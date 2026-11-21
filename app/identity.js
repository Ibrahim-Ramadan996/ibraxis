export const icons={code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-16-4 20"/>',data:'<path d="M4 20V9m5 11V4m6 16v-8m5 8V6M2 20h20"/>',ai:'<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3M9 12h6m-3-3v6"/>',web:'<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20"/>',database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',design:'<path d="m12 2 10 10-10 10L2 12Z M12 7v10M7 12h10"/>',award:'<circle cx="12" cy="8" r="6"/><path d="m8 13-3 9 7-4 7 4-3-9"/>',book:'<path d="M12 5v17M2 3c5-1 8 0 10 2 2-2 5-3 10-2v17c-5-1-8 0-10 2-2-2-5-3-10-2Z"/>',work:'<rect x="2" y="7" width="20" height="15" rx="2"/><path d="M8 7V3h8v4M2 12h20"/>',cloud:'<path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-1 6 6 0 0 1 0 11Z"/>',shield:'<path d="m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6Z m-4 10 3 3 5-6"/>',star:'<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>'};
// Original monochrome glyphs with distinctive tool colors, bundled locally (no CDN).
const toolGlyphs={python:'Py',sql:'SQL',powerbi:'BI',excel:'X',pandas:'pd',matplotlib:'M',jupyter:'Jn',git:'Git',machinelearning:'ML',tableau:'Tb',numpy:'Np',scikitlearn:'SK',tensorflow:'TF',pytorch:'Pt'};
const toolColors={python:'#3776ab',sql:'#237e9d',powerbi:'#b88700',excel:'#188038',pandas:'#7653a0',matplotlib:'#2784aa',jupyter:'#e97729',git:'#e05235',machinelearning:'#7a65d4',tableau:'#1977a1',numpy:'#3076a4',scikitlearn:'#e67e22',tensorflow:'#ef8700',pytorch:'#d84d46'};
for(const [id,text] of Object.entries(toolGlyphs))icons[id]=`<rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1"/><text x="12" y="15" font-family="system-ui,sans-serif" font-weight="750" font-size="${text.length>2?'7.5':'10'}" text-anchor="middle" fill="currentColor" stroke="none">${text}</text>`;
export const iconLabel=id=>({python:'Python',sql:'SQL',powerbi:'Power BI',excel:'Microsoft Excel',pandas:'Pandas',matplotlib:'Matplotlib',jupyter:'Jupyter',git:'Git',machinelearning:'Machine Learning',tableau:'Tableau',numpy:'NumPy',scikitlearn:'Scikit-learn',tensorflow:'TensorFlow',pytorch:'PyTorch'})[id]||id;
export function validateIcon(v){if(typeof v!=='string'||(v!==''&&!Object.hasOwn(icons,v)))throw Error('Invalid icon');return v}
export function pickIcon(title='',kind=''){
 const s=String(title).toLowerCase();
 const specific=[[/power\s*bi|باور\s*بي/,'powerbi'],[/scikit[\s-]*learn|sklearn/,'scikitlearn'],[/machine\s*learning|تعلم\s*الآلة|تعلّم\s*الآلة/,'machinelearning'],[/matplotlib/,'matplotlib'],[/tensorflow/,'tensorflow'],[/pytorch/,'pytorch'],[/jupyter/,'jupyter'],[/pandas/,'pandas'],[/python|بايثون/,'python'],[/\bsql\b/,'sql'],[/excel|اكسل|إكسل/,'excel'],[/tableau|تابلو/,'tableau'],[/numpy/,'numpy'],[/\bgit\b/,'git']];
 const hit=specific.find(([re])=>re.test(s));if(hit)return hit[1];
 if(/java|code|برمج|c\+\+|typescript|javascript/.test(s))return 'code';
 if(/database|قواعد/.test(s))return 'database';
 if(/\bai\b|ذكاء/.test(s))return 'ai';
 if(/data|تحليل|بيانات/.test(s))return 'data';
 if(/cloud|سحاب/.test(s))return 'cloud';if(/security|أمن/.test(s))return 'shield';if(/web|react|مواقع/.test(s))return 'web';if(/design|تصميم/.test(s))return 'design';
 return ({skill:'star',achievement:'award',certification:'award',education:'book',career:'work',project:'code'})[kind]||'star';
}
export function iconSvg(x){const id=Object.hasOwn(icons,x)?x:'star';return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${toolColors[id]?` style="color:${toolColors[id]}"`:''}>${icons[id]}</svg>`}
