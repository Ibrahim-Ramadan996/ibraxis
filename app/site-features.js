/** Public-only feature data renderer shared by Node HTML and the owner SPA. */
const html=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function safeUrl(u){
 if(typeof u!=='string'||u.length>500||!u.trim())throw Error('Valid link required');
 if(/^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[a-z0-9_\-./?&%#=]*)?$/i.test(u))return u;
 if(/^\/[a-z0-9_\-./?&%#=]*$/i.test(u)&&!u.startsWith('//')&&!u.split('/').includes('..'))return u;
 throw Error('Only HTTPS and safe local links are supported');
}
export function validatePublicFeatures(value){
 if(!Array.isArray(value)||value.length>50)throw Error('Feature list must have 0–50 entries');
 const used=new Set();
 return value.map(x=>{
  if(!x||typeof x!=='object'||Array.isArray(x)||!['section','button'].includes(x.kind))throw Error('Unsupported feature kind');
  if(typeof x.id!=='string'||!/^[a-f0-9]{12}$/.test(x.id)||used.has(x.id))throw Error('Feature identifier is not unique');used.add(x.id);
  for(const k of ['title','description'])if(typeof x[k]!=='string'||x[k].length>(k==='title'?80:2500))throw Error('Invalid feature text');
  if(!x.title.trim())throw Error('Feature title required');
  if(x.kind==='button')safeUrl(x.url);
  return {id:x.id,kind:x.kind,title:x.title,description:x.description,url:x.kind==='button'?x.url:''};
 });
}
export function renderPublicFeatures(raw,lang='ar'){
 const features=validatePublicFeatures(raw);
 return features.map(x=>{
  const attr=`data-ibraxis-feature="${x.id}"`,title=html(x.title),desc=html(x.description);
  if(x.kind==='button')return `<section class="content-section" ${attr}><a class="primary" href="${html(safeUrl(x.url))}" rel="noopener noreferrer">${title}</a></section>`;
  return `<section class="content-section" ${attr} aria-label="${title}"><div class="section-head"><h2>${title}</h2></div>${desc?`<p>${desc}</p>`:''}</section>`;
 }).join('');
}
