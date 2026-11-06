import test from 'node:test';
import assert from 'node:assert/strict';
import {SHARE_LIMITS,normaliseShareItem,shareItemFromEntity,resultCsv,resultCalendar,googleCalendarHref} from '../src/share.mjs';
import {createShareDialog} from '../src/share-dialog.mjs';
const origin='https://jackaloperhs.com',now='2026-11-06T14:30:00Z';
const match=(patch={})=>({id:'brookston',kind:'match',title:'Brookston opener',summary:'Official match',dateIso:'2026-11-06',locationLabel:'Brookston, MN',destination:{webHref:'/matches/brookston'},...patch});
const unfold=value=>value.replaceAll('\r\n ','');

test('public snapshot preserves revision-pinned child links and bounded presentation without mutating input',()=>{
 const input={id:'rules',kind:'other',title:'Rules'.repeat(100),href:'/rules?revision=2026-10-31&view=changes#rule-860cfbc52e81',metadata:Array(20).fill('x'.repeat(500)),image:{url:'/assets/logo.jpg',alt:'Logo'},recipientIds:['private'],destination:{nativeRoute:'/private'}};
 const result=normaliseShareItem(input,{origin});
 assert.equal(result.href,origin+input.href);assert.equal(result.title.length,SHARE_LIMITS.title);assert.equal(result.metadata.length,SHARE_LIMITS.metadata);assert.equal(result.metadata[0].length,SHARE_LIMITS.metadataText);
 assert.equal(result.image.url,origin+'/assets/logo.jpg');assert.equal(result.recipientIds,undefined);assert.equal(result.destination,undefined);assert.equal(input.title.length,500);
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.metadata)&&Object.isFrozen(result.image));assert.equal(shareItemFromEntity,normaliseShareItem);
});

test('share links reject executable, credentialed, ambiguous and control-injected URLs',()=>{
 for(const href of ['javascript:alert(1)','data:text/html,x','file:///secret','//evil.example/x','https://user:pass@example.com/','/rules\r\nX-Injection:1','/\\evil.example','https://example.com/a b']){
  assert.throws(()=>normaliseShareItem({title:'Rules',href},{origin}),TypeError,href);
 }
 assert.throws(()=>normaliseShareItem({title:'Rules',href:'/rules'}),TypeError);
 assert.throws(()=>normaliseShareItem({title:'Rules',href:'/rules'},{origin:'javascript:evil'}),TypeError);
 assert.equal(normaliseShareItem({title:'External',href:'https://example.com/path?a=1#section'}).href,'https://example.com/path?a=1#section');
});

test('CSV exports only supplied scope and quotes cells while neutralizing spreadsheet formula prefixes',()=>{
 const csv=resultCsv([match({title:' \t=HYPERLINK("https://evil")',locationLabel:'+cmd',summary:'not exported',statusLabel:'@SUM(1)',distanceLabel:'-1+2'}),match({title:'Two, "quoted"\nlines',destination:{webHref:'javascript:alert(1)'}})]);
 assert.match(csv,/"'=HYPERLINK\(""https:\/\/evil""\)"/);assert.match(csv,/"'\+cmd"/);assert.match(csv,/"'@SUM\(1\)"/);assert.match(csv,/"'-1\+2"/);
 assert.match(csv,/"Two, ""quoted""\nlines"/);assert.match(csv,/"\/matches\/brookston"/);assert.doesNotMatch(csv,/javascript|not exported/);
 assert.equal(resultCsv([]),'"Type","Title","Date","Location","Status","Distance","URL"');
});

test('calendar omits undated/TBD/non-match records and never coerces local timestamps into UTC',()=>{
 const invalid=[match({dateIso:undefined}),match({dateIso:'TBD'}),match({dateIso:'2026-02-29'}),match({kind:'club'}),match({startIso:'2026-11-06T09:00:00'}),match({startIso:'2026-02-30T09:00:00Z'}),match({startIso:'2026-11-06T24:00:00Z'}),match({timeTbd:true,dateIso:undefined,startIso:'2026-11-06T09:00:00Z'})];
 assert.equal(resultCalendar(invalid,{origin,now}),null);for(const row of invalid)assert.equal(googleCalendarHref(row,{origin}),null);
});

test('date-only and time-TBD records stay all-day with exclusive next-day end across leap/year boundaries',()=>{
 for(const [date,end]of [['2028-02-29','20280301'],['2026-12-31','20270101']]){
  const result=match({dateIso:date,timeTbd:true,startIso:'2026-11-06T09:00:00Z'}),ics=resultCalendar([result],{origin,now});
  assert.match(ics,new RegExp('DTSTART;VALUE=DATE:'+date.replaceAll('-','')));assert.match(ics,new RegExp('DTEND;VALUE=DATE:'+end));assert.doesNotMatch(ics,/DTSTART:\d{8}T/);
  assert.equal(new URL(googleCalendarHref(result,{origin})).searchParams.get('dates'),date.replaceAll('-','')+'/'+end);
 }
});

test('timed events preserve explicit offsets as UTC and never manufacture duration',()=>{
 const row=match({startIso:'2026-11-06T23:30:00-06:00'}),ics=resultCalendar([row],{origin,now});
 assert.match(ics,/DTSTART:20261107T053000Z/);assert.doesNotMatch(ics,/DTEND/);assert.equal(googleCalendarHref(row,{origin}),null);
 const withEnd={...row,endIso:'2026-11-07T01:00:00-06:00'},complete=resultCalendar([withEnd],{origin,now});
 assert.match(complete,/DTEND:20261107T070000Z/);assert.equal(new URL(googleCalendarHref(withEnd,{origin})).searchParams.get('dates'),'20261107T053000Z/20261107T070000Z');
 assert.equal(resultCalendar([{...row,endIso:'2026-11-06T01:00:00-06:00'}],{origin,now}),null);
});

test('ICS escapes CRLF/property injection and folds at 75 UTF-8 octets without splitting Unicode',()=>{
 const row=match({title:'Rifle, optics; safety\\check\r\nBEGIN:VEVENT',summary:'🦌é'.repeat(400),locationLabel:'Woods\nDTSTART:evil'});
 const ics=resultCalendar([row],{origin,now}),flat=unfold(ics);
 assert.equal((flat.match(/\r\nBEGIN:VEVENT\r\n/g)||[]).length,1);assert.match(flat,/SUMMARY:Rifle\\, optics\\; safety\\\\check\\nBEGIN:VEVENT/);assert.match(flat,/LOCATION:Woods\\nDTSTART:evil/);
 assert.ok(ics.endsWith('\r\n'));assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line,'utf8')<=75));assert.match(flat,/🦌é🦌é/);assert.doesNotMatch(flat,/�/);
});

test('calendar URL scope and injected timestamp are deterministic; unsafe URLs are excluded',()=>{
 const rows=[match(),match({id:'another',destination:{webHref:'javascript:alert(1)'}})];
 const first=resultCalendar(rows,{origin,now}),second=resultCalendar(rows,{origin,now});assert.equal(first,second);
 assert.match(first,/DTSTAMP:20261106T143000Z/);assert.match(unfold(first),/URL:https:\/\/jackaloperhs.com\/matches\/brookston/);assert.doesNotMatch(first,/javascript/);
 assert.equal((first.match(/BEGIN:VEVENT/g)||[]).length,2);assert.throws(()=>resultCalendar([match()],{origin,now:'not a timestamp'}),TypeError);
 const google=new URL(googleCalendarHref(match(),{origin}));assert.ok(google.searchParams.get('details').includes(origin+'/matches/brookston'));
 const punctuation=resultCalendar([match({destination:{webHref:'/matches/brookston?tags=a,b;c'}})],{origin,now});
 assert.ok(unfold(punctuation).includes('URL:'+origin+'/matches/brookston?tags=a,b;c\r\n'),'URI properties retain valid URI punctuation instead of TEXT escaping');
});

test('calendar uses supplied multiday bounds and rejects invalid/reversed bounds',()=>{
 const row=match({endDateIso:'2026-11-09'});assert.match(resultCalendar([row],{now}),/DTEND;VALUE=DATE:20261109/);
 for(const endDateIso of ['2026-11-06','2026-11-05','2026-02-30'])assert.equal(resultCalendar([match({endDateIso})],{now}),null);
});

test('export scope and snapshot sizes are bounded',()=>{
 const excessive=Array(SHARE_LIMITS.results+1).fill(match());assert.throws(()=>resultCsv(excessive),TypeError);assert.throws(()=>resultCalendar(excessive),TypeError);assert.throws(()=>resultCsv(null),TypeError);
 assert.throws(()=>normaliseShareItem({title:'',href:origin}),TypeError);assert.throws(()=>normaliseShareItem({title:'Rules',href:origin+'/'+'x'.repeat(5000)}),TypeError);
 assert.equal(resultCalendar([],{now}),null);
 const unicode=normaliseShareItem({title:'🦌'.repeat(201),href:origin});assert.equal(Array.from(unicode.title).length,200);assert.doesNotMatch(unicode.title,/[\uD800-\uDFFF]/u);
 assert.throws(()=>resultCalendar([match()],{now:new Date('+010000-01-01T00:00:00Z')}),TypeError);
});

// Model the native dialog's queued close event, without a browser or DOM package.
function dialogFixture(){
 const queued=[],document={activeElement:null},copied=[];
 const element=()=>({isConnected:true,handlers:new Map(),focusCount:0,value:'',textContent:'',disabled:false,dataset:{},addEventListener(type,fn){this.handlers.set(type,fn);},focus(){this.focusCount++;document.activeElement=this;},select(){}});
 const trigger=element();document.activeElement=trigger;
 const dialog=Object.assign(element(),{open:false,nodes:new Map(),setAttribute(){},showModal(){this.open=true;},close(){this.open=false;queued.push(()=>this.handlers.get('close')?.());},remove(){this.isConnected=false;},querySelector(selector){return this.nodes.get(selector);},querySelectorAll(selector){if(selector==='[data-share-close]')return [this.nodes.get('[data-share-close]')];if(selector==='[data-share-extra]')return this.extras;return [];}});
 Object.defineProperty(dialog,'innerHTML',{set(value){for(const node of this.nodes.values())node.isConnected=false;this.nodes=new Map(['[data-share-close]','[data-share-copy]','[data-share-url]','[data-share-status]'].map(key=>[key,element()]));this.extras=Array.from(value.matchAll(/data-share-extra="(\d+)"/g),match=>Object.assign(element(),{dataset:{shareExtra:match[1]}}));}});
 document.createElement=()=>dialog;document.body={append(){}};
 const window={location:{origin},navigator:{clipboard:{async writeText(href){copied.push(href);}}}};
 const api=createShareDialog({document,window});
 const open=(suffix,extraActions=[])=>api.open({item:{title:suffix,href:'/rules#'+suffix},extraActions});
 return {api,open,dialog,trigger,copied,flush(){while(queued.length)queued.shift()();}};
}

test('dialog replacement retains the original trigger and queued close events cannot clear a reopened request',async()=>{
 const f=dialogFixture();f.open('first');f.open('second');f.api.close();f.flush();assert.equal(f.trigger.focusCount,1,'replacing an open request retains the external trigger');
 f.open('third');f.api.close();f.open('fourth');f.flush();
 assert.equal(f.dialog.open,true);await f.dialog.querySelector('[data-share-copy]').handlers.get('click')();
 assert.equal(f.copied.at(-1),origin+'/rules#fourth','a delayed old close event leaves the new request active');
});

test('an earlier extra-action callback cannot close a newer request',async()=>{
 const f=dialogFixture();let staleClose;
 f.open('first',[{label:'Export',onAction({close}){staleClose=close;}}]);
 await f.dialog.extras[0].handlers.get('click')();f.api.close();f.flush();f.open('second');
 staleClose();assert.equal(f.dialog.open,true,'close callbacks belong to the request that created them');
 f.api.destroy();assert.equal(f.dialog.isConnected,false);assert.throws(()=>f.open('destroyed'),/destroyed/);
});
