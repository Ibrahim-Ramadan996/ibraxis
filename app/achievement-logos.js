// Automatic favicon resolution for any validated achievement domain.
export function enhanceAchievementLogos(root=document){
 for(const img of root.querySelectorAll('img[data-achievement-logo]')){
  if(img.dataset.ixLogoBound==='1')continue;
  img.dataset.ixLogoBound='1';

  const googleSrc=img.src;
  let host='';
  try{
   host=new URL(googleSrc).searchParams.get('domain')||'';
  }catch{}

  if(!/^[a-z0-9.-]+$/i.test(host)||!host.includes('.'))continue;

  const duckSrc='https://icons.duckduckgo.com/ip3/'+host+'.ico';
  const brand=img.closest('.ix-achievement-brand');

  const reveal=()=>{
   if(img.naturalWidth>0)
    brand?.classList.add('ix-achievement-brand--loaded');
  };

  img.addEventListener('load',reveal);
  img.addEventListener('error',()=>{
   if(img.src===duckSrc)img.src=googleSrc;
  });

  brand?.classList.remove('ix-achievement-brand--loaded');
  img.src=duckSrc;
  if(img.complete)reveal();
 }
}
