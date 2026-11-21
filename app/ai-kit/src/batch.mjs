import { extractFile, extractPlainText, IngestError } from './file-extractor.mjs';
import { proposeRecords, normalizeMatch } from './proposal-engine.mjs';

const MAX_BATCH_ITEMS = 8;
const MAX_BATCH_BYTES = 16 * 1024 * 1024;

function fingerprint(p) {
  const f = p.fields;
  const key = p.category === 'education' ? `${f.institution}:${f.degree}`
    : p.category === 'career' ? `${f.organization}:${f.position}`
      : p.category === 'skills' ? f.name : f.name;
  return `${p.category}:${normalizeMatch(key)}`;
}

/** Multiple text blocks/files, one read-only, deduplicated batch preview. */
export async function previewBatchInputs({ items, existingRecords = {}, localOcr = null } = {}) {
  if (!Array.isArray(items) || !items.length || items.length > MAX_BATCH_ITEMS) {
    throw new IngestError('BAD_BATCH', `Provide 1–${MAX_BATCH_ITEMS} text or file inputs`);
  }
  let totalBytes = 0;
  for (const item of items) {
    if (item?.type === 'text') {
      totalBytes += Buffer.byteLength(String(item.text ?? ''));
    } else if (item?.type === 'file') {
      if (!(Buffer.isBuffer(item.bytes) || item.bytes instanceof Uint8Array)) {
        throw new IngestError('BAD_CONTENT', 'Each file must contain a byte buffer');
      }
      totalBytes += item.bytes.byteLength;
    } else {
      throw new IngestError('BAD_BATCH', 'Only text or file input types are accepted');
    }
    if (totalBytes > MAX_BATCH_BYTES) throw new IngestError('BATCH_TOO_LARGE', 'Batch exceeds 16 MB');
  }
  const results = [];
  const combined = [], duplicates = [], unclassified = [], warnings = [];
  const dedup = new Set();
  for (const [index, item] of items.entries()) {
    const extracted = item.type === 'text'
      ? extractPlainText(item.text)
      : await extractFile({ filename: item.filename, bytes: item.bytes, localOcr });
    const result = proposeRecords(extracted, { existingRecords });
    results.push({ index, kind: item.type, source: result.source, proposalCount: result.proposals.length });
    for (const candidate of result.proposals) {
      const key = fingerprint(candidate);
      if (dedup.has(key)) {
        duplicates.push({ category: candidate.category, evidence: candidate.evidence, reason: 'duplicate_across_inputs' });
      } else {
        dedup.add(key);
        combined.push(candidate);
      }
    }
    duplicates.push(...result.skippedDuplicates);
    unclassified.push(...result.unclassified);
    warnings.push(...result.warnings);
  }
  return {
    version: 2, mode: 'preview_only', source: { kind: 'batch', count: results.length },
    inputs: results, proposals: combined.slice(0, 100),
    skippedDuplicates: duplicates, unclassified: unclassified.slice(0, 100),
    warnings: [...new Set([...warnings, ...(combined.length > 100 ? ['تم اقتطاع المقترحات إلى 100.'] : [])])],
    requiresOwnerApproval: true, writesPerformed: 0,
  };
}
