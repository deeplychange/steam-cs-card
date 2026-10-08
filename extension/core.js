(function (scope) {
  'use strict';
  function validId(id) {
    if (typeof id !== 'string' || !/^7656119\d{10}$/.test(id)) return false;
    const n = BigInt(id);
    return n >= 76561197960265728n && n <= 76561202255233023n;
  }
  function isProfileUrl(url) {
    try {
      const parsed=new URL(url);
      if(parsed.origin!=='https://steamcommunity.com')return false;
      const numeric=parsed.pathname.match(/^\/profiles\/(\d+)\/?$/);
      return numeric ? validId(numeric[1]) : /^\/id\/[^/]+\/?$/.test(parsed.pathname);
    }catch{return false;}
  }
  function extractId(url, scripts = []) {
    if(!isProfileUrl(url))return null;
    const pathname = new URL(url).pathname;
    const numeric = pathname.match(/^\/profiles\/(\d+)\/?$/);
    if (numeric) return validId(numeric[1]) ? numeric[1] : null;
    if (!/^\/id\/[^/]+\/?$/.test(pathname)) return null;
    for (const script of scripts) {
      // Read the profile's own data, never the logged-in user's g_steamID.
      const m = script.match(/g_rgProfileData\s*=\s*({[\s\S]*?})\s*;/);
      if (m) {
        try { const id = JSON.parse(m[1]).steamid; if (validId(id)) return id; } catch {}
      }
    }
    return null;
  }
  function unknown(platform, message) {
    return {platform, status: 'unknown', ban: '未知', message, stats: {}};
  }
  function fiveERank(level){
    if(!level)return null;
    if(level.match_status===3||level.level_id===100)return '未定级';
    const labels={21:'D',22:'D+',23:'C',24:'C+',25:'B',26:'B+',27:'A',28:'A+',29:'S',30:'S+',41:'D',42:'C',43:'C+',44:'C++',45:'B',46:'B+',47:'B++',48:'A',49:'A+',50:'A++',51:'S',52:'SS',53:'SSS',54:'SSS · TOP100',55:'SSS · TOP10'};
    const label=labels[level.level_id];if(!label)return null;
    return [51,52,53].includes(level.level_id)&&Number.isSafeInteger(level.star_num)&&level.star_num>=0?label+' · '+level.star_num+'星':label;
  }
  function normalizeFiveE(home, identity, candidate, uuid, id) {
    if (identity?.success !== true || identity.data?.steamid_64 !== id) throw new Error('5E SteamID 映射不匹配');
    const d = home?.data;
    if (home?.code !== 0 || !d?.uinfo || d.uinfo.uuid !== uuid || d.uinfo.domain !== candidate.domain || d.uinfo.username !== identity.data.username) throw new Error('5E 玩家资料身份不一致');
    if (d.uinfo.steamid_64 && d.uinfo.steamid_64 !== id) throw new Error('5E 玩家 SteamID 不匹配');
    const s=d.season_data || {};
    const mode=d.elo_info?.modes?.[String(s.match_mode)];
    const finite=v=>typeof v === 'number' && Number.isFinite(v) ? v : null;
    const sameSeason=mode?.season && mode.season === s.season;
    return {platform:'fiveE',status:'ok',ban:'未知',name:d.uinfo.username,
      season:s.season,matchMode:s.match_mode,
      stats:{rank:sameSeason?fiveERank(mode):null,score:sameSeason ? finite(mode.elo):null,rating:finite(s.rating),kd:finite(s.death)>0 && finite(s.kill)!==null ? s.kill/s.death : null,matches:finite(s.match_total),adr:finite(s.adr),winRate:finite(s.per_win_match)!==null?s.per_win_match*100:null},
      scope:'赛季 '+String(s.season || '未知')+' · 模式 '+String(s.match_mode ?? '未知'),
      message:'账号经 SteamID→用户名→唯一同名资料关联；封禁尚未验证。',
      source:'5E · player/home',updatedAt:Date.now(),profileUrl:'https://arena.5eplay.com/data/player/'+encodeURIComponent(candidate.domain)};
  }
  function normalizePerfectPublic(response,id) {
    if(response?.code!==1 || !Array.isArray(response.result))throw new Error('完美公开搜索没有返回可用资料');
    const matches=response.result.filter(p=>typeof p.steamId==='string' && p.steamId===id);
    if(matches.length!==1)throw new Error('完美搜索无法精确匹配该 SteamID');
    const p=matches[0];
    const score=typeof p.pvpScore==='number' && Number.isFinite(p.pvpScore) && p.pvpScore>0 ? p.pvpScore : null;
    return {platform:'perfect',status:'ok',ban:'未知',name:typeof p.pvpNickName==='string'?p.pvpNickName:'',
      stats:{score,rating:null,kd:null,matches:null},scope:'公开搜索资料 · 分数统计范围未提供',
      message:score!==null?'公开接口返回分数；Rating 和封禁尚未查到。':'已匹配平台账号；分数字段为零或缺失，尚不能确认有效天梯分。Rating 和封禁未知。',
      source:'完美 · search/user（免登录）',updatedAt:Date.now()};
  }
  function normalizeFiveEBan(response, identity, candidate, uuid, id, now=Date.now()) {
    if(identity?.success!==true || identity.data?.steamid_64!==id)throw new Error('5E 封禁查询 SteamID 映射不匹配');
    const u=response?.data?.header?.user_data;
    if(![0,'0'].includes(response?.code) || !u || u.uuid!==uuid || u.domain!==candidate.domain || u.username!==identity.data.username)throw new Error('5E 封禁响应身份不一致');
    const integer=v=>(typeof v==='number' || typeof v==='string' && /^-?\d+$/.test(v)) && Number.isSafeInteger(Number(v)) ? Number(v):null;
    const status=integer(u.account_status),type=integer(u.anticheat_type),until=integer(u.login_banned_time);
    let ban='未知',banKind='unknown',detail='接口状态未识别，不能判断是否封禁。';
    if(status===-4){ban=type===2?'作弊关联封禁':'作弊封禁';banKind='banned';detail='官网当前资料状态：'+ban+'。接口未明确提供此处罚的永久/临时期限。';}
    else if([-1,-2,-6].includes(status)){ban=({'-1':'恶意行为封禁','-2':'风控限制','-6':'违规行为封禁'})[status];banKind='banned';detail='官网当前资料状态：'+ban+'；不能等同于作弊封禁。';}
    else if(until!==null && until>now/1000){ban='临时限制';banKind='banned';detail='排位资格受限至 '+new Date(until*1000).toLocaleString('zh-CN')+'。';}
    else if(status===0 && until!==null){ban='未显示封禁';banKind='clear';detail='官网当前账号状态正常，未显示有效限制；不代表从未被封禁，也不覆盖所有赛事资格。';}
    return {ban,banKind,banDetail:detail,banSource:'5E · userinterface/header',accountStatus:status,updatedAt:now};
  }
  function normalizePerfectStats(response,id) {
    const p=response?.data;
    if(response?.statusCode!==0 || !p)throw new Error('完美战绩接口未返回数据（代码 '+(Number.isSafeInteger(response?.statusCode)?response.statusCode:'未知')+'）。');
    if(p.steamId!==id)throw new Error('完美战绩响应的 SteamID 不匹配。');
    const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
    return {platform:'perfect',status:'ok',ban:'未知',name:typeof p.name==='string'?p.name:'',stats:{score:number(p.pvpScore),rating:number(p.pwRating),kd:number(p.deaths)>0&&number(p.kills)!==null?p.kills/p.deaths:null,matches:number(p.cnt)},scope:'赛季 '+String(p.seasonId||'接口未提供')+' · PW Rating',message:'通过账号令牌查询战绩；此接口未验证封禁信息。',source:'完美 · detailStats（登录）',updatedAt:Date.now()};
  }
  function normalizeFiveESeasons(response){
    if(response?.code!==0 || !Array.isArray(response.data?.season_list))throw new Error('5E 赛季列表未返回。');
    const seen=new Set();
    return response.data.season_list.filter(s=>/^\d{4}s[1-9]\d?$/.test(s.season)&&[0,1].includes(s.cs_type)&&!seen.has(s.season)&&seen.add(s.season))
      .map(s=>({season:s.season,csType:s.cs_type,current:s.current_season===true,label:s.season.replace('s',' S')+' · '+(s.cs_type===0?'CS2':'CS:GO')+(s.current_season?'（当前）':'')}));
  }
  function normalizeFiveESeason(response,season,matchMode){
    const s=response?.data?.contrast_data;
    if(response?.code!==0 || !s || s.match_type!==matchMode || !Number.isSafeInteger(s.match_total) || s.match_total<0)throw new Error('5E 历史赛季返回格式或模式不匹配。');
    const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
    const played=s.match_total>0;
    return {season,matchMode,status:'ok',stats:{rank:played?fiveERank(s):null,score:played?finite(s.elo):null,rating:played?finite(s.rating):null,kd:played&&finite(s.death)>0&&finite(s.kill)!==null?s.kill/s.death:null,matches:s.match_total,adr:played?finite(s.adr):null,winRate:played&&finite(s.per_win_match)!==null?s.per_win_match*100:null},
      scope:'赛季 '+season+' · '+String(s.name||'模式 '+matchMode),
      message:played?'已按确认的 5E 账号与所选赛季查询。历史接口未提供 KD 时显示 —；封禁为账号当前状态。':'该赛季在此模式下没有对局记录；默认分数不作为真实成绩。',
      source:'5E · player/season',updatedAt:Date.now()};
  }
  scope.CSCore = {validId, isProfileUrl, extractId, unknown, fiveERank,normalizeFiveE, normalizePerfectPublic, normalizeFiveEBan, normalizePerfectStats,normalizeFiveESeasons,normalizeFiveESeason};
  if (typeof module !== 'undefined') module.exports = scope.CSCore;
})(globalThis);
