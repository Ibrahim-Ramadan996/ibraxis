/**
 * Optional provider adapter: AI returns data-only file proposals, never commands.
 * Host decides whether provider is local or external and must configure it.
 */
export function createAiSitePlanner({ builder, generateChanges, sourcePaths = [], externalProvider = false, maxSourceChars = 40000 } = {}) {
  if (!builder || typeof builder.stage !== 'function' || typeof builder.readText !== 'function') throw new TypeError('A guarded Site Builder is required');
  if (typeof generateChanges !== 'function') throw new TypeError('Explicit model/provider callback required');
  if (!Array.isArray(sourcePaths) || sourcePaths.length > 8 || sourcePaths.some(x=>typeof x!=='string')) throw new TypeError('Explicit source file paths required (max 8)');
  if (typeof maxSourceChars !== 'number' || maxSourceChars < 1000 || maxSourceChars > 100000) throw new TypeError('Invalid source limit');
  return Object.freeze({
    async draft(context, { request, consentExternal = false } = {}) {
      if (typeof request !== 'string' || request.trim().length < 8 || request.length > 2000) throw new TypeError('A specific feature request is required');
      if (externalProvider && consentExternal !== true) {
        throw Object.assign(new Error('Explicit consent is required before transmitting source code to an external AI provider'),{code:'EXTERNAL_CONSENT_REQUIRED'});
      }
      let count = 0;
      const sources = [];
      for (const path of sourcePaths) {
        const contents = await builder.readText(context, path); // owner + CSRF and allowlist enforced
        if (count + contents.length > maxSourceChars) throw Object.assign(new Error('Selected source context is too large for AI planning'),{code:'CONTEXT_LIMIT'});
        count += contents.length;
        sources.push({ path, contents });
      }
      // The provider is not granted file, network, shell or Git tools by this module.
      // Its answer is untrusted text and will be revalidated by the Site Builder.
      const draft = await generateChanges({ request, sources, outputFormat: 'strict_file_changes',
        systemLimits: 'Only create/update source files inside approved roots. No shell, secrets, .env, Git push, deploy, deletion, or execution. Never fabricate biography or project outcomes. Require owner approval.' });
      if (!draft || typeof draft !== 'object' || typeof draft.description !== 'string' || !Array.isArray(draft.changes)) {
        throw Object.assign(new Error('AI returned an invalid change-plan structure'), {code:'BAD_AI_RESPONSE'});
      }
      const plan = await builder.stage(context, { description: draft.description, changes: draft.changes });
      return { ...plan, generatedBy: 'configured_ai_provider', sourcePaths, externalProvider,
        warning: 'راجع جميع فروق الكود؛ اقتراح الذكاء الاصطناعي لا يضمن خلو التغيير من أخطاء أو مخاطر أمنية.' };
    },
  });
}
