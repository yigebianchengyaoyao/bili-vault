const { _electron } = require('E:/workspace/projects/2026-10-17/orbit-launcher/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async()=>{
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  const desktop=await _electron.launch({executablePath:path.resolve('release/win-unpacked/BiliVault.exe'),env});
  try {
    const page=await desktop.firstWindow(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.getByRole('heading',{name:'把喜欢的视频，稳稳地留在本地。'}).waitFor();
    assert.equal(await page.locator('select').inputValue(),'none');
    assert.equal(await page.getByRole('button',{name:'4K 超清',exact:false}).count(),0);
    await page.locator('textarea').fill('https://b23.tv/test https://b23.tv/test');
    await page.getByRole('button',{name:'加入批量队列'}).click();
    await page.getByRole('button',{name:'下载队列 1'}).waitFor();
    await page.getByRole('button',{name:'移除',exact:true}).click();
    await page.getByText('队列是空的，粘贴多个链接后加入队列。').waitFor();
    const resourcePath=await desktop.evaluate(()=>process.resourcesPath);
    const runtime={packaged:await desktop.evaluate(({app})=>app.isPackaged),yt:require('node:fs').existsSync(path.join(resourcePath,'tools','yt-dlp.exe')),ffmpeg:require('node:fs').existsSync(path.join(resourcePath,'tools','ffmpeg.exe'))};
    assert.deepEqual(runtime,{packaged:true,yt:true,ffmpeg:true});
    const invalid=await page.evaluate(()=>new Promise(resolve=>{window.bili.onError(resolve);window.bili.inspect({url:'https://bilibili.com.evil.test/video/x',browser:'none'});}));
    assert.match(invalid.message,/B 站/);
    assert.deepEqual(errors,[]);
    console.log('PASS packaged window, no renderer errors, real format default, batch deduplication, queue removal, external runtime tools');
  } finally {await desktop.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
