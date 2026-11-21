/**
 * Optional bilingual drafting adapter, deliberately disconnected by default.
 * This module never selects a provider or sends data anywhere; the host supplies
 * the implementation and records the owner's affirmative consent first.
 * AI copy is kept separate from extracted facts and is never auto-saved.
 */
export async function enrichBilingualPreview(preview, {
  rewrite = null,
  ownerApprovedExternalProcessing = false,
  localOnly = true,
} = {}) {
  if (!preview || preview.mode !== 'preview_only' || !Array.isArray(preview.proposals)) {
    throw new TypeError('Provide an existing preview');
  }
  if (typeof rewrite !== 'function') return preview;
  if (!localOnly && !ownerApprovedExternalProcessing) {
    throw new Error('Explicit owner approval is required before sending private data to an external AI provider');
  }
  const proposals = [];
  for (const proposal of preview.proposals.slice(0, 30)) {
    // Only text suggestions; the AI cannot change factual fields or chosen operation.
    const suggested = await rewrite({
      category: proposal.category,
      sourceText: proposal.fields.originalText,
      language: proposal.fields.language,
      instruction: 'Rewrite faithfully in Modern Standard Arabic and professional English. Do not add claims, achievements, dates, institutions or credentials absent from the source.',
    });
    const ar = typeof suggested?.ar === 'string' ? suggested.ar.trim().slice(0, 1200) : '';
    const en = typeof suggested?.en === 'string' ? suggested.en.trim().slice(0, 1200) : '';
    proposals.push({
      ...proposal,
      fields: { ...proposal.fields },
      suggestedCopy: { ar, en },
      generatedText: Boolean(ar || en),
      needsVerification: [...new Set([...(proposal.needsVerification || []), ...(ar || en ? ['aiSuggestedCopy'] : [])])],
    });
  }
  return {
    ...preview,
    proposals,
    warnings: [...preview.warnings, 'الصياغة المقترحة بالذكاء الاصطناعي تحتاج مراجعة بشرية ولا تُعد إثباتًا للحقائق.'],
    requiresOwnerApproval: true,
    writesPerformed: 0,
  };
}
