/**
 * ════════════════════════════════════════════════════════════════════════════
 * TERMINAL PRELOAD - Bridge IPC para Terminal
 * ════════════════════════════════════════════════════════════════════════════
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('terminalAPI', {
  close: () => {
    ipcRenderer.send('terminal-close');
  },
  
  sendCommand: (command) => {
    ipcRenderer.send('terminal-command', { command });
  }
});

