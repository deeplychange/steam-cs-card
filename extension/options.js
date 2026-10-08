'use strict';
const el=id=>document.getElementById(id);
let generation=0,activeQr=null,pollTimer=null;
async function send(message){const r=await chrome.runtime.sendMessage(message);if(r?.error)throw new Error(r.error);return r;}
function status(text){el('status').textContent=text;}
function clearDisplay(){clearTimeout(pollTimer);activeQr=null;el('qr-image').replaceChildren();el('qr-box').hidden=true;el('qr-start').disabled=false;}
async function poll(version){
  const qr=activeQr;if(version!==generation||!qr)return;
  if(Date.now()>=qr.expiresAt){clearDisplay();send({type:'perfectQrCancel'}).catch(()=>{});status('等待超时，请重新生成二维码。');return;}
  try{
    const r=await send({type:'perfectQrPoll',id:qr.id});
    if(version!==generation||activeQr?.id!==qr.id)return;
    if(r.state==='complete'){clearDisplay();status(r.message+' 绑定 SteamID：'+r.steamId+'。回资料卡点击刷新。');return;}
    if(r.state==='expired'){clearDisplay();status(r.message);return;}
    if(r.state!=='waiting')throw new Error('扫码状态无法识别。');
    status(r.message);pollTimer=setTimeout(()=>poll(version),2000);
  }catch(e){if(version===generation){clearDisplay();send({type:'perfectQrCancel'}).catch(()=>{});status(e.message+' 可重新生成二维码。');}}
}
el('qr-start').onclick=async()=>{
  const version=++generation;clearDisplay();el('qr-start').disabled=true;status('正在向官方申请二维码…');
  try{
    const r=await send({type:'perfectQrStart'});if(version!==generation)return;
    if(typeof r.id!=='string'||!Number.isFinite(r.expiresAt)||new URL(r.url).origin!=='https://news.wmpvp.com')throw new Error('官方二维码响应无法识别。');
    const qr=qrcode(0,'M');qr.addData(r.url,'Byte');qr.make();
    el('qr-image').innerHTML=qr.createSvgTag({scalable:true});el('qr-box').hidden=false;
    activeQr=r;el('qr-start').disabled=false;el('qr-start').textContent='刷新登录二维码';
    status('请用完美世界电竞 App 扫码，并在手机上确认登录。');pollTimer=setTimeout(()=>poll(version),2000);
  }catch(e){if(version===generation){clearDisplay();send({type:'perfectQrCancel'}).catch(()=>{});status(e.message);}}
};
el('qr-cancel').onclick=async()=>{generation++;clearDisplay();try{await send({type:'perfectQrCancel'});status('已取消本次插件扫码。');}catch(e){status(e.message);}};
el('logout').onclick=async()=>{generation++;clearDisplay();try{await send({type:'perfectLogout'});status('已清除插件登录，资料卡将使用公开查询。');}catch(e){status(e.message);}};
el('bridge-connect').onclick=async()=>{generation++;clearDisplay();const key=el('bridge-key').value.trim();el('bridge-key').value='';try{await send({type:'perfectBridgeConnect',key});status('本机辅助程序连接成功。现在点击生成登录二维码，保持辅助程序窗口开启。');}catch(e){status(e.message);}};
el('diagnose').onclick=async()=>{el('diagnostics').hidden=false;try{el('diagnostics').textContent=JSON.stringify(await send({type:'perfectDiagnostics'}),null,2);}catch(e){el('diagnostics').textContent='诊断失败：'+e.message+'。请确认旧扩展已移除并加载 0.8.1。';}};
window.addEventListener('pagehide',()=>{generation++;clearTimeout(pollTimer);send({type:'perfectQrCancel'}).catch(()=>{});});
send({type:'perfectStatus'}).then(r=>{
  if(generation!==0)return;
  if(!r.supported){el('qr-start').disabled=true;status('此浏览器不支持会话存储，扫码功能不可用；5E 仍可免登录查询。');}
  else status(r.loggedIn?'已有本次浏览器会话的完美令牌。绑定 SteamID：'+r.steamId+'。查询以实际结果为准。':r.bridge?'本机辅助程序已配置，请保持窗口开启后生成二维码。':'未登录。Steam 中请先连接本机辅助程序；5E 可直接查询。');
}).catch(e=>{if(generation===0)status(e.message);});
