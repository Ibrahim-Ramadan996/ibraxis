/** Read-only heuristic quality checks for owner-provided content snapshots. */
import { normalizeMatch } from './proposal-engine.mjs';

const GROUPS = ['skills', 'education', 'career', 'certifications', 'projects'];
const LABELS = { skills: 'المهارات', education: 'التعليم', career: 'الخبرات', certifications: 'الشهادات', projects: 'المشاريع' };
function firstString(record, fields) {
  return fields.find(key => typeof record?.[key] === 'string' && record[key].trim()) ?? null;
}

export function reviewContentQuality(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new TypeError('Expected records snapshot');
  const issues = [];
  for (const type of GROUPS) {
    const records = snapshot[type];
    if (records === undefined) continue;
    if (!Array.isArray(records)) {
      issues.push({ severity: 'info', section: type, code: 'UNSUPPORTED_SCHEMA', message: 'القسم ليس مصفوفة؛ يلزم مراجعة الربط بالحقول الفعلية.' });
      continue;
    }
    if (!records.length) {
      issues.push({ severity: 'info', section: type, code: 'EMPTY_SECTION', message: `قسم ${LABELS[type]} لا يحتوي على سجلات في اللقطة المقدمة.` });
      continue;
    }
    const seen = new Set();
    for (const [index, record] of records.entries()) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
      const key = firstString(record, ['name', 'title', 'titleEn', 'titleAr', 'institution', 'organization']);
      const identifier = key ? normalizeMatch(record[key]) : null;
      if (identifier && seen.has(identifier)) {
        issues.push({ severity: 'review', section: type, index, code: 'POSSIBLE_DUPLICATE', message: 'عنوان مكرر محتمل؛ افحص السجل قبل أي تغيير.' });
      }
      if (identifier) seen.add(identifier);
      const ar = firstString(record, ['titleAr', 'nameAr', 'descriptionAr']);
      const en = firstString(record, ['titleEn', 'nameEn', 'descriptionEn']);
      if (ar && !en) issues.push({ severity: 'info', section: type, index, code: 'MISSING_EN', message: 'المحتوى الإنجليزي غير موجود في الحقول المعروفة.' });
      if (en && !ar) issues.push({ severity: 'info', section: type, index, code: 'MISSING_AR', message: 'المحتوى العربي غير موجود في الحقول المعروفة.' });
      if (type === 'certifications' && record.issuer === null) {
        issues.push({ severity: 'review', section: type, index, code: 'CERT_ISSUER_MISSING', message: 'جهة إصدار الشهادة غير موثقة في البيانات المقدمة.' });
      }
    }
  }
  for (const language of ['ar', 'en']) {
    const title = snapshot.seo?.[language]?.title;
    if (typeof title === 'string' && title.length > 70) {
      issues.push({ severity: 'info', section: 'seo', code: `LONG_TITLE_${language.toUpperCase()}`, message: 'عنوان SEO طويل نسبيًا؛ راجعه على نتائج البحث.' });
    }
  }
  return {
    mode: 'quality_review_only', issues,
    summary: { issues: issues.length, sectionsInspected: GROUPS.filter(x => Array.isArray(snapshot[x])).length },
    evidenceScope: 'owner_supplied_snapshot', requiresOwnerApproval: true,
    writesPerformed: 0,
    warnings: ['الفحص محلي للبيانات المقدمة فقط؛ لم يتم فتح الموقع أو اختبار الروابط أو أداء SEO الحقيقي.'],
  };
}
