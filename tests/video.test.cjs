const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {validateUrl,parseInfo,parseLockedFormats,errorMessage}=require('../electron/video.cjs');
const {cookieArgs,writeCookieFile,readCookieFile}=require('../electron/cookies.cjs');

test('reject unrelated hosts and multiple links',()=>{for(const url of ['https://bilibili.com.evil.test/video/x','file:///tmp/x','https://b23.tv/x https://b23.tv/y'])assert.throws(()=>validateUrl(url));assert.equal(validateUrl('https://www.bilibili.com/video/BV123'),'https://www.bilibili.com/video/BV123');});

test('4K only appears when returned by extractor',()=>{const info=parseInfo(JSON.stringify({title:'测试',formats:[{height:1080,vcodec:'avc'},{height:1080,vcodec:'av1'},{vcodec:'none'}]}));assert.equal(info.has4k,false);assert.equal(info.formats.length,1);assert.ok(!info.formats[0].value.includes('/best'));});

test('recognize 4K and reject empty formats',()=>{assert.equal(parseInfo(JSON.stringify({formats:[{height:2160,vcodec:'hevc'}]})).has4k,true);assert.throws(()=>parseInfo('{"formats":[]}'));});

test('actionable cookie and network errors',()=>{assert.match(errorMessage('DPAPI decrypt failed'),/扫码登录/);assert.match(errorMessage('Could not copy Edge cookie database'),/扫码登录/);assert.match(errorMessage('connection timed out'),/网络/);});

test('timeout errors explain the recovery path',()=>{assert.match(errorMessage('request timeout'),/网络/);});

test('cookie file uses yt-dlp cookies argument',()=>{assert.deepEqual(cookieArgs({browser:'none',cookieFile:path.resolve('tests/fixtures.cookies')}),['--cookies',path.resolve('tests/fixtures.cookies')]);});

test('premium-only formats are reported to the user',()=>{
  assert.deepEqual(parseLockedFormats('[BiliBili] Format(s) 4K 高清, 1080P 60帧 are missing; you have to become a premium member to download them.'),['4K 高清','1080P 60帧']);
  assert.deepEqual(parseLockedFormats('nothing here'),[]);
});

test('4K selector never silently downgrades',()=>{
  const info=parseInfo(JSON.stringify({formats:[{height:2160,vcodec:'hevc'},{height:1080,vcodec:'avc'}]}));
  assert.equal(info.maxHeight,2160);
  assert.equal(info.formats[0].value,'bv*[height=2160]+ba/b[height=2160]');
});

test('netscape cookie export keeps only bilibili domains',()=>{
  const file=path.join(os.tmpdir(),'bili-'+Date.now()+'.cookies');
  writeCookieFile(file,[{domain:'.bilibili.com',path:'/',secure:true,name:'SESSDATA',value:'abc%2C1',expirationDate:1900000000},{domain:'.evil.test',name:'x',value:'y'}]);
  const text=fs.readFileSync(file,'utf8');
  assert.equal(text.split('\n')[0],'# Netscape HTTP Cookie File');
  assert.ok(text.includes('.bilibili.com\tTRUE\t/\tTRUE\t1900000000\tSESSDATA\tabc%2C1'));
  assert.ok(!text.includes('evil'));
  assert.equal(readCookieFile(file)[0].name,'SESSDATA');
  fs.rmSync(file,{force:true});
});

test('download failures name the next action',()=>{
  assert.match(errorMessage('ERROR: Requested format is not available'),/重新/);
  assert.match(errorMessage('ERROR: -352 风控校验失败'),/更新/);
  assert.match(errorMessage('ERROR: Failed to decrypt with DPAPI'),/扫码登录/);
});
