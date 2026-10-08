'use strict';
const http=require('node:http'),crypto=require('node:crypto');
function createBridge({key,fetchImpl=fetch}){
 const secret=Buffer.from(key);const validId=x=>typeof x==='string'&&/^7656119\d{10}$/.test(x);
 const ticket=x=>typeof x==='string'&&x.length>=1&&x.length<=4096&&!/[\r\n]/.test(x);
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
  const reply=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
  if(req.headers.host!=='127.0.0.1:'+server.address().port||req.url!=='/request')return reply(404,{error:'本机地址不匹配。'});
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-CS-Bridge-Key');res.writeHead(204);return res.end();}
  if(req.method!=='POST')return reply(405,{error:'仅支持 POST。'});
  const supplied=Buffer.from(String(req.headers['x-cs-bridge-key']||''));
  if(supplied.length!==secret.length||!crypto.timingSafeEqual(supplied,secret))return reply(401,{error:'本机连接码无效，请使用辅助程序窗口中的连接码。'});
  let chunks=[],length=0;
  try{
   for await(const chunk of req){length+=chunk.length;if(length>16384)return reply(413,{error:'请求过大。'});chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));let url,body,headers={};
   if(input.operation==='ping')return reply(200,{ready:true,protocol:1});
   if(input.operation==='qrStart'){url='https://passport.pwesports.cn/qrAuth/applyToken';body={appId:'5',qrType:'1',redirect:false,website:'pvp'};}
   else if(input.operation==='qrCheck'&&ticket(input.body?.accessToken)){url='https://passport.pwesports.cn/qrAuth/check';body={appId:'5',accessToken:input.body.accessToken};}
   else if(input.operation==='stats'&&validId(input.body?.mySteamId)&&validId(input.body?.toSteamId)&&ticket(input.token)&&input.token.length>=16){url='https://api.wmpvp.com/api/csgo/home/pvp/detailStats';body={mySteamId:input.body.mySteamId,toSteamId:input.body.toSteamId};headers={appversion:'3.5.4.172',platform:'android',token:input.token};}
   else return reply(400,{error:'不支持的操作或参数。'});
   const result=await fetchImpl(url,{method:'POST',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
   if(!result.ok)return reply(502,{error:'官方接口返回 HTTP '+result.status});
   const raw=await result.text();if(raw.length>2000000)return reply(502,{error:'官方响应过大。'});
   reply(200,{data:raw});
  }catch{reply(502,{error:'本机请求失败，请检查网络或请求格式。'});}
 });return server;
}
module.exports={createBridge};
if(require.main===module){
 const key=crypto.randomBytes(32).toString('hex'),server=createBridge({key});
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口已占用：请使用已打开的辅助程序，或关闭旧窗口后重试。':'本机辅助程序启动失败。');process.exitCode=1;});
 server.listen(27843,'127.0.0.1',()=>{console.log('\nCS 资料卡本机辅助程序（0.9.1）\n仅监听本机，直接请求完美接口，不保存账号令牌。\n\n复制以下连接码，粘贴到插件设置的「本机连接码」：\n\n'+key+'\n\n保持此窗口开启；关闭窗口即停止服务。连接码每次启动都会变化。\n');});
}
