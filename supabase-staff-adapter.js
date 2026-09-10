/* BIG BROTHER — Staff Management Supabase Adapter V1 */
(function(){
  'use strict';

  const URL='https://sjfhlaclgmkwwofzstok.supabase.co';
  const KEY='sb_publishable_w762jR65CWwlO30fKQsYOw_6L9grx8S';
  const SESSION_KEY='BB_SUPABASE_DEV_SESSION_V1';
  let session=null;
  let bootstrapPromise=null;
  let bootstrapAt=0;

  function readSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}
    catch(_){return null}
  }

  function saveSession(s){
    session=s||null;
    try{
      if(!s){localStorage.removeItem(SESSION_KEY);return;}
      if(!s.expires_at&&s.expires_in){
        s.expires_at=Math.floor(Date.now()/1000)+Number(s.expires_in);
      }
      localStorage.setItem(SESSION_KEY,JSON.stringify(s));
    }catch(_){}
  }

  async function parse(response){
    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{}}
    catch(_){data={message:text}}
    if(!response.ok){
      throw new Error(
        data.message||data.error_description||data.error||
        ('Staff database request failed ('+response.status+')')
      );
    }
    return data;
  }

  async function refreshSession(){
    const current=readSession();
    if(!current?.refresh_token){
      throw new Error('Please sign in to BIG BROTHER first from the Clients Editor.');
    }
    const response=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:current.refresh_token})
    });
    const next=await parse(response);
    saveSession(next);
    return next;
  }

  async function ensureSession(){
    session=readSession();
    if(!session?.access_token){
      throw new Error('Please sign in to BIG BROTHER first from the Clients Editor.');
    }
    const now=Math.floor(Date.now()/1000);
    if(session.expires_at&&Number(session.expires_at)<now+30){
      await refreshSession();
    }
    return session;
  }

  async function rpc(fn,args={}){
    await ensureSession();
    const response=await fetch(URL+'/rest/v1/rpc/'+fn,{
      method:'POST',
      headers:{
        apikey:KEY,
        Authorization:'Bearer '+session.access_token,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(args||{}),
      cache:'no-store'
    });
    return parse(response);
  }

  function bootstrap(){
    const now=Date.now();
    if(!bootstrapPromise || now-bootstrapAt>1500){
      bootstrapAt=now;
      bootstrapPromise=rpc('bb_staff_management_bootstrap').catch(error=>{
        bootstrapPromise=null;
        throw error;
      });
    }
    return bootstrapPromise;
  }

  async function get(action,_params={}){
    const data=await bootstrap();
    switch(String(action||'')){
      case 'getDepartments': return {success:true,data:data.departments||[]};
      case 'getStaff': return {success:true,data:data.staff||[]};
      case 'getStaffSalary': return {success:true,data:data.salaries||[]};
      default: throw new Error('Unsupported Staff Management read action: '+action);
    }
  }

  async function post(action,data={}){
    let result;
    switch(String(action||'')){
      case 'saveDepartment':
        result=await rpc('bb_staff_management_save_department',{p_payload:data||{}});
        break;
      case 'saveStaff':
        result=await rpc('bb_staff_management_save_staff',{p_payload:data||{}});
        break;
      case 'saveStaffSalary':
        result=await rpc('bb_staff_management_save_salary',{p_payload:data||{}});
        break;
      default:
        throw new Error('Unsupported Staff Management write action: '+action);
    }
    bootstrapPromise=null;
    bootstrapAt=0;
    return result;
  }

  window.BBStaffAdapter={rpc,get,post};
})();