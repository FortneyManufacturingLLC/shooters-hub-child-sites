import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('admin exports only edited colors, preserves reordered visibility and resets safely',async()=>{
 const nodes=new Map(),listeners={};
 function make(id=''){return {id,value:'',textContent:'',children:[],dataset:{},style:{setProperty(){}},append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},setAttribute(){},removeAttribute(){},focus(){},addEventListener(type,fn){this['on'+type]=fn;if(id)listeners[id+':'+type]=fn;},querySelector(){return node('submit');},querySelectorAll(){return this.children.flatMap(child=>child.children||[]).filter(child=>child.type==='button');}};}
 function node(id){if(!nodes.has(id))nodes.set(id,make(id));return nodes.get(id);}
 const theme={id:'core',tokens:{accent:'red',surface:'rgb(1,2,3)',ink:'#123'},layout:{navigation:'header',density:'comfortable'}};
 const site={siteId:'demo',communityId:'shooters-hub',seriesId:'series',title:'Original',timeZone:'UTC',brand:{},themeTokens:{surface:'rgb(1,2,3)'},theme};let exported;
 const context={window:{HubSiteConfig:site},document:{getElementById:node,querySelector:s=>node(s.slice(1)),createElement:()=>make(),createTextNode:text=>text},fetch:async(url,options)=>{if(!options)return {ok:false};exported=JSON.parse(options.body);return {ok:true,headers:{get:()=> 'application/json'},json:async()=>exported};},Blob,URL,setTimeout:fn=>fn()};
 vm.createContext(context);vm.runInContext(await readFile(new URL('../src/page-layout.js',import.meta.url),'utf8'),context);vm.runInContext(await readFile(new URL('../src/page-layout-editor.js',import.meta.url),'utf8'),context);vm.runInContext(await readFile(new URL('../starter/admin.js',import.meta.url),'utf8'),context);
 node('title').value='Edited';await listeners['settings:submit']({preventDefault(){}});assert.deepEqual(exported.themeTokens,{surface:'rgb(1,2,3)'});
 node('accent').value='#00ff00';listeners['settings:input']({target:node('accent')});
 const first=node('section-list').children[0];first.children[2].onclick();
 const check=node('section-list').children[0].children[0].children[0];check.checked=false;check.onchange();
 await listeners['settings:submit']({preventDefault(){}});assert.deepEqual(exported.themeTokens,{surface:'rgb(1,2,3)',accent:'#00ff00'});assert.equal(exported.homePage.sections[0].id,'matches');assert.equal(exported.homePage.sections[0].visible,false);
 listeners['reset:click']();await listeners['settings:submit']({preventDefault(){}});assert.deepEqual(exported.themeTokens,{surface:'rgb(1,2,3)'});assert.equal(exported.homePage.sections[0].id,'introduction');
});
