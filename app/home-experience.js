// Shared bilingual homepage for the private preview and published GitHub Pages.
// Public-facing content is limited to public records and site configuration.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=(v,n=170)=>Array.from(String(v??'').replace(/\s+/g,' ').trim()).slice(0,n).join('');
export function homeExperience({site={},rows=[],lang='ar',urlFor=p=>p}){
 const ar=lang==='ar',tr=(en,arText)=>ar?arText:en;
 const title=site[ar?'headline_ar':'headline_en']||tr('Technology with purpose.','تكنولوجيا تصنع فارقًا.');
 const sub=site[ar?'subline_ar':'subline_en']||tr('From insight to impact.','من الفكرة إلى التأثير.');
 const records=Array.isArray(rows)?rows:[],projects=records.filter(x=>x.kind==='project'&&x.status==='published');
 const identity=records.find(x=>x.kind==='brand'&&x.brand==='personal');
 const desc=(identity?.[ar?'ar_body':'en_body']||identity?.body||site[ar?'bio_ar':'bio_en']||tr('Data, artificial intelligence and useful digital products — brought together in one independent studio.','البيانات والذكاء الاصطناعي والمنتجات الرقمية المفيدة، في استوديو تقني مستقل.'));
 const preview=projects.slice(0,2).map(project=>{
  const name=project[ar?'ar_title':'en_title']||project.title||tr('Project','مشروع');
  return `<a class="ix-featured-item" href="${escape(urlFor('/project/'+project.id))}"><span>↗</span><strong>${escape(short(name,84))}</strong></a>`;
 }).join('');
 return `<section class="hero ix-home-hero" aria-labelledby="ix-home-heading">
  <div class="hero-copy ix-home-copy"><div class="eyebrow"><span class="signal"></span>${tr('IBRAXIS / INDEPENDENT DIGITAL STUDIO','IBRAXIS / استوديو رقمي مستقل')}</div>
  <h1 id="ix-home-heading">${escape(title)} <em>${escape(sub)}</em></h1>
  <p class="ix-home-lead">${escape(short(desc,250))}</p>
  <div class="ix-home-actions"><a class="primary" href="${escape(urlFor('/projects'))}">${tr('Explore projects','استكشف المشاريع')} <span aria-hidden="true">↗</span></a><a class="secondary" href="#contact">${tr('Discuss a project','ناقش مشروعك')}</a></div>
  <div class="ix-home-meta"><span><i aria-hidden="true"></i>${tr('Explore projects, research and practical experiments','اكتشف المشاريع والأبحاث والتجارب العملية')}</span><span>${tr('Arabic / English','عربي / English')}</span></div></div>
  <div class="ix-home-lab" aria-label="${tr('IBRAXIS technology showcase','عرض الهوية التقنية لـ IBRAXIS')}"><div class="ix-lab-top"><span class="ix-lab-light" aria-hidden="true"></span><span>IBRAXIS / LAB</span><span>✦</span></div><div class="ix-lab-center"><span class="ix-lab-orbit ix-lab-orbit-a"></span><span class="ix-lab-orbit ix-lab-orbit-b"></span><strong>IX<span>.</span></strong></div><div class="ix-lab-bottom"><span>DATA</span><span>AI</span><span>BUILD</span><span>EXPLORE</span></div></div>
 </section><section class="ix-home-capabilities" aria-label="${tr('Areas of work','مجالات العمل')}">
 ${[
  ['01','DATA / ANALYTICS',tr('Understand the data','افهم البيانات'),tr('Analysis, reporting and interactive dashboards.','تحليل وتقارير ولوحات معلومات تفاعلية.')],
  ['02','AI / INTELLIGENCE',tr('Test the ideas','اختبر الأفكار'),tr('Models, evaluation and responsible experiments.','نماذج وتقييم وتجارب ذكية قابلة للفهم.')],
  ['03','BUILD / ENGINEERING',tr('Make it useful','حوّلها إلى منتج'),tr('Interfaces, programming and practical tools.','واجهات وبرمجة وأدوات عملية.')]
 ].map(([no,tag,head,body])=>`<article class="ix-capability"><div class="ix-capability-head"><span>${no}</span><small>${tag}</small></div><h2>${head}</h2><p>${body}</p></article>`).join('')}
 </section><section class="ix-featured" aria-label="${tr('Featured work','أعمال مختارة')}"><div><div class="eyebrow">${tr('THE WORK','الأعمال')}</div><h2>${projects.length?tr('Built to be explored.','مشاريع تستحق الاستكشاف.'):tr('The next project starts here.','المشروع القادم يبدأ هنا.')}</h2><p>${projects.length?tr('Explore published work and available live demonstrations.','تصفح المشاريع المنشورة والتجارب المتاحة.'):tr('New work will be showcased here after review and publication.','هنعرض هنا الأعمال الجديدة بعد مراجعتها واعتماد نشرها.')}</p></div><div class="ix-featured-list">${preview||`<a class="secondary" href="#contact">${tr('Start a conversation','ابدأ التواصل')} ↗</a>`}<a href="${escape(urlFor('/projects'))}" class="ix-all-work">${tr('View project atlas','عرض أطلس المشاريع')} ↗</a></div></section>`;
}
