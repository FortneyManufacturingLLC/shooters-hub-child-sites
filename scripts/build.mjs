import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateSite} from '../src/contracts.mjs';
import {loadThemes,tokenStyles,resolveThemes} from '../src/themes.mjs';
const args=process.argv.slice(2);let configPath='site.example.json';const themes=[];
for(let i=0;i<args.length;i++){if(args[i]==='--site')configPath=args[++i];else if(args[i]==='--theme')themes.push(args[++i]);else throw Error('Unknown build argument');}
const site=validateSite(JSON.parse(await readFile(resolve(configPath),'utf8'))),loaded=await loadThemes(themes);
await mkdir('dist/themes',{recursive:true});const catalog=[];
for(let n=0;n<=loaded.manifests.length;n++){const theme=resolveThemes(loaded.manifests.slice(0,n));const styles=[];for(let i=0;i<n;i++){const part=await loadThemes(themes.slice(0,i+1));styles.push(...part.styles.slice(styles.length));}const css=tokenStyles(theme)+styles.join('\n');await writeFile('dist/themes/'+theme.id+'.css',css);catalog.push({...theme,name:n?loaded.manifests[n-1].name:'Core',stylesheet:'/themes/'+theme.id+'.css'});}
const selected=site.themeId||catalog.at(-1).id;if(!catalog.some(theme=>theme.id===selected))throw Error('Selected theme is not in the pinned build');
const active=catalog.find(theme=>theme.id===selected);const theme={...active,tokens:{...active.tokens,...site.themeTokens},layout:{...active.layout,...site.themeLayout}};
for(const file of ['index.html','app.js','base.css','admin.html','admin.js','admin.css'])await copyFile('starter/'+file,'dist/'+file);
for(const file of ['dates.js','results.js','results.css','page-layout.js','page-layout-editor.js'])await copyFile('src/'+file,'dist/'+file);
await writeFile('dist/site-config.js','window.HubSiteConfig='+JSON.stringify({...site,theme,themeCatalog:catalog}).replace(/</g,'\\u003c')+';\n');
await writeFile('dist/theme.css',(await readFile('dist/themes/'+selected+'.css','utf8'))+tokenStyles(theme));
await writeFile('dist/site.json',JSON.stringify(site));await writeFile('dist/theme-catalog.json',JSON.stringify(catalog));
console.log('Built starter and admin with '+catalog.length+' pinned theme choices. No provider credentials are written to dist.');
