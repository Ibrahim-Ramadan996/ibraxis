/** Browser UI for approval-gated site changes. No trusted operations run client-side. */
let sequence = 0;
export function mountSiteBuilderPanel(container, { previewRequest, approvePlan, rejectPlan, undoChange } = {}) {
  if (!container || [previewRequest, approvePlan, rejectPlan, undoChange].some(x => typeof x !== 'function')) {
    throw new TypeError('Container and four authenticated server callbacks are required');
  }
  const id = `ibraxis-site-builder-${++sequence}`;
  const root = document.createElement('section');
  root.className = 'ibraxis-site-builder';
  root.dir = 'rtl';
  root.setAttribute('aria-label','التطوير الذكي للموقع');
  root.innerHTML = `
  <style>
  .ibraxis-site-builder{max-width:990px;font:inherit;color:inherit}
  .ibraxis-site-builder textarea,.ibraxis-site-builder input{width:100%;box-sizing:border-box;border:1px solid #9da6b1;border-radius:7px;padding:10px;color:inherit;background:transparent;font:inherit}
  .ibraxis-site-builder textarea{min-height:100px;resize:vertical}
  .ibraxis-site-builder button{padding:9px 14px;border:1px solid #8b96a5;border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}
  .ibraxis-site-builder button:disabled{opacity:.45;cursor:not-allowed}
  .ibraxis-site-builder .actions{display:flex;gap:10px;flex-wrap:wrap;margin-block:12px}
  .ibraxis-site-builder .review{border:1px solid #aab2bb;border-radius:10px;padding:14px;margin-block:12px}
  .ibraxis-site-builder pre{white-space:pre-wrap;overflow-wrap:anywhere;direction:ltr;max-height:350px;overflow:auto;background:rgba(130,130,130,.1);padding:12px;border-radius:8px}
  .ibraxis-site-builder small{display:block;opacity:.85;margin-block:7px}
  .ibraxis-site-builder .hidden{display:none}
  </style>
  <h3>التطوير الذكي للموقع</h3>
  <p>اطلب إضافة صفحة أو قسم أو زر. أي تعديل للكود يحتاج معاينة وموافقة صريحة. لا يوجد نشر تلقائي.</p>
  <label for="${id}-prompt">طلب الإضافة أو التحسين</label>
  <textarea id="${id}-prompt" maxlength="1500" placeholder="مثال: ضيف قسم جديد لعرض الشهادات"></textarea>
  <details><summary>تفاصيل إضافية (اختياري)</summary><label for="${id}-title">عنوان الإضافة (اختياري)</label>
  <input id="${id}-title" maxlength="80" placeholder="شهاداتي">
  <label for="${id}-desc">وصف الإضافة (اختياري)</label>
  <textarea id="${id}-desc" maxlength="2500" placeholder="اكتب وصفًا حقيقيًا أو اتركه فارغًا"></textarea>
  <label for="${id}-url">رابط الزر (لو الطلب زر)</label>
  <input id="${id}-url" maxlength="500" placeholder="https://example.com/cv.pdf">
  <label>طريقة التطوير <select id="${id}-mode"><option value="template">إضافة قسم أو زر (بدون AI)</option><option value="ai">تطوير كود الموقع باستخدام AI</option></select></label>
  <label id="${id}-consent-wrap" hidden><input type="checkbox" id="${id}-consent"> أوافق على إرسال ملفات الواجهة المختارة لمزوّد AI الخارجي عند استخدامه</label>
  </details><div class="actions"><button type="button" data-action="preview">اقترح التعديل واعرض الكود</button></div>
  <p role="status" aria-live="polite"></p>
  <div data-review class="review hidden"></div>
  <div class="actions"><button type="button" data-action="approve" class="hidden">أوافق على تعديل ملفات التطوير</button>
  <button type="button" data-action="reject" class="hidden">رفض الخطة</button>
  <button type="button" data-action="undo" class="hidden">التراجع عن التعديل</button></div>
  <small>الاعتماد هنا يعدّل نسخة العمل المحلية فقط. النشر وGit push يحتاجان موافقة منفصلة خارج هذه الوحدة.</small>`;
  container.append(root);
  let plan = null, applied = null, stamp = 0, busy = false;
  const status = root.querySelector('[role=status]'), review = root.querySelector('[data-review]');
  const buttons = Object.fromEntries(['preview','approve','reject','undo'].map(a => [a, root.querySelector(`[data-action=${a}]`)]));
  const textarea = root.querySelector('textarea');
  const mode = root.querySelector(`#${id}-mode`), consent = root.querySelector(`#${id}-consent`);
  mode.addEventListener('change',()=>{root.querySelector(`#${id}-consent-wrap`).hidden=mode.value!=='ai'});
  const title = root.querySelector(`#${id}-title`), description = root.querySelector(`#${id}-desc`), url = root.querySelector(`#${id}-url`);
  function setBusy(yes) { busy = yes; Object.values(buttons).forEach(b=>b.disabled=yes); }
  function clear() { stamp++; plan = null; applied=null; review.replaceChildren();review.classList.add('hidden');['approve','reject','undo'].forEach(a=>buttons[a].classList.add('hidden'));status.textContent=''; }
  for (const inp of [textarea,title,description,url,mode,consent]) inp.addEventListener('input',clear);
  buttons.preview.addEventListener('click', async()=>{
    const localStamp = ++stamp;
    setBusy(true); plan=null;applied=null;review.replaceChildren();review.classList.add('hidden');
    ['approve','reject','undo'].forEach(a=>buttons[a].classList.add('hidden'));
    status.textContent='جارٍ إعداد خطة التعديل…';
    try {
      const p = await previewRequest({ request: textarea.value, title:title.value||undefined, description:description.value, url:url.value||undefined, mode:mode.value, consentExternal:consent.checked });
      if (localStamp!==stamp) return;
      if (!p?.planId || !p?.reviewDigest || p.status!=='awaiting_approval' || !Array.isArray(p.changes)) throw new Error('Invalid preview response');
      plan=p;review.classList.remove('hidden');
      const heading=document.createElement('h4');heading.textContent=`${p.description} — ${p.changes.length} ملف`;review.append(heading);
      for (const c of p.changes) {
        const h=document.createElement('p');h.textContent=`${c.action}: ${c.path} (إضافات: ${c.addedLines}، حذف: ${c.removedLines})`;review.append(h);
        const pre=document.createElement('pre');pre.textContent=c.summary;review.append(pre);
        if (c.abbreviated){const x=document.createElement('small'); x.textContent='المعاينة مختصرة؛ راجع الملف الكامل قبل النشر.'; review.append(x);}
      }
      if (p.securityWarnings?.length) { const warning=document.createElement('p'); warning.textContent=`تحذيرات كود تحتاج مراجعة: ${p.securityWarnings.join('، ')}`;review.prepend(warning); }
      status.textContent='هذه معاينة، لم يتم تعديل أي ملفات.';
      buttons.approve.classList.remove('hidden');buttons.reject.classList.remove('hidden');
    } catch(e){if(localStamp===stamp)status.textContent=`تعذر إعداد المعاينة: ${e.message}`;}
    finally{if(localStamp===stamp)setBusy(false);}
  });
  buttons.approve.addEventListener('click',async()=>{
    if (!plan||busy) return;
    const current=plan; setBusy(true); status.textContent='جارٍ تطبيق الخطة الموافق عليها…';
    try { const r=await approvePlan({planId:current.planId,reviewDigest:current.reviewDigest,acknowledge:true});
      plan=null; applied=r; buttons.approve.classList.add('hidden');buttons.reject.classList.add('hidden'); buttons.undo.classList.remove('hidden');
      status.textContent=`تم تعديل ${r.filesChanged?.length??0} ملف. أعد تشغيل لوحة الإدارة لعرض التغيير، واختبره قبل النشر.`;
    } catch(e) {status.textContent=`لم تنفّذ الخطة: ${e.message}`;plan=null;buttons.approve.classList.add('hidden');buttons.reject.classList.add('hidden');}
    finally{setBusy(false);}
  });
  buttons.reject.addEventListener('click',async()=>{
    if(!plan||busy)return;setBusy(true);
    try{await rejectPlan({planId:plan.planId});clear();status.textContent='تم رفض الخطة دون تعديل ملفات.';}
    catch(e){status.textContent=`تعذر الرفض: ${e.message}`;}
    finally{setBusy(false);}
  });
  buttons.undo.addEventListener('click',async()=>{
    if(!applied?.changeId||busy)return;setBusy(true);
    try{await undoChange({changeId:applied.changeId,acknowledge:true});applied=null;buttons.undo.classList.add('hidden');status.textContent='تم التراجع عن التعديل في نسخة التطوير.';}
    catch(e){status.textContent=`لم يتم التراجع: ${e.message}`;}
    finally{setBusy(false);}
  });
  return Object.freeze({ destroy:()=>{stamp++;root.remove();} });
}
