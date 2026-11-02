import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/results.js',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(source,context);
const {render,filterRows,toCSV}=context.window.HubSitesResults;
const rows=[
 {rank:7,name:'Zed O’Neil',division:'Open',points:42},
 {rank:2,name:'Alpha, Jr.',division:'Limited',points:0},
 {rank:2,name:'Élodie "E"',division:'Open',points:100},
 {rank:null,name:'Unranked',division:'',points:null}
];
const names=value=>Array.from(value,row=>row.name);

test('search trims and folds case while preserving punctuation and exact division filters',()=>{
 assert.deepEqual(names(filterRows(rows,{search:'  O’NEIL  '})),['Zed O’Neil']);
 assert.deepEqual(names(filterRows(rows,{search:'ÉLODIE',division:'Open'})),['Élodie "E"']);
 assert.deepEqual(names(filterRows(rows,{search:'Jr.',division:'Open'})),[]);
 assert.deepEqual(names(filterRows(rows,{division:'Limited'})),['Alpha, Jr.']);
});

test('sorting preserves tied/source ranks, genuine zero points and immutable input',()=>{
 const before=structuredClone(rows);
 assert.deepEqual(names(filterRows(rows)),['Alpha, Jr.','Élodie "E"','Zed O’Neil','Unranked']);
 const byPoints=filterRows(rows,{sort:'points'});
 assert.deepEqual(names(byPoints),['Élodie "E"','Zed O’Neil','Alpha, Jr.','Unranked']);
 assert.deepEqual(Array.from(byPoints,row=>row.rank),[2,7,2,null]);
 assert.equal(byPoints[2].points,0);
 assert.deepEqual(names(filterRows(rows.slice(0,2),{sort:'name'})),['Alpha, Jr.','Zed O’Neil']);
 assert.deepEqual(rows,before);
});

// Parse CSV records rather than comparing a serialization snapshot, including
// embedded commas, quotes and newlines that must remain within a single cell.
function parseCSV(csv){
 const records=[],row=[];let value='',quoted=false;
 for(let i=csv.charCodeAt(0)===0xfeff?1:0;i<csv.length;i++){
  const c=csv[i];
  if(c==='"'){if(quoted&&csv[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(value);value='';}
  else if(c==='\r'&&csv[i+1]==='\n'&&!quoted){row.push(value);records.push([...row]);row.length=0;value='';i++;}
  else value+=c;
 }
 assert.equal(quoted,false);return records;
}

test('CSV preserves Unicode, embedded quotes/newlines and exact numeric zero',()=>{
 const records=parseCSV(toCSV([{rank:2,name:'Élodie, "E"\nSecond line',division:'Open',points:0}]));
 assert.deepEqual(records,[['Rank','Shooter','Division','Points'],['2','Élodie, "E"\nSecond line','Open','0']]);
 assert.equal(toCSV(rows).charCodeAt(0),0xfeff);
});

test('CSV neutralizes every spreadsheet formula prefix in all text columns',()=>{
 const unsafe=['=1+1','+SUM(1,2)','-2+3','@SUM(1,2)','\tcommand','\rcommand','  =1+1'];
 for(const value of unsafe){
  const record=parseCSV(toCSV([{rank:value,name:value,division:value,points:value}]))[1];
  assert.deepEqual(record,Array(4).fill("'"+value));
 }
 assert.deepEqual(parseCSV(toCSV([{rank:-1,name:'Safe person',division:'Open',points:-5}]))[1],['-1','Safe person','Open','-5']);
});

test('rendering covers empty publication, accessible headings and compact limits without controls',()=>{
 const full=render(rows,{title:'Season <results>'});
 assert.equal((full.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr>/g)||[]).length,4);
 assert.equal((full.match(/scope="col"/g)||[]).length,4);
 assert.equal((full.match(/scope="row"/g)||[]).length,4);
 assert.match(full,/<caption[^>]*>Season &lt;results&gt;<\/caption>/);
 assert.match(full,/aria-live="polite"/);
 assert.match(render([]),/No results have been published/);
 const six=Array.from({length:6},(_,i)=>({rank:i+1,name:'Fixture '+i,division:'Open',points:i}));
 const compact=render(six,{compact:true});
 assert.equal((compact.match(/<tr>/g)||[]).length,6); // One heading row plus five source rows.
 assert.doesNotMatch(compact,/data-results-query|data-results-csv|data-results-source/);
 assert.equal((render(six,{compact:true,limit:2}).match(/scope="row"/g)||[]).length,2);
});

class Control {
 constructor(value=''){this.value=value;this.listeners={};this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';}
 addEventListener(type,handler){this.listeners[type]=handler;}
 dispatch(type){this.listeners[type]();}
 focus(){this.focused=true;}
}
test('mounted filters update rows/count/empty state and CSV exports only the current rows',async()=>{
 const controls=Object.fromEntries(['query','division','sort','clear','csv','body','count','empty','download-status'].map(key=>[key,new Control(key==='sort'?'rank':'')]));
 const scroll=new Control(),root={dataset:{resultsSource:JSON.stringify(rows)},hasAttribute:name=>name==='data-results-source',querySelector:selector=>selector==='.results-ui-scroll'?scroll:controls[selector.slice('[data-results-'.length,-1)]};
 let exported,clicks=0;const urls=[];
 const sandbox={window:{},document:{querySelectorAll:()=>[root],createElement:()=>({click(){clicks++;}})},Blob,URL:{createObjectURL(blob){exported=blob;return 'blob:fixture';},revokeObjectURL:url=>urls.push(url)},setTimeout:fn=>fn()};
 vm.runInNewContext(source,sandbox);sandbox.window.HubSitesResults.mount();sandbox.window.HubSitesResults.mount();
 controls.division.value='Open';controls.division.dispatch('change');controls.sort.value='points';controls.sort.dispatch('change');
 assert.equal(controls.count.textContent,'2 of 4 results');assert.equal(scroll.hidden,false);assert.equal(controls.clear.hidden,false);
 controls.csv.dispatch('click');assert.equal(clicks,1);assert.deepEqual(urls,['blob:fixture']);
 const csv=parseCSV(await exported.text());assert.deepEqual(csv.slice(1).map(record=>record[1]),['Élodie "E"','Zed O’Neil']);
 assert.deepEqual(csv.slice(1).map(record=>record[0]),['2','7']);
 controls.query.value='Nobody';controls.query.dispatch('input');
 assert.equal(controls.count.textContent,'0 of 4 results');assert.equal(controls.empty.hidden,false);assert.equal(scroll.hidden,true);assert.equal(controls.csv.disabled,true);
 controls.csv.dispatch('click');assert.equal(clicks,1);
 controls.clear.dispatch('click');assert.equal(controls.query.value,'');assert.equal(controls.division.value,'');assert.equal(controls.query.focused,true);
 assert.equal(controls.count.textContent,'4 of 4 results');assert.equal(controls.empty.hidden,true);assert.equal(controls.csv.disabled,false);
});
