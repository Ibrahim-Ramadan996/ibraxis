// Shared project-driven work areas for server preview, client gallery and GitHub Pages.
// Only published project classifications count; no placeholder claims or fake totals.
export const WORK_AREAS = Object.freeze([
 {id:'data',domains:['data','bi'],tag:'DATA / ANALYTICS',title_ar:'افهم البيانات',title_en:'Understand data',desc_ar:'تحليل البيانات والتقارير ولوحات المعلومات.',desc_en:'Data analysis, reporting and dashboards.'},
 {id:'ai',domains:['ai','ml','automation'],tag:'AI / INTELLIGENCE',title_ar:'اختبر الأفكار',title_en:'Explore AI',desc_ar:'ذكاء اصطناعي ونماذج وتجارب وأتمتة.',desc_en:'Artificial intelligence, models and automation.'},
 {id:'build',domains:['web','software'],tag:'BUILD / ENGINEERING',title_ar:'حوّلها إلى منتج',title_en:'Build useful tools',desc_ar:'واجهات وبرمجة وتطبيقات عملية.',desc_en:'Interfaces, software and useful applications.'}
]);
export function projectInArea(record,id){
 const area=WORK_AREAS.find(x=>x.id===id);
 return !!(area && record?.kind==='project' && record.status==='published' && area.domains.some(k=>record.classification?.domains?.includes(k)));
}
export function areaCounts(records=[]){
 const projects=records.filter(x=>x?.kind==='project'&&x.status==='published');
 return WORK_AREAS.map(area=>({...area,count:projects.filter(p=>projectInArea(p,area.id)).length}));
}
export function isWorkArea(value){return WORK_AREAS.some(x=>x.id===value)}
