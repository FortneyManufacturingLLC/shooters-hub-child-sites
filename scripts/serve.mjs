import {validateAdminDraft} from '../src/admin.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {httpsOrigin,validateSite,normalizeSnapshot} from '../src/contracts.mjs';
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'self'; frame-ancestors 'self'"};
export function createStarterServer({root,site,gateway=null,token='',fetcher=fetch,themeIds=['core'],editorService=null,membershipAdminService=null}){
 root=resolve(root);site=validateSite(site);gateway=gateway?httpsOrigin(gateway):null;
 return createServer(async(req,res)=>{
  const send=(status,body,type='application/json',extra={})=>{res.writeHead(status,{...headers,'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store',...extra});res.end(req.method==='HEAD'?undefined:body);};
  let url;try{url=new URL(req.url,'http://local');}catch{send(400,'Bad request target','text/plain');return;}
  if(url.pathname==='/api/admin/memberships'){
   const privateSend=(status,data)=>send(status,JSON.stringify(data),'application/json',{'Cache-Control':'private, no-store','Vary':'Authorization, Cookie, Origin'});
   if(req.method!=='GET'){privateSend(405,{error:'method_not_allowed'});return;}
   const entries=[...url.searchParams];
   if(entries.length>1||entries.some(([key,value])=>key!=='afterId'||!/^[a-f0-9]{64}$/.test(value))){privateSend(400,{error:'scope_is_server_bound'});return;}
   if(!membershipAdminService){privateSend(503,{error:'membership_admin_not_configured'});return;}
   if(!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(req.headers.authorization||'')){privateSend(401,{error:'auth_required'});return;}
   try{
    const result=await membershipAdminService.read({authorization:req.headers.authorization,afterId:url.searchParams.get('afterId')||undefined});
    if(result.status!==200){privateSend([401,403,404].includes(result.status)?result.status:503,{error:'membership_access_unavailable'});return;}
    const body=JSON.stringify(result.data);
    if(!Array.isArray(result.data.responses)||result.data.responses.length>25||Buffer.byteLength(body)>1024*1024)throw Error('Invalid response page');
    privateSend(200,result.data);
   }catch{privateSend(503,{error:'membership_service_unavailable'});}return;
  }
  if(url.pathname==='/api/admin/config'||url.pathname==='/api/site-presentation'){
   if(!editorService){send(503,JSON.stringify({error:'Authenticated editor provider is not configured'}));return;}
   if(url.search){send(400,JSON.stringify({error:'Scope is deployment bound'}));return;}
   if(url.pathname==='/api/site-presentation'&&req.method==='GET'){const result=await editorService.readPublished();send(result.status,JSON.stringify(result.data));return;}
   if(url.pathname==='/api/admin/config'&&req.method==='GET'){const result=await editorService.read({authorization:req.headers.authorization});send(result.status,JSON.stringify(result.data));return;}
   if(url.pathname==='/api/admin/config'&&req.method==='POST'){
    if(req.headers['sec-fetch-site']==='cross-site'){send(403,JSON.stringify({error:'Cross-site request rejected'}));return;}
    if(req.headers['content-type']?.split(';')[0]!=='application/json'){send(415,JSON.stringify({error:'JSON required'}));return;}
    try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536){send(413,JSON.stringify({error:'Payload too large'}));return;}}const result=await editorService.save({authorization:req.headers.authorization,body:JSON.parse(body)});send(result.status,JSON.stringify(result.data));}catch{send(400,JSON.stringify({error:'Invalid request'}));}return;
   }
   send(405,JSON.stringify({error:'Method not allowed'}));return;
  }
  if(url.pathname==='/api/admin/draft'&&req.method==='POST'){
   if(url.search){send(400,JSON.stringify({error:'Unexpected query parameters'}));return;}
   if(req.headers['content-type']?.split(';')[0]!=='application/json'){send(415,JSON.stringify({error:'Send JSON configuration'}));return;}
   if(req.headers['sec-fetch-site']==='cross-site'){send(403,JSON.stringify({error:'Cross-site request rejected'}));return;}
   try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384){send(413,JSON.stringify({error:'Configuration exceeds 16 KB'}));return;}}const draft=validateAdminDraft(site,JSON.parse(body));if(draft.themeId&&!themeIds.includes(draft.themeId))throw Error('Theme is not installed in this build');send(200,JSON.stringify(draft));}catch(error){send(400,JSON.stringify({error:error instanceof SyntaxError?'Invalid JSON configuration':error.message}));}return;
  }
  if(!['GET','HEAD'].includes(req.method)){send(405,'{"error":"read_only_starter"}');return;}
  if(url.pathname==='/api/site'){
   if(url.search){send(400,'{"error":"scope_is_server_bound"}');return;}
   if(!gateway){send(503,'{"error":"gateway_not_configured"}');return;}
   try{const response=await fetcher(gateway+'/api/site',{headers:{accept:'application/json',...(token?{authorization:'Bearer '+token}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Gateway unavailable');send(200,JSON.stringify(normalizeSnapshot(await response.json(),site)));}catch{send(503,'{"error":"gateway_unavailable"}');}return;
  }
  let path;try{path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':['/admin','/admin/'].includes(url.pathname)?'/admin.html':url.pathname));}catch{send(400,'Bad path','text/plain');return;}
  if(!path.startsWith(root+sep)){send(404,'Not found','text/plain');return;}
  try{const bytes=await readFile(path);send(200,bytes,({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'})[extname(path)]||'application/octet-stream');}catch{send(404,'Not found','text/plain');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const root=resolve('dist'),site=JSON.parse(await readFile(resolve(root,'site.json'),'utf8'));createStarterServer({root,site,gateway:process.env.HUB_GATEWAY_ORIGIN||null,token:process.env.HUB_GATEWAY_TOKEN||'',themeIds:JSON.parse(await readFile(resolve(root,'theme-catalog.json'),'utf8')).map(theme=>theme.id)}).listen(Number(process.env.PORT)||8768,()=>console.log('Child-site starter listening'));}
