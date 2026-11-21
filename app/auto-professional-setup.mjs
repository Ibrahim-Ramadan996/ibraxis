export const setupDocumentCategories = Object.freeze([
  'identity',
  'skills',
  'education',
  'career',
  'certifications',
  'seo',
  'static'
]);

const validIcons=Object.freeze(new Set([
 'python','sql','powerbi','excel','pandas','matplotlib','jupyter','git','machinelearning'
]));

const skillCatalog = Object.freeze({
  python: {domains:['data-analytics'],technologies:['python'],tags:['Python','data-analysis']},
  sql: {domains:['data-analytics','database'],technologies:['sql'],tags:['SQL','data-analysis']},
  powerbi: {domains:['business-intelligence'],technologies:['power-bi'],tags:['Power BI','dashboards']},
  excel: {domains:['business-intelligence'],technologies:['excel'],tags:['Excel','spreadsheets']},
  pandas: {domains:['data-analytics'],technologies:['pandas'],tags:['Pandas','data-cleaning']},
  matplotlib: {domains:['data-visualization'],technologies:['matplotlib'],tags:['Matplotlib','visualization']},
  jupyter: {domains:['development-tools'],technologies:['jupyter'],tags:['Jupyter','notebooks']},
  git: {domains:['development-tools'],technologies:['git'],tags:['Git','version-control']},
  machinelearning: {domains:['machine-learning'],technologies:['machine-learning'],tags:['Machine Learning','data-preparation']}
});

const text = value => typeof value === 'string' ? value.trim() : '';

export function skillKey(value) {
  const title = text(value).toLowerCase();
  if (/power\s*bi|باور\s*بي/.test(title)) return 'powerbi';
  if (/machine\s*learning|تعلم\s*الآلة|تعلّم\s*الآلة/.test(title)) return 'machinelearning';
  if (/matplotlib/.test(title)) return 'matplotlib';
  if (/jupyter/.test(title)) return 'jupyter';
  if (/pandas/.test(title)) return 'pandas';
  if (/python|بايثون/.test(title)) return 'python';
  if (/\bsql\b/.test(title)) return 'sql';
  if (/excel|إكسل|اكسل/.test(title)) return 'excel';
  if (/git/.test(title)) return 'git';
  return '';
}

export function buildProfessionalSetup(existingRecords = [], site = {}, cvSkillCandidates = []) {
  if (!Array.isArray(existingRecords) || !site || typeof site !== 'object' || !Array.isArray(cvSkillCandidates)) {
    throw Error('Invalid professional setup input');
  }

  const present = new Set();
  for(const row of existingRecords){
   if(!row||row.status==='deleted')continue;
   if(row.kind==='skill'){
    const icon=text(row.icon).toLowerCase();
    const inferred=skillKey([row.en_title,row.title,row.ar_title].find(v=>text(v))||'');
    if(validIcons.has(icon))present.add(icon);
    if(validIcons.has(inferred))present.add(inferred);
   }
  }

  const seen=new Set();
  const skillDrafts = [];
  for(const candidate of cvSkillCandidates){
   if(candidate?.kind!=='skill'||candidate.status!=='draft')continue;
   const icon=text(candidate.icon).toLowerCase();
   if(!validIcons.has(icon)||present.has(icon)||seen.has(icon))continue;
   if(!text(candidate.title)||!text(candidate.ar_title)||!text(candidate.en_title)||!text(candidate.ar_body)||!text(candidate.en_body))continue;
   seen.add(icon);
   skillDrafts.push({
      kind:'skill',
      brand:'personal',
      status:'draft',
      title:candidate.title,
      ar_title:candidate.ar_title,
      en_title:candidate.en_title,
      body:candidate.body,
      ar_body:candidate.ar_body,
      en_body:candidate.en_body,
      icon:candidate.icon,
      catalog:{
        mode:'manual',
        ...skillCatalog[candidate.icon],
        featured:false
      }
   });
  }

  const sitePatch = {};

  // Existing, manually edited SEO is never replaced. Fill only genuinely missing fields.
  if (!text(site.seo_title_ar) && text(site.name)) sitePatch.seo_title_ar = `${site.name} | محلل بيانات وذكاء أعمال | IBRAXIS`;
  if (!text(site.seo_title_en) && text(site.name)) sitePatch.seo_title_en = `${site.name} | Data Analyst & BI | IBRAXIS`;
  if (!text(site.seo_description_ar) && text(site.role_ar)) sitePatch.seo_description_ar = text(site.role_ar);
  if (!text(site.seo_description_en) && text(site.role_en)) sitePatch.seo_description_en = text(site.role_en);

  const documentedKinds=existingRecords.filter(row=>row && row.status!=='deleted' && ['education','career','certification'].includes(row.kind));
  const byKind=Object.fromEntries(['education','career','certification'].map(k=>[k,documentedKinds.filter(row=>row.kind===k).length]));
  const left = [
    'projects','caseStudies','products','services','clients','articles','futureWork'
  ];

  return {
    sitePatch,
    skillDrafts,
    report:{
      created:{
        skills: skillDrafts.length,
        education: 0,
        career: 0,
        certifications: 0
      },
      improved:{
        identity: Object.keys(sitePatch).filter(k => !k.startsWith('seo_')).length,
        seo: Object.keys(sitePatch).filter(k => k.startsWith('seo_')).length,
        static:0
      },
      documented:{
        education: byKind.education,
        career: byKind.career,
        certifications: byKind.certification
      },
      notCreatedWithoutEvidence:{
        education:true,
        career:true,
        certifications:true
      },
      skippedManual: existingRecords.filter(row => row?.status !== 'deleted').length,
      leftUnchanged:left
    }
  };
}
