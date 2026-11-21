/**
 * Owner-admin browser panel. All content is rendered as text; no arbitrary HTML.
 * The host supplies protected callbacks and MUST re-check owner session + CSRF.
 * There are no network calls, writes, or hidden API requests in this module.
 */
const labels = {
  education: 'التعليم', career: 'الخبرات', certifications: 'الشهادات', skills: 'المهارات',
};
let panelCounter = 0;

export function mountIngestionPanel(container, {
  previewText, previewFile, previewFiles = null, onPreparePlan = null,
} = {}) {
  if (!container || typeof previewText !== 'function' || typeof previewFile !== 'function') {
    throw new TypeError('Container, previewText and previewFile callbacks are required');
  }
  const token = `ibraxis-input-${++panelCounter}`;
  const root = document.createElement('section');
  root.className = 'ibraxis-ingestion';
  root.setAttribute('aria-label', 'إدخال البيانات وفهم الملفات');
  root.dir = 'rtl';
  root.innerHTML = `
    <style>
      .ibraxis-ingestion{font-family:inherit;max-width:980px;margin-inline:auto;color:inherit}
      .ibraxis-ingestion .modebar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
      .ibraxis-ingestion button{border:1px solid #8b96a5;border-radius:9px;padding:9px 15px;background:transparent;color:inherit;cursor:pointer;font:inherit}
      .ibraxis-ingestion button.active{background:#16395c;color:#fff;border-color:#16395c}
      .ibraxis-ingestion button:disabled{cursor:not-allowed;opacity:.45}
      .ibraxis-ingestion textarea{display:block;width:100%;min-height:130px;box-sizing:border-box;border:1px solid #9aa4b3;border-radius:8px;padding:12px;font:inherit;background:transparent;color:inherit}
      .ibraxis-ingestion input[type=file]{display:block;width:100%;margin:10px 0;font:inherit}
      .ibraxis-ingestion .panel{border:1px solid #ccd2da;border-radius:12px;padding:16px;margin-block:10px}
      .ibraxis-ingestion .proposal{border-top:1px solid #ccd2da;padding:12px 0}
      .ibraxis-ingestion .muted{opacity:.8;font-size:.92em}
      .ibraxis-ingestion pre{white-space:pre-wrap;overflow-wrap:anywhere;direction:auto;font-size:.87em}
      .ibraxis-ingestion .hidden{display:none}
      .ibraxis-ingestion [role=status]{min-height:1.5em}
      .ibraxis-ingestion .actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .ibraxis-ingestion .proposal label{display:flex;gap:8px;align-items:center;cursor:pointer}
      .ibraxis-ingestion .proposal input{width:18px;height:18px}
      .ibraxis-ingestion .warning{border-right:3px solid #a56f16;padding-right:10px}
    </style>
    <div class="modebar" role="group" aria-label="مصدر البيانات">
      <button type="button" data-mode="text" class="active" aria-pressed="true">✍️ معلومات نصية</button>
      <button type="button" data-mode="file" aria-pressed="false">📄 فهم الملفات</button>
    </div>
    <div class="panel" data-section="text">
      <label for="${token}-text">اكتب معلوماتك بالطريقة الطبيعية</label>
      <textarea id="${token}-text" placeholder="مثال: اتخرجت من جامعة الفيوم سنة 2025، بكالوريوس علوم حاسب" maxlength="100000"></textarea>
    </div>
    <div class="panel hidden" data-section="file">
      <label for="${token}-file">ارفع CV أو شهادة أو ملف بيانات</label>
      <input id="${token}-file" type="file" accept=".txt,.md,.csv,.tsv,.pdf,.docx,.xlsx,.png,.jpg,.jpeg" ${typeof previewFiles === 'function' ? 'multiple' : ''}>
      <p class="muted">TXT وCSV وDOCX وExcel. PDF يحتاج مكتبة قراءة محلية، والصور تحتاج OCR محلي. أقصى حجم 4MB.</p>
    </div>
    <div class="actions"><button type="button" data-action="preview">معاينة المقترحات</button>
      <button type="button" data-action="clear">مسح المعاينة</button></div>
    <p role="status" aria-live="polite"></p>
    <div class="panel hidden" data-results></div>
    <button type="button" data-action="prepare" class="hidden" disabled>إرسال العناصر المختارة لمراجعة المدير</button>
  `;
  container.append(root);
  let mode = 'text', lastResult = null, inputSnapshot = null;
  let revision = 0;
  const chosen = new Set();
  const status = root.querySelector('[role=status]');
  const results = root.querySelector('[data-results]');
  const previewButton = root.querySelector('[data-action=preview]');
  const prepareButton = root.querySelector('[data-action=prepare]');
  const fileInput = root.querySelector('input[type=file]');
  const textarea = root.querySelector('textarea');
  const clear = () => {
    revision += 1; lastResult = null; inputSnapshot = null; chosen.clear();
    results.replaceChildren(); results.classList.add('hidden');
    prepareButton.classList.add('hidden'); prepareButton.disabled = true;
    status.textContent = '';
  };
  root.querySelector('[data-action=clear]').addEventListener('click', clear);
  const switchMode = (newMode) => {
    if (newMode === mode) return;
    mode = newMode; clear();
    root.querySelectorAll('[data-mode]').forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    root.querySelectorAll('[data-section]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.section !== mode));
  };
  root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => switchMode(button.dataset.mode)));
  textarea.addEventListener('input', clear);
  fileInput.addEventListener('change', clear);

  const updatePrepare = () => {
    prepareButton.classList.toggle('hidden', !(lastResult?.proposals?.length && typeof onPreparePlan === 'function'));
    prepareButton.disabled = chosen.size === 0;
    prepareButton.textContent = `إرسال ${chosen.size} عنصر للمراجعة (بدون حفظ)`;
  };
  previewButton.addEventListener('click', async () => {
    const runningRevision = ++revision;
    lastResult = null; chosen.clear();
    previewButton.disabled = true;
    status.textContent = 'جارٍ إعداد المعاينة...';
    prepareButton.classList.add('hidden');
    results.replaceChildren(); results.classList.add('hidden');
    try {
      const input = mode === 'text' ? textarea.value : [...(fileInput.files ?? [])];
      if (mode === 'file' && !input.length) throw new Error('اختار ملفًا أولًا');
      if (mode === 'file' && (input.length > 8 || input.some(f => f.size > 4 * 1024 * 1024))) {
        throw new Error('تأكد أن كل ملف أقل من 4 ميجابايت، وبحد أقصى 8 ملفات');
      }
      const result = mode === 'text'
        ? await previewText(input)
        : typeof previewFiles === 'function' ? await previewFiles(input) : await previewFile(input[0]);
      if (runningRevision !== revision) return; // An older asynchronous preview must never overwrite a newer one.
      if (!result || result.mode !== 'preview_only' || !Array.isArray(result.proposals)) {
        throw new Error('استجابة غير متوقعة من خدمة المعاينة');
      }
      lastResult = result;
      inputSnapshot = input;
      results.classList.remove('hidden');
      const heading = document.createElement('h3');
      heading.textContent = `مقترحات قابلة للمراجعة: ${result.proposals.length}`;
      results.append(heading);
      const summary = document.createElement('p');
      summary.className = 'muted';
      summary.textContent = `المكررات المحتملة: ${result.skippedDuplicates?.length ?? 0} — نصوص غير مصنفة: ${result.unclassified?.length ?? 0}. لم يُحفظ أي شيء.`;
      results.append(summary);
      for (const [index, proposal] of result.proposals.entries()) {
        const section = document.createElement('article');
        section.className = 'proposal';
        const selectLabel = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = false;
        checkbox.setAttribute('aria-label', `اختيار المقترح ${index + 1}`);
        const title = document.createElement('strong');
        title.textContent = `${labels[proposal.category] ?? 'غير معروف'} — ${proposal.confidence === 'partial' ? 'يحتاج استكمال' : 'مستخرج من المصدر'}`;
        selectLabel.append(checkbox, title);
        const details = document.createElement('pre');
        details.textContent = JSON.stringify(proposal.fields, null, 2);
        const evidence = document.createElement('p');
        evidence.className = 'muted';
        evidence.textContent = `المصدر: ${(proposal.evidence ?? []).map(e => `${e.source} — ${JSON.stringify(e.location)}: ${e.quote ?? ''}`).join('؛ ')}`;
        section.append(selectLabel, details, evidence);
        if (proposal.needsVerification?.length) {
          const warning = document.createElement('p');
          warning.className = 'warning';
          warning.textContent = `يحتاج تحقق: ${proposal.needsVerification.join('، ')}`;
          section.append(warning);
        }
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) chosen.add(proposal.id);
          else chosen.delete(proposal.id);
          updatePrepare();
        });
        results.append(section);
      }
      for (const warning of result.warnings ?? []) {
        const note = document.createElement('p');
        note.className = 'muted'; note.textContent = warning; results.append(note);
      }
      status.textContent = 'المعاينة جاهزة. اختار المقترحات اللي عايز تراجعها؛ مفيش حفظ تلقائي.';
      updatePrepare();
    } catch (error) {
      if (runningRevision === revision) {
        lastResult = null;
        status.textContent = `تعذرت المعاينة: ${error?.message ?? 'خطأ غير معروف'}`;
      }
    } finally { previewButton.disabled = false; }
  });
  prepareButton.addEventListener('click', async () => {
    if (!lastResult || !chosen.size || typeof onPreparePlan !== 'function') return;
    prepareButton.disabled = true;
    try {
      // Only selection IDs + original input; backend MUST recompute the trusted preview.
      await onPreparePlan({ selectedIds: [...chosen], input: inputSnapshot, mode });
      status.textContent = 'تم إرسال العناصر المختارة للمراجعة؛ لا يوجد حفظ أو نشر من هذه الواجهة.';
    } catch (error) {
      status.textContent = `تعذر إعداد خطة المراجعة: ${error?.message ?? 'خطأ غير معروف'}`;
    } finally { updatePrepare(); }
  });
  return { destroy() { clear(); root.remove(); } };
}
