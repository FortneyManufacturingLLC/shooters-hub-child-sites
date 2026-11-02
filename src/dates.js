(() => {
 const validKey=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';};
 function key(value,{dateOnly=false}={}){if(typeof value!=='string'||!value)return '';if(dateOnly||/^\d{4}-\d{2}-\d{2}$/.test(value))return validKey(value.slice(0,10));if(!validKey(value.slice(0,10))||!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return '';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';const parts=new Intl.DateTimeFormat('en-US',{timeZone:window.HubSiteConfig?.timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=type=>parts.find(p=>p.type===type).value;return get('year')+'-'+get('month')+'-'+get('day');}
 function format(value,options={}){const day=key(value,options);return day?new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}):'';}
 function time(value,{dateOnly=false}={}){if(dateOnly||typeof value!=='string'||!value.includes('T')||!key(value))return 'TBD';return new Date(value).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:window.HubSiteConfig?.timeZone||'UTC'});}
 function offset(value,days=0,options={}){const base=key(value,options);if(!base)return '';const date=new Date(base+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+(Number.isFinite(days)?Math.trunc(days):0));return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):'';}
 window.HubSitesDates={key,format,time,offset};
})();
