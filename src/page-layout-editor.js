(function(root){
 function mount(container,{registry,value,onChange,announce=()=>{},history}){
  const ids=registry.map(row=>row.id),labels=new Map(registry.map(row=>[row.id,row.label]));
  let current=root.HubPageLayout.validate(value,ids);
  const enabled=history!==undefined;
  if(enabled&&(!history||typeof history!=='object'||Array.isArray(history)))throw Error('Invalid editor history options');
  const limit=history?.limit===undefined?50:history.limit,controls=history?.controls;
  if(enabled&&(!Number.isInteger(limit)||limit<1||limit>100))throw Error('History limit must be an integer from 1 to 100');
  if(controls!==undefined&&(!controls||typeof controls.append!=='function'||container.contains(controls)))throw Error('History controls must be outside the editor list');
  const past=[],future=[];
  let destroyed=false,group,undoButton,redoButton;
  const snapshot=value=>root.HubPageLayout.validate(value,ids);
  const canUndo=()=>!destroyed&&enabled&&past.length>0,canRedo=()=>!destroyed&&enabled&&future.length>0;
  function syncControls(){if(group){undoButton.disabled=!canUndo();redoButton.disabled=!canRedo();}}
  function remember(stack,value){stack.push(snapshot(value));if(stack.length>limit)stack.shift();}
  const commit=(next,message,focus)=>{if(destroyed)return;const validated=snapshot(next);if(enabled&&JSON.stringify(validated)===JSON.stringify(current))return;if(enabled){remember(past,current);future.length=0;}current=validated;render(focus);onChange(snapshot(current));announce(message);};
  function travel(from,to,message){if(destroyed||!enabled||!from.length)return false;remember(to,current);current=snapshot(from.pop());render();onChange(snapshot(current));announce(message);return true;}
  const undo=()=>travel(past,future,'Change undone.'),redo=()=>travel(future,past,'Change redone.');
  function render(focus){const active=document.activeElement;if(enabled&&!focus&&container.contains(active)&&active.dataset?.section)focus={id:active.dataset.section,checkbox:active.type==='checkbox',offset:Number(active.dataset.offset)};container.replaceChildren();current.sections.forEach((section,index)=>{const li=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.section=section.id;check.checked=section.visible;check.addEventListener('change',()=>{if(destroyed)return;const next=snapshot(current);next.sections[index].visible=check.checked;commit(next,labels.get(section.id)+(check.checked?' shown.':' hidden.'),{id:section.id,checkbox:true});});label.append(check,document.createTextNode(labels.get(section.id)));li.append(label);
   for(const [offset,text]of [[-1,'Move up'],[1,'Move down']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',text+' '+labels.get(section.id));button.dataset.section=section.id;button.dataset.offset=String(offset);button.disabled=index+offset<0||index+offset>=current.sections.length;button.addEventListener('click',()=>commit(root.HubPageLayout.move(current,section.id,offset,ids),labels.get(section.id)+' moved to position '+(index+offset+1)+'.',{id:section.id,offset}));li.append(button);}container.append(li);});
   if(focus?.checkbox){[...container.querySelectorAll('input')].find(input=>input.dataset.section===focus.id)?.focus();}else if(focus){const candidates=[...container.querySelectorAll('button')].filter(button=>button.dataset.section===focus.id&&!button.disabled);(candidates.find(button=>button.dataset.offset===String(focus.offset))||candidates[0])?.focus();}syncControls();
  }
  if(controls){group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label','Edit history');undoButton=document.createElement('button');redoButton=document.createElement('button');for(const [button,text,action]of [[undoButton,'Undo',undo],[redoButton,'Redo',redo]]){button.type='button';button.textContent=text;button.addEventListener('click',action);group.append(button);}controls.append(group);}
  render();return {undo,redo,canUndo,canRedo,update(next){if(destroyed)return;const validated=snapshot(next);current=validated;past.length=0;future.length=0;render();},destroy(){if(destroyed)return;destroyed=true;past.length=0;future.length=0;group?.remove();container.replaceChildren();}};
 }
 root.HubPageEditor=Object.freeze({mount});
})(typeof window==='object'?window:globalThis);
