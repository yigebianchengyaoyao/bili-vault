const { app, BrowserWindow, ipcMain, shell, dialog, session } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { parseInfo, parseLockedFormats, validateUrl, errorMessage } = require('./video.cjs');
const { cookieArgs, writeCookieFile, readCookieFile } = require('./cookies.cjs');

const BILI_PARTITION = 'persist:bilivault-login';
const BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const root = path.join(__dirname, '..');
const tools = app.isPackaged ? path.join(process.resourcesPath, 'tools') : path.join(root, 'tools');
const stateFile = path.join(app.getPath('userData'), 'state.json');
const savedCookieFile = path.join(app.getPath('userData'), 'bilibili-cookies.txt');
const INSPECT_IDLE_MS = 60000;
const DOWNLOAD_IDLE_MS = 180000;

let win, loginWin, loginTimer, active = null;
let queue = [], history = [];
try { const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); queue = Array.isArray(saved.queue) ? saved.queue : []; history = Array.isArray(saved.history) ? saved.history : []; } catch {}

function send(channel, data) { if (win && !win.isDestroyed()) win.webContents.send(channel, data); }
function persist() { try { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile + '.tmp', JSON.stringify({queue, history})); fs.renameSync(stateFile + '.tmp', stateFile); } catch (e) { send('process-error', {message:'保存任务记录失败：' + e.message}); } }

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {windowsHide:true});
  else child.kill();
}

// 扫码登录后保存的 Cookie 文件优先于任何外部来源。
function cookieArgsFor(item) {
  const explicit = typeof item.cookieFile === 'string' && item.cookieFile && fs.existsSync(item.cookieFile) ? item.cookieFile : '';
  const saved = !explicit && fs.existsSync(savedCookieFile) ? savedCookieFile : '';
  const file = explicit || saved;
  return cookieArgs({ browser: file ? 'none' : item.browser, cookieFile: file });
}

function run(item, kind) {
  if (active) return send('process-error', {message:'当前已有任务运行，请等待完成或取消。'});
  try {
    validateUrl(item.url);
    const executable = path.join(tools, 'yt-dlp.exe');
    if (!fs.existsSync(executable)) throw new Error('缺少 yt-dlp.exe，请重新解压完整软件。');
    const args = ['--ignore-config', '--no-update', '--socket-timeout', '20', ...cookieArgsFor(item)];
    if (kind === 'inspect') {
      args.push('--retries', '1', '--extractor-retries', '1', '-J', '--no-playlist');
    } else {
      if (!path.isAbsolute(item.folder)) throw new Error('请选择绝对路径的保存目录。');
      fs.mkdirSync(item.folder, {recursive:true});
      if (!fs.existsSync(path.join(tools, 'ffmpeg.exe'))) throw new Error('缺少 ffmpeg.exe，请重新解压完整软件。');
      args.push('--retries', '10', '--fragment-retries', '10', '--newline', '--no-playlist', '--continue', '-f', item.format, '--merge-output-format', 'mp4', '--ffmpeg-location', tools, '-o', path.join(item.folder, '%(title)s [%(id)s].%(ext)s'));
    }
    args.push('--', item.url);
    const child = spawn(executable, args, {cwd: tools, windowsHide:true});
    const task = {child, item, kind, cancelled:false, timedOut:false};
    active = task;
    let output = '', errors = '', lastBeat = Date.now();
    const idleLimit = kind === 'inspect' ? INSPECT_IDLE_MS : DOWNLOAD_IDLE_MS;
    const watchdog = setInterval(() => {
      if (active !== task) return;
      if (Date.now() - lastBeat < idleLimit) return;
      task.timedOut = true;
      task.cancelled = true;
      killTree(child);
    }, 3000);
    child.stdout.on('data', d => { lastBeat = Date.now(); output += d.toString(); if (kind !== 'inspect') send('process-line',{kind,text:d.toString()}); });
    child.stderr.on('data', d => { lastBeat = Date.now(); errors = (errors + d.toString()).slice(-20000); send('process-line',{kind,text:d.toString()}); });
    child.on('error', e => { errors += e.message; });
    child.on('close', code => {
      if (active !== task) return;
      clearInterval(watchdog);
      active = null;
      const locked = parseLockedFormats(errors);
      let info;
      if (!code && kind === 'inspect') { try { info = parseInfo(output); } catch(e) { code = 1; errors += e.message; } }
      if (!code && kind === 'download') {
        const record = {...item, finishedAt:new Date().toISOString()};
        history = [record, ...history.filter(h=>h.id !== item.id)].slice(0,100);
        queue = queue.filter(q=>q.id !== item.id); persist();
      }
      const message = task.timedOut
        ? '任务超过 ' + Math.round(idleLimit / 1000) + ' 秒没有任何进展，已停止。请检查网络或登录状态后重试。'
        : task.cancelled ? '任务已取消，可重新下载续传。'
        : code ? errorMessage(errors) : '';
      send('process-done',{kind, code, info, locked, cancelled:task.cancelled, message, item, queue, history});
    });
  } catch(e) { send('process-error',{kind, message:e.message}); }
}

async function biliCookies() {
  try { return await session.fromPartition(BILI_PARTITION).cookies.get({ domain: 'bilibili.com' }); } catch { return []; }
}

function cookieHeader(cookies) {
  return cookies.map(c => c.name + '=' + c.value).join('; ');
}

async function loginStatus() {
  if (!fs.existsSync(savedCookieFile)) return {loggedIn:false};
  const cookies = readCookieFile(savedCookieFile);
  if (!cookies.length) return {loggedIn:false};
  try {
    const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {headers:{Cookie: cookieHeader(cookies), 'User-Agent': BILI_UA, Referer:'https://www.bilibili.com/'}});
    const json = await res.json();
    if (json.code !== 0 || !json.data || !json.data.isLogin) return {loggedIn:false};
    return {loggedIn:true, uname:json.data.uname, vip:json.data.vipStatus === 1, level:json.data.level};
  } catch { return {loggedIn:true, uname:'未知账号', vip:false, offline:true}; }
}

function openLogin() {
  if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return; }
  let succeeded = false;
  loginWin = new BrowserWindow({
    width:540, height:760, parent: win, title:'B 站登录 · 登录后自动关窗',
    webPreferences:{partition:BILI_PARTITION, contextIsolation:true, nodeIntegration:false},
  });
  loginWin.setMenuBarVisibility(false);
  loginWin.loadURL('https://passport.bilibili.com/login');
  loginWin.webContents.setWindowOpenHandler(({url}) => { loginWin.loadURL(url); return {action:'deny'}; });
  loginWin.on('closed', () => { clearInterval(loginTimer); loginWin = null; if (!succeeded) send('login-status', {loggedIn:false, cancelled:true}); });
  loginTimer = setInterval(async () => {
    const cookies = await biliCookies();
    if (!cookies.some(c => c.name === 'SESSDATA' && c.value)) return;
    if (succeeded) return;
    succeeded = true;
    clearInterval(loginTimer);
    try {
      const count = writeCookieFile(savedCookieFile, cookies);
      const status = await loginStatus();
      send('login-status', {...status, cookies:count});
      if (loginWin && !loginWin.isDestroyed()) loginWin.close();
    } catch (e) { succeeded = false; send('login-status', {loggedIn:false, error:e.message}); }
  }, 1500);
}

ipcMain.handle('state',()=>({queue,history}));
ipcMain.handle('pick-folder',async()=>{const r=await dialog.showOpenDialog({properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];});
ipcMain.handle('pick-cookie-file',async()=>{const r=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Cookie 文件',extensions:['txt','cookies']},{name:'所有文件',extensions:['*']}]});return r.canceled?null:r.filePaths[0];});
ipcMain.handle('bili-login',()=>{openLogin();return {opened:true};});
ipcMain.handle('login-status',()=>loginStatus());
ipcMain.handle('bili-logout',async()=>{try{fs.rmSync(savedCookieFile,{force:true});}catch{};try{await session.fromPartition(BILI_PARTITION).clearStorageData();}catch{};return {loggedIn:false};});
ipcMain.handle('update-yt-dlp',()=>new Promise(resolve=>{
  const exe = path.join(tools,'yt-dlp.exe');
  if (!fs.existsSync(exe)) return resolve({ok:false,message:'缺少 yt-dlp.exe，请重新解压完整软件。'});
  const child = spawn(exe, ['-U'], {cwd:tools, windowsHide:true});
  let out = '';
  child.stdout.on('data', d => { out += d.toString(); });
  child.stderr.on('data', d => { out += d.toString(); });
  child.on('error', e => resolve({ok:false,message:e.message}));
  child.on('close', code => resolve({ok:code === 0, message:(out.trim() || (code === 0 ? '内核已是最新版本。' : '更新失败，请手动下载 yt-dlp.exe。')).slice(-400)}));
}));
ipcMain.on('inspect',(_,item)=>run(item,'inspect'));
ipcMain.on('download',(_,item)=>run(item,'download'));
ipcMain.on('cancel',()=>{if(active){active.cancelled=true;killTree(active.child);}});
ipcMain.on('set-queue',(_,items)=>{if(!Array.isArray(items))return;queue=items.filter(item=>{try{validateUrl(item.url);return true;}catch{return false;}}).slice(0,500);persist();});
ipcMain.on('open-folder',async(_,folder)=>{if(typeof folder!=='string'||!path.isAbsolute(folder))return;const error=await shell.openPath(folder);if(error)send('process-error',{message:error});});
app.whenReady().then(()=>{win=new BrowserWindow({width:1180,height:820,minWidth:980,minHeight:680,backgroundColor:'#0b0f14',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false}});win.loadFile(path.join(root,'dist','index.html')).catch(e=>dialog.showErrorBox('页面加载失败',e.message));});
app.on('before-quit',()=>{if(active)killTree(active.child);});
app.on('window-all-closed',()=>app.quit());
