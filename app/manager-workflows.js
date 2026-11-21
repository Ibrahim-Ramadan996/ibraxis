import {mountIngestionPanel} from './manager-input-panel.js';
import {mountSiteBuilderPanel} from './manager-site-panel.js';

async function fileInput(file){
 if(!file||file.size>4*1024*1024||file.size<1)throw Error('File must be between 1 byte and 4 MB');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const parts=[];
 for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
 return {type:'file',filename:file.name,data:btoa(parts.join(''))};
}
export function mountManagerWorkflows(panel,{api,refresh,ar}){
 const section=document.createElement('section');section.className='card';
 section.innerHTML=`<h3>${ar?'إدخال البيانات وفهم الملفات':'Understand text and files'}</h3><p>${ar?'راجع البيانات المستخرجة، وحدد المطلوب، ووافق قبل الحفظ.':'Inspect extracted facts, select them, and approve before saving.'}</p>`;
 panel.append(section);
 const decision=document.createElement('div');decision.className='ix-manager-output';section.append(decision);
 let pending=null;
 const fileToRequest=async(data,mode)=>mode==='text'?{type:'text',text:data}:fileInput(data[0]);
 const inputPanel=mountIngestionPanel(section,{
  previewText:async(text)=>api('ai/manager/ingest/preview',{input:{type:'text',text}}),
  previewFile:async(file)=>api('ai/manager/ingest/preview',{input:await fileInput(file)}),
  onPreparePlan:async({selectedIds,input,mode})=>{
   const v=await api('ai/manager/ingest/prepare',{input:await fileToRequest(input,mode),selectedIds});
   pending=v.id;decision.replaceChildren();
   const title=document.createElement('h4');title.textContent=ar?`راجع ${v.records.length} مسودة قبل الحفظ`:`Review ${v.records.length} drafts before saving`;decision.append(title);
   for(const d of v.records){const p=document.createElement('p');p.textContent=`${d.kind}: ${d.title}`;decision.append(p)}
   const approve=document.createElement('button');approve.type='button';approve.className='primary';approve.textContent=ar?'أوافق واحفظ المسودات':'Approve and save drafts';
   const reject=document.createElement('button');reject.type='button';reject.textContent=ar?'رفض':'Reject';
   approve.onclick=async()=>{
    if(!pending||!confirm(ar?'هل توافق على حفظ المسودات الخاصة الموضحة فقط؟':'Save only these private drafts?'))return;
    approve.disabled=true;
    try{const v=await api('ai/manager/execute',{id:pending,confirm:true});pending=null;await refresh();decision.textContent=ar?`تم حفظ ${v.created.length} مسودة بدون نشر.`:`Saved ${v.created.length} drafts without publishing.`;}
    catch(e){decision.textContent=e.message;}
   };
   reject.onclick=async()=>{if(!pending)return;try{await api('ai/manager/cancel',{id:pending});pending=null;decision.textContent=ar?'تم الرفض، بدون حفظ.':'Rejected, nothing saved.';}catch(e){decision.textContent=e.message}};
   decision.append(approve,reject);
  },
 });
 const site=document.createElement('section');site.className='card';panel.append(site);
 site.innerHTML=`<h3>${ar?'تطوير الموقع بعد الموافقة':'Approve website improvements'}</h3>`;
 mountSiteBuilderPanel(site,{
  previewRequest:data=>api('ai/manager/site/preview',data),
  approvePlan:data=>api('ai/manager/site/approve',data),
  rejectPlan:data=>api('ai/manager/site/reject',data),
  undoChange:data=>api('ai/manager/site/undo',data),
 });
 return {inputPanel};
}
