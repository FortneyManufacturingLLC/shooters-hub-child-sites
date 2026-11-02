(() => {
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const list=value=>Array.isArray(value)?value:[];
 const normal=value=>String(value??'').trim().toLocaleLowerCase();
 const number=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
 function filterRows(rows,{search='',division='',sort='rank'}={}){
  const query=normal(search);
  return list(rows).filter(row=>normal(row.name).includes(query)&&(!division||row.division===division)).sort((a,b)=>{
   if(sort==='name')return String(a.name??'').localeCompare(String(b.name??''),undefined,{sensitivity:'base'});
   const key=sort==='points'?'points':'rank',av=number(a[key]),bv=number(b[key]);
   if(av===null)return bv===null?0:1;if(bv===null)return -1;
   return sort==='points'?bv-av:av-bv;
  });
 }
 function csvCell(value){
  let content=String(value??'');
  // Quoting alone does not prevent spreadsheet formula execution. Keep source
  // numbers numeric; prefix unsafe text, including whitespace-prefixed formulas.
  if(typeof value==='string'&&(/^[\t\r\n]/.test(content)||/^\s*[=+\-@]/.test(content)))content="'"+content;
  return '"'+content.replace(/"/g,'""')+'"';
 }
 function toCSV(rows){return '\uFEFF'+[['Rank','Shooter','Division','Points'],...list(rows).map(row=>[row.rank,row.name,row.division,row.points])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
 const rowHTML=rows=>rows.map(row=>`<tr><td>${esc(row.rank??'—')}</td><th scope="row">${esc(row.name)}</th><td>${esc(row.division||'—')}</td><td>${esc(row.points??'—')}</td></tr>`).join('');
 function render(rows,{title='Published results',compact=false,limit}={}){
  const max=Number.isInteger(limit)&&limit>=0?limit:compact?5:undefined;
  const source=max===undefined?list(rows).slice():list(rows).slice(0,max);
  const divisions=[...new Set(source.map(row=>row.division).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const displayed=compact?source:filterRows(source);
  return `<section class="results-ui ${compact?'results-ui-compact':''}" data-results-ui ${!compact?`data-results-source="${esc(JSON.stringify(source))}"`:''}>
   ${!compact&&source.length?`<div class="results-ui-controls"><label>Find a shooter<input type="search" data-results-query placeholder="Shooter name" autocomplete="off"></label><label>Division<select data-results-division><option value="">All divisions</option>${divisions.map(division=>`<option value="${esc(division)}">${esc(division)}</option>`).join('')}</select></label><label>Sort results<select data-results-sort><option value="rank">Rank: lowest first</option><option value="points">Points: highest first</option><option value="name">Shooter: A–Z</option></select></label></div><div class="results-ui-toolbar"><p data-results-count role="status" aria-live="polite" aria-atomic="true">${source.length} ${source.length===1?'result':'results'}</p><button type="button" class="text-button" data-results-clear hidden>Clear filters</button><button type="button" class="button" data-results-csv>Download CSV</button></div>`:''}
   <div class="results-ui-scroll" role="region" aria-label="${esc(title)} table" tabindex="0"><table class="standings-table results-ui-table"><caption class="sr-only">${esc(title)}</caption><thead><tr><th scope="col">Rank</th><th scope="col">Shooter</th><th scope="col">Division</th><th scope="col">Points</th></tr></thead><tbody data-results-body>${rowHTML(displayed)}</tbody></table></div>
   <p class="results-ui-empty" data-results-empty ${source.length?'hidden':''}>${source.length?'No shooters match these filters.':'No results have been published.'}</p>
   ${!compact&&source.length?'<p class="results-ui-download-status" data-results-download-status role="status"></p>':''}
  </section>`;
 }
 function mount(){
  document.querySelectorAll('[data-results-ui]').forEach(root=>{
   if(root.dataset.mounted||!root.hasAttribute('data-results-source'))return;
   root.dataset.mounted='true';
   let rows;try{rows=JSON.parse(root.dataset.resultsSource);}catch{return;}
   const query=root.querySelector('[data-results-query]');if(!query)return;
   const division=root.querySelector('[data-results-division]'),sort=root.querySelector('[data-results-sort]'),clear=root.querySelector('[data-results-clear]'),csv=root.querySelector('[data-results-csv]'),body=root.querySelector('[data-results-body]'),count=root.querySelector('[data-results-count]'),empty=root.querySelector('[data-results-empty]'),scroll=root.querySelector('.results-ui-scroll'),status=root.querySelector('[data-results-download-status]');
   let current=filterRows(rows);
   const update=()=>{
    current=filterRows(rows,{search:query.value,division:division.value,sort:sort.value});
    body.innerHTML=rowHTML(current);count.textContent=current.length+' of '+rows.length+' results';
    empty.hidden=current.length!==0;scroll.hidden=!current.length;csv.disabled=!current.length;
    clear.hidden=!query.value&&!division.value;status.textContent='';
   };
   query.addEventListener('input',update);division.addEventListener('change',update);sort.addEventListener('change',update);
   clear.addEventListener('click',()=>{query.value='';division.value='';update();query.focus();});
   csv.addEventListener('click',()=>{
    if(!current.length)return;
    const url=URL.createObjectURL(new Blob([toCSV(current)],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');
    anchor.href=url;anchor.download='jackalope-results.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent=current.length+' '+(current.length===1?'result':'results')+' exported. CSV files are snapshots of the published information.';
   });
  });
 }
 window.HubSitesResults={render,mount,filterRows,toCSV};
})();
