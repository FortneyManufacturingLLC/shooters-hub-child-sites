/** Public sharing/export extraction; pinned Hub sources and deltas: docs/share.md. */
export const SHARE_LIMITS=Object.freeze({results:1000,title:200,summary:2000,metadata:8,metadataText:160,href:4096});
const kinds=new Set(['article','brand','club','external','freedope','forum','group','listing','match','other','post','profile','results','search','season','series','stage','thread']);
const text=(value,max)=>Array.from(String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uD800-\uDFFF]/gu,'')).slice(0,max).join('').trim();
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const unsafeUrl=/[\\\s\u0000-\u001f\u007f]/u;
function safeHref(value,origin){
 if(typeof value!=='string')throw new TypeError('A public HTTP(S) share URL is required');
 const candidate=value.trim();
 if(!candidate||candidate.length>SHARE_LIMITS.href||unsafeUrl.test(candidate)||candidate.startsWith('//'))throw new TypeError('Invalid share URL');
 let base;
 if(origin!==undefined){const parsed=new URL(origin);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new TypeError('Invalid share origin');base=parsed.origin;}
 const url=new URL(candidate,base);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new TypeError('Share URLs must use HTTP(S) without credentials');
 return url.href;
}
export function normaliseShareItem(input,{origin}={}){
 if(!record(input))throw new TypeError('A share item is required');
 const title=text(input.title,SHARE_LIMITS.title);if(!title)throw new TypeError('A share title is required');
 const href=safeHref(input.href??input.destination?.webHref,origin);
 const item={id:text(input.id,200)||href,kind:kinds.has(input.kind)?input.kind:'other',eyebrow:text(input.eyebrow,160),title,href,metadata:Object.freeze((Array.isArray(input.metadata)?input.metadata:[]).slice(0,SHARE_LIMITS.metadata).map(value=>text(value,SHARE_LIMITS.metadataText)).filter(Boolean))};
 if(input.summary)item.summary=text(input.summary,SHARE_LIMITS.summary);
 if(input.image){const url=safeHref(input.image.url,origin);item.image=Object.freeze({url,alt:text(input.image.alt,200)});}
 return Object.freeze(item);
}
export const shareItemFromEntity=normaliseShareItem;
function resultsList(results){if(!Array.isArray(results)||results.length>SHARE_LIMITS.results)throw new TypeError(`Expected at most ${SHARE_LIMITS.results} scoped results`);return results.filter(record);}
function resultHref(result,origin){
 const candidate=result.destination?.webHref??result.href;
 try{const href=safeHref(candidate,origin??'https://child-share.invalid');return origin===undefined&&!/^[a-z][a-z0-9+.-]*:/iu.test(candidate)?href.replace('https://child-share.invalid',''):href;}catch{return '';}
}
function csvCell(value){
 let cell=text(value,SHARE_LIMITS.summary);
 // Spreadsheet engines ignore leading whitespace before evaluating formulas.
 if(/^[\s\uFEFF]*[=+\-@]/u.test(cell))cell="'"+cell;
 return '"'+cell.replaceAll('"','""')+'"';
}
export function resultCsv(results){
 return [['Type','Title','Date','Location','Status','Distance','URL'],...resultsList(results).map(result=>[result.kind,result.title,result.dateIso,result.locationLabel,result.statusLabel,result.distanceLabel,resultHref(result)])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);
 if(year<1000||month<1||month>12||day<1||day>31)return false;
 const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)||!validDate(value.slice(0,10)))return null;
 const hour=Number(value.slice(11,13)),minute=Number(value.slice(14,16)),seconds=value[16]===':'?Number(value.slice(17,19)):0;
 if(hour>23||minute>59||seconds>59)return null;
 const date=new Date(value);return Number.isFinite(date.valueOf())&&date.getUTCFullYear()>=1000&&date.getUTCFullYear()<=9999?date:null;
}
const calendarInstant=date=>date.toISOString().replace(/[-:]/gu,'').replace(/\.\d{3}Z$/u,'Z');
const calendarDate=value=>value.replaceAll('-','');
function nextDay(value){const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);}
function schedule(result){
 if(result.kind!=='match')return null;
 if(result.timeTbd===true||!result.startIso){
  if(!validDate(result.dateIso))return null;
  const end=result.endDateIso??nextDay(result.dateIso);
  if(!validDate(end)||end<=result.dateIso)return null;
  return {start:calendarDate(result.dateIso),end:calendarDate(end),allDay:true};
 }
 const start=instant(result.startIso),end=result.endIso?instant(result.endIso):null;
 if(!start||(result.endIso&&(!end||end<=start)))return null;
 return {start:calendarInstant(start),end:end?calendarInstant(end):null,allDay:false};
}
const calendarCell=value=>text(value,SHARE_LIMITS.summary).replaceAll('\\','\\\\').replaceAll('\r','').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;');
function stableExportToken(value){let first=2166136261,second=0x9e3779b9;for(const char of value){const code=char.codePointAt(0);first=Math.imul(first^code,16777619);second=Math.imul(second^code,2246822519);}return (first>>>0).toString(36)+(second>>>0).toString(36);}
function foldLine(value){
 const lines=[];let line='',bytes=0;
 for(const char of value){const length=new TextEncoder().encode(char).length;if(bytes+length>75){lines.push(line);line=' ';bytes=1;}line+=char;bytes+=length;}
 lines.push(line);return lines.join('\r\n');
}
export function resultCalendar(results,{origin,timeZone,now=new Date()}={}){
 const scoped=resultsList(results),eligible=scoped.flatMap(result=>{const dates=schedule(result);return dates?[{result,dates}]:[];});
 if(!eligible.length)return null;
 const stamp=now instanceof Date?now:typeof now==='string'?instant(now):null;
 if(!stamp||!Number.isFinite(stamp.valueOf())||stamp.getUTCFullYear()<1000||stamp.getUTCFullYear()>9999)throw new TypeError('A valid explicit UTC/offset export timestamp is required');
 const events=eligible.flatMap(({result,dates})=>{
  const href=resultHref(result,origin),zone=text(result.timeZone??timeZone,100),uid=stableExportToken([result.id,href,dates.start,dates.end].join('\u0000'));
  return ['BEGIN:VEVENT',`UID:share-${uid}@competition-hub`, `DTSTAMP:${calendarInstant(stamp)}`,
   `DTSTART${dates.allDay?';VALUE=DATE':''}:${dates.start}`,...(dates.end?[`DTEND${dates.allDay?';VALUE=DATE':''}:${dates.end}`]:[]),
   `SUMMARY:${calendarCell(text(result.title,SHARE_LIMITS.title)||'Scheduled match')}`,`LOCATION:${calendarCell(result.locationLabel)}`,`DESCRIPTION:${calendarCell(result.summary)}`,
   ...(zone?[`X-SHOOTERS-HUB-TIMEZONE:${calendarCell(zone)}`]:[]),...(href?[`URL:${href}`]:[]),'END:VEVENT'];
 });
 return ['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH','PRODID:-//Competition Hub//Child Site Share//EN',...events,'END:VCALENDAR'].map(foldLine).join('\r\n')+'\r\n';
}
export function googleCalendarHref(result,{origin}={}){
 if(!record(result))return null;const dates=schedule(result);if(!dates||!dates.end)return null;
 const href=resultHref(result,origin),params=new URLSearchParams({action:'TEMPLATE',text:text(result.title,SHARE_LIMITS.title)||'Scheduled match',dates:dates.start+'/'+dates.end,details:[text(result.summary,SHARE_LIMITS.summary),href].filter(Boolean).join('\n\n'),location:text(result.locationLabel,500)});
 if(result.timeZone)params.set('ctz',text(result.timeZone,100));
 return 'https://calendar.google.com/calendar/render?'+params.toString();
}
