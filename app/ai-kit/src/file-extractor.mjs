/**
 * IBRAXIS — local-only, read-only file extraction.
 * No network calls, database writes, or uploads to third parties.
 * Optional third-party parsers are resolved only for the corresponding file type.
 */
import { extname } from 'node:path';
import { sha256, safeFilename, checkOfficeZip } from './safety.mjs';
import { extractDocxLite, extractXlsxLite } from './office-lite.mjs';

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT_CHARS = 100_000;
const MAX_PDF_PAGES = 30;
const MAX_SHEETS = 12;
const MAX_ROWS_PER_SHEET = 300;
const MAX_CELLS_PER_ROW = 30;
const ACCEPTED = new Set(['.txt', '.md', '.csv', '.tsv', '.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg']);
const segmentCharCounts = new WeakMap();

export class IngestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IngestError';
    this.code = code;
  }
}

function requireBytes(bytes, filename) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new IngestError('BAD_CONTENT', 'File content must be a Buffer or Uint8Array');
  }
  const content = Buffer.from(bytes);
  if (content.byteLength === 0) throw new IngestError('EMPTY_FILE', 'File is empty');
  if (content.byteLength > MAX_FILE_BYTES) throw new IngestError('FILE_TOO_LARGE', 'File exceeds the 4 MB limit');
  const safeName = safeFilename(filename);
  const type = extname(safeName).toLowerCase();
  if (!ACCEPTED.has(type)) {
    throw new IngestError('UNSUPPORTED_FILE', `Unsupported file type ${type || '(none)'}.`);
  }
  if (type === '.pdf' && !content.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new IngestError('FILE_SIGNATURE', 'Invalid PDF file signature');
  }
  if (type === '.docx' || type === '.xlsx') checkOfficeZip(content, type);
  if (type === '.png' && !content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    throw new IngestError('FILE_SIGNATURE', 'Invalid PNG file signature');
  }
  if (['.jpg', '.jpeg'].includes(type) && !(content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff)) {
    throw new IngestError('FILE_SIGNATURE', 'Invalid JPEG file signature');
  }
  if (['.txt', '.md', '.csv', '.tsv'].includes(type) && content.includes(0)) {
    throw new IngestError('BINARY_TEXT', 'Text file appears to contain binary data');
  }
  return { content, type, safeName };
}

function pushSegment(segments, text, location, warnings) {
  if (!text || !text.trim()) return;
  const used = segmentCharCounts.get(segments) ?? 0;
  if (used >= MAX_TEXT_CHARS) {
    if (!warnings.includes('تم الوصول للحد الأقصى للنص المستخرج؛ راجع الملف الأصلي.')) {
      warnings.push('تم الوصول للحد الأقصى للنص المستخرج؛ راجع الملف الأصلي.');
    }
    return;
  }
  const segmentText = text.slice(0, MAX_TEXT_CHARS - used).trim();
  segments.push({ text: segmentText, location });
  segmentCharCounts.set(segments, used + segmentText.length);
}

function decodeText(content) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(content).replace(/^\uFEFF/, ''); }
  catch { throw new IngestError('INVALID_TEXT_ENCODING', 'Text must be valid UTF-8'); }
}

function csvRows(content, delimiter) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
      if (rows.length >= MAX_ROWS_PER_SHEET) break;
    } else field += ch;
  }
  if (quoted) throw new IngestError('BAD_CSV', 'Unterminated quoted CSV field');
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Convert PDF text items into traceable lines without merging an entire CV page.
 * pdfjs may mark lines with hasEOL, or change their vertical text coordinate.
 */
export function pdfTextLines(items = []) {
  const lines = [];
  let line = '', prevY = null;
  const flush = () => {
    if (line.trim()) lines.push(line.trim());
    line = '';
  };
  for (const item of items) {
    if (!item || typeof item.str !== 'string') continue;
    const raw = item.str.replace(/\0/g, '').trim();
    const y = Array.isArray(item.transform) && Number.isFinite(item.transform[5])
      ? item.transform[5] : null;
    if (raw && line && y !== null && prevY !== null && Math.abs(y - prevY) > 2) flush();
    if (raw) {
      line += line ? ` ${raw}` : raw;
      if (y !== null) prevY = y;
    }
    if (item.hasEOL === true) { flush(); prevY = null; }
  }
  flush();
  return lines;
}

export function pdfReadError(error) {
  const name = String(error?.name ?? '');
  const detail = String(error?.message ?? ''); // Never returned to caller or logged.
  if (/password/i.test(name) || /password|encrypted/i.test(detail)) {
    return new IngestError('PDF_PASSWORD_PROTECTED',
      'ملف PDF محمي بكلمة مرور. صدّر نسخة غير محمية ثم جرّب تاني.');
  }
  if (/InvalidPDF|FormatError|MissingPDF/i.test(name) || /invalid pdf|corrupt|truncated/i.test(detail)) {
    return new IngestError('PDF_INVALID',
      'تعذرت قراءة بنية PDF. افتح الملف وأعد تصديره بصيغة PDF أو DOCX.');
  }
  if (/DOMMatrix|OffscreenCanvas|ImageData|canvas/i.test(detail)) {
    return new IngestError('PDF_RUNTIME_ERROR',
      'مكتبة PDF لا تعمل بالكامل في بيئة Node الحالية. راجع توافق Node وpdfjs-dist.');
  }
  return new IngestError('PDF_READ_FAILED',
    'تعذرت قراءة صفحات PDF. جرّب إعادة تصدير الملف أو استخدام DOCX.');
}

async function readPdf(content, segments, warnings, pdfjsLoader = () => import('pdfjs-dist/legacy/build/pdf.mjs')) {
  let pdfjs;
  try { pdfjs = await pdfjsLoader(); }
  catch {
    throw new IngestError('PDF_READER_UNAVAILABLE',
      'مكتبة قراءة PDF غير متاحة. نفّذ npm install وأعد تشغيل لوحة الإدارة.');
  }
  let task, pdf;
  let failure = null;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(content),
      isEvalSupported: false,
      enableXfa: false,
      useSystemFonts: true,
    });
    pdf = await task.promise;
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_PDF_PAGES); i++) {
      const page = await pdf.getPage(i);
      try {
        const result = await page.getTextContent();
        for (const [index, line] of pdfTextLines(result.items).entries()) {
          pushSegment(segments, line, { page: i, line: index + 1 }, warnings);
        }
      } finally { try { page.cleanup(); } catch { /* Cleanup must not hide the PDF error. */ } }
    }
    if (pdf.numPages > MAX_PDF_PAGES) warnings.push(`تم تحليل أول ${MAX_PDF_PAGES} صفحة فقط.`);
    if (!segments.length) warnings.push('الـPDF لا يحتوي على نص قابل للاستخراج؛ قد يكون ممسوحًا ضوئيًا ويحتاج OCR.');
  } catch (e) {
    failure = pdfReadError(e);
  } finally {
    try {
      if (pdf) await pdf.destroy();
      else if (task) await task.destroy();
    } catch {
      // Cleanup can fail after text has already been successfully extracted.
      // Attempt to stop the underlying loading task too; never discard valid
      // extracted text or mask an actual parsing error on cleanup failure.
      if (pdf && task) { try { await task.destroy(); } catch { /* best effort */ } }
      if (!failure) warnings.push(
        'تم استخراج نص PDF، لكن القارئ أبلغ عن مشكلة عند الإغلاق. راجع المعاينة وأعد تشغيل لوحة الإدارة إذا تكرر التحذير.');
    }
  }
  if (failure) throw failure;
}

async function readDocx(content, segments, warnings) {
  let mammoth;
  try { mammoth = await import('mammoth'); }
  catch {
    const result = extractDocxLite(content);
    result.paragraphs.forEach((text, i) => pushSegment(segments, text, { paragraph: i + 1 }, warnings));
    warnings.push(...result.warnings);
    return;
  }
  const extracted = await mammoth.extractRawText({ buffer: content });
  const paragraphs = (extracted.value || '').split(/\n+/);
  paragraphs.forEach((paragraph, i) => pushSegment(segments, paragraph, { paragraph: i + 1 }, warnings));
  if (extracted.messages?.length) warnings.push('بعض عناصر DOCX قد لا تُستخرج بالكامل؛ راجع الملف الأصلي.');
}

async function readXlsx(content, segments, warnings) {
  let mod;
  try { mod = await import('exceljs'); }
  catch {
    const result = extractXlsxLite(content);
    for (const sheet of result.sheets) {
      for (const row of sheet.rows) pushSegment(segments, row.text, { sheet: sheet.name, row: row.row }, warnings);
    }
    warnings.push(...result.warnings);
    return;
  }
  const ExcelJS = mod.default ?? mod;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(content);
  for (const sheet of workbook.worksheets.slice(0, MAX_SHEETS)) {
    let rowCount = 0;
    sheet.eachRow((row, number) => {
      if (++rowCount > MAX_ROWS_PER_SHEET) return;
      const values = [];
      for (let col = 1; col <= Math.min(row.cellCount, MAX_CELLS_PER_ROW); col++) {
        const cell = row.getCell(col);
        // Never calculate formulas or follow links; only surface text or cached results.
        const value = cell.value;
        let printable = '';
        if (value && typeof value === 'object') {
          if ('formula' in value || 'sharedFormula' in value) printable = value.result == null ? '' : String(value.result);
          else if ('text' in value) printable = String(value.text);
          else if (value instanceof Date) printable = value.toISOString().slice(0, 10);
          else if ('richText' in value) printable = value.richText.map(part => part.text ?? '').join('');
        } else printable = value == null ? '' : String(value);
        if (printable.trim()) values.push(`${cell.address}: ${printable}`);
      }
      pushSegment(segments, values.join(' | '), { sheet: sheet.name, row: number }, warnings);
    });
    if (sheet.rowCount > MAX_ROWS_PER_SHEET) warnings.push(`تم تحليل أول ${MAX_ROWS_PER_SHEET} صف من ورقة ${sheet.name}.`);
  }
  if (workbook.worksheets.length > MAX_SHEETS) warnings.push('تم تجاوز بعض أوراق Excel بسبب حدود الأمان.');
}

export async function extractFile({ filename, bytes, localOcr = null, localPdfLoader = null }) {
  const { content, type, safeName } = requireBytes(bytes, filename);
  const segments = [], warnings = [];
  switch (type) {
    case '.txt':
    case '.md': {
      decodeText(content).split(/\r?\n/)
        .forEach((line, index) => pushSegment(segments, line, { line: index + 1 }, warnings));
      break;
    }
    case '.csv':
    case '.tsv': {
      const rows = csvRows(decodeText(content), type === '.tsv' ? '\t' : ',');
      rows.forEach((row, index) => pushSegment(segments, row.slice(0, MAX_CELLS_PER_ROW).join(' | '), { row: index + 1 }, warnings));
      break;
    }
    case '.png':
    case '.jpg':
    case '.jpeg': {
      if (typeof localOcr !== 'function') {
        throw new IngestError('OCR_NOT_CONFIGURED', 'Image needs an explicitly configured local OCR provider');
      }
      const ocrText = await localOcr({ bytes: content, filename: safeName, languages: ['ara', 'eng'] });
      if (typeof ocrText !== 'string') throw new IngestError('OCR_BAD_RESPONSE', 'OCR provider must return text');
      pushSegment(segments, ocrText, { image: 1 }, warnings);
      warnings.push('النص المستخرج من صورة يحتاج مراجعة بصرية قبل الاعتماد.');
      break;
    }
    case '.pdf': await readPdf(content, segments, warnings, localPdfLoader ?? undefined); break;
    case '.docx': await readDocx(content, segments, warnings); break;
    case '.xlsx': await readXlsx(content, segments, warnings); break;
  }
  return {
    source: { kind: 'file', filename: safeName, extension: type, sizeBytes: content.byteLength, sha256: sha256(content) },
    segments,
    warnings,
    text: segments.map(item => item.text).join('\n').slice(0, MAX_TEXT_CHARS),
  };
}

export function extractPlainText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new IngestError('EMPTY_TEXT', 'Enter text first');
  if (text.length > MAX_TEXT_CHARS) throw new IngestError('TEXT_TOO_LARGE', 'Text exceeds the preview limit');
  const segments = [];
  const warnings = [];
  text.split(/\r?\n/).forEach((line, index) => pushSegment(segments, line, { line: index + 1 }, warnings));
  return { source: { kind: 'text', sha256: sha256(Buffer.from(text)) }, segments, warnings, text };
}
