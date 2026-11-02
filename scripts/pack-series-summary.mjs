import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.argv[2];if(!output)throw Error('Explicit output directory required');
const files=new Map();
const sourcePackage=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const pkg={name:sourcePackage.name,version:sourcePackage.version,type:'module',license:sourcePackage.license,engines:sourcePackage.engines,exports:{'./series-summary':sourcePackage.exports['./series-summary'],'./series-summary/fixtures':sourcePackage.exports['./series-summary/fixtures']}};
files.set('package/package.json',Buffer.from(JSON.stringify(pkg,null,2)+'\n'));
for(const name of ['src/series-summary.mjs','src/series-summary-fixtures.mjs','src/series-summary.d.ts','src/series-summary-fixtures.d.ts','LICENSE'])files.set('package/'+name,await readFile(path.join(root,name)));
const provenance={schemaVersion:1,sourceBase:process.env.CP01_SOURCE_BASE||'13a1079b728f862bda8980abb85e74f008c5b4ab',sourceState:'local-uncommitted-cp01',files:Object.fromEntries([...files].map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]))};
files.set('package/series-summary-provenance.json',Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
const chunks=[];
for(const [name,bytes]of files){const header=Buffer.alloc(512);header.write(name);const octal=(value,offset,length)=>header.write(value.toString(8).padStart(length-1,'0')+'\0',offset,length);octal(0o644,100,8);octal(0,108,8);octal(0,116,8);octal(bytes.length,124,12);octal(0,136,12);header.fill(32,148,156);header[156]=48;header.write('ustar\0',257);header.write('00',263);const checksum=header.reduce((sum,value)=>sum+value,0);header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8);chunks.push(header,bytes,Buffer.alloc((512-bytes.length%512)%512));}
chunks.push(Buffer.alloc(1024));const archive=gzipSync(Buffer.concat(chunks),{level:9});const sha256=createHash('sha256').update(archive).digest('hex');
await mkdir(output,{recursive:true});const archivePath=path.resolve(output,`competition-hub-child-sites-series-summary-${sha256.slice(0,20)}.tgz`);await writeFile(archivePath,archive,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});if(createHash('sha256').update(await readFile(archivePath)).digest('hex')!==sha256)throw Error('Existing artifact mismatch');
console.log(JSON.stringify({archivePath,sha256,entries:[...files.keys()],provenance},null,2));
