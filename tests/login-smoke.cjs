const path = require('node:path');
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', 'E:/workspace/projects/2026-10-17/orbit-launcher/node_modules/playwright'].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch {}
  }
  throw new Error('未找到 playwright，请设置 PLAYWRIGHT_PATH 指向 playwright 包目录。');
}
const { _electron } = loadPlaywright();
const assert = require('node:assert/strict');
(async()=>{
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({args:['.'],cwd:process.cwd(),env});
  try{
    const page=await app.firstWindow();
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.getByRole('heading',{name:'把喜欢的视频，稳稳地留在本地。'}).waitFor({timeout:25000});
    const btn=page.getByRole('button',{name:'会员扫码登录'});
    assert.equal(await btn.count(),1);
    await btn.click();
    await new Promise(r=>setTimeout(r,7000));
    const urls=app.windows().map(w=>{try{return w.url()}catch{return 'gone'}});
    assert.ok(urls.some(u=>u.includes('passport.bilibili.com')),'登录窗口应打开 B 站通行证页面');
    assert.deepEqual(errors,[]);
    console.log('PASS login window opens at passport.bilibili.com with no renderer errors');
  } finally { await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
