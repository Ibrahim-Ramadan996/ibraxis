import test from 'node:test';
import assert from 'node:assert/strict';
import { previewTextInput, previewFileInput, IngestError, enrichBilingualPreview } from '../app/ai-kit/src/index.mjs';
import { extractFile, MAX_FILE_BYTES } from '../app/ai-kit/src/file-extractor.mjs';
import { normalizeMatch } from '../app/ai-kit/src/proposal-engine.mjs';

test('Arabic natural text generates education proposal, not a write', async () => {
  const result = await previewTextInput({ text: 'اتخرجت من جامعة الفيوم سنة 2025، بكالوريوس علوم حاسب' });
  assert.equal(result.mode, 'preview_only');
  assert.equal(result.writesPerformed, 0);
  assert.equal(result.requiresOwnerApproval, true);
  assert.equal(result.proposals[0].category, 'education');
  assert.equal(result.proposals[0].fields.institution, 'جامعة الفيوم');
  assert.deepEqual(result.proposals[0].fields.years, [2025]);
  assert.equal(result.proposals[0].status, 'review_required');
});

test('Do not invent bilingual translation or issuing institution', async () => {
  const result = await previewTextInput({ text: 'حصلت على شهادة تحليل البيانات' });
  const cert = result.proposals.find(p => p.category === 'certifications');
  assert.ok(cert);
  assert.equal(cert.fields.issuer, null);
  assert.ok(cert.needsVerification.includes('issuer'));
  assert.equal(cert.fields.titleEn, undefined);
});

test('Pre-existing skills are not proposed again', async () => {
  const result = await previewTextInput({
    text: 'مهاراتي Python و SQL و Power BI',
    existingRecords: { skills: [{ titleEn: 'python' }, { name: 'SQL' }] },
  });
  assert.deepEqual(result.proposals.map(p => p.fields.name), ['Power BI']);
  assert.equal(result.skippedDuplicates.length, 2);
});

test('Duplicate normalized Arabic names match', () => {
  assert.equal(normalizeMatch('جامعة الْفيوم'), normalizeMatch('جامعه الفيوم'));
});

test('CSV extraction supports quotations and source rows', async () => {
  const result = await extractFile({
    filename: 'education.csv',
    bytes: Buffer.from('type,description\neducation,"بكالوريوس, جامعة الفيوم"\n', 'utf8'),
  });
  assert.equal(result.source.filename, 'education.csv');
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments[1].location.row, 2);
  assert.ok(result.segments[1].text.includes('بكالوريوس, جامعة الفيوم'));
});

test('Plain text file flows into the same proposal engine', async () => {
  const result = await previewFileInput({ filename: 'profile.txt', bytes: Buffer.from('مهارات: Python و SQL') });
  assert.deepEqual(result.proposals.map(p => p.fields.name), ['Python', 'SQL']);
  assert.equal(result.proposals[0].evidence[0].source, 'profile.txt');
  assert.equal(result.proposals[0].evidence[0].location.line, 1);
});

test('Reject executable file uploads and image with no OCR configured', async () => {
  await assert.rejects(() => previewFileInput({ filename: 'evil.js', bytes: Buffer.from('run') }), { code: 'UNSUPPORTED_FILE' });
  await assert.rejects(() => previewFileInput({ filename: 'card.png', bytes: Buffer.from([137,80,78,71,13,10,26,10,1,2]) }), { code: 'OCR_NOT_CONFIGURED' });
});

test('Reject forged PDF, forged XLSX and null bytes in text', async () => {
  await assert.rejects(() => previewFileInput({ filename: 'fake.pdf', bytes: Buffer.from('not pdf') }), { code: 'FILE_SIGNATURE' });
  await assert.rejects(() => previewFileInput({ filename: 'fake.xlsx', bytes: Buffer.from('not a zip') }), { code: 'FILE_SIGNATURE' });
  await assert.rejects(() => previewFileInput({ filename: 'note.txt', bytes: Buffer.from([0, 1]) }), { code: 'BINARY_TEXT' });
});

test('Reject oversize files before invoking third-party parsers', async () => {
  await assert.rejects(() => previewFileInput({ filename: 'huge.txt', bytes: Buffer.alloc(MAX_FILE_BYTES + 1, 'x') }), { code: 'FILE_TOO_LARGE' });
});

test('Uncertain text remains unclassified and cannot create invented results', async () => {
  const result = await previewTextInput({ text: 'أنا بحب أتعلم حاجات جديدة' });
  assert.equal(result.proposals.length, 0);
  assert.equal(result.unclassified.length, 1);
});

test('No input must fail explicitly', async () => {
  await assert.rejects(() => previewTextInput({ text: '' }), IngestError);
});


test('Image OCR can be injected locally without transmitting image to a provider', async () => {
  let called = false;
  const result = await previewFileInput({
    filename: 'certificate.png', bytes: Buffer.from([137,80,78,71,13,10,26,10,1,2]),
    localOcr: async ({ languages }) => {
      called = true; assert.deepEqual(languages, ['ara', 'eng']);
      return 'حصلت على شهادة تحليل البيانات';
    },
  });
  assert.equal(called, true);
  assert.equal(result.proposals[0].category, 'certifications');
  assert.equal(result.proposals[0].evidence[0].location.image, 1);
});


test('Bilingual AI suggestions require explicit consent for external processing', async () => {
  const source = await previewTextInput({ text: 'اتخرجت من جامعة الفيوم سنة 2025، بكالوريوس علوم حاسب' });
  await assert.rejects(() => enrichBilingualPreview(source, {
    rewrite: async () => ({ ar: 'نص عربي', en: 'English copy' }), localOnly: false,
  }), /owner approval/i);
});

test('AI rewriting cannot change extracted facts or authorize saving', async () => {
  const source = await previewTextInput({ text: 'اتخرجت من جامعة الفيوم سنة 2025، بكالوريوس علوم حاسب' });
  const result = await enrichBilingualPreview(source, {
    localOnly: true,
    rewrite: async () => ({ ar: 'تخرجت من جامعة الفيوم.', en: 'Graduated from Fayoum University.', category: 'clients', operation: 'publish', institution: 'Imaginary Academy' }),
  });
  assert.equal(result.proposals[0].fields.institution, 'جامعة الفيوم');
  assert.equal(result.proposals[0].category, 'education');
  assert.equal(result.proposals[0].operation, 'propose_create_draft');
  assert.equal(result.proposals[0].suggestedCopy.en, 'Graduated from Fayoum University.');
  assert.equal(result.writesPerformed, 0);
  assert.equal(result.requiresOwnerApproval, true);
});


test('input source resolver sends a selected CV as file instead of empty text', async () => {
 const {resolveIngestionSource} = await import('../app/manager-input-panel.js');
 const pdf={name:'MyCV.pdf',size:20};
 assert.deepEqual(resolveIngestionSource({mode:'file',text:'',files:[pdf]}),{mode:'file',input:[pdf]});
 assert.deepEqual(resolveIngestionSource({mode:'text',text:'  ',files:[pdf]}),{mode:'file',input:[pdf]});
 assert.deepEqual(resolveIngestionSource({mode:'text',text:'جامعة الفيوم',files:[pdf]}),{mode:'text',input:'جامعة الفيوم'});
 assert.throws(()=>resolveIngestionSource({mode:'file',text:'',files:[]}),/اختار ملف/);
 assert.throws(()=>resolveIngestionSource({mode:'text',text:'',files:[]}),/اكتب معلومات/);
});

// Regression: PDF text often contains multiple visual lines on one page.
// Preserving lines improves CV section recognition without network or OCR.
test('PDF text items retain line breaks and ignore empty objects', async () => {
  const { pdfTextLines } = await import('../app/ai-kit/src/file-extractor.mjs');
  const lines = pdfTextLines([
    {str:'Education',transform:[1,0,0,1,10,100]},
    {str:'Fayoum University',transform:[1,0,0,1,10,80],hasEOL:true},
    null, {str:'Skills',transform:[1,0,0,1,10,60],hasEOL:true},
    {str:'Python',transform:[1,0,0,1,10,40]},
    {str:'SQL',transform:[1,0,0,1,20,40],hasEOL:true},
  ]);
  assert.deepEqual(lines,['Education','Fayoum University','Skills','Python SQL']);
});

test('PDF password and parser errors are diagnosed without reflecting file text', async () => {
  const { pdfReadError } = await import('../app/ai-kit/src/file-extractor.mjs');
  assert.equal(pdfReadError({name:'PasswordException',message:'secret'}).code,'PDF_PASSWORD_PROTECTED');
  assert.equal(pdfReadError({name:'InvalidPDFException',message:'secret'}).code,'PDF_INVALID');
  assert.equal(pdfReadError({name:'Error',message:'DOMMatrix is not defined'}).code,'PDF_RUNTIME_ERROR');
  assert.equal(pdfReadError({name:'Error',message:'some private data'}).code,'PDF_READ_FAILED');
  assert.ok(!pdfReadError({name:'Error',message:'some private data'}).message.includes('private data'));
});
