import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const layoutSource=readFileSync(new URL('../src/page-layout.js',import.meta.url),'utf8');
const editorSource=readFileSync(new URL('../src/page-layout-editor.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

// Host ports only: all validation, rendering and history run in the real scripts.
function host(){
  const document={activeElement:null};
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.parentNode=null;this.dataset={};this.attributes={};this.listeners={};this.disabled=false;}
    append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
    remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.append(...nodes);}
    setAttribute(key,value){this.attributes[key]=value;}
    querySelectorAll(tag){return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)]);}
    addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
    dispatch(type){for(const listener of this.listeners[type]??[])listener();}
    focus(){if(!this.disabled)document.activeElement=this;}
  }
  document.createElement=tag=>new Element(tag);
  document.createTextNode=text=>Object.assign(new Element('#text'),{textContent:text});
  const context=vm.createContext({document});
  vm.runInContext(layoutSource,context,{filename:'page-layout.js'});
  vm.runInContext(editorSource,context,{filename:'page-layout-editor.js'});
  const registry=['introduction','matches','sponsors'].map(id=>({id,label:id}));
  const initial=()=>context.HubPageLayout.defaults(registry.map(row=>row.id));
  function mount(options={}){
    const list=new Element('ul'),changes=[],announcements=[];
    const editor=context.HubPageEditor.mount(list,{registry,value:initial(),onChange:value=>changes.push(value),announce:message=>announcements.push(message),...options});
    return {list,changes,announcements,editor};
  }
  return {document,Element,initial,mount,context,registry};
}
const input=(list,id)=>list.querySelectorAll('input').find(node=>node.dataset.section===id);
const moveButton=(list,id,offset)=>list.querySelectorAll('button').find(node=>node.dataset.section===id&&node.dataset.offset===String(offset));
function toggle(list,id,visible){const check=input(list,id);check.checked=visible;check.dispatch('change');}
const order=list=>list.querySelectorAll('input').map(node=>node.dataset.section);

test('external update without history makes no focus calls; history undo/redo restore list focus',()=>{
  const h=host(),originalFocus=h.Element.prototype.focus;
  let focusCalls=0;
  h.Element.prototype.focus=function(){focusCalls++;originalFocus.call(this);};
  const disabled=h.mount();
  input(disabled.list,'matches').focus();focusCalls=0;
  disabled.editor.update(h.initial());
  assert.equal(focusCalls,0);
  const enabled=h.mount({history:{}});
  toggle(enabled.list,'matches',false);
  focusCalls=0;
  assert.equal(enabled.editor.undo(),true);
  assert.equal(focusCalls,1);
  assert.equal(h.document.activeElement,input(enabled.list,'matches'));
  assert.equal(enabled.editor.redo(),true);
  assert.equal(focusCalls,2);
  assert.equal(h.document.activeElement,input(enabled.list,'matches'));
});

test('history is disabled by default and mounting has no callback',()=>{
  const h=host(),{list,editor,changes}=h.mount();
  assert.equal(changes.length,0);
  toggle(list,'matches',false);
  assert.equal(changes.length,1);
  for(const method of ['undo','redo','canUndo','canRedo'])assert.equal(editor[method](),false);
  assert.equal(input(list,'matches').checked,false);
  toggle(list,'matches',false);
  assert.equal(changes.length,2);
});

test('toggle and move undo/redo each render and emit one detached validated value',()=>{
  const h=host(),original=h.initial(),{list,editor,changes,announcements}=h.mount({history:{},value:original});
  original.sections[0].visible=false;
  toggle(list,'matches',false);
  const toggled=plain(changes[0]);
  changes[0].sections[0].visible=false;
  moveButton(list,'sponsors',-1).dispatch('click');
  assert.deepEqual(order(list),['introduction','sponsors','matches']);
  assert.equal(editor.undo(),true);
  assert.deepEqual(plain(changes.at(-1)),toggled);
  assert.equal(editor.undo(),true);
  assert.deepEqual(plain(changes.at(-1)),plain(h.initial()));
  assert.equal(editor.undo(),false);
  assert.equal(editor.redo(),true);
  assert.equal(editor.redo(),true);
  assert.equal(editor.redo(),false);
  assert.equal(changes.length,6);
  assert.equal(announcements.length,6);
  assert.deepEqual(order(list),['introduction','sponsors','matches']);
  assert.equal(input(list,'introduction').checked,true);
  assert.equal(input(list,'matches').checked,false);
  assert.equal(editor.canUndo(),true);
  assert.equal(editor.canRedo(),false);
});

test('only actual edits consume history or clear redo; changed edits clear redo',()=>{
  const {list,editor,changes}=host().mount({history:{}});
  toggle(list,'matches',true);
  moveButton(list,'introduction',-1).dispatch('click');
  assert.equal(changes.length,0);
  assert.equal(editor.canUndo(),false);
  toggle(list,'matches',false);
  editor.undo();
  toggle(list,'matches',true);
  assert.equal(editor.canRedo(),true);
  toggle(list,'sponsors',false);
  assert.equal(editor.canRedo(),false);
  assert.equal(editor.redo(),false);
  assert.equal(editor.undo(),true);
  assert.equal(editor.undo(),false);
});

test('default and explicit history bounds retain only the permitted snapshots',()=>{
  for(const [history,count]of [[{},50],[{limit:1},1],[{limit:2},2],[{limit:100},100]]){
    const {list,editor}=host().mount({history});
    for(let i=0;i<count+3;i++)toggle(list,'matches',i%2!==0);
    let undos=0,redos=0;
    while(editor.undo())undos++;
    while(editor.redo())redos++;
    assert.equal(undos,count);
    assert.equal(redos,count);
  }
});

test('history rejects invalid options and controls inside the list before rendering',()=>{
  const h=host();
  for(const history of [null,[],true,{limit:0},{limit:101},{limit:1.5},{limit:'2'},{limit:NaN},{controls:null}]){
    assert.throws(()=>h.mount({history}));
  }
  for(const nested of [false,true]){
    const list=new h.Element('ul'),foreign=new h.Element('span');list.append(foreign);
    assert.throws(()=>h.context.HubPageEditor.mount(list,{registry:h.registry,value:h.initial(),onChange(){},history:{controls:nested?foreign:list}}));
    assert.deepEqual(list.children,[foreign]);
  }
});

test('external update resets both stacks without callback; invalid update is atomic',()=>{
  const h=host(),controls=new h.Element('aside'),{list,editor,changes}=h.mount({history:{controls}});
  toggle(list,'matches',false);toggle(list,'sponsors',false);editor.undo();
  const before=plain(changes.at(-1)),buttons=controls.querySelectorAll('button');
  assert.throws(()=>editor.update({version:2,sections:[]}));
  assert.equal(editor.canUndo(),true);assert.equal(editor.canRedo(),true);
  assert.deepEqual(buttons.map(button=>button.disabled),[false,false]);
  assert.equal(input(list,'matches').checked,false);assert.equal(input(list,'sponsors').checked,true);
  assert.equal(changes.length,3);
  const replacement=h.initial();replacement.sections[0].visible=false;
  editor.update(replacement);replacement.sections[0].visible=true;
  assert.equal(changes.length,3);
  assert.equal(input(list,'introduction').checked,false);
  assert.equal(editor.canUndo(),false);assert.equal(editor.canRedo(),false);
  assert.deepEqual(buttons.map(button=>button.disabled),[true,true]);
  toggle(list,'matches',false);editor.undo();editor.update(h.initial());
  assert.equal(editor.canUndo(),false);assert.equal(editor.canRedo(),false);
  assert.equal(before.sections.find(section=>section.id==='matches').visible,false);
});

test('owned accessible controls preserve siblings and focus across history renders',()=>{
  const h=host(),controls=new h.Element('aside'),foreign=new h.Element('span');controls.append(foreign);
  const {list,editor}=h.mount({history:{controls}}),group=controls.children[1],[undo,redo]=group.querySelectorAll('button');
  assert.deepEqual(group.attributes,{role:'group','aria-label':'Edit history'});
  assert.deepEqual([undo.textContent,redo.textContent],['Undo','Redo']);
  assert.deepEqual([undo.type,redo.type],['button','button']);
  assert.deepEqual([undo.disabled,redo.disabled],[true,true]);
  toggle(list,'matches',false);
  assert.equal(h.document.activeElement,input(list,'matches'));
  editor.undo();assert.equal(h.document.activeElement,input(list,'matches'));
  redo.focus();redo.dispatch('click');assert.equal(h.document.activeElement,redo);
  undo.focus();undo.dispatch('click');assert.equal(h.document.activeElement,undo);
  assert.equal(controls.children[0],foreign);assert.equal(controls.children[1],group);
  editor.redo();moveButton(list,'sponsors',-1).dispatch('click');
  assert.equal(h.document.activeElement.dataset.section,'sponsors');
  editor.undo();assert.equal(h.document.activeElement.dataset.section,'sponsors');
  assert.equal(h.document.activeElement.disabled,false);
});

test('mounts are isolated and destroy is idempotent with inert retained handles and controls',()=>{
  const h=host(),controls=new h.Element('aside'),foreign=new h.Element('span');controls.append(foreign);
  const a=h.mount({history:{controls}}),b=h.mount({history:{controls}});
  toggle(a.list,'matches',false);toggle(b.list,'sponsors',false);
  a.editor.undo();assert.equal(input(b.list,'sponsors').checked,false);
  assert.equal(b.editor.canUndo(),true);
  const retainedInput=input(a.list,'matches'),retainedMove=moveButton(a.list,'sponsors',-1),retainedUndo=controls.children[1].querySelectorAll('button')[0];
  const calls=a.changes.length,announcements=a.announcements.length;
  a.editor.destroy();a.editor.destroy();
  assert.equal(a.list.children.length,0);assert.equal(controls.children.length,2);assert.equal(controls.children[0],foreign);
  for(const method of ['undo','redo','canUndo','canRedo'])assert.equal(a.editor[method](),false);
  assert.doesNotThrow(()=>a.editor.update(null));
  retainedInput.checked=false;retainedInput.dispatch('change');retainedMove.dispatch('click');retainedUndo.dispatch('click');
  assert.equal(a.list.children.length,0);assert.equal(a.changes.length,calls);assert.equal(a.announcements.length,announcements);
  assert.equal(b.editor.undo(),true);assert.equal(input(b.list,'sponsors').checked,true);
  b.editor.destroy();assert.deepEqual(controls.children,[foreign]);
});
