import {validateIcon} from './identity.js';

export const managerKinds=Object.freeze(['skill','education','career','certification']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const text=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim():null;
const normalize=v=>String(v??'').normalize('NFKC').toLocaleLowerCase().trim();
const duplicateKey=(kind,row)=>{
 if(kind==='skill'){
  const icon=normalize(row.icon);
  if(icon)return `${kind}:icon:${icon}`;
 }
 return `${kind}:title:${normalize(row.ar_title||row.title)}|${normalize(row.en_title||row.title)}`;
};

export const aiManagerInstruction=`You are IBRAXIS AI Manager. You can only propose structured management actions. Never invent dates, institutions, credentials, employers, results or personal facts. Return exactly one JSON object.
Allowed actions:
{"action":"answer","message":"..."}
{"action":"read","kind":"skill|education|career|certification|all","query":"..."}
{"action":"preview_create","records":[{"kind":"skill|education|career|certification","title":"...","ar_title":"...","en_title":"...","body":"...","ar_body":"...","en_body":"...","icon":"optional valid icon"}]}
{"action":"preview_update","id":"32 hex characters","patch":{"title":"...","ar_title":"...","en_title":"...","body":"...","ar_body":"...","en_body":"...","icon":"..."}}
Never request or output secrets. Only propose draft records. Never publish, delete, add project/product/service/client/article records, change the portrait, or modify a published record. Read existing records and avoid duplicates.`;

export function readManagerContext(records=[],kind='all',query=''){
 if(!Array.isArray(records)||typeof kind!=='string'||typeof query!=='string')throw Error('Invalid manager context');
 const q=normalize(query);
 return records
  .filter(row=>row&&row.status!=='deleted'&&(kind==='all'||row.kind===kind))
  .filter(row=>!q||[row.title,row.ar_title,row.en_title,row.body,row.ar_body,row.en_body,row.icon].some(v=>normalize(v).includes(q)))
  .slice(0,100)
  .map(row=>({id:row.id,kind:row.kind,title:row.title,ar_title:row.ar_title,en_title:row.en_title,body:row.body,ar_body:row.ar_body,en_body:row.en_body,status:row.status,icon:row.icon||'',catalog:row.catalog||''}));
}

export function validateManagerPlan(raw,records=[]){
 if(!plain(raw)||typeof raw.action!=='string')throw Error('Invalid manager plan');
 if(raw.action==='answer'){
  const message=text(raw.message,4000);
  if(!message)throw Error('Empty answer');
  return {action:'answer',message};
 }
 if(raw.action==='read'){
  if(!['all',...managerKinds].includes(raw.kind))throw Error('Invalid read kind');
  if(typeof raw.query!=='string'||raw.query.length>180)throw Error('Invalid search');
  return {action:'read',kind:raw.kind,query:raw.query.trim(),rows:readManagerContext(records,raw.kind,raw.query)};
 }
 if(raw.action==='preview_create'){
  if(!Array.isArray(raw.records)||raw.records.length<1||raw.records.length>20)throw Error('Invalid draft batch');
  const seen=new Set(),out=[];
  for(const item of raw.records){
   if(!plain(item)||!managerKinds.includes(item.kind))throw Error('Invalid draft kind');
   const title=text(item.title,150);
   const arTitle=text(item.ar_title??'',150)??'';
   const enTitle=text(item.en_title??'',150)??'';
   const body=text(item.body??'',30000)??'';
   const arBody=text(item.ar_body??'',30000)??'';
   const enBody=text(item.en_body??'',30000)??'';
   if(!title)throw Error('Draft title required');
   let icon='';
   if(item.icon!==undefined){icon=validateIcon(String(item.icon));}
   const draft={kind:item.kind,brand:'personal',status:'draft',title,ar_title:arTitle,en_title:enTitle,body,ar_body:arBody,en_body:enBody,icon};
   const key=duplicateKey(item.kind,draft);
   if(seen.has(key))throw Error('Duplicate draft in batch');
   seen.add(key);
   if(records.some(row=>row.kind===item.kind&&row.status!=='deleted'&&duplicateKey(item.kind,row)===key))throw Error('Draft matches an existing record');
   out.push(draft);
  }
  return {action:'preview_create',records:out};
 }
 if(raw.action==='preview_update'){
  if(!/^[a-f0-9]{32}$/.test(raw.id||''))throw Error('Invalid record id');
  const row=records.find(x=>x.id===raw.id&&x.status!=='deleted');
  if(!row||!managerKinds.includes(row.kind))throw Error('Record not editable');
  if(row.status==='published')throw Error('Published records require explicit protected editing');
  if(!plain(raw.patch)||Object.keys(raw.patch).length<1)throw Error('Invalid patch');
  const allowed=new Set(['title','ar_title','en_title','body','ar_body','en_body','icon']);
  if(Object.keys(raw.patch).some(k=>!allowed.has(k)))throw Error('Unsupported patch field');
  const patch={},changes=[];
  for(const [field,value] of Object.entries(raw.patch)){
   const max=field.endsWith('_title')||field==='title'?150:30000;
   let next;
   if(field==='icon')next=validateIcon(String(value??''));
   else{next=text(value,max);if(next===null)throw Error('Invalid patch value');if(field==='title'&&!next)throw Error('Title required');}
   if(String(row[field]??'')!==next){
    patch[field]=next;
    changes.push({field,before:String(row[field]??''),after:next});
   }
  }
  if(!changes.length)return {action:'answer',message:'No changes / لا توجد تغييرات.'};
  return {action:'preview_update',id:row.id,kind:row.kind,title:row.title,patch,changes,base:JSON.stringify(row)};
 }
 throw Error('Unsupported manager action');
}
