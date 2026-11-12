// Portable response presentation. Authenticated I/O and issuer binding belong to the host.
export const statusLabel=value=>String(value).split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
export function responseColumns(rows) {
 const fields=new Map();
 for(const row of rows)for(const field of row.form.fields){const key=row.programRevision+':'+field.id;if(!fields.has(key))fields.set(key,{key,id:field.id,label:field.label,revision:row.programRevision});}
 return [...fields.values()];
}
export function responseAnswer(row,field){if(row.programRevision!==field.revision)return '';const value=row.answers.find(a=>a.fieldId===field.id)?.value;return value===undefined?'':typeof value==='boolean'?value?'Yes':'No':value;}
export function filterResponses(rows,text='',status='') {
 const needle=text.trim().toLocaleLowerCase(),known=['active','pending-approval','cancelled','revoked'];
 return rows.filter(row=>(!status||(status==='other'?!known.includes(row.status):row.status===status))&&(!needle||[row.displayName,row.userId,statusLabel(row.status),...row.answers.map(a=>String(a.value))].some(value=>value.toLocaleLowerCase().includes(needle))));
}
const csvCell=value=>'"'+(/^[\t\r\n]|^\s*[=+@-]/.test(String(value))?"'":'')+String(value).replaceAll('"','""')+'"';
export function responsesCsv(rows){const fields=responseColumns(rows);return '\uFEFF'+[['Member','Shooter ID','Status','Program revision','Enrollment revision','Joined','Expires',...fields.map(f=>`${f.label} (program ${f.revision}; ${f.id})`)],...rows.map(row=>[row.displayName||row.userId,row.userId,statusLabel(row.status),row.programRevision,row.revision,row.joinedAt,row.expiresAt||'',...fields.map(f=>responseAnswer(row,f))])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function createMembershipAdminSession({request,current,onChange=()=>{}}) {
 let state={page:null,cursors:[null],busy:false,message:''},generation=0;
 const emit=()=>onChange(state);
 return {
  state:()=>state,
  clear(message='Account changed. Load members to verify access again.'){generation++;state={page:null,cursors:[null],busy:false,message};emit();},
  async load({direction='refresh',exportPage=false,text='',status=''}={}){
   if(state.busy||!current())return null;
   const owner=current(),ticket=++generation;
   const cursors=direction==='next'?[...state.cursors,state.page?.nextCursor]:direction==='previous'?state.cursors.slice(0,-1):direction==='first'?[null]:[...state.cursors];
   if(!cursors.length||(direction==='next'&&!state.page?.nextCursor))return null;
   state={...state,busy:true,message:''};emit();
   try{
    const cursor=cursors.at(-1),data=await request('/api/admin/memberships'+(cursor?'?'+new URLSearchParams({afterId:cursor}):''));
    if(ticket!==generation||current()!==owner)return null;
    state={page:data,cursors,busy:false,message:''};emit();
    return exportPage?responsesCsv(filterResponses(data.responses,text,status)):null;
   }catch(error){
    if(ticket!==generation||current()!==owner)return null;
    state={page:null,cursors:[null],busy:false,message:error.status===401?'Sign in again to view members.':error.status===403?'This account cannot manage this season. Private member information has been cleared.':'Member access could not be confirmed. Private information has been cleared; try loading again.'};emit();return null;
   }
  }
 };
}
