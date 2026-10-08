'use strict';
// Only the extension settings page can invoke these account operations.
const PerfectAuth = (() => {
  const KEY='perfectQr';
  let transport;
  async function qrTransport(){
    if(await read('perfectBridge'))return;
    if(/Valve Steam Client/i.test(globalThis.navigator?.userAgent||''))throw new Error('Steam 中请先打开 helper/Start.cmd，填写本机连接码并点击连接，再生成二维码。');
    if(!chrome.declarativeNetRequest?.updateSessionRules)throw new Error('此浏览器不支持扫码请求所需的扩展规则。');
    // CEF may omit the extension initiator. Restrict to non-tab background requests instead.
    if(!transport)transport=chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[70801],addRules:[{id:70801,priority:100,action:{type:'modifyHeaders',requestHeaders:[{header:'Origin',operation:'remove'}]},condition:{regexFilter:'^https://passport\\.pwesports\\.cn/qrAuth/(applyToken|check)$',resourceTypes:['xmlhttprequest','other'],requestMethods:['post','options'],tabIds:[-1]}}]}).catch(e=>{transport=null;throw new Error('扫码请求规则无法启用。请查看诊断信息。');});
    await transport;
  }
  const parse=text=>JSON.parse(text.replace(/("(?:steamId|mySteamId)"\s*:\s*)(\d{17})(?=\s*[,}])/g,'$1"$2"'));
  const read=async key=>(await chrome.storage.session.get(key))[key];
  async function post(url,body,headers={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const bridge=await read('perfectBridge');
      if(bridge){
        const operation=url==='https://passport.pwesports.cn/qrAuth/applyToken'?'qrStart':url==='https://passport.pwesports.cn/qrAuth/check'?'qrCheck':url==='https://api.wmpvp.com/api/csgo/home/pvp/detailStats'?'stats':null;
        if(!operation)throw new Error('不支持的本机请求。');
        const reply=await bridgeRequest(bridge,{operation,body,...(operation==='stats'?{token:headers.token}:{})},controller.signal);
        if(typeof reply.data!=='string')throw new Error('本机辅助程序响应无法识别。');
        try{return parse(reply.data);}catch{throw new Error('官方响应格式无法识别。');}
      }
      const r=await fetch(url,{method:'POST',credentials:'omit',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
      if(!r.ok){
        let cors=false;
        if(r.status===403&&url.startsWith('https://passport.pwesports.cn/qrAuth/')){try{cors=(await r.text()).trim()==='Invalid CORS request';}catch{}}
        throw new Error('接口请求失败：HTTP '+r.status+(cors?'（官方拒绝跨域请求，当前环境的兼容规则未解决。请查看诊断信息。）':''));
      }
      const text=await r.text();try{return parse(text);}catch{throw new Error('接口返回格式无法识别。');}
    }finally{clearTimeout(timer);}
  }
  async function bridgeRequest(key,body,signal){
    let r;try{r=await fetch('http://127.0.0.1:27843/request',{method:'POST',credentials:'omit',redirect:'error',signal,headers:{'Content-Type':'application/json','X-CS-Bridge-Key':key},body:JSON.stringify(body)});}catch{throw new Error('无法连接本机辅助程序，请打开 helper/Start.cmd 并保持窗口开启。');}
    let data;try{data=await r.json();}catch{throw new Error('本机响应格式无法识别。');}
    if(!r.ok)throw new Error(r.status===401?'本机连接码无效，请复制辅助程序当前连接码。':r.status===502?'本机辅助程序请求官方接口失败。':'本机连接失败：HTTP '+r.status);
    return data;
  }
  async function connectBridge(key){
    if(!chrome.storage.session)throw new Error('此浏览器不支持会话存储。');
    if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))throw new Error('请填写辅助程序窗口中的 64 位本机连接码。');
    const r=await bridgeRequest(key,{operation:'ping'},AbortSignal.timeout(5000));
    if(r.ready!==true||r.protocol!==1)throw new Error('辅助程序版本不匹配。');
    await cancelQr();await chrome.storage.session.set({perfectBridge:key});return {ok:true};
  }
  async function session(){return read('perfectSession');}
  async function stats(id,auth){
    const r=await post('https://api.wmpvp.com/api/csgo/home/pvp/detailStats',{mySteamId:auth.steamId,toSteamId:id},{appversion:'3.5.4.172',platform:'android',token:auth.token});
    return CSCore.normalizePerfectStats(r,id);
  }
  async function startQr(){
    if(!chrome.storage.session)throw new Error('此浏览器不支持会话存储，无法启用登录功能。');
    const id=crypto.randomUUID(),time=Date.now();
    await chrome.storage.session.set({[KEY]:{id,time}});
    await qrTransport();
    if((await read(KEY))?.id!==id)throw new Error('二维码生成已取消。');
    const r=await post('https://passport.pwesports.cn/qrAuth/applyToken',{appId:'5',qrType:'1',redirect:false,website:'pvp'});
    if(r.code!==0||typeof r.result?.accessUrl!=='string')throw new Error('官方接口未生成登录二维码。');
    let url;try{url=new URL(r.result.accessUrl);}catch{throw new Error('二维码地址格式无法识别。');}
    const accessToken=url.searchParams.get('accessToken');
    if(url.origin!=='https://news.wmpvp.com'||url.pathname!=='/'||url.username||url.password||!accessToken||accessToken.length>4096||url.searchParams.get('website')!=='pvp'||url.searchParams.get('qrType')!=='1')throw new Error('二维码地址不属于已验证的官方登录流程，已停止。');
    if((await read(KEY))?.id!==id)throw new Error('二维码生成已取消。');
    await chrome.storage.session.set({[KEY]:{id,time,accessToken}});
    // Parse only for validation. Native App QR matching may depend on the exact raw URL.
    // URL.href inserts '/' before '?' for an empty path and changes the official payload.
    return {id,url:r.result.accessUrl,expiresAt:time+120000};
  }
  const pending=new Map();
  async function pollQr(id){
    if(pending.has(id))return pending.get(id);
    const task=(async()=>{
      const qr=await read(KEY);
      if(!qr||qr.id!==id||!qr.accessToken)throw new Error('二维码已取消或刷新，请重新生成。');
      if(Date.now()-qr.time>=120000){await chrome.storage.session.remove(KEY);return {state:'expired',message:'等待超时，请重新生成二维码。'};}
      await qrTransport();
      const r=await post('https://passport.pwesports.cn/qrAuth/check',{appId:'5',accessToken:qr.accessToken});
      if((await read(KEY))?.id!==id)throw new Error('本次扫码已取消。');
      if(r.code!==0||!r.result)throw new Error('官方扫码状态查询失败。');
      const s=r.result.status;
      if(s===0||s===1)return {state:'waiting',message:'请用完美世界电竞 App 扫码，并在手机上确认登录。'};
      if(s===3){await chrome.storage.session.remove(KEY);return {state:'expired',message:'官方二维码已过期，请重新生成。'};}
      if(s!==2)throw new Error('官方扫码状态未识别，已停止查询。');
      const a=r.result.accountItem,token=r.result.token;
      if(!CSCore.validId(a?.steamId)||typeof token!=='string'||token.length<16||token.length>4096||/[\r\n]/.test(token))throw new Error('扫码响应没有返回有效的绑定账号及登录令牌。');
      const auth={steamId:a.steamId,token};let verified=false;
      try{await stats(auth.steamId,auth);verified=true;}catch{}
      if((await read(KEY))?.id!==id)throw new Error('本次扫码已取消。');
      await chrome.storage.session.set({perfectSession:auth});await chrome.storage.session.remove(KEY);
      return {state:'complete',steamId:auth.steamId,verified,message:verified?'扫码登录成功，战绩接口验证成功；完美封禁仍未知。':'扫码已返回令牌，但战绩接口验证失败；不能确认可查询。'};
    })();
    pending.set(id,task);try{return await task;}finally{pending.delete(id);}
  }
  async function cancelQr(){if(chrome.storage.session)await chrome.storage.session.remove(KEY);return {ok:true};}
  async function status(){if(!chrome.storage.session)return {loggedIn:false,supported:false};const a=await session();return {loggedIn:!!a,steamId:a?.steamId,supported:true,bridge:!!await read('perfectBridge')};}
  async function clear(){await cancelQr();if(chrome.storage.session)await chrome.storage.session.remove('perfectSession');return {ok:true};}
  async function diagnostics(){
    let rules=[],readable=false;
    try{rules=await chrome.declarativeNetRequest.getSessionRules();readable=true;}catch{}
    const rule=rules.find(r=>r.id===70801);
    return {version:chrome.runtime.getManifest().version,backgroundBuild:'qr-background-0.9.1',browser:globalThis.navigator?.userAgent||'不可读取',sessionStorage:!!chrome.storage.session,bridgeConfigured:!!await read('perfectBridge'),ruleApi:!!chrome.declarativeNetRequest?.updateSessionRules,ruleReadable:readable,qrRulePresent:!!rule,backgroundScope:!!rule?.condition?.tabIds?.includes(-1)};
  }
  return {startQr,pollQr,cancelQr,status,clear,session,stats,diagnostics,connectBridge};
})();

