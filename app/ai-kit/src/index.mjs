import { extractFile, extractPlainText, IngestError } from './file-extractor.mjs';
import { proposeRecords } from './proposal-engine.mjs';
import { enrichBilingualPreview } from './ai-enrichment.mjs';

/**
 * Side-effect-free preview entry point.
 * Caller MUST enforce owner auth and CSRF at their existing API boundary.
 * The existing Manager API is responsible for validating and saving accepted proposals.
 */
export async function previewTextInput({ text, existingRecords = {} }) {
  return proposeRecords(extractPlainText(text), { existingRecords });
}

export async function previewFileInput({ filename, bytes, localOcr = null, existingRecords = {} }) {
  const extracted = await extractFile({ filename, bytes, localOcr });
  return proposeRecords(extracted, { existingRecords });
}

export { IngestError, enrichBilingualPreview };

export { previewBatchInputs } from './batch.mjs';
export { prepareReviewSelection } from './review-selection.mjs';
export { previewProjectPlan } from './project-planner.mjs';
export { reviewContentQuality } from './quality-review.mjs';
export { createSiteBuilder, stageTextSiteFeature } from '../site-builder/index.mjs';
export { createAiSitePlanner } from '../site-builder/ai-planner.mjs';
