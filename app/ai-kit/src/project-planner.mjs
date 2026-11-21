/** A project planning suggestion, NOT an IBRAXIS projects database record. */
import { sha256 } from './safety.mjs';

export function previewProjectPlan({ title, description, technologies = [] } = {}) {
  const name = String(title ?? '').trim();
  const details = String(description ?? '').trim();
  if (!name || name.length > 140 || !details || details.length > 5000 ||
      !Array.isArray(technologies) || technologies.length > 20 ||
      technologies.some(t => typeof t !== 'string' || t.length > 60)) {
    throw new TypeError('Project title, description and technologies must be provided within limits');
  }
  // Deliberately generic future work: never claim any project deliverable has been completed.
  const phases = [
    { label: 'تحديد الهدف', tasks: ['توثيق سؤال المشروع والنتائج المتوقعة', 'تحديد البيانات المطلوبة والقيود'] },
    { label: 'البيانات', tasks: ['مراجعة مصادر البيانات والتراخيص والخصوصية', 'فحص الجودة والقيم الناقصة والتكرارات'] },
    { label: 'التحليل', tasks: ['تخطيط التحليل الاستكشافي أو النموذج حسب الهدف', 'إعداد طريقة للتحقق من النتائج'] },
    { label: 'العرض والتوثيق', tasks: ['توثيق الخطوات والأدلة والقيود', 'إعداد صفحة مشروع للمراجعة قبل النشر'] },
  ].map((phase, i) => ({
    id: `phase-${i + 1}`, title: phase.label, status: 'suggested',
    tasks: phase.tasks.map((task, n) => ({ id: `phase-${i + 1}-task-${n + 1}`, title: task, status: 'suggested' })),
  }));
  return {
    version: 1, mode: 'project_plan_preview', project: {
      id: sha256(Buffer.from(`${name}\n${details}`)).slice(0, 20),
      title: name, description: details,
      technologies: [...new Set(technologies.map(t => t.trim()).filter(Boolean))],
      status: 'not_created', source: 'owner_text',
    },
    phases,
    warnings: ['خطة عمل مستقبلية، وليست إثباتًا بإنجاز أي مرحلة.', 'لا توجد كتابة في قسم المشاريع أو قاعدة البيانات.'],
    requiresOwnerApproval: true, writesPerformed: 0,
  };
}
