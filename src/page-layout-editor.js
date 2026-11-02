(function(root){
 function mount(container,{registry,value,onChange,announce=()=>{}}){
  const ids=registry.map(row=>row.id),labels=new Map(registry.map(row=>[row.id,row.label]));
  let current=root.HubPageLayout.validate(value,ids);
  const commit=(next,message,focus)=>{current=root.HubPageLayout.validate(next,ids);render(focus);onChange(root.HubPageLayout.validate(current,ids));announce(message);};
  function render(focus){container.replaceChildren();current.sections.forEach((section,index)=>{const li=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.section=section.id;check.checked=section.visible;check.addEventListener('change',()=>{const next=root.HubPageLayout.validate(current,ids);next.sections[index].visible=check.checked;commit(next,labels.get(section.id)+(check.checked?' shown.':' hidden.'),{id:section.id,checkbox:true});});label.append(check,document.createTextNode(labels.get(section.id)));li.append(label);
   for(const [offset,text]of [[-1,'Move up'],[1,'Move down']]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',text+' '+labels.get(section.id));button.dataset.section=section.id;button.dataset.offset=String(offset);button.disabled=index+offset<0||index+offset>=current.sections.length;button.addEventListener('click',()=>commit(root.HubPageLayout.move(current,section.id,offset,ids),labels.get(section.id)+' moved to position '+(index+offset+1)+'.',{id:section.id,offset}));li.append(button);}container.append(li);});
   if(focus?.checkbox){[...container.querySelectorAll('input')].find(input=>input.dataset.section===focus.id)?.focus();}else if(focus){const candidates=[...container.querySelectorAll('button')].filter(button=>button.dataset.section===focus.id&&!button.disabled);(candidates.find(button=>button.dataset.offset===String(focus.offset))||candidates[0])?.focus();}
  }
  render();return {update(next){current=root.HubPageLayout.validate(next,ids);render();},destroy(){container.replaceChildren();}};
 }
 root.HubPageEditor=Object.freeze({mount});
})(typeof window==='object'?window:globalThis);
