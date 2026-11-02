(function(root){
 const own=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
 function validate(layout,ids){if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id.trim())||new Set(ids).size!==ids.length)throw Error('Invalid section registry');if(!own(layout,['version','sections'])||layout.version!==1||!Array.isArray(layout.sections)||layout.sections.length!==ids.length)throw Error('Invalid page layout');const seen=new Set();return {version:1,sections:layout.sections.map(section=>{if(!own(section,['id','visible'])||!ids.includes(section.id)||seen.has(section.id)||typeof section.visible!=='boolean')throw Error('Unknown, duplicate or invalid section');seen.add(section.id);return {id:section.id,visible:section.visible};})};}
 function defaults(ids){return validate({version:1,sections:ids.map(id=>({id,visible:true}))},ids);}
 function move(layout,id,offset,ids){const next=validate(layout,ids),from=next.sections.findIndex(section=>section.id===id),to=from+offset;if(from<0||!Number.isInteger(offset)||to<0||to>=next.sections.length)return next;const [section]=next.sections.splice(from,1);next.sections.splice(to,0,section);return next;}
 root.HubPageLayout=Object.freeze({validate,defaults,move});
})(typeof window==='object'?window:globalThis);
