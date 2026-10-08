const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');
const id = '76561198015091352';
test('Only Steam player profile home URLs are eligible for the card',()=>{
  for(const url of ['https://steamcommunity.com/profiles/'+id,'https://steamcommunity.com/id/example/?l=schinese#info'])assert.equal(C.isProfileUrl(url),true);
  for(const path of ['/', '/market/', '/profiles/'+id+'/inventory','/profiles/'+id+'/games/','/id/example/friends','/id/example/edit','/id/example/allcomments'])assert.equal(C.isProfileUrl('https://steamcommunity.com'+path),false);
  assert.equal(C.isProfileUrl('https://store.steampowered.com/id/example/'),false);
  assert.equal(C.isProfileUrl('not a URL'),false);
});
test('SteamID is extracted without number precision loss',()=>{
  assert.equal(C.extractId('https://steamcommunity.com/profiles/'+id+'/'),id);
  assert.equal(C.validId(Number(id)),false);
  assert.equal(C.validId('76561199999999999'),true);
  assert.equal(C.validId('76561190000000000'),false);
});
test('Vanity profile uses the viewed profile, never logged-in account',()=>{
  assert.equal(C.extractId('https://steamcommunity.com/id/example/',['g_steamID = "76561198000000001";']),null);
  assert.equal(C.extractId('https://steamcommunity.com/id/example/',['var g_rgProfileData = {"steamid":"'+id+'","personaname":"example"};']),id);
  assert.equal(C.extractId('https://steamcommunity.com/profiles/'+id+'/inventory'),null);
});
test('5E mismatches and season differences cannot create misleading statistics',()=>{
  const identity={success:true,data:{steamid_64:id,username:'player'}};
  const candidate={domain:'test-domain'};
  const home={code:0,data:{uinfo:{uuid:'test-uuid',domain:'test-domain',username:'player'},elo_info:{modes:{9:{elo:2000,season:'2026s4'}}},season_data:{season:'2026s4',match_mode:9,rating:1.18,kill:969,death:799,match_total:57}}};
  const p=C.normalizeFiveE(home,identity,candidate,'test-uuid',id);
  assert.equal(p.stats.score,2000);assert.equal(p.stats.matches,57);assert.equal(p.ban,'未知');
  home.data.elo_info.modes[9].season='2026s3';
  assert.equal(C.normalizeFiveE(home,identity,candidate,'test-uuid',id).stats.score,null);
  home.data.uinfo.username='different';
  assert.throws(()=>C.normalizeFiveE(home,identity,candidate,'test-uuid',id));
});
test('Perfect public search matches exact SteamID and does not treat zero score as verified rank',()=>{
  const response={code:1,result:[{steamId:id,pvpNickName:'player',pvpScore:0}]};
  const p=C.normalizePerfectPublic(response,id);
  assert.equal(p.name,'player');assert.equal(p.stats.score,null);assert.equal(p.ban,'未知');
  response.result[0].pvpScore=1234;
  assert.equal(C.normalizePerfectPublic(response,id).stats.score,1234);
  response.result.push({...response.result[0]});assert.throws(()=>C.normalizePerfectPublic(response,id));
  assert.throws(()=>C.normalizePerfectPublic({code:1,result:[{steamId:'76561198000000001'}]},id));
});
test('5E ban status uses verified profile header, never career status or empty ban logs',()=>{
  const identity={success:true,data:{steamid_64:id,username:'player'}};
  const candidate={domain:'player-domain'},uuid='player-uuid';
  const response={code:'0',data:{header:{user_data:{uuid,domain:candidate.domain,username:'player',account_status:'-4',anticheat_type:'1',login_banned_time:'0'}}}};
  const normalize=()=>C.normalizeFiveEBan(response,identity,candidate,uuid,id,1000000);
  assert.equal(normalize().ban,'作弊封禁');
  response.data.header.user_data.anticheat_type='2';assert.equal(normalize().ban,'作弊关联封禁');
  response.data.header.user_data.account_status='-2';assert.equal(normalize().ban,'风控限制');
  response.data.header.user_data.account_status='0';assert.equal(normalize().ban,'未显示封禁');
  response.data.header.user_data.login_banned_time='2000';assert.equal(normalize().ban,'临时限制');
  delete response.data.header.user_data.login_banned_time;assert.equal(normalize().ban,'未知');
  response.data.header.user_data.account_status='-9';assert.equal(normalize().ban,'未知');
  response.data.header.user_data.uuid='someone-else';assert.throws(normalize);
  response.data.header.user_data.uuid=uuid;response.code=401;assert.throws(normalize);
});
