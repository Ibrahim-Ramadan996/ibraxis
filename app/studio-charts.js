// Browser-only chart DOM + pure, testable aggregate helpers.
export function visibleGroups(groups,query='',order='desc'){
 if(!Array.isArray(groups)||groups.length>100||!['desc','asc','name'].includes(order)||typeof query!=='string'||query.length>200)throw Error('Invalid chart filter');
 const rows=groups.filter(g=>g&&typeof g.label==='string'&&g.label.length<=120&&(g.value===null||typeof g.value==='number'&&Number.isFinite(g.value))&&g.label.toLowerCase().includes(query.toLowerCase()));
 return rows.sort((a,b)=>order==='name'?a.label.localeCompare(b.label):order==='asc'?(a.value??-Infinity)-(b.value??-Infinity):(b.value??-Infinity)-(a.value??-Infinity));
}
const safeCell=value=>{let s=String(value??'');if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function chartCSV(rows,measure='Value'){
 if(!Array.isArray(rows)||rows.length>100||rows.some(x=>typeof x.label!=='string'||!(x.value===null||typeof x.value==='number'&&Number.isFinite(x.value))))throw Error('Invalid chart series');
 return '\uFEFF'+[[ 'Group', measure ],...rows.map(x=>[x.label,x.value])].map(row=>row.map(safeCell).join(',')).join('\r\n');
}
export function mountChart(root,groups,{mode='bars',ar=false}={}){
 if(!['bars','columns','table'].includes(mode)||!root||typeof document==='undefined')throw Error('Invalid chart mode');
 root.replaceChildren();root.className='ix-chart ix-chart--'+mode;
 if(!groups.length){const p=document.createElement('p');p.textContent=ar?'لا توجد نتائج مطابقة':'No matching results';root.append(p);return;}
 const max=Math.max(1,...groups.map(x=>Math.abs(x.value??0)));
 if(mode==='table'){
  const table=document.createElement('table');table.className='ix-chart-table';const thead=table.createTHead(),head=thead.insertRow();for(const t of [ar?'المجموعة':'Group',ar?'القيمة':'Value']){const th=document.createElement('th');th.textContent=t;head.append(th)}const body=table.createTBody();for(const g of groups){const row=body.insertRow();row.insertCell().textContent=g.label;row.insertCell().textContent=g.value===null?'—':g.value.toLocaleString()}root.append(table);return;
 }
 for(const g of groups.slice(0,30)){
  const item=document.createElement('div');item.className='ix-chart-item';const label=document.createElement('span');label.className='ix-chart-label';label.textContent=g.label;const track=document.createElement('div');track.className='ix-chart-track';track.setAttribute('role','img');track.setAttribute('aria-label',g.label+': '+(g.value??'—'));const bar=document.createElement('div');bar.className='ix-chart-bar';bar.style.setProperty('--ix-value',(Math.abs(g.value??0)/max*100)+'%');if((g.value??0)<0)bar.classList.add('ix-chart-negative');track.append(bar);const value=document.createElement('strong');value.textContent=g.value===null?'—':g.value.toLocaleString();item.append(label,track,value);root.append(item);
 }
 if(groups.length>30){const note=document.createElement('p');note.textContent=ar?'يظهر أول 30 عنصرًا فقط. استخدم البحث أو جدول البيانات لعرض البقية.':'Showing the first 30 items. Search or use table view for more.';root.append(note)}
}
