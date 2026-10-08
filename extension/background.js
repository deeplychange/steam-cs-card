importScripts('core.js','perfect-auth.js');
const pending = new Map();
const cache = new Map();
const fiveEProfiles=new Map(),seasonCache=new Map(),seasonPending=new Map();
let accountRevision=0;
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.storage.onChanged.addListener((changes,area) => {if(area==='session'&&!changes?.perfectSession)return;accountRevision++;cache.clear();pending.clear();});
// Drop legacy v0.1–v0.3 credentials. This version never uses account sessions.
chrome.storage.local.remove(['perfectToken','ownSteamId','appversion']);
if(chrome.storage.session)chrome.storage.session.remove(['perfectSmsChallenge','perfectSmsAt']);

async function queryPerfect(id) {
  let loginError='';
  if(chrome.storage.session){
    const auth=await PerfectAuth.session();
    if(auth){try{return await PerfectAuth.stats(id,auth);}catch(e){loginError='登录战绩查询失败：'+e.message+' ';}}
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://appengine.wmpvp.com/steamcn/app/search/user', {
      method: 'POST', credentials: 'omit', signal: controller.signal,
      headers: {'Content-Type': 'application/json;charset=UTF-8'},
      body: JSON.stringify({keyword:id,page:1})
    });
    if (!res.ok) throw new Error('完美请求失败：HTTP ' + res.status);
    const p=CSCore.normalizePerfectPublic(await res.json(), id);
    if(loginError)p.message=loginError+p.message;
    return p;
  } catch (e) {
    return CSCore.unknown('perfect', e.name === 'AbortError' ? '查询超时，请稍后重试。' : '查询失败：' + e.message);
  } finally { clearTimeout(timer); }
}

async function queryFiveE(id) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  const get=async(url,body)=>{
    const r=await fetch(url,{signal:controller.signal,credentials:'omit',...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  };
  try {
    const identity=await get('https://api-client-arena.5eplay.com/api/user/steam_username/'+id);
    if(identity?.success!==true || identity.data?.steamid_64!==id || !identity.data.username) throw new Error('没有获取到绑定该 SteamID 的 5E 账号');
    const searchResponse=await get('https://arena.5eplay.com/api/search/player/1/16?keywords='+encodeURIComponent(identity.data.username));
    const list=searchResponse?.data?.user?.list;
    const matches=Array.isArray(list) ? list.filter(p=>p.username===identity.data.username && typeof p.domain==='string'):[];
    if(searchResponse?.success!==true || matches.length!==1 || Number(searchResponse.data.user.total)>16) throw new Error('5E 搜索结果不能唯一确认账号，已停止查询');
    const candidate=matches[0];
    const transfer=await get('https://gate.5eplay.com/userinterface/http/v1/userinterface/idTransfer',{trans:{domain:candidate.domain}});
    const uuid=transfer?.data?.uuid;
    if(transfer?.code!==0 || typeof uuid!=='string' || !/^[a-f\d-]{36}$/i.test(uuid)) throw new Error('5E 账号映射失败');
    // Ban status is independent of career statistics: retain either result if the other fails.
    const [home,header,seasons]=await Promise.allSettled([
      get('https://gate.5eplay.com/crane/http/api/data/v3/player/home?uuid='+encodeURIComponent(uuid)),
      get('https://gate.5eplay.com/userinterface/http/v1/userinterface/header?v='+encodeURIComponent(uuid)),
      get('https://gate.5eplay.com/crane/http/api/data/season_list?uuid='+encodeURIComponent(uuid))
    ]);
    let result=CSCore.unknown('fiveE','5E 统计未返回。');
    if(home.status==='fulfilled'){
      try {result=CSCore.normalizeFiveE(home.value,identity,candidate,uuid,id);}catch(e){result.message=e.message;}
    }
    if(header.status==='fulfilled'){
      try {
        const ban=CSCore.normalizeFiveEBan(header.value,identity,candidate,uuid,id);
        result={...result,...ban,banUpdatedAt:ban.updatedAt,name:identity.data.username};
        result.message=home.status==='fulfilled' && result.status==='ok' ? '账号经 SteamID→用户名→唯一同名资料关联。':'统计未获取，已单独查询账号封禁状态。';
      }catch(e){result.banDetail='封禁查询失败：'+e.message;}
    }else result.banDetail='封禁接口未返回，不能判断是否封禁。';
    if(seasons.status==='fulfilled'){
      try{result.seasons=CSCore.normalizeFiveESeasons(seasons.value);}catch(e){result.seasonError=e.message;}
    }else result.seasonError='赛季列表查询失败，请刷新重试。';
    fiveEProfiles.set(id,{uuid,seasons:result.seasons||[],matchMode:Number.isSafeInteger(result.matchMode)?result.matchMode:9});
    if(fiveEProfiles.size>100)fiveEProfiles.delete(fiveEProfiles.keys().next().value);
    return result;
  } catch(e) { return CSCore.unknown('fiveE',e.name==='AbortError' ? '5E 查询超时，请重试。' : '5E 查询失败：'+e.message); }
  finally {clearTimeout(timer);}
}

async function queryFiveESeason(id,season,force=false){
  let profile=fiveEProfiles.get(id);
  if(!profile){await queryFiveE(id);profile=fiveEProfiles.get(id);}
  const choice=profile?.seasons.find(s=>s.season===season);
  if(!choice)throw new Error('该赛季不在官方赛季列表中，请刷新资料卡。');
  const key=id+':'+profile.uuid+':'+profile.matchMode+':'+season+':'+choice.csType;
  const old=seasonCache.get(key);
  if(!force&&old&&Date.now()-old.time<60000)return old.value;
  if(seasonPending.has(key))return seasonPending.get(key);
  const task=(async()=>{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const params=new URLSearchParams({uuid:profile.uuid,season,match_type:String(profile.matchMode),cs_type:String(choice.csType)});
      const r=await fetch('https://gate.5eplay.com/crane/http/api/data/player/season?'+params,{credentials:'omit',signal:controller.signal});
      if(!r.ok)throw new Error('历史赛季请求失败：HTTP '+r.status);
      const value={steamId:id,...CSCore.normalizeFiveESeason(await r.json(),season,profile.matchMode)};
      seasonCache.set(key,{time:Date.now(),value});if(seasonCache.size>150)seasonCache.delete(seasonCache.keys().next().value);
      return value;
    }finally{clearTimeout(timer);}
  })();
  seasonPending.set(key,task);try{return await task;}finally{seasonPending.delete(key);}
}

async function query(id, force=false) {
  const revision=accountRevision;
  const old = cache.get(id);
  if (!force && old && Date.now() - old.time < 60000) return old.value;
  if (pending.has(id)) return pending.get(id);
  const task = (async () => {
    const [perfect,fiveE] = await Promise.all([queryPerfect(id),queryFiveE(id)]);
    if(revision!==accountRevision)return {error:'登录状态已改变，请刷新查询。'};
    const value = {steamId: id, perfect, fiveE};
    cache.set(id, {time: Date.now(), value});
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return value;
  })();
  pending.set(id, task);
  try { return await task; } finally { if(pending.get(id)===task)pending.delete(id); }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if(['perfectQrStart','perfectQrPoll','perfectQrCancel','perfectLogout','perfectStatus','perfectDiagnostics','perfectBridgeConnect'].includes(message?.type)){
    if(sender.url!==chrome.runtime.getURL('options.html')){reply({error:'只能在扩展设置页操作登录。'});return;}
    const task=message.type==='perfectBridgeConnect'?PerfectAuth.connectBridge(message.key):message.type==='perfectQrStart'?PerfectAuth.startQr():message.type==='perfectQrPoll'?PerfectAuth.pollQr(String(message.id||'')):message.type==='perfectQrCancel'?PerfectAuth.cancelQr():message.type==='perfectLogout'?PerfectAuth.clear():message.type==='perfectDiagnostics'?PerfectAuth.diagnostics():PerfectAuth.status();
    task.then(reply,e=>reply({error:e.name==='AbortError'?'接口超时，请稍后再试。':e.message}));return true;
  }
  if (message?.type === 'options') { chrome.runtime.openOptionsPage(); reply({ok: true}); return; }
  if(message?.type==='fiveESeason'){
    if(!CSCore.isProfileUrl(sender.url)||!CSCore.validId(message.steamId)||typeof message.season!=='string'||!/^\d{4}s[1-9]\d?$/.test(message.season)){reply({error:'无效赛季查询'});return;}
    queryFiveESeason(message.steamId,message.season,message.force===true).then(reply,e=>reply({error:e.name==='AbortError'?'历史赛季查询超时，请重试。':e.message}));return true;
  }
  if (message?.type !== 'query') return;
  let allowed = false;
  try { allowed = new URL(sender.url).origin === 'https://steamcommunity.com'; } catch {}
  if (!allowed || !CSCore.validId(message.steamId)) { reply({error: '无效查询'}); return; }
  query(message.steamId,message.force===true).then(reply, () => reply({error: '扩展查询失败，请重新加载扩展。'}));
  return true;
});
