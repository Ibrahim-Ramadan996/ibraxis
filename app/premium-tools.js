// Owner-workspace helpers. Pure functions are exercised without real client data.
const norm = value => String(value ?? '').toLocaleLowerCase().trim();
export const active = row => row && row.status !== 'deleted' && row.status !== 'archived';
export function overviewMetrics(records = []) {
  if (!Array.isArray(records)) throw Error('Invalid records');
  const rows = records.filter(active);
  return {
    projects: rows.filter(x => x.kind === 'project').length,
    published: rows.filter(x => x.kind === 'project' && x.status === 'published').length,
    inquiries: rows.filter(x => x.kind === 'inquiry' && x.status === 'new').length,
    reviewing: rows.filter(x => x.kind === 'inquiry' && x.status === 'under_review').length,
    clients: rows.filter(x => x.kind === 'client').length,
    drafts: rows.filter(x => x.status === 'draft' && ['project', 'page', 'service', 'article'].includes(x.kind)).length
  };
}
export function searchWorkspace(records = [], query = '', scope = 'all') {
  if (!Array.isArray(records) || typeof query !== 'string' || query.length > 180 || typeof scope !== 'string') throw Error('Invalid search');
  const q = norm(query);
  if (!q) return [];
  return records.filter(x => active(x) && (scope === 'all' || x.kind === scope) && [x.title,x.ar_title,x.en_title,x.body,x.ar_body,x.en_body].some(v => norm(v).includes(q))).slice(0,40);
}
export function readinessAudit(site = {}, records = []) {
  const issues = [], push = (code,ar,en) => issues.push({code,ar,en});
  if (!site.seo_title_ar || !site.seo_title_en) push('seo-title','راجع عنوان البحث بالعربية والإنجليزية','Add Arabic and English SEO titles');
  if (!site.seo_description_ar || !site.seo_description_en) push('seo-description','راجع وصف البحث بالعربية والإنجليزية','Add Arabic and English SEO descriptions');
  if (!site.headline_ar || !site.headline_en) push('hero','أضف عنوانًا افتتاحيًا باللغتين','Set a bilingual homepage headline');
  for (const r of records.filter(x => x.status === 'published' && ['project','service','article','page'].includes(x.kind)).slice(0,40)) {
    if (!r.ar_title || !r.en_title) push('translation-title','محتوى منشور يحتاج عنوانًا باللغتين: '+String(r.title||'').slice(0,60),'Published item needs bilingual title: '+String(r.title||'').slice(0,60));
    if (!r.ar_body || !r.en_body) push('translation-body','محتوى منشور يحتاج وصفًا باللغتين: '+String(r.title||'').slice(0,60),'Published item needs bilingual description: '+String(r.title||'').slice(0,60));
  }
  return issues.slice(0,50);
}
export function layoutOffenders(boxes = [], width) {
  if (!Number.isFinite(width) || width <= 0) throw Error('Invalid viewport');
  return boxes.filter(b => b && Number.isFinite(b.left) && Number.isFinite(b.right) && b.right > b.left && (b.left < -2 || b.right > width + 2)).slice(0,15);
}
export function sanitizeCSV(value) {
  let v = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]/.test(v)) v = "'" + v;
  return '"' + v.replaceAll('"', '""') + '"';
}
export function inquiryCSV(records, ar = true) {
  if (!Array.isArray(records)) throw Error('Invalid records');
  const fields = ar ? ['العنوان','الاسم','البريد الإلكتروني','نوع المشروع','الميزانية','الحالة'] : ['Title','Name','Email','Kind','Budget','Status'];
  const rows = records.filter(x => x.kind === 'inquiry' && active(x)).slice(0,2000).map(r => {
    let b = {}; try {b = JSON.parse(r.body); if (!b || typeof b !== 'object' || Array.isArray(b)) b = {};} catch {};
    return [r.title, b.name, b.email, b.kind, b.budget, r.status];
  });
  return '\uFEFF' + [fields,...rows].map(x => x.map(sanitizeCSV).join(',')).join('\r\n');
}
export function validateQuickProject(input = {}) {
  const title = String(input.title ?? '').trim(), body = String(input.body ?? '').trim();
  if (!title || title.length > 150 || body.length > 30000) throw Error('Invalid project draft');
  return {kind:'project', brand:'personal', status:'draft', title, body, ar_title:String(input.ar_title??'').trim().slice(0,150), en_title:String(input.en_title??'').trim().slice(0,150)};
}
