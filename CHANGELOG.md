# CHANGELOG

## 0.2.3 — 2026-11-22

### 修复

- **4K 无法下载**：新增 Electron 内「会员扫码登录」，直接从应用会话导出 Netscape Cookie，绕开 Chrome/Edge 的 DPAPI / App-Bound 解密失败（实测 `--cookies-from-browser edge` 必失败）。
- **下载被 60 秒超时杀死**：识别与下载拆分超时策略（识别 60s 无响应、下载 180s 无进展），并改用 `taskkill /T` 结束进程树。
- 下载失败原因细化：格式不可用、-352/-412 风控、DPAPI、403/412/429 各有可操作提示。

### 变更

- 画质选择串改为 `bv*[height=H]+ba/b[height=H]`，识别结果附带 `maxHeight`。
- 识别阶段解析 yt-dlp 的「premium member」提示，界面提示哪些格式需要大会员。
- 新增「更新内核」按钮（yt-dlp -U）。
- 登录状态持久化到 userData/bilibili-cookies.txt，启动时校验并显示昵称与大会员状态。
- 下载重试提高：`--retries 10 --fragment-retries 10`。

### 测试

- 回归用例 6 → 10 项，覆盖 4K 选择器、会员格式解析、Cookie 导出格式与错误文案。

## 0.2.2 — 2026-10-24

- 识别进程加入 60 秒超时与重试上限。

## 0.2.1 — 2026-10-22

- 修复打包后工具路径、Cookie 文件兜底、队列与历史持久化。
