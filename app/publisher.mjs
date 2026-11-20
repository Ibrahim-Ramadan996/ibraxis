// Owner-only publishing service. Credentials never enter the browser or AI context.
const defaultRepo='Ibrahim-Ramadan996/ibraxis';
const repoPattern=/^[\w.-]+\/[\w.-]+$/;
const workflow='/actions/workflows/pages.yml';
const active=run=>run&&run.status!=='completed';
const validId=id=>Number.isSafeInteger(id)&&id>0;
const problem=(status,message)=>Object.assign(new Error(message),{status});
export function createPublisher({store,token=process.env.IBRAXIS_PUBLISH_TOKEN,repo=process.env.IBRAXIS_PUBLISH_REPO||defaultRepo,fetcher=globalThis.fetch,now=Date.now}={}){
 const configured=()=>!!(token&&repoPattern.test(repo)&&store?.status.configured&&store.repo?.toLowerCase()!==repo.toLowerCase());
 let busy=false,runId=null,retryAfter=0,unknown=false;
 const actionsUrl=`https://github.com/${repo}/actions/workflows/pages.yml`;
 async function github(path,method='GET',body){
  let response;try{response=await fetcher(`https://api.github.com/repos/${repo}${path}`,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)})}catch{throw problem(502,'GitHub connection failed; check Actions before retrying');}
  if(!response.ok)throw problem(502,`GitHub Actions HTTP ${response.status}`);
  if(response.status===204)return null;
  try{return await response.json()}catch{throw problem(502,'Invalid GitHub Actions response; check Actions before retrying')}
 }
 async function recent(){const v=await github(workflow+'/runs?branch=main&per_page=20');if(!Array.isArray(v?.workflow_runs))throw problem(502,'Invalid workflow run list');return v.workflow_runs;}
 function view(run){if(!validId(run?.id))return null;return {id:run.id,status:run.status,conclusion:run.conclusion||null,url:`https://github.com/${repo}/actions/runs/${run.id}`};}
 async function status(){if(!configured())return {configured:false,busy:false,run:null};const runs=await recent();const tracked=runId?runs.find(r=>r.id===runId):null;return {configured:true,busy,run:runId?view(tracked||{id:runId,status:'requested'}):unknown?null:view(runs[0]),unknown,actionsUrl};}
 async function publish(confirm){
  if(confirm!==true)throw problem(400,'Confirmation required');
  if(!configured())throw problem(503,'Configure private data storage and publishing token first');
  if(busy||now()<retryAfter)throw problem(409,'A publish request is active or was just sent; refresh Actions before retrying');
  busy=true;
  try{
   if((await recent()).some(active))throw problem(409,'A Pages workflow is already active; retry after it finishes');
   if(store.busy)throw problem(409,'Data sync is already active; retry after it finishes');
   const synced=await store.sync();
   if(!synced?.configured||synced.pending||synced.error||!synced.lastSuccess||store.busy)throw problem(409,'Data sync incomplete; publishing was not started');
   // Recheck immediately before dispatch, including pending concurrent edits.
   if((await recent()).some(active))throw problem(409,'A Pages workflow is already active; retry after it finishes');
   if(store.busy||store.status.pending||store.status.error)throw problem(409,'Data changed during sync; publishing was not started');
   retryAfter=now()+60000; // No automatic retry of an ambiguous dispatch.
   runId=null;unknown=true;
   const result=await github(workflow+'/dispatches','POST',{ref:'main'});
   if(!validId(result?.workflow_run_id))return {configured:true,accepted:true,run:null,actionsUrl};
   runId=result.workflow_run_id;unknown=false;
   return {configured:true,accepted:true,run:view({id:runId,status:'requested'}),actionsUrl};
  }finally{busy=false}
 }
 return {status,publish};
}
