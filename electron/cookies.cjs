const fs = require('node:fs');
const path = require('node:path');

function validateCookieFile(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !fs.existsSync(file)) {
    throw new Error('Cookie 文件不存在，请重新选择。');
  }
  if (!fs.statSync(file).isFile()) throw new Error('请选择 Cookie 文件，而不是文件夹。');
  const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/, 1)[0];
  if (!/^# (?:HTTP Cookie File|Netscape HTTP Cookie File)$/.test(firstLine)) {
    throw new Error('Cookie 文件格式不正确，请导出 Netscape 格式的 Cookie 文件。');
  }
  return file;
}

function cookieArgs({ browser = 'none', cookieFile = '' } = {}) {
  if (cookieFile) return ['--cookies', validateCookieFile(cookieFile)];
  if (browser && browser !== 'none') {
    if (!['chrome', 'edge', 'firefox'].includes(browser)) throw new Error('请选择有效的浏览器。');
    return ['--cookies-from-browser', browser];
  }
  return [];
}

function netscapeLine(cookie) {
  const domain = String(cookie.domain || '');
  if (!domain || !cookie.name) return '';
  const expires = Math.floor(cookie.expirationDate || Date.now() / 1000 + 2592000);
  return [
    domain,
    domain.startsWith('.') ? 'TRUE' : 'FALSE',
    cookie.path || '/',
    cookie.secure ? 'TRUE' : 'FALSE',
    String(expires),
    cookie.name,
    cookie.value,
  ].join('\t');
}

function writeCookieFile(file, cookies) {
  const usable = (Array.isArray(cookies) ? cookies : [])
    .filter(c => c && c.name && c.value && /bilibili\.com$/i.test(String(c.domain || '')));
  if (!usable.length) throw new Error('没有读取到 B 站登录 Cookie，请确认登录成功后再试。');
  const body = ['# Netscape HTTP Cookie File', '# 由 BiliVault 从本机登录状态导出，请勿外传', ...usable.map(netscapeLine).filter(Boolean)];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', body.join('\n') + '\n', 'utf8');
  fs.renameSync(file + '.tmp', file);
  return usable.length;
}

function readCookieFile(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const parts = line.split('\t');
      if (parts.length < 7) return null;
      return {
        domain: parts[0],
        path: parts[2],
        secure: parts[3] === 'TRUE',
        expirationDate: Number(parts[4]),
        name: parts[5],
        value: parts.slice(6).join('\t'),
      };
    })
    .filter(Boolean);
}

module.exports = { cookieArgs, validateCookieFile, writeCookieFile, readCookieFile };
