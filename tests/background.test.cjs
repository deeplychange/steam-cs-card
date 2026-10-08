const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const C=require('../extension/core.js');
function worker(fetchImpl){
  let listener;const deleted=[];
  const sandbox={CSCore:C,importScripts:()=>{},setTimeout,clearTimeout,AbortController,URL,Map,Date,fetch:fetchImpl,chrome:{
    action:{onClicked:{addListener:()=>{}}},storage:{local:{remove:keys=>deleted.push(...keys)},onChanged:{addListener:()=>{}}},
    runtime:{openOptionsPage:()=>{},onMessage:{addListener:fn=>listener=fn}}
  }};
  vm.runInNewContext(fs.readFileSync(require.resolve('../extension/background.js'),'utf8'),sandbox);
  return {deleted,query:(steamId,url='https://steamcommunity.com/profiles/'+steamId)=>new Promise(resolve=>listener({type:'query',steamId},{url},resolve))};
}
const id='76561198015091352';
test('Anonymous Perfect search omits account sessions and deduplicates queries',async()=>{
  let calls=0;
  const w=worker(async(url,init)=>{
    assert.equal(init.credentials,'omit');
    assert.equal(init.headers?.token,undefined);
    assert.equal(init.headers?.Authorization,undefined);
    if(url.includes('5eplay.com'))return {ok:true,json:async()=>({success:false})};
    calls++;assert.equal(url,'https://appengine.wmpvp.com/steamcn/app/search/user');
    assert.equal(JSON.parse(init.body).keyword,id);
    return {ok:true,json:async()=>({code:1,result:[{steamId:id,pvpNickName:'fixture',pvpScore:1234}]})};
  });
  assert.ok(w.deleted.includes('perfectToken'));
  const [a,b]=await Promise.all([w.query(id),w.query(id)]);
  assert.equal(calls,1);assert.equal(a.perfect.stats.score,1234);assert.equal(b.perfect.ban,'未知');
  await w.query(id);assert.equal(calls,1);
});
test('Non-Steam senders are rejected before network access',async()=>{
  const w=worker(()=>{throw new Error('unexpected network');});
  assert.equal((await w.query(id,'https://example.com/')).error,'无效查询');
});
test('Manifest limits login to API origins without cookie access or partner pages',()=>{
  const m=require('../extension/manifest.json');
  assert.equal(m.optional_permissions,undefined);assert.equal(m.optional_host_permissions,undefined);
  assert.ok(!m.permissions.includes('cookies'));
  assert.ok(!m.host_permissions.some(x=>x.includes('partner.')));
  assert.ok(m.host_permissions.includes('https://passport.pwesports.cn/*'));
});
test('Anonymous ban result survives a failed statistics query',async()=>{
  const uuid='63d1cec5-a7ca-11ea-8109-ec0d9a7185b0';
  const w=worker(async(url,init)=>{
    assert.equal(init.credentials,'omit');assert.equal(init.headers?.Authorization,undefined);
    let body;
    if(url.includes('appengine.'))body={code:1,result:[]};
    else if(url.includes('/steam_username/'))body={success:true,data:{steamid_64:id,username:'player'}};
    else if(url.includes('/search/player/'))body={success:true,data:{user:{total:1,list:[{username:'player',domain:'domain'}]}}};
    else if(url.includes('/idTransfer'))body={code:0,data:{uuid}};
    else if(url.includes('/player/home'))throw new Error('Stats temporarily unavailable');
    else if(url.includes('/userinterface/header'))body={code:'0',data:{header:{user_data:{uuid,domain:'domain',username:'player',account_status:'-4',anticheat_type:'1',login_banned_time:'0'}}}};
    else throw new Error('unexpected endpoint');
    return {ok:true,json:async()=>body};
  });
  const result=(await w.query(id)).fiveE;
  assert.equal(result.ban,'作弊封禁');assert.equal(result.banKind,'banned');assert.equal(result.stats.rating,undefined);
});
