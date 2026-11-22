const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bili', {
  inspect: data => ipcRenderer.send('inspect', data),
  download: data => ipcRenderer.send('download', data),
  cancel: () => ipcRenderer.send('cancel'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickCookieFile: () => ipcRenderer.invoke('pick-cookie-file'),
  openFolder: folder => ipcRenderer.send('open-folder', folder),
  getState: () => ipcRenderer.invoke('state'),
  setQueue: items => ipcRenderer.send('set-queue', items),
  login: () => ipcRenderer.invoke('bili-login'),
  logout: () => ipcRenderer.invoke('bili-logout'),
  loginStatus: () => ipcRenderer.invoke('login-status'),
  updateYtdlp: () => ipcRenderer.invoke('update-yt-dlp'),
  onLogin: fn => ipcRenderer.on('login-status', (_, data) => fn(data)),
  onLine: fn => ipcRenderer.on('process-line', (_, data) => fn(data)),
  onDone: fn => ipcRenderer.on('process-done', (_, data) => fn(data)),
  onError: fn => ipcRenderer.on('process-error', (_, data) => fn(data)),
});
