# BiliVault

## BiliVault 0.2.3

BiliVault 是一个面向 Windows 新手的 B 站本地视频下载器。它使用 yt-dlp 获取视频，使用 ffmpeg 合并音视频，所有处理都在本机完成。

### 这版修了什么（0.2.3）

1. **4K 能下了**：新增「会员扫码登录」。在软件里点一下，弹出 B 站登录窗口，用手机 App 扫码即可。登录成功后 Cookie 直接从 Electron 自己的会话里读出并保存，绕开 Chrome/Edge 新版 DPAPI 加密（此前 `--cookies-from-browser` 在本机必然报 `Failed to decrypt with DPAPI`，于是永远拿不到 4K）。
2. **下载不再被 60 秒掐断**：以前识别和下载共用同一条 60 秒超时，稍大的视频一定会失败。现在识别仍是 60 秒无响应超时，下载改为 180 秒「无进展」超时，正常下载不会再被杀。
3. **4K 权限说清楚**：识别时解析 yt-dlp 的提示，界面直接显示「B 站提示 4K 高清 / 1080P 60帧 需要大会员」并给出登录入口。
4. **失败原因可操作**：格式不可用、B 站风控（-352/-412）、DPAPI、403 等分别给出下一步该做什么（重新识别 / 更新内核 / 扫码登录）。
5. **更新内核**：B 站接口经常变，界面新增「更新内核」按钮，一键执行 yt-dlp -U。
6. 画质选择串改为 `bv*[height=H]+ba/b[height=H]`，只按 yt-dlp 真实返回的高度生成选项，绝不用 1080P 冒充 4K。

### 功能

- 识别真实标题与可用格式；没有 4K 时不伪造选项，也不降级冒充 4K。
- 会员扫码登录，Cookie 只保存在本机（userData/bilibili-cookies.txt），识别与下载自动复用。
- 主进程记录下载任务，失败保留队列；队列成功后继续下一项，失败或取消则停止。
- 仍支持按需选择浏览器 Cookie、导入 Netscape 格式 Cookie 文件（作为兜底）。
- 下载队列、批量链接、下载历史、断点续传、取消下载、中文错误提示。

### Windows 使用

1. 运行 `release/BiliVault-0.2.3-Windows-x64.exe`。
2. 点「会员扫码登录」，用 B 站手机 App 扫码（要 4K 就必须登大会员账号）。
3. 粘贴 B 站链接，点「识别视频」。
4. 选择清晰度（4K 只在账号真的有权限时出现），点「开始下载」。
5. 默认保存到 `E:\视频下载`，可在界面更改。

4K 视频多为 HEVC/AV1 编码，Windows 自带播放器可能放不出来，建议用 PotPlayer / VLC。

### 常见问题

- **只有 1080P 没有 4K**：视频本身没有 4K，或当前账号不是大会员，或登录已过期。重新扫码登录后再点「识别视频」。
- **识别报 403 / -352**：B 站接口变了，点「更新内核」。
- **Cookie 导入失败**：直接用「会员扫码登录」，不要再去读 Chrome/Edge 的数据库。

## 开发

```powershell
npm install
npm run build
npm run desktop
```

将 `yt-dlp.exe` 和 `ffmpeg.exe` 放入 `tools/` 后即可真实下载。

### 验证

- `node --test tests/video.test.cjs`：10 项回归（域名校验、4K 选择器、会员格式解析、Netscape Cookie 导出、错误文案）。
- `node tests/desktop.cjs`：打包窗口冒烟（需先 `npm run pack`）。

## 打包

```powershell
npm run pack
```

输出位于 `release/`。

## 说明

4K 只在视频提供 4K 且当前账号有权限时显示和下载；应用不绕过会员或版权限制。Cookie 是登录凭证，只在本机传给 yt-dlp，请勿上传或发送给他人。
