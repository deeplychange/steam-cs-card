const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBridge}=require('../helper/bridge.cjs');
test('Loopback helper requires pairing, rejects arbitrary URLs, preserves raw SteamID and forwards fixed QR operations',async()=>{
 const key='a'.repeat(64),calls=[];
 const server=createBridge({key,fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,text:async()=>'{"code":0,"steamId":76561198098647336}'};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/request';
 const post=(body,k=key)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-CS-Bridge-Key':k,Origin:'null'},body:JSON.stringify(body)});
 try{
  assert.equal((await post({operation:'qrStart'},'bad')).status,401);assert.equal(calls.length,0);
  assert.equal((await post({operation:'request',url:'https://example.com'})).status,400);
  const p=await post({operation:'ping'});assert.equal(p.headers.get('access-control-allow-origin'),'*');assert.equal((await p.json()).ready,true);
  const response=await post({operation:'qrStart'});assert.match((await response.json()).data,/76561198098647336/);
  assert.equal(calls[0].url,'https://passport.pwesports.cn/qrAuth/applyToken');assert.equal(calls[0].init.headers.Origin,undefined);
  assert.equal((await post({operation:'stats',body:{mySteamId:'bad',toSteamId:'bad'},token:'x'})).status,400);
 }finally{await new Promise(r=>server.close(r));}
});
test('5E ranks come from official level IDs and stars, not guessed ELO',()=>{
 const c=require('../extension/core.js');assert.equal(c.fiveERank({level_id:44}),'C++');assert.equal(c.fiveERank({level_id:51,star_num:4}),'S · 4星');assert.equal(c.fiveERank({level_id:52,star_num:24}),'SS · 24星');assert.equal(c.fiveERank({level_id:53,star_num:44}),'SSS · 44星');assert.equal(c.fiveERank({level_id:55}),'SSS · TOP10');assert.equal(c.fiveERank({level_id:100}),'未定级');assert.equal(c.fiveERank({elo:3000,level_id:999}),null);
});
