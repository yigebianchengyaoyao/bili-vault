function validateUrl(value) {
  if (typeof value !== 'string' || /\s/.test(value)) throw new Error('每个任务只允许一个完整视频链接。');
  let url; try { url = new URL(value); } catch { throw new Error('请输入完整的 B 站 HTTPS 链接，每次识别一个视频。'); }
  if (url.protocol !== 'https:' || !['bilibili.com','www.bilibili.com','m.bilibili.com','b23.tv'].includes(url.hostname)) throw new Error('仅支持 B 站 HTTPS 视频链接。');
  return value;
}

// 只有 yt-dlp 真的返回了该高度才列出，绝不为 4K 造占位选项。
function parseInfo(output) {
  const data = JSON.parse(output);
  const videos = (data.formats || []).filter(f => f.vcodec && f.vcodec !== 'none' && f.height);
  const heights = [...new Set(videos.map(f => f.height))].sort((a, b) => b - a);
  if (!heights.length) throw new Error('没有读取到可用画质，请检查视频权限或登录状态。');
  const label = height => {
    if (height >= 2160) return height + 'P · 4K及以上';
    if (height >= 1440) return height + 'P · 2K';
    return height + 'P';
  };
  return {
    title: data.title || data.id,
    formats: heights.map(height => ({
      id: String(height),
      label: label(height),
      detail: '当前账号可获取',
      value: 'bv*[height=' + height + ']+ba/b[height=' + height + ']',
    })),
    has4k: heights.some(h => h >= 2160),
    maxHeight: heights[0],
  };
}

// yt-dlp 会把“需要大会员才能拿”的格式写在 stderr 里，读出来给用户看。
function parseLockedFormats(text) {
  const match = /Format\(s\)\s+(.+?)\s+are missing;\s+you have to become a premium member/i.exec(String(text || ''));
  if (!match) return [];
  return match[1].split(/[,，]\s*/).map(item => item.trim()).filter(Boolean).slice(0, 6);
}

function errorMessage(text) {
  const raw = String(text || '');
  if (/Could not copy (?:Chrome|Edge) cookie database/i.test(raw)) return '浏览器 Cookie 数据库被占用或受系统保护。请改用“会员扫码登录”在软件内登录。';
  if (/Failed to decrypt with DPAPI|decrypt with DPAPI/i.test(raw)) return 'Chrome/Edge 新版加密导致外部读取 Cookie 失败。请点击“会员扫码登录”，在软件内扫码登录一次即可。';
  if (/cookie|decrypt|DPAPI|database.*locked/i.test(raw)) return '读取浏览器登录状态失败。请使用“会员扫码登录”在软件内登录。';
  if (/Requested format is not available/i.test(raw)) return '所选清晰度当前不可用：可能是大会员登录已失效，或该视频已下线此清晰度。请重新“识别视频”后再选择。';
  if (/(-352|-412|Invalid signature|wbi|risk control)/i.test(raw)) return 'B 站接口校验失败，通常是 yt-dlp 版本过旧。请点击“更新内核”后重试。';
  if (/format.*not available|premium|login|members/i.test(raw)) return '当前账号无此画质权限，或视频不提供该画质。请先用“会员扫码登录”登录大会员账号，再重新识别。';
  if (/403|412|429/i.test(raw)) return 'B站暂时拒绝访问，请稍后重试并检查登录状态。';
  if (/timed out|timeout|超时|network|resolve|connection|Read timed out/i.test(raw)) return '网络连接失败或超时，请检查网络、登录状态后重试。';
  return '下载失败：' + raw.trim().slice(-600);
}

module.exports = {validateUrl,parseInfo,parseLockedFormats,errorMessage};
