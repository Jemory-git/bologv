// electron/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";

// electron/types/ipc.ts
var IPC = {
  boot: "blg:boot",
  ready: "blg:ready",
  event: "blg:event"
};

// electron/preload/index.ts
contextBridge.exposeInMainWorld("bologui", {
  // boot 信息：插件列表、会话路径、工作目录
  boot: () => ipcRenderer.invoke(IPC.boot),
  onReady: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(IPC.ready, listener);
    return () => ipcRenderer.removeListener(IPC.ready, listener);
  },
  onEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(IPC.event, listener);
    return () => ipcRenderer.removeListener(IPC.event, listener);
  }
});
