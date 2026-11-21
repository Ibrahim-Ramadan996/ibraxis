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
  let extracted;
  try {
    extracted = await extractFile({ filename, bytes, localOcr });
  } catch (error) {
    if (error instanceof IngestError) throw error;
    // Office ZIP validation emits a code-bearing Error, not IngestError.
    if (['FILE_SIGNATURE', 'BAD_OFFICE_ZIP', 'UNSAFE_OFFICE_ZIP'].includes(error?.code)) {
      throw new IngestError(error.code, 'ملف Word أو Excel غير صالح أو غير آمن للمعالجة.');
    }
    throw new IngestError('FILE_EXTRACTION_FAILED',
      'تعذرت قراءة محتوى الملف. راجع نوعه أو أعد تصديره ثم حاول مرة أخرى.');
  }
  try {
    return proposeRecords(extracted, { existingRecords });
  } catch (error) {
    if (error instanceof IngestError) throw error;
    throw new IngestError('CV_CLASSIFICATION_FAILED',
      'تم استخراج النص من الملف، لكن تعذر تصنيف بياناته. جرّب ملف TXT أو DOCX.');
  }
}

export { IngestError, enrichBilingualPreview };

export { previewBatchInputs } from './batch.mjs';
export { prepareReviewSelection } from './review-selection.mjs';
export { previewProjectPlan } from './project-planner.mjs';
export { reviewContentQuality } from './quality-review.mjs';
export { createSiteBuilder, stageTextSiteFeature } from '../site-builder/index.mjs';
export { createAiSitePlanner } from '../site-builder/ai-planner.mjs';
