(() => {
  'use strict';
  if (document.getElementById('cs-platform-card')) return;
  const demo = document.documentElement.dataset.csPreview === 'true';
  const host = document.createElement('div');
  host.id = 'cs-platform-card';
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{display:block;margin:0 0 18px;min-width:0;color:#dce5ef;font:13px/1.5 Arial,"Microsoft YaHei",sans-serif}
    *{box-sizing:border-box} .card{background:linear-gradient(145deg,#202d40,#121c2a);border:1px solid #42566f;border-radius:12px;overflow:hidden;box-shadow:0 10px 28px #0004}
    header{padding:17px 16px 12px;border-bottom:1px solid #ffffff12} .eyebrow{color:#72bddc;font-size:10px;letter-spacing:2px} h2{font-size:19px;margin:4px 0;font-weight:600} .id{font:11px/1.5 monospace;color:#9aafc3;overflow-wrap:anywhere}
    .tools{display:flex;gap:7px;margin-top:12px} button{cursor:pointer;border:1px solid #55718c;border-radius:5px;background:#ffffff08;color:#dce5ef;padding:5px 10px;font:inherit}button:hover{background:#ffffff18}button:disabled{opacity:.5;cursor:wait}
    section{padding:14px 16px;border-bottom:1px solid #ffffff12} .title{display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:600} .badge{font-size:11px;font-weight:400;background:#d4a35a15;border:1px solid #d4a35a40;border-radius:4px;color:#e6bd7d;padding:2px 6px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}.label{font-size:11px;color:#97a9be}.value{font-size:22px;font-weight:600;color:#f4f7fb;line-height:1.3}.scope,.message,.source{font-size:11px;color:#96a9bd;margin:10px 0 0}.source{color:#6f879e}footer{padding:10px 16px;font-size:11px;color:#8ea4bb}.preview{color:#ffce83}.error{color:#efb590}.collapsed section,.collapsed footer{display:none}
  </style><article class="card"><header><div class="eyebrow">COUNTER-STRIKE · CROSS PLATFORM</div><h2>CS 跨平台资料</h2><div class="id"></div><div class="tools"><button id="refresh">刷新</button><button id="copy">复制 ID</button><button id="settings">设置</button><button id="collapse" aria-expanded="true">收起</button></div></header><div id="platforms" aria-live="polite"></div><footer></footer></article>`;
  const q = selector => root.querySelector(selector);
  let currentId = null;
  let generation = 0;
  let busy = false;
  let displayData=null,selectedSeason='',seasonGeneration=0;
  function node(tag, cls, text) { const n = document.createElement(tag); n.className = cls; n.textContent = text; return n; }
  function render(data) {
    q('#platforms').replaceChildren();
    for (const [key, name] of [['perfect', '完美世界竞技'], ['fiveE', '5E 对战平台']]) {
      const p = data[key];
      const section = document.createElement('section');
      const title = node('div', 'title', name);
      const badge=node('span','badge','封禁：'+p.ban);
      if(p.banKind==='banned'){badge.style.color='#ff9e9e';badge.style.borderColor='#d66565';}
      if(p.banKind==='clear'){badge.style.color='#9bd6c4';badge.style.borderColor='#629d89';}
      title.append(badge); section.append(title);
      if(key==='fiveE'&&p.seasons?.length){
        const label=node('label','scope','查看赛季');const select=document.createElement('select');select.setAttribute('aria-label','5E 赛季');
        select.style.cssText='display:block;width:100%;margin-top:6px;padding:7px;background:#172536;color:#dce5ef;border:1px solid #55718c;border-radius:5px';
        for(const season of p.seasons){const option=document.createElement('option');option.value=season.season;option.textContent=season.label;select.append(option);}
        select.value=selectedSeason||p.season||p.seasons[0].season;
        select.onchange=()=>loadSeason(select.value);label.append(select);section.append(label);
      }
      const grid = node('div', 'grid', '');
      const fields=[['score','天梯分数'], ['rating','Rating'], ['kd','KD'], ['matches','场次']];
      if(key==='fiveE'){fields.unshift(['rank','5E 段位']);fields.push(['adr','ADR'],['winRate','胜率']);}
      for (const [field, label] of fields) {
        const cell = document.createElement('div'); const value = p.stats[field];
        cell.append(node('div','label',label),node('div','value', field==='rank'&&typeof value==='string'?value:typeof value === 'number' ? (field==='winRate'?value.toFixed(1)+'%':field==='adr'?value.toFixed(1):['rating','kd'].includes(field)?value.toFixed(2):String(value)) : '—')); grid.append(cell);
      }
      if(p.name) section.append(node('p','scope','平台昵称 · '+p.name));
      if(key==='perfect'){
        const login=node('button','','完美登录');login.type='button';login.style.marginTop='10px';
        login.onclick=()=>{if(demo){q('footer').textContent='预览不处理登录。安装新版后可打开登录设置。';return;}send({type:'options'}).catch(e=>{q('footer').textContent=e.message;});};
        section.append(login);
      }
      section.append(grid,node('p','scope',p.scope || '段位名称与统计范围待接口核对'),node('p','message',p.message));
      if(p.banDetail)section.append(node('p','message',p.banDetail));
      if(p.seasonError)section.append(node('p','message',p.seasonError));
      if(p.banSource)section.append(node('p','source',p.banSource+' · '+new Date(p.banUpdatedAt||p.updatedAt).toLocaleTimeString()));
      if (p.source) section.append(node('p','source',p.source + ' · ' + new Date(p.updatedAt).toLocaleTimeString()));
      q('#platforms').append(section);
    }
    q('footer').textContent = demo ? '示例预览 · 所有数值均为虚构，不属于任何玩家' : '封禁为当前账号状态 · v0.9.1';
    q('footer').className = demo ? 'preview' : '';
  }
  const empty = message => ({perfect:CSCore.unknown('perfect',message),fiveE:CSCore.unknown('fiveE',message)});
  function send(message) {
    return new Promise((resolve, reject) => {
      if (!globalThis.chrome?.runtime?.sendMessage) return reject(new Error('扩展后台不可用，请检查 Steam 的扩展支持。'));
      chrome.runtime.sendMessage(message, result => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(result);
      });
    });
  }
  async function refresh(force=false) {
    const version = ++generation;
    seasonGeneration++;
    busy = true; q('#refresh').disabled = true;
    if (demo) {
      render({perfect:{ban:'未知',stats:{score:2186,rating:1.24,kd:1.18,matches:126},scope:'示例赛季 · 虚构数据',message:'统计卡片示例；封禁查询尚未接通。'},fiveE:{ban:'未知',stats:{score:1920,rating:1.16,kd:1.09,matches:84},scope:'示例赛季 · 虚构数据',message:'统计卡片示例；封禁查询尚未接通。'}});
    } else if (!currentId) render(empty('未识别该资料的 SteamID，无法查询。'));
    else {
      render(empty('正在查询…'));
      try { const data = await send({type:'query',steamId:currentId,force}); if (version !== generation) return; if (data?.error || data?.steamId !== currentId) throw new Error(data?.error || '响应身份不匹配');displayData=data;render(data);if(selectedSeason&&selectedSeason!==data.fiveE.season&&data.fiveE.seasons?.some(s=>s.season===selectedSeason))loadSeason(selectedSeason,force); }
      catch(e) { if (version === generation) render(empty(e.message)); }
    }
    if (version === generation) { busy = false; q('#refresh').disabled = false; }
  }
  async function loadSeason(season,force=false){
    if(!displayData)return;
    const base=displayData.fiveE,id=currentId,version=generation,serial=++seasonGeneration;
    selectedSeason=season;
    if(season===base.season){render(displayData);return;}
    render({...displayData,fiveE:{...base,stats:{},scope:'赛季 '+season,message:'正在加载所选赛季…'}});
    try{
      const result=await send({type:'fiveESeason',steamId:id,season,force});
      if(version!==generation||serial!==seasonGeneration||id!==currentId)return;
      if(result?.error||result?.steamId!==id||result?.season!==season)throw new Error(result?.error||'赛季响应不匹配');
      render({...displayData,fiveE:{...base,...result}});
    }catch(e){if(version===generation&&serial===seasonGeneration)render({...displayData,fiveE:{...base,stats:{},scope:'赛季 '+season,message:'历史赛季查询失败：'+e.message}});}
  }
  function mount() {
    const column = document.querySelector('.profile_rightcol');
    if (column) { if (host.parentElement !== column || column.firstElementChild !== host) column.prepend(host); host.style.cssText = ''; }
    else if (!host.isConnected) { document.body.append(host); host.style.cssText = 'position:fixed;right:18px;top:110px;width:300px;z-index:10000;max-height:80vh;overflow:auto'; }
  }
  function check() {
    const url = demo ? 'https://steamcommunity.com/profiles/76561198015091352/' : location.href;
    // Content-script matches also include inventory, friends, games and edit pages.
    // Detach on navigation and invalidate pending replies before mounting anything.
    if(!CSCore.isProfileUrl(url)){
      if(host.isConnected || currentId!==null){
        generation++;seasonGeneration++;selectedSeason='';displayData=null;currentId=null;busy=false;q('#refresh').disabled=false;
        q('#platforms').replaceChildren();host.remove();
      }
      return;
    }
    mount();
    const id = CSCore.extractId(url,Array.from(document.scripts,s=>s.textContent));
    if (id !== currentId || !q('#platforms').children.length) {if(id!==currentId){selectedSeason='';displayData=null;seasonGeneration++;} currentId = id; q('.id').textContent = id ? 'SteamID64 · ' + id : 'SteamID64 · 未识别'; refresh(); }
  }
  q('#refresh').onclick = () => { if (!busy) refresh(true); };
  q('#settings').onclick = () => { if(demo) { q('footer').textContent='这是布局示例。安装扩展后可打开查询说明。'; return; } send({type:'options'}).catch(e => {q('footer').textContent=e.message;}); };
  q('#copy').onclick = async () => { if (!currentId) return; try { await navigator.clipboard.writeText(currentId); q('#copy').textContent = '已复制'; } catch { q('footer').textContent = '请手动复制 SteamID：' + currentId; } };
  q('#collapse').onclick = () => { const collapsed=q('.card').classList.toggle('collapsed'); q('#collapse').textContent=collapsed?'展开':'收起'; q('#collapse').setAttribute('aria-expanded',String(!collapsed)); };
  check();
  // Only observe profile replacement, not our shadow tree updates.
  let timer; const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(check,250);});
  observer.observe(document.body,{childList:true,subtree:true});
  const interval=setInterval(check,2000);
  window.addEventListener('popstate',check);
  window.addEventListener('hashchange',check);
  window.navigation?.addEventListener('navigatesuccess',check);
  window.addEventListener('pagehide',()=>{observer.disconnect();clearInterval(interval);clearTimeout(timer);});
})();



