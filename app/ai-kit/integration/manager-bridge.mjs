/**
 * Framework-neutral adapter to the existing owner-authenticated IBRAXIS API.
 * Does not create routes, database tables or write records itself.
 * Host MUST supply real owner/CSRF checks and a plan-only stageReviewPlan hook.
 */
import { previewTextInput, previewFileInput, previewBatchInputs } from '../src/index.mjs';
import { prepareReviewSelection } from '../src/review-selection.mjs';

function ensureFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} callback required`);
}

export function createIngestionBridge({
  assertOwner, assertCsrf, readExistingRecords, stageReviewPlan, onAudit = null, localOcr = null,
} = {}) {
  for (const [fn, name] of [
    [assertOwner, 'assertOwner'], [assertCsrf, 'assertCsrf'],
    [readExistingRecords, 'readExistingRecords'], [stageReviewPlan, 'stageReviewPlan'],
  ]) ensureFunction(fn, name);

  async function trustedPreview(context, input) {
    await assertOwner(context);
    await assertCsrf(context);
    const existingRecords = await readExistingRecords(context);
    if (!existingRecords || typeof existingRecords !== 'object' || Array.isArray(existingRecords)) {
      throw new TypeError('Host must return current owner-visible record arrays');
    }
    if (input?.type === 'text') {
      return previewTextInput({ text: input.text, existingRecords });
    }
    if (input?.type === 'file') {
      return previewFileInput({ filename: input.filename, bytes: input.bytes, existingRecords, localOcr });
    }
    if (input?.type === 'batch') {
      return previewBatchInputs({ items: input.items, existingRecords, localOcr });
    }
    throw new TypeError('Unsupported input type');
  }

  return Object.freeze({
    async preview(context, input) {
      const result = await trustedPreview(context, input);
      if (typeof onAudit === 'function') await onAudit({ kind: 'ingestion_preview', count: result.proposals.length }, context);
      return result;
    },
    async prepare(context, { input, selectedIds } = {}) {
      // Treat every client-provided preview as untrusted. Re-extract from original
      // bytes/text and re-read the database to account for concurrent edits.
      const trusted = await trustedPreview(context, input);
      const selection = prepareReviewSelection(trusted, selectedIds);
      if (!selection.proposals.length) throw new Error('At least one reviewed proposal must be selected');
      // stageReviewPlan MUST only create a pending, owner-reviewable plan, never save records.
      const plan = await stageReviewPlan(selection, context);
      if (typeof onAudit === 'function') await onAudit({ kind: 'ingestion_review_staged', count: selection.proposals.length }, context);
      return { mode: 'awaiting_owner_approval', plan, writesPerformed: 0 };
    },
  });
}
