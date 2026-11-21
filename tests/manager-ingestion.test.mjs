import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  previewTextInput, previewFileInput, previewBatchInputs, prepareReviewSelection,
  previewProjectPlan, reviewContentQuality,
} from '../app/ai-kit/src/index.mjs';
import { extractFile } from '../app/ai-kit/src/file-extractor.mjs';
import { checkOfficeZip, safeFilename } from '../app/ai-kit/src/safety.mjs';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = file => readFile(join(fixtures, file));

test('Multiline Arabic CV section becomes one education proposal with locations', async () => {
  const result = await previewTextInput({ text: 'التعليم\nجامعة الفيوم\nبكالوريوس علوم الحاسب\n2021 - 2025' });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].fields.institution, 'جامعة الفيوم');
  assert.equal(result.proposals[0].fields.degree, 'بكالوريوس علوم الحاسب');
  assert.deepEqual(result.proposals[0].fields.years, [2021, 2025]);
  assert.deepEqual(result.proposals[0].evidence.map(x => x.location.line), [2, 3, 4]);
});

test('Multiline English CV education extracted with traceable evidence', async () => {
  const result = await previewTextInput({ text: "Education\nFayoum University\nBachelor's Degree in Computer Science\n2021 - 2025" });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].fields.institution, 'Fayoum University');
  assert.equal(result.proposals[0].fields.degree, "Bachelor's Degree in Computer Science");
  assert.equal(result.proposals[0].evidence.length, 3);
});

test('Different degrees from the same university must not be combined or dropped', async () => {
  const result = await previewTextInput({ text: 'التعليم\nجامعة الفيوم، بكالوريوس علوم الحاسب\nجامعة الفيوم، ماجستير نظم المعلومات' });
  assert.equal(result.proposals.length, 2);
  assert.ok(result.proposals[1].needsVerification.includes('degree'));
});

test('Category changes prevent accidental merging of separate facts', async () => {
  const result = await previewTextInput({ text: 'حصلت على شهادة تحليل البيانات\nمهاراتي Python و SQL' });
  assert.deepEqual(result.proposals.map(x => x.category), ['certifications', 'skills', 'skills']);
});

test('Proof includes SHA-256 of original input and noneditable review status', async () => {
  const result = await previewTextInput({ text: 'مهاراتي Python' });
  assert.match(result.source.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.proposals[0].evidence[0].sourceHash, result.source.sha256);
  assert.match(result.proposals[0].id, /^[0-9a-f]{20}$/);
  assert.equal(result.proposals[0].status, 'review_required');
});

test('Windows file paths are reduced to a safe filename', () => {
  assert.equal(safeFilename('C:\\Users\\Downloads\\certificate.pdf'), 'certificate.pdf');
  assert.equal(safeFilename('folder/other/file.csv'), 'file.csv');
});

test('Valid simple Office ZIP preflight passes for Word and Excel structure', async () => {
  assert.ok(checkOfficeZip(await fixture('minimal.docx'), '.docx').entries >= 2);
  assert.ok(checkOfficeZip(await fixture('minimal.xlsx'), '.xlsx').entries >= 2);
});

test('Reject traversal and compression abuse before invoking optional parser', async () => {
  const evil = await fixture('traversal.docx');
  const bomb = await fixture('high-ratio.docx');
  await assert.rejects(() => extractFile({ filename: 'evil.docx', bytes: evil }), { code: 'UNSAFE_OFFICE_ZIP' });
  await assert.rejects(() => extractFile({ filename: 'evil.docx', bytes: bomb }), { code: 'ZIP_RESOURCE_LIMIT' });
});

test('Reject renamed or corrupted Office ZIP archive', async () => {
  const buf = await fixture('minimal.docx');
  await assert.rejects(() => extractFile({ filename: 'not-really.xlsx', bytes: buf }), { code: 'BAD_OFFICE_ZIP' });
  await assert.rejects(() => extractFile({ filename: 'bad.docx', bytes: buf.subarray(0, buf.length - 14) }), { code: 'BAD_OFFICE_ZIP' });
});

test('Batch combines file and text, keeps provenance and avoids cross-input duplicate', async () => {
  const result = await previewBatchInputs({ items: [
    { type: 'text', text: 'المهارات: Python و SQL' },
    { type: 'file', filename: 'more.txt', bytes: Buffer.from('Skills: Python and Excel') },
  ] });
  assert.equal(result.writesPerformed, 0);
  assert.deepEqual(result.proposals.map(x => x.fields.name), ['Python', 'SQL', 'Excel']);
  assert.equal(result.skippedDuplicates.filter(x => x.reason === 'duplicate_across_inputs').length, 1);
  assert.equal(result.inputs.length, 2);
});

test('Batch fails closed on unapproved inputs and overly large collections', async () => {
  await assert.rejects(() => previewBatchInputs({ items: [{ type: 'url', url: 'https://example.com/' }] }), { code: 'BAD_BATCH' });
  await assert.rejects(() => previewBatchInputs({ items: Array(9).fill({ type: 'text', text: 'x' }) }), { code: 'BAD_BATCH' });
  await assert.rejects(() => previewBatchInputs({ items: [{ type: 'file', filename: 'x.txt', bytes: Buffer.alloc(16 * 1024 * 1024 + 1) }] }), { code: 'BATCH_TOO_LARGE' });
});

test('Review selection whitelists trusted IDs and never approves any change', async () => {
  const preview = await previewTextInput({ text: 'مهاراتي Python و SQL' });
  const result = prepareReviewSelection(preview, [preview.proposals[1].id]);
  assert.equal(result.mode, 'prepare_review_only');
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].fields.name, 'SQL');
  assert.equal(result.requiresOwnerApproval, true);
  assert.equal(result.writesPerformed, 0);
});

test('Review selection refuses tampered IDs, duplicate selection and publishing operation', async () => {
  const preview = await previewTextInput({ text: 'مهاراتي Python' });
  assert.throws(() => prepareReviewSelection(preview, ['a'.repeat(20)]), /unknown/i);
  assert.throws(() => prepareReviewSelection(preview, [preview.proposals[0].id, preview.proposals[0].id]), /duplicate/i);
  preview.proposals[0].operation = 'publish';
  assert.throws(() => prepareReviewSelection(preview, [preview.proposals[0].id]), /Unsafe/);
});

test('Project planning remains a preview and does not fabricate completed work', () => {
  const result = previewProjectPlan({ title: 'Sales Analysis', description: 'تحليل بيانات المبيعات', technologies: ['Python', 'SQL'] });
  assert.equal(result.mode, 'project_plan_preview');
  assert.equal(result.project.status, 'not_created');
  assert.equal(result.writesPerformed, 0);
  assert.equal(result.phases.every(p => p.status === 'suggested'), true);
  assert.equal(result.phases.flatMap(p => p.tasks).every(task => task.status === 'suggested'), true);
});

test('Project planner rejects imaginary inputs and input flood', () => {
  assert.throws(() => previewProjectPlan({ title: '', description: 'abc' }), TypeError);
  assert.throws(() => previewProjectPlan({ title: 'A', description: 'x'.repeat(5001) }), TypeError);
});

test('Read-only content review marks unknown claims as needing confirmation', () => {
  const result = reviewContentQuality({
    skills: [{ name: 'Python', titleEn: 'Python' }, { name: 'PYTHON' }],
    certifications: [{ name: 'Data certificate', issuer: null }], projects: [],
    seo: { en: { title: 'a'.repeat(80) } },
  });
  assert.equal(result.mode, 'quality_review_only');
  assert.equal(result.writesPerformed, 0);
  assert.ok(result.issues.some(x => x.code === 'POSSIBLE_DUPLICATE'));
  assert.ok(result.issues.some(x => x.code === 'CERT_ISSUER_MISSING'));
  assert.ok(result.issues.some(x => x.code === 'LONG_TITLE_EN'));
});

test('DOCX fallback extracts genuine OOXML paragraphs without installing a third-party module', async () => {
  const result = await previewFileInput({ filename: 'sample.docx', bytes: await fixture('sample.docx') });
  const edu = result.proposals.find(x => x.category === 'education');
  assert.ok(edu);
  assert.equal(edu.fields.institution, 'جامعة الفيوم');
  assert.equal(edu.fields.degree, 'بكالوريوس علوم الحاسب');
  assert.deepEqual(edu.evidence.map(e => e.location.paragraph), [2, 3]);
});

test('XLSX fallback reads both shared and inline strings without evaluating formulas', async () => {
  const result = await extractFile({ filename: 'sample.xlsx', bytes: await fixture('sample.xlsx') });
  assert.equal(result.segments[0].location.sheet, 'Skills');
  assert.match(result.segments[0].text, /المهارات/);
  assert.match(result.segments[1].text, /Python/);
  assert.match(result.segments[1].text, /SQL/);
});

test('Integration bridge enforces owner + CSRF before any database read', async () => {
  const { createIngestionBridge } = await import('../app/ai-kit/integration/manager-bridge.mjs');
  let dbReads = 0;
  const bridge = createIngestionBridge({
    assertOwner: c => { if (!c?.owner) throw new Error('owner required'); },
    assertCsrf: c => { if (!c?.csrf) throw new Error('csrf required'); },
    readExistingRecords: () => { dbReads++; return { skills: [] }; },
    stageReviewPlan: () => { throw new Error('should not stage'); },
  });
  await assert.rejects(() => bridge.preview({ owner: false, csrf: true }, { type: 'text', text: 'مهارات Python' }), /owner/);
  await assert.rejects(() => bridge.preview({ owner: true, csrf: false }, { type: 'text', text: 'مهارات Python' }), /csrf/);
  assert.equal(dbReads, 0);
});

test('Bridge reruns extraction with updated records before creating any plan', async () => {
  const { createIngestionBridge } = await import('../app/ai-kit/integration/manager-bridge.mjs');
  let latestRecords = [];
  let stages = 0;
  const bridge = createIngestionBridge({
    assertOwner: () => {}, assertCsrf: () => {},
    readExistingRecords: () => ({ skills: latestRecords }),
    stageReviewPlan: async selection => { stages++; return { pending: true, names: selection.proposals.map(p => p.fields.name) }; },
  });
  const input = { type: 'text', text: 'مهاراتي Python و SQL' };
  const preview = await bridge.preview({}, input);
  latestRecords = [{ name: 'Python' }]; // A concurrent update after first preview.
  await assert.rejects(() => bridge.prepare({}, { input, selectedIds: [preview.proposals[0].id] }), /unknown/);
  assert.equal(stages, 0);
  const next = await bridge.prepare({}, { input, selectedIds: [preview.proposals[1].id] });
  assert.equal(next.mode, 'awaiting_owner_approval');
  assert.equal(next.writesPerformed, 0);
  assert.deepEqual(next.plan.names, ['SQL']);
});

test('Bridge never stages an empty review selection', async () => {
  const { createIngestionBridge } = await import('../app/ai-kit/integration/manager-bridge.mjs');
  const bridge = createIngestionBridge({
    assertOwner: () => {}, assertCsrf: () => {}, readExistingRecords: () => ({}),
    stageReviewPlan: () => { throw new Error('MUST NOT BE REACHED'); },
  });
  await assert.rejects(() => bridge.prepare({}, { input: { type: 'text', text: 'مهارات Python' }, selectedIds: [] }), /At least/);
});

test('Spreadsheet Skills sheet recognizes entries on separate rows', async () => {
  const result = await previewFileInput({ filename: 'sample.xlsx', bytes: await fixture('sample.xlsx') });
  assert.deepEqual(result.proposals.map(p => p.fields.name), ['Python', 'SQL']);
  assert.deepEqual(result.proposals.map(p => p.evidence[0].location.row), [2, 2]);
});

test('Invalid UTF-8 is rejected instead of silently inserting replacement characters', async () => {
  await assert.rejects(() => previewFileInput({ filename: 'bad.txt', bytes: Buffer.from([0xff, 0xfe, 0xfd]) }), { code: 'INVALID_TEXT_ENCODING' });
});
