// Private owner workspace. No image is transmitted until the owner clicks Save.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maxOriginal=12*1024*1024;
const maxSaved=480000;
function asDataURL(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||''));
  reader.onerror=()=>reject(Error('Cannot read selected file / تعذرت قراءة الملف المختار'));
  reader.readAsDataURL(file);
 });
}
function imageFrom(url){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>img.naturalWidth&&img.naturalHeight?resolve(img):reject(Error('Invalid image dimensions'));
  img.onerror=()=>reject(Error('Image loading failed'));
  img.src=url;
 });
}
async function imageSource(file){
 const url=URL.createObjectURL(file);
 try{
  try{return await imageFrom(url)}catch{}
  if(typeof createImageBitmap==='function')try{return await createImageBitmap(file)}catch{}
  return await imageFrom(await asDataURL(file));
 }catch{
  throw Error('Your browser could not open the picture. Try the lossless WebP file or open Admin in Chrome/Edge / المتصفح تعذر عليه قراءة الصورة. جرّب ملف WebP الأصلي أو افتح الإدارة في Edge أو Chrome');
 }finally{URL.revokeObjectURL(url)}
}
async function optimize(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file?.type)||file.size>maxOriginal)throw Error('Select a JPG, PNG or WebP photo under 12 MB / اختر صورة JPG أو PNG أو WebP أقل من 12 ميجابايت');
 // An already-optimized WebP does not need decoding or re-encoding in the browser.
 // The private server validates the format, frame dimensions and maximum byte size.
 if(file.type==='image/webp'&&file.size<=maxSaved){
  const data=await asDataURL(file);
  if(!data.startsWith('data:image/webp;base64,'))throw Error('Invalid WebP file / ملف WebP غير صالح');
  return data;
 }
 const source=await imageSource(file);
 try{
  const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
  if(!width||!height||width*height>42000000)throw Error('Photo dimensions are unsupported / أبعاد الصورة غير مدعومة');
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw Error('Image processing unavailable');
  for(const side of [1100,960,800,680]){
   const ratio=Math.min(1,side/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
   context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(source,0,0,canvas.width,canvas.height);
   for(const quality of [.84,.74,.62]){
    const output=canvas.toDataURL('image/webp',quality);
    if(!output.startsWith('data:image/webp;base64,'))throw Error('Browser does not support WebP conversion / المتصفح لا يدعم تحويل WebP');
    if(output.length<=4*Math.ceil(maxSaved/3)+'data:image/webp;base64,'.length)return output;
   }
  }
  throw Error('Image is too detailed; try a smaller photo / الصورة كبيرة جدًا بعد الضغط، اختر صورة أصغر');
 }finally{if(typeof source.close==='function')source.close()}
}
export async function mountProfileEditor(panel,{ar,api}){
 const tr=(e,a)=>ar?a:e,block=document.createElement('section');block.className='card ix-profile-manager';
 const label=(key,opts)=>`<label>${tr(...key)}<select name="${opts.name}">${opts.values.map(([v,en,a])=>`<option value="${v}">${tr(en,a)}</option>`).join('')}</select></label>`;
 block.innerHTML=`<div class="ix-photo-heading"><div><div class="eyebrow">IBRAXIS / PORTRAIT STUDIO</div><h3>${tr('Your professional portrait','صورتك الشخصية على الموقع')}</h3><p class="muted">${tr('Upload here without sending your photo through chat or editing code. Save privately, review, approve, then use Smart Publishing.','ارفع صورتك هنا مباشرةً دون إرسالها في المحادثة أو تعديل الكود. احفظها كمسودة، راجعها، اعتمدها، ثم استخدم النشر الذكي.')}</p></div><span class="ix-photo-pill">${tr('OWNER ONLY','خاص بالمالك')}</span></div>
 <div class="ix-photo-workspace"><div class="ix-photo-preview" id="ix-photo-preview"><span class="ix-photo-placeholder">IX<span>.</span></span></div><div class="ix-photo-controls">
 <label>${tr('Choose a photo from your device','اختر صورة من جهازك')}<input id="ix-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label>
 <small>${tr('JPG / PNG / WebP up to 12 MB. Converted locally to a light WebP (up to 480 KB).','JPG / PNG / WebP حتى 12 ميجابايت. تحويل تلقائي داخل متصفحك إلى WebP خفيف (بحد أقصى 480 كيلوبايت).')}</small>
 ${label(['Where to display','مكان الظهور'],{name:'portrait_placement',values:[['both','Home and About','الرئيسية ومن أنا'],['hero','Home only','الرئيسية فقط'],['about','About only','من أنا فقط'],['off','Hide image in public pages','إخفاء الصورة من الصفحات العامة']]})}
 ${label(['Portrait treatment','شكل الصورة'],{name:'portrait_style',values:[['editorial','Editorial frame','إطار تحريري احترافي'],['soft','Soft corners','حواف ناعمة'],['circle','Circular portrait','صورة دائرية']]})}
 ${label(['Portrait size','حجم الصورة'],{name:'portrait_size',values:[['balanced','Balanced','متوازن'],['compact','Compact','صغير'],['large','Prominent','بارز']]})}
 <div class="ix-photo-sliders"><label>${tr('Horizontal crop','موضع القص الأفقي')}<input name="portrait_focus_x" type="range" min="0" max="100" step="1"></label><label>${tr('Vertical crop','موضع القص الرأسي')}<input name="portrait_focus_y" type="range" min="0" max="100" step="1"></label></div>
 <div class="toolbar ix-photo-actions"><button type="button" id="ix-photo-save">${tr('Save private photo','حفظ صورة خاصة')}</button><button type="button" id="ix-photo-approve" class="primary">${tr('Approve for public site','اعتماد للعرض العام')}</button><button type="button" id="ix-photo-appearance">${tr('Save appearance','حفظ تنسيق الصورة')}</button><button type="button" id="ix-photo-hide">${tr('Unpublish photo','إلغاء ظهور الصورة')}</button><button type="button" id="ix-photo-remove">${tr('Delete stored photo','حذف الصورة المحفوظة')}</button></div>
 <p id="ix-photo-message" role="status" aria-live="polite"></p><p class="muted" id="ix-photo-state"></p></div></div>`;
 panel.insertBefore(block,panel.querySelector('#identity-form'));
 const $=sel=>block.querySelector(sel),preview=$('#ix-photo-preview'),file=$('#ix-photo-file'),feedback=$('#ix-photo-message'),state=$('#ix-photo-state');let selectedData='';
 const fields=['portrait_placement','portrait_style','portrait_size','portrait_focus_x','portrait_focus_y'];
 const setMsg=text=>{feedback.textContent=text};
 const appearance=()=>Object.fromEntries(fields.map(k=>[k,$(`[name="${k}"]`).value]));
 const previewStyle=()=>{const cfg=appearance();preview.className=`ix-photo-preview ix-photo--${cfg.portrait_style} ix-photo-size--${cfg.portrait_size}`;preview.style.setProperty('--ix-photo-focus',`${cfg.portrait_focus_x}% ${cfg.portrait_focus_y}%`)};
 for(const k of fields)$(`[name="${k}"]`).oninput=previewStyle;
 const show=data=>{preview.replaceChildren();if(!data){preview.innerHTML='<span class="ix-photo-placeholder" aria-hidden="true">IX<span>.</span></span>';return;}const img=document.createElement('img');img.src=data;img.alt=tr('Private photo preview','معاينة خاصة لصورتك');preview.append(img)};
 async function refresh(){const v=await api('profile-photo');for(const k of fields)$(`[name="${k}"]`).value=String(v.appearance[k]);selectedData=v.draft||'';show(selectedData);previewStyle();state.textContent=v.approved?tr('Photo approved locally. Use Smart Publishing to update GitHub Pages.','الصورة معتمدة محليًا. استخدم النشر الذكي لتحديث GitHub Pages.'):v.hasDraft?tr('Private draft saved. Not visible to visitors.','مسودة خاصة محفوظة، ولا تظهر للزوار.'):tr('No photo has been uploaded yet.','لم تُرفع صورة بعد.');}
 file.onchange=async()=>{if(!file.files[0])return;try{setMsg(tr('Preparing photo in your browser…','جارٍ تجهيز الصورة داخل المتصفح…'));selectedData=await optimize(file.files[0]);show(selectedData);previewStyle();setMsg(tr('Preview ready. Click Save private photo; visitors cannot see it yet.','المعاينة جاهزة. اضغط حفظ صورة خاصة؛ الزوار لا يستطيعون رؤيتها الآن.'))}catch(e){file.value='';setMsg(e.message)}};
 async function run(action,b={},confirmText=''){if(confirmText&&!confirm(confirmText))return;try{setMsg(tr('Processing…','جارٍ التنفيذ…'));await api('profile-photo',{action,...b});await refresh();setMsg({upload:tr('Photo saved as a private draft.','تم حفظ الصورة كمسودة خاصة.'),approve:tr('Approved. Publish via Data & GitHub when ready.','تم الاعتماد. انشر من البيانات وGitHub عندما تكون جاهزًا.'),appearance:tr('Appearance saved.','تم حفظ التنسيق.'),hide:tr('Photo hidden locally; publish to update visitors.','تم إخفاء الصورة محليًا؛ انشر لتطبيق ذلك للعامة.'),remove:tr('Photo deleted locally; publish to update the public site.','تم حذف الصورة محليًا؛ انشر لتحديث الموقع العام.')}[action]||tr('Saved','تم الحفظ'))}catch(e){setMsg(e.message)}}
 $('#ix-photo-save').onclick=()=>{if(!selectedData){setMsg(tr('Choose a photo first.','اختر صورة أولًا.'));return;}run('upload',{data:selectedData.slice('data:image/webp;base64,'.length)})};
 $('#ix-photo-approve').onclick=()=>run('approve',{confirm:true},tr('Make your saved portrait eligible for public publication?','اعتماد الصورة المحفوظة للنشر العام؟'));
 $('#ix-photo-appearance').onclick=()=>run('appearance',appearance());
 $('#ix-photo-hide').onclick=()=>run('hide',{confirm:true},tr('Hide the public portrait on the next publish?','إخفاء الصورة من الموقع العام عند النشر القادم؟'));
 $('#ix-photo-remove').onclick=()=>run('remove',{confirm:true},tr('Remove the current saved photo and private draft? Earlier versions may remain in private Git history.','حذف الصورة والمسودة من النسخة الحالية؟ قد تبقى نسخ سابقة في سجل Git الخاص.'));
 try{await refresh()}catch(e){setMsg(tr('Could not load photo settings: ','تعذر تحميل إعدادات الصورة: ')+e.message)}
}
