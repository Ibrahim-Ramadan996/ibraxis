import test from 'node:test';
import assert from 'node:assert/strict';
import { previewTextInput } from '../app/ai-kit/src/index.mjs';
import { proposeRecords } from '../app/ai-kit/src/proposal-engine.mjs';

const cvExcerpt = [
  'EDUCATION',
  'Bachelor of Science in Computer Science — Example University, Sample City',
  'September 2020 – June 2024 | Focus: Data Analysis and Machine Learning',
  'Relevant Coursework: Data Structures, Algorithms, Database Management, Machine Learning',
  'PROJECTS',
  'Monthly Metric Dashboard',
  'Built sample charts to summarize metrics in a fictional dataset.',
  'Analytics Practice Portfolio',
  'Used Python and SQL to clean a synthetic dataset.',
].join('\n');

test('CV education stops at PROJECTS and keeps complete bachelor degree', async () => {
  const result = await previewTextInput({ text: cvExcerpt });
  assert.equal(result.mode, 'preview_only');
  assert.equal(result.writesPerformed, 0);
  assert.equal(result.proposals.length, 1);
  const education = result.proposals[0];
  assert.equal(education.category, 'education');
  assert.equal(education.fields.institution, 'Example University');
  assert.equal(education.fields.degree, 'Bachelor of Science in Computer Science');
  assert.deepEqual(education.fields.years, [2020, 2024]);
  assert.ok(!education.fields.originalText.includes('PROJECTS'));
  assert.ok(!education.fields.originalText.includes('Monthly Metric Dashboard'));
  assert.deepEqual(education.evidence.map(e => e.location.line), [2, 3, 4]);
  assert.ok(result.unclassified.some(e => e.quote === 'PROJECTS'));
  assert.ok(result.unclassified.some(e => e.quote === 'Monthly Metric Dashboard'));
  assert.ok(result.unclassified.some(e => e.quote.startsWith('Used Python')));
});

test('unsupported CV section cannot produce fabricated education or career drafts', async () => {
  const result = await previewTextInput({ text: [
    'PERSONAL PROJECTS',
    'Example University data dashboard',
    'Worked as intern on a university mock dataset',
    'PROFILE',
    'Bachelor of Science practice tasks',
  ].join('\n') });
  assert.equal(result.proposals.length, 0);
  assert.equal(result.unclassified.length, 5);
});

test('a supported heading after projects restores accurate CV grouping', async () => {
  const result = await previewTextInput({ text: [
    'EDUCATION',
    'Bachelor of Science in Computer Science — Example University',
    'PROJECTS',
    'Monthly Metric Dashboard',
    'SKILLS',
    'Python, SQL',
  ].join('\n') });
  assert.deepEqual(result.proposals.map(p => p.category), ['education', 'skills', 'skills']);
  assert.deepEqual(result.proposals.filter(p => p.category === 'skills').map(p => p.fields.name), ['Python', 'SQL']);
  assert.equal(result.proposals[0].fields.degree, 'Bachelor of Science in Computer Science');
});

test('PDF source page and line provenance is retained for separated sections', () => {
  const lines = cvExcerpt.split('\n');
  const result = proposeRecords({
    source: { kind: 'file', filename: 'CV.pdf', sha256: 'source-hash' },
    segments: lines.map((text, index) => ({ text, location: { page: 1, line: index + 20 } })),
    warnings: [],
  });
  assert.deepEqual(result.proposals[0].evidence.map(e => e.location.line), [21, 22, 23]);
  assert.equal(result.proposals[0].evidence[0].source, 'CV.pdf');
  assert.equal(result.proposals[0].evidence[0].sourceHash, 'source-hash');
  assert.equal(result.writesPerformed, 0);
});
