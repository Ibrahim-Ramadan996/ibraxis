/** Owner-only data ingestion adapter: extract => preview => validate existing manager draft plan. */
import {previewTextInput,previewFileInput,prepareReviewSelection} from './ai-kit/src/index.mjs';
import {validateManagerPlan} from './ai-manager.mjs';

const KIND={skills:'skill',education:'education',career:'career',certifications:'certification'};
const trim=(x,max)=>String(x??'').trim().slice(0,max);
const hasArabic=x=>/[\u0600-\u06ff]/.test(x);
export function readInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid input');
 if(raw.type==='text'){
  if(typeof raw.text!=='string'||!raw.text.trim())throw Error('لم يصل نص للمعاينة. لو رفعت CV، اختار «فهم الملفات» وتأكد إن اسم الملف ظاهر.');
  if(raw.text.length>100000)throw Error('النص أطول من الحد المسموح (100000 حرف).');
  return {type:'text',text:raw.text};
 }
 if(raw.type==='file'){
  if(typeof raw.filename!=='string'||raw.filename.length>240||!raw.filename)throw Error('Invalid filename');
  if(typeof raw.data!=='string'||raw.data.length>Math.ceil(4*1024*1024/3)*4+4||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw.data))throw Error('Invalid file data');
  const bytes=Buffer.from(raw.data,'base64');
  if(!bytes.length||bytes.length>4*1024*1024||bytes.toString('base64')!==raw.data)throw Error('File exceeds limit or has invalid encoding');
  return {type:'file',filename:raw.filename,bytes};
 }
 throw Error('Supported sources: text, file');
}
export function existingForIngestion(records){
 const result={skills:[],education:[],career:[],certifications:[]};
 for(const record of records){
  if(record.status==='deleted')continue;
  const category=Object.keys(KIND).find(k=>KIND[k]===record.kind);
  if(!category)continue;
  result[category].push({title:record.title,titleAr:record.ar_title,titleEn:record.en_title,name:record.title,icon:record.icon});
 }
 return result;
}
export async function previewIngestion(input,records){
 const source=readInput(input);
 const existingRecords=existingForIngestion(records);
 const result=source.type==='text'?await previewTextInput({text:source.text,existingRecords}):await previewFileInput({filename:source.filename,bytes:source.bytes,existingRecords});
 // Also reuse the existing Manager's canonical duplicate validator. This catches
 // previously approved drafts whose formatted titles contain combined fields.
 const accepted=[];
 for(const item of result.proposals){
  try{validateManagerPlan({action:'preview_create',records:[reviewedToDraft(item)]},records);accepted.push(item)}
  catch(e){
   if(/duplicate|matches an existing record/i.test(e.message))result.skippedDuplicates.push({category:item.category,evidence:item.evidence,reason:'existing_manager_record'});
   else accepted.push(item); // Let the final plan validator report field-specific errors.
  }
 }
 result.proposals=accepted;
 return result;
}
export function reviewedToDraft(item){
 if(!item||!KIND[item.category])throw Error('Unsupported proposal kind');
 const f=item.fields||{},kind=KIND[item.category];
 let title;
 if(kind==='skill')title=trim(f.name,150);
 else if(kind==='education')title=trim([f.degree,f.institution].filter(Boolean).join(' — '),150);
 else if(kind==='career')title=trim([f.position,f.organization].filter(Boolean).join(' — '),150);
 else title=trim(f.name,150);
 if(!title)throw Error('Proposal lacks a verified title');
 const quotes=(item.evidence||[]).map(e=>trim(e.quote,240)).filter(Boolean);
 const raw=trim(f.originalText||quotes.join('\n'),25000);
 const src=[...new Set((item.evidence||[]).map(e=>`${e.source||'text'} ${Object.entries(e.location||{}).map(([k,v])=>`${k}:${v}`).join(' ')}`))].join(' | ');
 const body=trim(`${raw}\n\nSource / المصدر: ${src||'text input'}${item.needsVerification?.length?`\nNeeds verification / يحتاج تحقق: ${item.needsVerification.join(', ')}`:''}`,30000);
 const ar=hasArabic(title);
 return {kind,title,ar_title:ar?title:'',en_title:ar?'':title,body,
  ar_body:hasArabic(raw)?raw:'',en_body:hasArabic(raw)?'':raw};
}
export async function prepareIngestionPlan(input,selectedIds,records){
 const preview=await previewIngestion(input,records);
 const selection=prepareReviewSelection(preview,selectedIds);
 if(selection.proposals.length<1||selection.proposals.length>20)throw Error('Select 1–20 proposals');
 const raw={action:'preview_create',records:selection.proposals.map(reviewedToDraft)};
 return {plan:validateManagerPlan(raw,records),selected:selection.proposals.map(p=>({id:p.id,category:p.category,evidence:p.evidence,needsVerification:p.needsVerification}))};
}
