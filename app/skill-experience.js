// Public, dependency-free skill presentation. It never reveals drafts or private project data.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const definitions = [
  ['python','Python','Programming','البرمجة','analysis'],
  ['sql','SQL','Data & databases','البيانات وقواعد البيانات','analysis'],
  ['powerbi','Power BI','Business intelligence','ذكاء الأعمال','visual'],
  ['excel','Excel','Business intelligence','ذكاء الأعمال','visual'],
  ['pandas','Pandas','Data & databases','البيانات وقواعد البيانات','analysis'],
  ['matplotlib','Matplotlib','Visualization','التصور البياني','visual'],
  ['jupyter','Jupyter Notebook','Development tools','أدوات التطوير','tools'],
  ['git','Git','Development tools','أدوات التطوير','tools'],
  ['machinelearning','Machine Learning','Machine learning','تعلّم الآلة','ml'],
  ['tableau','Tableau','Business intelligence','ذكاء الأعمال','visual'],
  ['numpy','NumPy','Data & databases','البيانات وقواعد البيانات','analysis'],
  ['scikitlearn','Scikit-learn','Machine learning','تعلّم الآلة','ml'],
  ['tensorflow','TensorFlow','Machine learning','تعلّم الآلة','ml'],
  ['pytorch','PyTorch','Machine learning','تعلّم الآلة','ml']
];
export const skillRegistry = Object.freeze(Object.fromEntries(definitions.map(([id,name,en,ar,group])=>[id,{id,name,en,ar,group}])));
export function skillForTitle(value=''){
 const s=String(value).normalize('NFKC').toLowerCase();
 const tests=[
  [/power\s*bi|باور\s*بي/, 'powerbi'],[/scikit[\s-]*learn|sklearn/,'scikitlearn'],[/machine\s*learning|تعلم\s*الآلة|تعلّم\s*الآلة/,'machinelearning'],[/matplotlib/,'matplotlib'],[/tensorflow/,'tensorflow'],[/pytorch/,'pytorch'],[/jupyter/,'jupyter'],[/pandas/,'pandas'],[/python|بايثون/,'python'],[/\bsql\b/,'sql'],[/excel|إكسل|اكسل/,'excel'],[/tableau|تابلو/,'tableau'],[/numpy/,'numpy'],[/\bgit\b/,'git']
 ];
 return tests.find(([re])=>re.test(s))?.[1]||null;
}
// This list is derived solely from the user's CV, and is opt-in, owner-only and always a draft.
export const cvSkillDrafts=Object.freeze([
 ['python','Python','بايثون','Data processing and exploratory analysis with Python.','معالجة البيانات والتحليل الاستكشافي باستخدام Python.'],
 ['sql','SQL','SQL','Querying and analyzing structured data.','الاستعلام عن البيانات المنظمة وتحليلها.'],
 ['powerbi','Power BI','Power BI','Interactive dashboards and KPI reporting.','لوحات معلومات تفاعلية وتقارير مؤشرات الأداء.'],
 ['excel','Excel','Excel','Data preparation and analysis in spreadsheets.','تجهيز البيانات وتحليلها باستخدام الجداول الإلكترونية.'],
 ['pandas','Pandas','Pandas','Data cleaning and analysis with Pandas.','تنظيف البيانات وتحليلها باستخدام Pandas.'],
 ['matplotlib','Matplotlib','Matplotlib','Visualizing analytical results with Matplotlib.','تصوير نتائج التحليل باستخدام Matplotlib.'],
 ['jupyter','Jupyter Notebook','Jupyter Notebook','Organizing reproducible analytical notebooks.','تنظيم دفاتر العمل الخاصة بتحليل البيانات.'],
 ['git','Git','Git','Tracking changes in code and analytical projects.','متابعة تغييرات الأكواد والمشاريع التحليلية.'],
 ['machinelearning','Machine Learning','تعلّم الآلة','Data preparation and exploration of machine learning methods.','تجهيز البيانات واستكشاف أساليب تعلّم الآلة.']
 ].map(([icon,title,ar_title,en_body,ar_body])=>({kind:'skill',brand:'personal',status:'draft',title,ar_title,en_title:title,body:en_body,en_body,ar_body,icon})));
export function draftSkillSelection(existing=[],candidates=cvSkillDrafts){
 if(!Array.isArray(existing)||!Array.isArray(candidates))throw Error('Invalid skill draft input');
 const have=new Set();
 for(const row of existing){
  if(row?.kind!=='skill'||row.status==='deleted')continue;
  const icon=String(row.icon||'').normalize('NFKC').trim().toLowerCase();
  const title=skillForTitle([row.en_title,row.ar_title,row.title].find(v=>String(v||'').trim())||'');
  if(icon&&skillRegistry[icon])have.add(icon);
  if(title)have.add(title);
 }
 const seen=new Set(),drafts=[];
 for(const candidate of candidates){
  if(candidate?.kind!=='skill'||candidate.status!=='draft')continue;
  const icon=String(candidate.icon||'').normalize('NFKC').trim().toLowerCase();
  if(!skillRegistry[icon])continue;
  if(have.has(icon)||seen.has(icon))continue;
  seen.add(icon);drafts.push({...candidate,icon});
 }
 return drafts;
}
// A public link is supplied only for a project whose explicit technology classification matches the skill.
export function relatedPublishedProjects(skill,projects=[]){
 const key=skill.icon&&skillRegistry[skill.icon]?skill.icon:skillForTitle(skill.en_title||skill.title||skill.ar_title);
 const techs={powerbi:['power-bi'],machinelearning:[],scikitlearn:['scikit-learn'],pytorch:['pytorch'],tensorflow:['tensorflow']};
 const required=techs[key]??(key?[key]:[]);
 if(!required.length)return [];
 return projects.filter(x=>x.kind==='project'&&x.status==='published'&&required.some(t=>(x.classification?.technologies||[]).includes(t))).slice(0,2);
}
const labels={all:['All','الكل'],analysis:['Data & code','البيانات والبرمجة'],visual:['BI & visualization','ذكاء الأعمال والتصور'],ml:['Machine learning','تعلّم الآلة'],tools:['Tools','الأدوات']};
export function renderSkillGallery(skills=[],projects=[],lang='ar',linkFor=()=> '#'){
 const ar=lang==='ar';if(!skills.length)return '';
 const group=id=>skillRegistry[id]?.group||'tools';
 const title=x=>x[ar?'ar_title':'en_title']||x.title||'';
 const body=x=>x[ar?'ar_body':'en_body']||x.body||'';
 const cards=skills.filter(x=>x.kind==='skill'&&x.status==='published').map(x=>{
  const key=skillRegistry[x.icon]?x.icon:skillForTitle(x.en_title||x.title||x.ar_title);
  const evidence=relatedPublishedProjects(x,projects);
  const icon=key?`<span class="ix-skill-brand ix-brand--${key}" aria-hidden="true">${escapeHTML(({python:'Py',sql:'SQL',powerbi:'BI',excel:'X',pandas:'pd',matplotlib:'M',jupyter:'Jn',git:'Git',machinelearning:'ML',tableau:'Tb',numpy:'Np',scikitlearn:'SK',tensorflow:'TF',pytorch:'Pt'})[key])}</span>`:'<span class="ix-skill-brand ix-brand--generic" aria-hidden="true">◆</span>';
  const description=body(x);
  const links=evidence.map(p=>`<a class="ix-skill-evidence" href="${escapeHTML(linkFor(p))}">${escapeHTML((ar?p.ar_title:p.en_title)||p.title)}</a>`).join('');
  return `<article class="ix-skill-card" data-ix-skill-category="${group(key)}"><div class="ix-skill-card-head">${icon}<span class="ix-skill-category">${escapeHTML((skillRegistry[key]||{en:'Skill',ar:'مهارة'})[ar?'ar':'en'])}</span></div><h4>${escapeHTML(title(x))}</h4>${description?`<p>${escapeHTML(description)}</p>`:''}${links?`<div class="ix-skill-proof"><span>${ar?'أعمال مرتبطة':'Related work'}</span>${links}</div>`:''}</article>`;
 }).join('');
 if(!cards)return '';
 return `<section class="ix-skill-lab" aria-label="${ar?'المهارات والأدوات':'Skills and tools'}"><div class="ix-skill-intro"><span class="ix-skill-kicker">${ar?'أدوات أستخدمها':'MY TOOLKIT'}</span><h3>${ar?'مهارات مدعومة بالتطبيق، لا بالنسب المئوية.':'Tools, not arbitrary proficiency scores.'}</h3><p>${ar?'الأدوات التي أستخدمها في التحليل والتصور، مع روابط للأعمال المنشورة عندما تتوفر.':'My analysis and visualization toolkit, with links to published work whenever available.'}</p></div><div class="ix-skill-path" aria-label="${ar?'منهجية التعامل مع البيانات':'Data workflow'}">${(ar?['تجهيز البيانات','استكشاف الأنماط','تصور المؤشرات','توصيل النتائج']:['Prepare data','Explore patterns','Visualize KPIs','Communicate findings']).map((step,i)=>`<span class="ix-skill-path-step"><b>${String(i+1).padStart(2,'0')}</b>${step}</span>`).join(`<span class="ix-skill-path-arrow" aria-hidden="true">${ar?'←':'→'}</span>`)}</div><div class="ix-skill-filters" role="group" aria-label="${ar?'تصفية المهارات':'Filter skills'}">${Object.entries(labels).map(([id,label])=>`<button type="button" data-ix-skill-filter="${id}" aria-pressed="${id==='all'?'true':'false'}">${label[ar?1:0]}</button>`).join('')}</div><div class="ix-skill-grid">${cards}</div></section>`;
}
// Enhances both the server-rendered pages and the Codespaces public preview.
export function bindSkillFilters(root){
 for(const lab of root.querySelectorAll('.ix-skill-lab')){
  const buttons=[...lab.querySelectorAll('[data-ix-skill-filter]')],cards=[...lab.querySelectorAll('[data-ix-skill-category]')];
  for(const button of buttons)button.addEventListener('click',()=>{
   const active=button.dataset.ixSkillFilter;
   for(const b of buttons)b.setAttribute('aria-pressed',String(b===button));
   for(const card of cards)card.hidden=active!=='all'&&card.dataset.ixSkillCategory!==active;
  });
 }
}
