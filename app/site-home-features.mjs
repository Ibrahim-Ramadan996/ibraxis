/** Adds real, public-SSR-compatible site features via reviewed JSON edits. */
import {createHash} from 'node:crypto';
import {validatePublicFeatures} from './site-features.js';
export async function stageHomeFeature(builder,ctx,{request,title='',description='',url=''}={}){
 if(typeof request!=='string'||request.trim().length<5||request.length>1500)throw Error('Describe the improvement briefly');
 if(typeof title!=='string'||title.length>80||typeof description!=='string'||description.length>2500||typeof url!=='string'||url.length>500)throw Error('Invalid feature fields');
 const kind=/(?:زر|button|link|رابط)/i.test(request)?'button':/(?:قسم|section|جزء)/i.test(request)?'section':null;
 if(!kind)throw Error('الإضافة المباشرة تدعم قسم أو زر. استخدم وضع AI للوظائف الأكبر.');
 const heading=title.trim()||request.replace(/^(?:ضيف|أضف|اعمل|create|add)\s*/i,'').slice(0,80);
 const id=createHash('sha256').update(`${kind}:${heading.trim().toLowerCase()}`).digest('hex').slice(0,12);
 const current=await builder.readText(ctx,'app/site-features.json');
 const features=validatePublicFeatures(JSON.parse(current));
 if(features.some(x=>x.id===id))throw Error('This feature already exists');
 const candidate={id,kind,title:heading.trim(),description:description.trim(),url:url.trim()};
 const updated=validatePublicFeatures([...features,candidate]);
 return builder.stage(ctx,{description:`إضافة ${kind==='button'?'زر':'قسم'} للصفحة الرئيسية: ${heading}`,changes:[{action:'update',path:'app/site-features.json',content:JSON.stringify(updated,null,2)+'\n'}]});
}
