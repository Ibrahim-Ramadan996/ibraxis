// Shared, dependency-free public contact settings and templates.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const contactFields=['contact_whatsapp','contact_float','contact_email','contact_booking','contact_message_ar','contact_message_en'];
export const requestKinds=['data','ai','dashboard','web','research','consultation','other'];
export const budgets=['unknown','small','medium','large','collaboration'];
export const timelines=['flexible','urgent','month','long'];
export function contactSettings(v={},strict=false){
 const clean=(k,max)=>{const x=v[k]??'';if(typeof x!=='string'||x.length>max||/[\r\n\x00-\x1f]/.test(x)){if(strict)throw Error('Invalid contact setting');return ''}return x.trim()};
 const phone=clean('contact_whatsapp',40).replace(/[\s()+-]/g,'');
 const email=clean('contact_email',160),booking=clean('contact_booking',500);let validBooking='';
 if(booking){try{const u=new URL(booking);if(u.protocol!=='https:'||u.username||u.password)throw Error();validBooking=u.href}catch{if(strict)throw Error('Booking URL must use HTTPS')}}
 const validPhone=/^[1-9]\d{7,14}$/.test(phone),validEmail=/^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email);
 if(strict&&((phone&&!validPhone)||(email&&!validEmail)))throw Error('Invalid international phone or email');
 const mode=v.contact_float??'off';if(strict&&!['on','off'].includes(mode))throw Error('Invalid WhatsApp visibility');
 return {contact_whatsapp:validPhone?phone:'',contact_float:mode==='on'&&validPhone?'on':'off',contact_email:validEmail?email:'',contact_booking:validBooking,contact_message_ar:clean('contact_message_ar',240),contact_message_en:clean('contact_message_en',240)};
}
export function whatsappURL(site,ar,message){const s=contactSettings(site);return s.contact_whatsapp?'https://wa.me/'+s.contact_whatsapp+'?text='+encodeURIComponent(message??(s[ar?'contact_message_ar':'contact_message_en']||(ar?'مرحبًا، أود التواصل بشأن مشروع.':'Hello, I would like to discuss a project.'))):''}
const icon='<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 11.8a8.8 8.8 0 0 1-13.2 7.6L3 21l1.5-4.6a8.8 8.8 0 1 1 16.3-4.6Z"/><path d="M8.3 7.7c-.6.4-.7 1.2-.3 2.2 1 2.6 3.3 5 5.8 5.8 1 .4 1.9.1 2.3-.5l.5-.9-2.6-1.4-.9 1c-1.5-.6-2.7-1.8-3.3-3.2l1-1-1.4-2.5-.7.5Z"/></svg>';
export function floatingContact(site,ar){const s=contactSettings(site);if(s.contact_float!=='on')return '';const label=ar?'تواصل عبر واتساب':'Contact on WhatsApp';return `<a class="ix-whatsapp-float" href="${esc(whatsappURL(s,ar))}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${icon}</a>`}
export function connectMarkup(site,ar,staticMode=false){const s=contactSettings(site),t=(en,a)=>ar?a:en,wa=whatsappURL(s,ar),hasChannel=!!(wa||s.contact_email),opts=(arr,labels)=>arr.map((k,i)=>`<option value="${k}">${labels[i]}</option>`).join('');const kinds=ar?['تحليل البيانات','الذكاء الاصطناعي','تصميم داشبورد','تطوير وبرمجة','بحث وابتكار','استشارة','تعاون آخر']:['Data analysis','Artificial intelligence','Dashboard design','Development','Research','Consultation','Other collaboration'];
 return `<section class="contact ix-connect" id="contact"><div class="ix-connect-intro"><div class="eyebrow">IBRAXIS / CONNECT</div><h2>${t('Turn your idea into reality.','لنحوّل فكرتك إلى واقع.')}</h2><p>${t('Tell me what you want to build, explore or improve.','أخبرني عن فكرة مشروعك أو التحليل الذي تحتاجه أو فرصة التعاون.')}</p><div class="ix-connect-tags">${kinds.slice(0,6).map(x=>`<span>${x}</span>`).join('')}</div><div class="ix-connect-channels">${wa?`<a class="secondary" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${icon} WhatsApp</a>`:''}${s.contact_email?`<a class="secondary" href="mailto:${esc(s.contact_email)}">${t('Email','البريد الإلكتروني')}</a>`:''}${s.contact_booking?`<a class="secondary" href="${esc(s.contact_booking)}" target="_blank" rel="noopener noreferrer">${t('Book a consultation','احجز استشارة')}</a>`:''}</div><p class="muted">${staticMode?t('Your request is prepared locally. You send it yourself through the selected contact channel. You may attach files there.','يُجهّز طلبك على جهازك، ثم ترسله بنفسك عبر وسيلة التواصل المختارة. يمكنك إرفاق الملفات هناك.'):t('Your request goes to the private owner workspace. Do not include passwords or sensitive files.','يصل الطلب إلى مساحة عمل المالك الخاصة. لا تضع كلمات مرور أو ملفات حساسة.')}</p></div>${staticMode&&!hasChannel?`<p class="ix-connect-empty">${t('Contact channels have not been configured yet.','لم يتم إعداد وسائل التواصل بعد.')}</p>`:`<form id="inquiry" class="ix-connect-form" hidden><h3>${t('Project brief','تفاصيل طلب المشروع')}</h3><label>${t('Project type','نوع المشروع')}<select name="kind">${opts(requestKinds,kinds)}</select></label><div class="ix-connect-pair"><label>${t('Name / company','الاسم أو الشركة')}<input name="name" required maxlength="100" autocomplete="name"></label><label>${t('Email','البريد الإلكتروني')}<input type="email" name="email" required maxlength="160" autocomplete="email" dir="ltr"></label></div><label>${t('Project title','عنوان المشروع')}<input name="title" required maxlength="150"></label><label>${t('Goals and requirements','الأهداف والمتطلبات')}<textarea name="body" required maxlength="${staticMode?1800:5000}" rows="5"></textarea></label><div class="ix-connect-pair"><label>${t('Budget','الميزانية')}<select name="budget">${opts(budgets,ar?['لم تُحدد','مشروع صغير','متوسط','متقدم','تعاون']:['Not decided','Small','Medium','Large','Collaboration'])}</select></label><label>${t('Timeline','المدة')}<select name="timeline">${opts(timelines,ar?['مرنة','عاجل','خلال شهر','أطول']:['Flexible','Urgent','Within a month','Longer'])}</select></label></div><input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><label class="ix-connect-consent"><input type="checkbox" name="consent" required> ${t('I agree to use these details to respond to my request.','أوافق على استخدام بياناتي للتواصل بشأن هذا الطلب.')}</label>${staticMode?`<div class="ix-connect-channels">${wa?`<button type="submit" class="primary" value="whatsapp">${t('Prepare WhatsApp message','جهّز رسالة واتساب')}</button>`:''}${s.contact_email?`<button type="submit" value="email">${t('Prepare email','جهّز بريدًا إلكترونيًا')}</button>`:''}</div>`:`<button class="primary" type="submit">${t('Send private inquiry','إرسال الطلب الخاص')}</button>`}<p id="message" role="status" aria-live="polite"></p></form>`}</section>`;
}
export function requestMessage(v,ar){const labels=ar?['الاسم','البريد','العنوان','النوع','الميزانية','المدة','التفاصيل']:['Name','Email','Title','Type','Budget','Timeline','Details'];const codes=[v.name,v.email,v.title,v.kind,v.budget,v.timeline,v.body];return labels.map((l,i)=>l+': '+String(codes[i]??'')).join('\n')}
export function bindConnect(root,site,ar,submit){const form=root.querySelector('#inquiry');if(!form)return;form.hidden=false;form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;const v=Object.fromEntries(new FormData(form));if(v.website)return;const status=form.querySelector('[role=status]');if(submit){const button=e.submitter; if(button)button.disabled=true;try{await submit({...v,consent:v.consent==='on'});form.reset();status.textContent=ar?'تم استلام طلبك.':'Your inquiry was received.'}catch(err){status.textContent=err.message}finally{if(button)button.disabled=false}return}const s=contactSettings(site),text=requestMessage({...v,kind:form.elements.kind.selectedOptions[0]?.textContent,budget:form.elements.budget.selectedOptions[0]?.textContent,timeline:form.elements.timeline.selectedOptions[0]?.textContent},ar),channel=e.submitter?.value|| (s.contact_whatsapp?'whatsapp':'email');const url=channel==='whatsapp'?whatsappURL(s,ar,text):s.contact_email?'mailto:'+s.contact_email+'?subject='+encodeURIComponent(v.title)+'&body='+encodeURIComponent(text):'';if(!url)return;status.textContent=ar?'تم تجهيز الطلب؛ أكمل الإرسال في التطبيق الذي فتحته.':'Draft prepared; complete sending in the opened app.';window.location.href=url;};}

// Owner-only presentation helper: never rendered in public static pages.
export function privateInquiryDetails(body,ar=true){
 const plain=()=>`<p class="ix-inquiry-plain">${esc(body)}</p>`;
 let data;try{data=JSON.parse(body)}catch{return plain()}
 if(!data||typeof data!=='object'||Array.isArray(data)||!['name','email','message','kind','budget','timeline'].some(k=>k in data))return plain();
 const names=ar?{name:'الاسم',email:'البريد الإلكتروني',message:'تفاصيل المشروع',kind:'نوع المشروع',budget:'الميزانية',timeline:'المدة'}:{name:'Name',email:'Email',message:'Details',kind:'Project type',budget:'Budget',timeline:'Timeline'};
 const codes={
  kind:{data:ar?'تحليل البيانات':'Data analysis',ai:ar?'ذكاء اصطناعي':'Artificial intelligence',dashboard:ar?'داشبورد':'Dashboard',web:ar?'تطوير وبرمجة':'Development',research:ar?'بحث':'Research',consultation:ar?'استشارة':'Consultation',other:ar?'أخرى':'Other'},
  budget:{unknown:ar?'غير محددة':'Not specified',small:ar?'صغير':'Small',medium:ar?'متوسط':'Medium',large:ar?'كبير':'Large',collaboration:ar?'تعاون':'Collaboration'},
  timeline:{flexible:ar?'مرنة':'Flexible',urgent:ar?'عاجل':'Urgent',month:ar?'خلال شهر':'Within a month',long:ar?'طويلة':'Longer'}
 };
 const fields=Object.entries(names).filter(([k])=>typeof data[k]==='string'&&data[k].trim()).map(([key,label])=>{
  const value=(codes[key]?.[data[key]]||data[key]).slice(0,5000);
  return `<div class="ix-inquiry-field"><dt>${esc(label)}</dt><dd${key==='email'?' dir="ltr"':''}>${esc(value)}</dd></div>`;
 });
 return fields.length?`<dl class="ix-inquiry-details">${fields.join('')}</dl>`:plain();
}

// Fallback template: private browser-only draft, explicitly NOT generated by AI.
export function localBusinessDraft(context,ar=true){
 const brief=String(context||'').trim().slice(0,6000);
 if(!brief)throw Error('Project details required');
 return ar?{
  summary:'مسودة أولية (بدون ذكاء اصطناعي) — وصف المشروع كما أدخلته:\n'+brief,
  feasibility:'تحتاج دراسة الجدوى إلى مراجعة البيانات والأهداف والموارد قبل إصدار حكم.',
  scope:'نطاق أولي مقترح للمراجعة: جمع المتطلبات، تحديد المخرجات، خطة التنفيذ، الاختبارات والتسليم.',
  timeline:'لم يتم تحديد مدة ملزمة؛ تُقدّر بعد مراجعة حجم العمل.',
  budget:'لا يوجد تسعير معتمد. يلزم تحديد التفاصيل والجهد والتكاليف.',
  questions:'ما الهدف النهائي؟ ما الملفات أو الأدوات المتاحة؟ ما تاريخ التسليم المطلوب؟',
  proposal:'هذه مسودة تنظيمية قابلة للتعديل وليست دراسة AI أو عرض سعر ملزم.'
 }:{
  summary:'Initial template (without AI) — project brief:\n'+brief,
  feasibility:'Feasibility requires a review of available data, goals and resources.',
  scope:'Draft scope for review: clarify requirements, deliverables, implementation, testing and handover.',
  timeline:'No committed timeline; estimate after reviewing work size.',
  budget:'No approved quote; scope and resource costs need review.',
  questions:'What is the goal? What files or tools are available? What is the desired delivery date?',
  proposal:'Editable organizational template only, not an AI analysis or binding quote.'
 };
}
