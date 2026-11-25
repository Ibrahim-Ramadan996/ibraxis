// Progressive enhancement only: show loaded domain favicons; leave initials if absent.
export function enhanceAchievementLogos(root=document){
 for(const img of root.querySelectorAll('img[data-achievement-logo]')){
  if(img.dataset.ixLogoBound==='1')continue;
  img.dataset.ixLogoBound='1';
  const reveal=()=>{
   if(img.naturalWidth>0)img.closest('.ix-achievement-brand')?.classList.add('ix-achievement-brand--loaded');
  };
  img.addEventListener('load',reveal,{once:true});
  if(img.complete)reveal();
 }
}
