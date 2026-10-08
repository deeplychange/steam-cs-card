const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const C=require('../extension/core.js');
const id='76561198098647336',uuid='8a8cae0f-a7ca-11ea-8109-ec0d9a7185b0';
test('Season list preserves CS2 and CSGO seasons and removes invalid entries',()=>{
  const r=C.normalizeFiveESeasons({code:0,data:{season_list:[{season:'2026s4',cs_type:0,current_season:true},{season:'2023s4',cs_type:1},{season:'2026s4',cs_type:0},{season:'wrong',cs_type:0}]}});
  assert.equal(r.length,2);assert.match(r[0].label,/当前/);assert.match(r[1].label,/CS:GO/);
});
test('Historical stats never substitute default ELO or invent KD without deaths',()=>{
  const response={code:0,data:{contrast_data:{match_type:9,match_total:0,elo:1000,rating:0}}};
  assert.equal(C.normalizeFiveESeason(response,'2020s1',9).stats.score,null);
  response.data.contrast_data={match_type:9,match_total:66,elo:2501.1,rating:1.26,kill:1227,adr:92.04,per_win_match:0.5};
  const stats=C.normalizeFiveESeason(response,'2026s3',9).stats;
  assert.equal(stats.kd,null);assert.equal(stats.winRate,50);assert.equal(stats.score,2501.1);
  assert.throws(()=>C.normalizeFiveESeason(response,'2026s3',1));
});
test('History requests bind verified UUID, official season and mode; reject arbitrary inputs and cache replies',async()=>{
  let listener,calls=0;
  const sandbox={CSCore:C,importScripts:()=>{},setTimeout,clearTimeout,AbortController,URL,URLSearchParams,Map,Date,chrome:{action:{onClicked:{addListener:()=>{}}},storage:{local:{remove:()=>{}},onChanged:{addListener:()=>{}}},runtime:{openOptionsPage:()=>{},onMessage:{addListener:fn=>listener=fn}}},fetch:async(url,init)=>{
    assert.equal(init.credentials,'omit');let body;
    if(url.includes('/steam_username/'))body={success:true,data:{steamid_64:id,username:'player'}};
    else if(url.includes('/search/player/'))body={success:true,data:{user:{total:1,list:[{username:'player',domain:'test'}]}}};
    else if(url.includes('/idTransfer'))body={code:0,data:{uuid}};
    else if(url.includes('/season_list'))body={code:0,data:{season_list:[{season:'2026s3',cs_type:0}]}};
    else if(url.includes('/player/season')){
      calls++;const p=new URL(url).searchParams;assert.equal(p.get('uuid'),uuid);assert.equal(p.get('season'),'2026s3');assert.equal(p.get('match_type'),'9');assert.equal(p.get('cs_type'),'0');
      body={code:0,data:{contrast_data:{match_type:9,match_total:66,elo:2501.1,rating:1.26}}};
    }else throw Error('Other fixture endpoint unavailable');
    return {ok:true,json:async()=>body};
  }};
  vm.runInNewContext(fs.readFileSync(require.resolve('../extension/background.js'),'utf8'),sandbox);
  const message=(season,url='https://steamcommunity.com/profiles/'+id)=>new Promise(r=>listener({type:'fiveESeason',steamId:id,season},{url},r));
  assert.ok((await message('2026s3','https://example.com/')).error);assert.equal(calls,0);
  const r=await message('2026s3');assert.equal(r.steamId,id);assert.equal(r.season,'2026s3');assert.equal(r.stats.matches,66);
  await message('2026s3');assert.equal(calls,1);
  assert.ok((await message('2030s1')).error);assert.equal(calls,1);
});
