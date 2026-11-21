/**
 * Lightweight LOCAL fallback for conventional, text-focused OOXML files.
 * No network, shell commands, macros, formula evaluation, or external XML entities.
 * It deliberately supports only a documented safe subset of DOCX and XLSX.
 */
import { inflateRawSync } from 'node:zlib';
import { checkOfficeZip } from './safety.mjs';

const MAX_XML = 12 * 1024 * 1024;
const MAX_SHEETS = 12;
const MAX_ROWS = 300;
const MAX_COLS = 30;

function unsupported(reason) {
  const error = new Error(reason);
  error.name = 'IngestError';
  error.code = 'UNSUPPORTED_OFFICE_CONTENT';
  return error;
}
function readArchiveParts(bytes, extension, targets) {
  checkOfficeZip(bytes, extension);
  const buffer = Buffer.from(bytes);
  const eocdMagic = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === eocdMagic && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { eocd = i; break; }
  }
  if (eocd < 0) throw unsupported('ZIP central directory missing');
  let at = buffer.readUInt32LE(eocd + 16);
  const count = buffer.readUInt16LE(eocd + 10);
  const extracted = new Map();
  const targetSet = new Set(targets);
  for (let i = 0; i < count; i++) {
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const packed = buffer.readUInt32LE(at + 20);
    const size = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    if (targetSet.has(name)) {
      if (size > MAX_XML || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) {
        throw unsupported('Invalid or oversized XML part');
      }
      const localFlags = buffer.readUInt16LE(local + 6);
      const localMethod = buffer.readUInt16LE(local + 8);
      if ((flags & 1) || flags !== localFlags || localMethod !== method) throw unsupported('Inconsistent archive metadata');
      const dataAt = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      if (dataAt + packed > buffer.length || dataAt + packed > at) throw unsupported('Archive entry boundary error');
      const data = buffer.subarray(dataAt, dataAt + packed);
      let output;
      try {
        output = method === 0 ? data : inflateRawSync(data, { maxOutputLength: MAX_XML + 1 });
      } catch {
        throw unsupported('Cannot decompress Office document part safely');
      }
      if (output.length !== size || size > MAX_XML) throw unsupported('Office part size mismatch');
      const xml = new TextDecoder('utf-8', { fatal: true }).decode(output);
      if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw unsupported('XML external entities are not accepted');
      extracted.set(name, xml);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  return extracted;
}

function xmlText(s) {
  return String(s).replace(/&(?:#(x[0-9a-fA-F]+|[0-9]+)|amp|lt|gt|quot|apos);/g, (entity, number) => {
    if (number) {
      const hex = /^x/i.test(number);
      const cp = Number.parseInt(hex ? number.slice(1) : number, hex ? 16 : 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)
        ? String.fromCodePoint(cp) : '\ufffd';
    }
    return { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[entity] ?? entity;
  });
}
function attrs(tag) {
  const result = Object.create(null);
  for (const match of tag.matchAll(/\b([\w:-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1]] = xmlText(match[2]);
  return result;
}
function collectTexts(xml, name) {
  const texts = [];
  const tag = name.replaceAll(':', '\\:');
  const re = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g');
  for (const match of xml.matchAll(re)) texts.push(xmlText(match[1]));
  return texts;
}

export function extractDocxLite(bytes) {
  const xml = readArchiveParts(bytes, '.docx', ['word/document.xml']).get('word/document.xml');
  if (!xml) throw unsupported('Word document body missing');
  const paragraphs = [];
  const re = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g;
  for (const match of xml.matchAll(re)) {
    const text = collectTexts(match[1], 'w:t').join('').trim();
    if (text) paragraphs.push(text);
    if (paragraphs.length >= 1000) break;
  }
  return { paragraphs, warnings: ['تمت قراءة Word بالوضع المحلي المبسط؛ قد تحتاج الجداول والعناصر المعقدة للمراجعة.'] };
}

export function extractXlsxLite(bytes) {
  // Request at most the allowed number of worksheets; avoids decompression of external payloads.
  const targets = ['xl/workbook.xml', 'xl/sharedStrings.xml', 'xl/_rels/workbook.xml.rels'];
  for (let i = 1; i <= MAX_SHEETS; i++) targets.push(`xl/worksheets/sheet${i}.xml`);
  const parts = readArchiveParts(bytes, '.xlsx', targets);
  const stringsXml = parts.get('xl/sharedStrings.xml') ?? '';
  const shared = [];
  for (const match of stringsXml.matchAll(/<si(?:\s+[^>]*)?>([\s\S]*?)<\/si>/g)) {
    shared.push(collectTexts(match[1], 't').join(''));
    if (shared.length >= 100000) break;
  }
  const names = new Map();
  const book = parts.get('xl/workbook.xml') || '';
  for (const [i, tag] of [...book.matchAll(/<sheet\s+[^>]*\/?\s*>/g)].entries()) {
    names.set(i + 1, attrs(tag[0]).name ?? `Sheet ${i + 1}`);
  }
  const sheets = [];
  for (let i = 1; i <= MAX_SHEETS; i++) {
    const xml = parts.get(`xl/worksheets/sheet${i}.xml`);
    if (!xml) continue;
    const rows = [];
    for (const rowMatch of xml.matchAll(/<row(?:\s+[^>]*)?>([\s\S]*?)<\/row>/g)) {
      if (rows.length >= MAX_ROWS) break;
      const rowTag = rowMatch[0].match(/^<row[^>]*>/)?.[0] ?? '';
      const rowNum = Number(attrs(rowTag).r) || rows.length + 1;
      const cells = [];
      for (const match of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        if (cells.length >= MAX_COLS) break;
        const a = attrs(match[1]);
        const body = match[2] ?? '';
        const type = a.t || '';
        const scalar = body.match(/<v(?:\s+[^>]*)?>([\s\S]*?)<\/v>/)?.[1] ?? '';
        const value = type === 's' ? shared[Number(scalar)] ?? ''
          : type === 'inlineStr' ? collectTexts(body, 't').join('') : xmlText(scalar);
        if (value.trim()) cells.push(`${a.r ?? `row ${rowNum}`}: ${value.slice(0, 1000)}`);
      }
      if (cells.length) rows.push({ row: rowNum, text: cells.join(' | ') });
    }
    sheets.push({ name: names.get(i) ?? `Sheet ${i}`, rows });
  }
  return {
    sheets,
    warnings: ['تمت قراءة Excel بالوضع المحلي المبسط: نتائج الصيغ المخزنة فقط، وقد لا تُفسر التواريخ والتنسيقات المعقدة.'],
  };
}
