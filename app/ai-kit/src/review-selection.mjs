import { SUPPORTED_CATEGORIES } from './proposal-engine.mjs';

/**
 * Prepare an allowlisted transfer to EXISTING Manager review/approval logic.
 * IMPORTANT: The original preview MUST be regenerated/trusted on the server,
 * never read back from a client JSON body. Does not save or approve anything.
 */
export function prepareReviewSelection(trustedPreview, selectedIds) {
  if (!trustedPreview || trustedPreview.mode !== 'preview_only' || trustedPreview.writesPerformed !== 0 ||
      !Array.isArray(trustedPreview.proposals) || !Array.isArray(selectedIds) ||
      selectedIds.length > 100) throw new TypeError('Invalid trusted preview or selection');
  const ids = new Set();
  for (const id of selectedIds) {
    if (typeof id !== 'string' || !/^[a-f0-9]{20}$/.test(id) || ids.has(id)) {
      throw new TypeError('Invalid or duplicate proposal selection id');
    }
    ids.add(id);
  }
  const known = new Map(trustedPreview.proposals.map(p => [p.id, p]));
  if ([...ids].some(id => !known.has(id))) throw new Error('Selection references an unknown proposal');
  const proposals = [...ids].map(id => known.get(id)).map(item => {
    if (!SUPPORTED_CATEGORIES.includes(item.category) ||
        item.operation !== 'propose_create_draft' || item.status !== 'review_required' ||
        !Array.isArray(item.evidence) || !item.evidence.length ||
        !item.fields || typeof item.fields !== 'object' || Array.isArray(item.fields)) {
      throw new Error('Unsafe draft proposal');
    }
    return structuredClone({
      id: item.id,
      category: item.category,
      operation: 'propose_create_draft',
      status: 'review_required',
      fields: item.fields,
      evidence: item.evidence,
      needsVerification: item.needsVerification,
      suggestedCopy: item.suggestedCopy,
    });
  });
  return Object.freeze({
    mode: 'prepare_review_only', proposals,
    requiresOwnerApproval: true, writesPerformed: 0,
  });
}
