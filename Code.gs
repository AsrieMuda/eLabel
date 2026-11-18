/**
 * e-Label Backend Foundation UAT v1.3
 * Google Apps Script bound or standalone. Uses the 13-tab UAT database.
 * IMPORTANT: NOT deployed; frontend demo is intentionally independent.
 * Letter office workflow is UAT frontend-only until secure Drive upload and dispatch APIs are implemented.
 * TKPK (KA) has NO login role; letter officer records external signing and dispatch.
 * Script Properties: SPREADSHEET_ID, GOOGLE_CLIENT_ID, ADMIN_EMAIL, ENVIRONMENT
 * Staff actions: Google ID token validated server-side using Google tokeninfo.
 * Google Apps Script ContentService cross-origin limitations may require a same-origin
 * hosting approach or an approved reverse proxy before GitHub Pages live integration.
 */
const E = Object.freeze({
  SPREADSHEET_ID: '13j1HcYTD3cbff-jO9RgJdNDApSSlXNCkNdZOe0DDxYA',
  ADMIN_EMAIL: 'asrie@moh.gov.my',
  ENVIRONMENT: 'UAT',
  STAFF_DOMAIN: 'moh.gov.my'
});
const HEADERS = {
 APPLICATIONS: ['application_id','legacy_ref','received_at','applicant_email','company_id','application_type','fee_amount','payment_ref','document_complete','current_status','current_stage','priority','assigned_kpp','created_by','created_at','updated_at','uat_flag'],
 COMPANIES: ['company_id','company_name','registration_no','contact_person','email','phone','address','created_at'],
 PRODUCTS: ['product_id','application_id','product_name','brand','country_of_origin','entry_point','batch_lot','proposed_label_drive_id'],
 USERS: ['user_id','email','display_name','role','active','department','created_at'],
 TASKS: ['task_id','application_id','task_type','assigned_to','assigned_by','assigned_at','due_at','task_status','completed_at','remarks'],
 LABEL_REVIEWS: ['review_id','application_id','product_id','task_id','reviewer_email','review_result','findings','correction_required','submitted_at'],
 STATUS_HISTORY: ['history_id','application_id','old_status','new_status','action','actor_email','action_at','remarks','visibility_to_applicant'],
 AUDIT_LOG: ['audit_id','entity_type','entity_id','action','actor_email','timestamp','before_json','after_json','request_id'],
 NOTIFICATIONS: ['notification_id','application_id','recipient_email','channel','event_type','subject','status','queued_at','sent_at','attempts']
};
function props_() { return PropertiesService.getScriptProperties(); }
function config_(key) { return props_().getProperty(key) || E[key] || ''; }
function book_() { return SpreadsheetApp.openById(config_('SPREADSHEET_ID')); }
function sheet_(name) { const s=book_().getSheetByName(name); if(!s) throw new Error('Missing sheet: '+name); return s; }
function table_(name) { const v=sheet_(name).getDataRange().getValues(); const keys=v.shift().map(String); return v.filter(r=>r.some(x=>x!=='' && x!==null)).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]]))); }
function insert_(name,record) { const s=sheet_(name),keys=s.getRange(1,1,1,s.getLastColumn()).getValues()[0]; s.appendRow(keys.map(k=>record[k]===undefined?'':record[k])); }
function patch_(name,key,value,patch) { const s=sheet_(name),v=s.getDataRange().getValues(),headers=v[0],i=headers.indexOf(key); if(i<0)throw Error('Invalid key'); const row=v.findIndex((r,n)=>n>0&&String(r[i])===String(value));if(row<0)throw Error('Record not found'); const before=Object.fromEntries(headers.map((k,n)=>[k,v[row][n]]));const after={...before,...patch};s.getRange(row+1,1,1,headers.length).setValues([headers.map(k=>after[k]===undefined?'':after[k])]);return {before,after}; }
function uid_() { return Utilities.getUuid(); }
function timestamp_() { return new Date().toISOString(); }
function assert_(ok,msg) { if(!ok)throw new Error(msg); }
function validEmail_(s) {return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||''));}
function clean_(s,max) {return String(s||'').trim().slice(0,max||500);}
function lock_(fn){const l=LockService.getScriptLock();assert_(l.tryLock(25000),'System busy, retry');try{return fn()}finally{l.releaseLock()}}
function verifyGoogleToken_(idToken) {
 assert_(idToken&&typeof idToken==='string','ID token required');
 const clientId=config_('GOOGLE_CLIENT_ID');assert_(clientId,'Set GOOGLE_CLIENT_ID in Script Properties');
 const url='https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken);
 const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
 assert_(response.getResponseCode()===200,'Google token rejected');
 const p=JSON.parse(response.getContentText());
 assert_(p.aud===clientId,'Invalid OAuth audience');
 assert_(['accounts.google.com','https://accounts.google.com'].includes(p.iss),'Invalid token issuer');
 assert_(Number(p.exp)*1000>Date.now(),'Expired token');
 assert_(p.email_verified===true||p.email_verified==='true','Email not verified');
 assert_(p.hd===E.STAFF_DOMAIN,'Not a verified KKM Workspace account');
 const email=String(p.email||'').toLowerCase();
 assert_(email.endsWith('@'+E.STAFF_DOMAIN),'Invalid staff email');
 return {email,name:p.name||email};
}
function user_(token) {
 const identity=verifyGoogleToken_(token),admin=String(config_('ADMIN_EMAIL')).toLowerCase();
 if(identity.email===admin)return {...identity,role:'SUPER_ADMIN'};
 const account=table_('USERS').find(u=>String(u.email).toLowerCase()===identity.email&&String(u.active).toUpperCase()==='TRUE');
 assert_(account,'Access not granted');
 return {...identity,role:String(account.role).toUpperCase()};
}
function permitted_(user,roles){assert_(user.role==='SUPER_ADMIN'||roles.includes(user.role),'Not authorized for this action')}
function event_(id,from,to,action,actor,remarks){insert_('STATUS_HISTORY',{history_id:uid_(),application_id:id,old_status:from,new_status:to,action,actor_email:actor,action_at:timestamp_(),remarks:remarks||'',visibility_to_applicant:'TRUE'});}
function audit_(name,id,action,user,before,after){insert_('AUDIT_LOG',{audit_id:uid_(),entity_type:name,entity_id:id,action,actor_email:user.email,timestamp:timestamp_(),before_json:JSON.stringify(before||{}),after_json:JSON.stringify(after||{}),request_id:uid_()});}
function alert_(id,email,type,subject){insert_('NOTIFICATIONS',{notification_id:uid_(),application_id:id,recipient_email:email||'',channel:'IN_APP',event_type:type,subject,status:'PENDING',queued_at:timestamp_(),sent_at:'',attempts:0});}
function app_(id){const a=table_('APPLICATIONS').find(x=>String(x.application_id)===String(id));assert_(a,'Application not found');return a;}
function issueId_(){const p=props_(),year=new Date().getFullYear(),key='SEQ_'+year;const n=Number(p.getProperty(key)||0)+1;p.setProperty(key,String(n));return `EL-UAT-${year}-${String(n).padStart(5,'0')}`;}
function dashboard_(u){const all=table_('APPLICATIONS');const counts={TOTAL:all.length,NEW:0,REVIEW:0,LETTER:0,WAIT_RETURN:0,READY_DISPATCH:0,DONE:0};all.forEach(a=>{if(counts[a.current_status]!==undefined)counts[a.current_status]++});return {role:u.role,counts,applications:all.slice(-100).reverse()};}
function register_(u,p){permitted_(u,['MYSTEP']);assert_(clean_(p.company_name,150),'Company name required');assert_(clean_(p.product_name,150),'Product name required');assert_(validEmail_(p.applicant_email),'Applicant email invalid');assert_(p.complete===true,'Documents must be checked before sending to KPP');const t=timestamp_(),id=issueId_(),company=uid_();insert_('COMPANIES',{company_id:company,company_name:clean_(p.company_name,150),registration_no:clean_(p.registration_no,60),email:clean_(p.applicant_email,254),phone:clean_(p.phone,50),created_at:t});insert_('APPLICATIONS',{application_id:id,received_at:t,applicant_email:clean_(p.applicant_email,254),company_id:company,application_type:clean_(p.application_type||'PELABELAN SEMULA',80),document_complete:'TRUE',current_status:'NEW',current_stage:'KPP',priority:'NORMAL',created_by:u.email,created_at:t,updated_at:t,uat_flag:'TRUE'});insert_('PRODUCTS',{product_id:uid_(),application_id:id,product_name:clean_(p.product_name,150),brand:clean_(p.brand,100),country_of_origin:clean_(p.country,100)});event_(id,'','NEW','REGISTER',u.email,'MySTEP registration');audit_('APPLICATIONS',id,'REGISTER',u,null,{id,company,product_name:p.product_name});alert_(id,config_('ADMIN_EMAIL'),'NEW_APPLICATION','Permohonan baharu '+id);return {id,status:'NEW'};}
function assign_(u,p){permitted_(u,['KPP']);const a=app_(p.application_id);assert_(a.current_status==='NEW','Application is not awaiting assignment');const all=Array.isArray(p.reviewers)?[...new Set(p.reviewers.map(x=>clean_(x,254).toLowerCase()))]:[];assert_(all.length>0&&all.length<=10,'Select 1-10 reviewers');const members=table_('USERS');for(const email of all){assert_(members.some(m=>String(m.email).toLowerCase()===email&&String(m.role).toUpperCase()==='REVIEWER'&&String(m.active).toUpperCase()==='TRUE'),'Invalid reviewer '+email)}const t=timestamp_();all.forEach(email=>{insert_('TASKS',{task_id:uid_(),application_id:a.application_id,task_type:'LABEL_REVIEW',assigned_to:email,assigned_by:u.email,assigned_at:t,task_status:'OPEN'});alert_(a.application_id,email,'TASK_ASSIGNED','Tugasan semakan '+a.application_id)});const x=patch_('APPLICATIONS','application_id',a.application_id,{current_status:'REVIEW',current_stage:'PENYEMAK',updated_at:t});event_(a.application_id,'NEW','REVIEW','ASSIGN',u.email,all.join('; '));audit_('APPLICATIONS',a.application_id,'ASSIGN',u,x.before,x.after);return {id:a.application_id,reviewers:all};}
function myTasks_(u){return table_('TASKS').filter(t=>u.role==='SUPER_ADMIN'||u.role==='KPP'||String(t.assigned_to).toLowerCase()===u.email)}
function submitReview_(u,p){permitted_(u,['REVIEWER']);const a=app_(p.application_id),tasks=table_('TASKS');assert_(a.current_status==='REVIEW','Application not in review');const t=tasks.find(x=>String(x.application_id)===String(a.application_id)&&String(x.task_id)===String(p.task_id)&&String(x.assigned_to).toLowerCase()===u.email&&x.task_status==='OPEN');assert_(t,'Task not assigned to current user');const allowed=['DISOKONG','PINDAAN','TIDAK_DISOKONG'];assert_(allowed.includes(p.result),'Invalid result');const stamp=timestamp_();insert_('LABEL_REVIEWS',{review_id:uid_(),application_id:a.application_id,task_id:t.task_id,reviewer_email:u.email,review_result:p.result,findings:clean_(p.findings,4000),correction_required:p.result==='PINDAAN'?'TRUE':'FALSE',submitted_at:stamp});patch_('TASKS','task_id',t.task_id,{task_status:'DONE',completed_at:stamp});audit_('TASKS',t.task_id,'REVIEW',u,t,{result:p.result});const other=table_('TASKS').filter(x=>String(x.application_id)===String(a.application_id)&&x.task_type==='LABEL_REVIEW'&&x.task_status!=='DONE');if(other.length===0){patch_('APPLICATIONS','application_id',a.application_id,{current_status:'LETTER',current_stage:'PENJANA_SURAT',updated_at:stamp});event_(a.application_id,'REVIEW','LETTER','REVIEW_COMPLETED',u.email,'All review tasks completed');alert_(a.application_id,'','REVIEW_COMPLETED','Semakan selesai '+a.application_id)}return {id:a.application_id,remaining:other.length};}
function doPost(e){try{const input=JSON.parse(e.postData.contents||'{}');const u=user_(input.idToken);let result;switch(input.action){case 'whoami':result=u;break;case 'dashboard':result=dashboard_(u);break;case 'myTasks':result=myTasks_(u);break;case 'register':result=lock_(()=>register_(u,input.payload||{}));break;case 'assign':result=lock_(()=>assign_(u,input.payload||{}));break;case 'submitReview':result=lock_(()=>submitReview_(u,input.payload||{}));break;default:throw new Error('Unknown operation')}return ContentService.createTextOutput(JSON.stringify({ok:true,data:result})).setMimeType(ContentService.MimeType.JSON)}catch(error){return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(error.message||error)})).setMimeType(ContentService.MimeType.JSON)}}
function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:true,service:'e-Label UAT Backend',version:'1.3-foundation',notice:'Staff operations require signed POST requests'})).setMimeType(ContentService.MimeType.JSON)}
