import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {httpsOrigin,validateSite,normalizeSnapshot} from '../src/contracts.mjs';
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'self'; frame-ancestors 'none'"};
export function createStarterServer({root,site,gateway=null,token='',fetcher=fetch}){
 root=resolve(root);site=validateSite(site);gateway=gateway?httpsOrigin(gateway):null;
 return createServer(async(req,res)=>{
  const send=(status,body,type='application/json')=>{res.writeHead(status,{...headers,'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);};
  let url;try{url=new URL(req.url,'http://local');}catch{send(400,'Bad request target','text/plain');return;}
  if(!['GET','HEAD'].includes(req.method)){send(405,'{"error":"read_only_starter"}');return;}
  if(url.pathname==='/api/site'){
   if(url.search){send(400,'{"error":"scope_is_server_bound"}');return;}
   if(!gateway){send(503,'{"error":"gateway_not_configured"}');return;}
   try{const response=await fetcher(gateway+'/api/site',{headers:{accept:'application/json',...(token?{authorization:'Bearer '+token}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Gateway unavailable');send(200,JSON.stringify(normalizeSnapshot(await response.json(),site)));}catch{send(503,'{"error":"gateway_unavailable"}');}return;
  }
  let path;try{path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{send(400,'Bad path','text/plain');return;}
  if(!path.startsWith(root+sep)){send(404,'Not found','text/plain');return;}
  try{const bytes=await readFile(path);send(200,bytes,({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'})[extname(path)]||'application/octet-stream');}catch{send(404,'Not found','text/plain');}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const root=resolve('dist'),site=JSON.parse(await readFile(resolve(root,'site.json'),'utf8'));createStarterServer({root,site,gateway:process.env.HUB_GATEWAY_ORIGIN||null,token:process.env.HUB_GATEWAY_TOKEN||''}).listen(Number(process.env.PORT)||8768,()=>console.log('Child-site starter listening'));}
