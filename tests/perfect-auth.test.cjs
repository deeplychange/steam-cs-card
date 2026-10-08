const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../extension/core.js'),{webcrypto}=require('node:crypto');
const id='76561198098647336',token='fixture-account-token-not-a-real-credential';
function setup(fetch){
 let data={},listener,changed;
 const chrome={declarativeNetRequest:{updateSessionRules:async rules=>{const r=rules.addRules[0];assert.equal(r.action.requestHeaders[0].operation,'remove');assert.deepEqual([...r.condition.tabIds],[-1]);assert.equal(r.condition.initiatorDomains,undefined);assert.deepEqual([...r.condition.requestMethods],['post','options']);assert.ok(r.condition.regexFilter.includes('qrAuth'));}},storage:{session:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])),set:async value=>{data={...data,...value};changed?.(Object.fromEntries(Object.keys(value).map(k=>[k,{}])),'session');},remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k];changed?.({},'session');}},local:{remove:()=>{}},onChanged:{addListener:fn=>changed=fn}},action:{onClicked:{addListener:()=>{}}},runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,openOptionsPage:()=>{},onMessage:{addListener:fn=>listener=fn}}};
 const ctx=vm.createContext({CSCore:C,fetch,chrome,crypto:webcrypto,setTimeout,clearTimeout,AbortController,URL,URLSearchParams,Map,Date,importScripts:()=>{}});
 vm.runInContext(fs.readFileSync(require.resolve('../extension/perfect-auth.js'),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../extension/background.js'),'utf8'),ctx);
 return {message:(m,url='chrome-extension://test/options.html')=>new Promise(r=>listener(m,{url},r)),data:()=>data};
}
const response=body=>({ok:true,text:async()=>JSON.stringify(body)});
const applied={code:0,result:{accessUrl:'https://news.wmpvp.com?type=upgrade&accessToken=test-qr-ticket&website=pvp&qrType=1'}};
test('Steam page cannot start, poll, cancel QR login or read credentials',async()=>{
 const w=setup(()=>{throw Error('unexpected fetch');});
 for(const type of ['perfectQrStart','perfectQrPoll','perfectQrCancel','perfectStatus','perfectLogout','perfectDiagnostics','perfectBridgeConnect'])assert.ok((await w.message({type},'https://steamcommunity.com/profiles/'+id)).error);
});
test('Confirmed QR preserves SteamID precision, validates stats, keeps account token out of replies',async()=>{
 const w=setup(async(url,init)=>{
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
  if(url.includes('/applyToken')){assert.equal(JSON.parse(init.body).appId,'5');return response(applied);}
  if(url.includes('/qrAuth/check'))return {ok:true,text:async()=>'{"code":0,"result":{"status":2,"accountItem":{"steamId":'+id+'},"token":"'+token+'"}}'};
  assert.equal(init.headers.token,token);assert.equal(JSON.parse(init.body).mySteamId,id);return response({statusCode:0,data:{steamId:id,pwRating:1.1}});
 });
 const qr=await w.message({type:'perfectQrStart'});assert.ok(qr.id);assert.equal(qr.url,applied.result.accessUrl);assert.ok(!qr.url.includes('/?'));
 const r=await w.message({type:'perfectQrPoll',id:qr.id});assert.equal(r.state,'complete');assert.equal(r.verified,true);assert.equal(r.steamId,id);
 assert.ok(!JSON.stringify(r).includes(token));assert.equal(w.data().perfectSession.token,token);
 assert.ok(!JSON.stringify(await w.message({type:'perfectStatus'})).includes(token));
 await w.message({type:'perfectLogout'});assert.equal(w.data().perfectSession,undefined);
});
test('Waiting and expired states cannot save a login token',async()=>{
 let state=0;
 const w=setup(async url=>response(url.includes('/applyToken')?applied:{code:0,result:{status:state,token}}));
 const qr=await w.message({type:'perfectQrStart'});
 assert.equal((await w.message({type:'perfectQrPoll',id:qr.id})).state,'waiting');assert.equal(w.data().perfectSession,undefined);
 state=3;assert.equal((await w.message({type:'perfectQrPoll',id:qr.id})).state,'expired');assert.equal(w.data().perfectQr,undefined);
});
test('QR login with failed statistics clearly reports unverified; stats do not infer bans',async()=>{
 const w=setup(async url=>response(url.includes('/applyToken')?applied:url.includes('/qrAuth/check')?{code:0,result:{status:2,accountItem:{steamId:id},token}}:{statusCode:90003,data:null}));
 const qr=await w.message({type:'perfectQrStart'}),r=await w.message({type:'perfectQrPoll',id:qr.id});assert.equal(r.verified,false);assert.match(r.message,/验证失败/);
 assert.equal(C.normalizePerfectStats({statusCode:0,data:{steamId:id,banType:0,pwRating:1.2}},id).ban,'未知');
 assert.throws(()=>C.normalizePerfectStats({statusCode:0,data:{steamId:'76561198015091352'}},id));
});
test('Cancel during verification prevents a delayed token from being saved',async()=>{
 let finish,started;const ready=new Promise(r=>started=r);
 const w=setup(async url=>{
  if(url.includes('/applyToken'))return response(applied);
  if(url.includes('/qrAuth/check'))return response({code:0,result:{status:2,accountItem:{steamId:id},token}});
  started();await new Promise(r=>finish=r);return response({statusCode:0,data:{steamId:id}});
 });
 const qr=await w.message({type:'perfectQrStart'}),task=w.message({type:'perfectQrPoll',id:qr.id});await ready;await w.message({type:'perfectQrCancel'});finish();
 assert.match((await task).error,/取消/);assert.equal(w.data().perfectSession,undefined);
});
test('Reject off-domain QR addresses and malformed responses without exposing contents',async()=>{
 const w=setup(async()=>response({code:0,result:{accessUrl:'https://example.com/?accessToken=foo&website=pvp&qrType=1'}}));assert.ok((await w.message({type:'perfectQrStart'})).error);
 const bad=setup(async()=>({ok:true,text:async()=>token+' invalid json'}));const r=await bad.message({type:'perfectQrStart'});assert.ok(r.error);assert.ok(!r.error.includes(token));
});
