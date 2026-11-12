import {createMembershipAdminSession,filterResponses,responseColumns,responseAnswer,statusLabel} from './membership-model.mjs';
export function mountMembershipAdmin({config,host,hubOrigin='https://shootershub.net',root=document}) {
const $=id=>root.querySelector('#'+id);
const status=$('membership-admin-status'),privateArea=$('membership-admin-private'),controls=$('membership-admin-controls'),signIn=$('membership-admin-signin'),link=$('season-membership-admin-link');
const enabled=Boolean(config?.enrollmentEnabled&&config.issuerType==='season'&&/^[\w-]{1,200}$/.test(config.issuerId||''));
function sessionKey(){const owner=host?.session();return owner?.uid?owner.uid+':'+owner.generation:null;}
const model=createMembershipAdminSession({request:(path)=>host.request(path),current:sessionKey,onChange:render});
function textCell(tag,value){const cell=document.createElement(tag);cell.textContent=value;return cell;}
function render(){
 const state=model.state(),page=state.page;
 status.textContent=state.busy?'Checking organizer access and loading members…':state.message||(!enabled?'Membership administration is being prepared. Enrollment remains closed.':!sessionKey()?'Sign in with an account that manages this season.':page?'Members loaded from Shooters Hub.':'Load members to verify your organizer access.');
 controls.hidden=!enabled||!sessionKey();signIn.hidden=!enabled||Boolean(sessionKey());privateArea.hidden=!page;
 $('membership-admin-load').disabled=state.busy;
 $('membership-admin-export').disabled=state.busy||!page||!filterResponses(page.responses,$('membership-admin-search').value,$('membership-admin-state').value).length;
 for(const id of ['search','state','view'])$('membership-admin-'+id).disabled=state.busy;
 link.hidden=!page;link.href=hubOrigin+'/seasons/'+encodeURIComponent(config?.issuerId||'')+'/memberships';
 const root=$('membership-admin-table');root.replaceChildren();
 if(!page){$('membership-admin-search').value='';$('membership-admin-state').value='';$('membership-admin-program').textContent='';$('membership-admin-count').textContent='';return;}
 $('membership-admin-program').textContent=page.program?page.program.title+' · Program '+page.program.revision+' · '+(page.program.enabled?'Enrollment enabled':'Enrollment closed'):'No membership program has been configured for this season.';
 const rows=filterResponses(page.responses,$('membership-admin-search').value,$('membership-admin-state').value),answers=$('membership-admin-view').value==='answers',fields=answers?responseColumns(rows):[];
 $('membership-admin-count').textContent=`${rows.length} of ${page.responses.length} members on this page · up to 25 per page`;
 if(!rows.length){const p=document.createElement('p');p.textContent=page.responses.length?'No members on this page match these filters.':'No members on this page yet. New season memberships will appear here after joining opens.';root.append(p);}
 else {
  const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent=answers?'Saved answers, labeled with the questionnaire revision each member completed.':'Members of this season. Use Show to review saved questionnaire answers.';table.append(caption);
  const head=document.createElement('thead'),tr=document.createElement('tr');for(const label of ['Member','Status','Joined','Program',...fields.map(f=>f.label+' · v'+f.revision)]){const th=textCell('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
  const body=document.createElement('tbody');
  for(const row of rows){const tr=document.createElement('tr'),member=document.createElement('th');member.scope='row';const a=document.createElement('a');a.href='/user/'+encodeURIComponent(row.userId);a.textContent=row.displayName||row.userId;member.append(a);const small=document.createElement('small');small.textContent=row.userId;member.append(small);tr.append(member,textCell('td',statusLabel(row.status)),textCell('td',new Date(row.joinedAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})),textCell('td',String(row.programRevision)));for(const f of fields)tr.append(textCell('td',responseAnswer(row,f)||'—'));body.append(tr);}table.append(body);root.append(table);
 }
 $('membership-admin-previous').disabled=state.busy||state.cursors.length===1;$('membership-admin-next').disabled=state.busy||!page.nextCursor;$('membership-admin-page').textContent='Page '+state.cursors.length;
}
$('membership-admin-load').addEventListener('click',()=>void model.load({direction:'first'}));
$('membership-admin-previous').addEventListener('click',()=>void model.load({direction:'previous'}));
$('membership-admin-next').addEventListener('click',()=>void model.load({direction:'next'}));
$('membership-admin-export').addEventListener('click',async()=>{
 const owner=host.session();const csv=await model.load({exportPage:true,text:$('membership-admin-search').value,status:$('membership-admin-state').value});if(!csv||!host.isCurrent(owner))return;
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='season-membership-responses-page.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
for(const id of ['search','state','view'])$('membership-admin-'+id).addEventListener(id==='search'?'input':'change',render);
host?.subscribeActor(()=>model.clear());host?.ready.then(render);render();

return {clear:()=>model.clear()};
}
