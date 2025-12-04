/**
 * ════════════════════════════════════════════════════════════════════════════
 * EVENT LISTENERS - Centralización de Event Listeners
 * Reemplaza onclick inline para cumplir con CSP
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Inicializa todos los event listeners
 */
function initEventListeners() {
  // Titlebar buttons
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
      }
    });
  }

  // Window controls
  const minimizeBtn = document.getElementById('minimizeBtn') || document.querySelector('.titlebar-btn[onclick*="minimize"]');
  if (minimizeBtn) {
    minimizeBtn.removeAttribute('onclick');
    minimizeBtn.addEventListener('click', () => {
      if (window.qwenValencia?.minimize) {
        window.qwenValencia.minimize();
      }
    });
  }

  const maximizeBtn = document.getElementById('maximizeBtn') || document.querySelector('.titlebar-btn[onclick*="maximize"]');
  if (maximizeBtn) {
    maximizeBtn.removeAttribute('onclick');
    maximizeBtn.addEventListener('click', () => {
      if (window.qwenValencia?.maximize) {
        window.qwenValencia.maximize();
      }
    });
  }

  const closeBtn = document.getElementById('closeBtn') || document.querySelector('.titlebar-btn.close');
  if (closeBtn) {
    closeBtn.removeAttribute('onclick');
    closeBtn.addEventListener('click', () => {
      if (window.qwenValencia?.close) {
        window.qwenValencia.close();
      }
    });
  }

  // Menu options - usar data-action o onclick legacy
  const menuOptions = document.querySelectorAll('.menu-option[data-action], .menu-option[onclick]');
  menuOptions.forEach(option => {
    const action = option.getAttribute('data-action');
    const onclick = option.getAttribute('onclick');
    const funcName = action || (onclick ? onclick.replace(/\(\)/g, '') : null);
    
    if (onclick) {
      option.removeAttribute('onclick');
    }
    
    if (funcName) {
      option.addEventListener('click', () => {
        if (typeof window[funcName] === 'function') {
          window[funcName]();
        }
      });
    }
  });

  // Sidebar buttons
  const collapseBtn = document.getElementById('collapseSidebarBtn') || document.querySelector('.collapse-btn');
  if (collapseBtn) {
    collapseBtn.removeAttribute('onclick');
    collapseBtn.addEventListener('click', () => {
      if (typeof window.toggleSidebar === 'function') {
        window.toggleSidebar();
      }
    });
  }

  const newChatBtn = document.getElementById('newChatSidebarBtn') || document.querySelector('.new-chat-btn');
  if (newChatBtn) {
    newChatBtn.removeAttribute('onclick');
    newChatBtn.addEventListener('click', () => {
      if (typeof window.newChat === 'function') {
        window.newChat();
      }
    });
  }

  // Avatar controls - por ID específico
  const avatarCameraBtn = document.getElementById('avatarCameraBtn');
  if (avatarCameraBtn) {
    avatarCameraBtn.removeAttribute('onclick');
    avatarCameraBtn.addEventListener('click', () => {
      if (typeof window.toggleAvatarCamera === 'function') {
        window.toggleAvatarCamera();
      }
    });
  }

  const avatarCallBtn = document.getElementById('avatarCallBtn');
  if (avatarCallBtn) {
    avatarCallBtn.removeAttribute('onclick');
    avatarCallBtn.addEventListener('click', () => {
      if (typeof window.toggleAvatarCall === 'function') {
        window.toggleAvatarCall();
      }
    });
  }

  const avatarHangBtn = document.getElementById('avatarHangBtn');
  if (avatarHangBtn) {
    avatarHangBtn.removeAttribute('onclick');
    avatarHangBtn.addEventListener('click', () => {
      if (typeof window.hangAvatarCall === 'function') {
        window.hangAvatarCall();
      }
    });
  }

  const avatarPauseBtn = document.getElementById('avatarPauseBtn');
  if (avatarPauseBtn) {
    avatarPauseBtn.removeAttribute('onclick');
    avatarPauseBtn.addEventListener('click', () => {
      if (typeof window.toggleAvatarPause === 'function') {
        window.toggleAvatarPause();
      }
    });
  }

  // Avatar mode buttons
  const avatarModeButtons = document.querySelectorAll('.avatar-mode-btn[data-mode]');
  avatarModeButtons.forEach(btn => {
    btn.removeAttribute('onclick');
    const mode = btn.getAttribute('data-mode');
    btn.addEventListener('click', () => {
      if (typeof window.setAvatarMode === 'function' && mode) {
        window.setAvatarMode(mode);
      }
    });
  });

  // Legacy avatar controls con onclick
  const avatarControls = document.querySelectorAll('.avatar-control-btn[onclick], .avatar-mode-btn[onclick]');
  avatarControls.forEach(btn => {
    const onclick = btn.getAttribute('onclick');
    if (onclick) {
      btn.removeAttribute('onclick');
      const match = onclick.match(/(\w+)\([^)]*\)/);
      if (match && typeof window[match[1]] === 'function') {
        const funcName = match[1];
        const args = onclick.match(/\(([^)]*)\)/)?.[1];
        btn.addEventListener('click', () => {
          if (args) {
            const argValue = args.replace(/['"]/g, '');
            window[funcName](argValue);
          } else {
            window[funcName]();
          }
        });
      }
    }
  });

  // Settings button
  const settingsBtn = document.getElementById('settingsSidebarBtn') || document.querySelector('.settings-btn');
  if (settingsBtn) {
    settingsBtn.removeAttribute('onclick');
    settingsBtn.addEventListener('click', () => {
      if (typeof window.openSettings === 'function') {
        window.openSettings();
      }
    });
  }

  // Model selector
  const modelBtn = document.getElementById('modelMenuBtn') || document.querySelector('.model-btn');
  if (modelBtn) {
    modelBtn.removeAttribute('onclick');
    modelBtn.addEventListener('click', () => {
      if (typeof window.toggleModelMenu === 'function') {
        window.toggleModelMenu();
      }
    });
  }

  // Model search
  const modelSearch = document.getElementById('modelSearch');
  if (modelSearch) {
    modelSearch.removeAttribute('oninput');
    modelSearch.addEventListener('input', (e) => {
      if (typeof window.filterModels === 'function') {
        window.filterModels(e.target.value);
      }
    });
  }

  // Model toggles
  const autoToggle = document.getElementById('autoToggle');
  if (autoToggle) {
    autoToggle.removeAttribute('onchange');
    autoToggle.addEventListener('change', (e) => {
      if (typeof window.toggleAutoMode === 'function') {
        window.toggleAutoMode(e.target.checked);
      }
    });
  }

  const maxModeToggle = document.getElementById('maxModeToggle');
  if (maxModeToggle) {
    maxModeToggle.removeAttribute('onchange');
    maxModeToggle.addEventListener('change', (e) => {
      if (typeof window.toggleMaxMode === 'function') {
        window.toggleMaxMode(e.target.checked);
      }
    });
  }

  const multiModelToggle = document.getElementById('multiModelToggle');
  if (multiModelToggle) {
    multiModelToggle.removeAttribute('onchange');
    multiModelToggle.addEventListener('change', (e) => {
      if (typeof window.toggleMultiModel === 'function') {
        window.toggleMultiModel(e.target.checked);
      }
    });
  }

  // Mode buttons
  const modeAgentBtn = document.getElementById('modeAgentBtn');
  if (modeAgentBtn) {
    modeAgentBtn.removeAttribute('onclick');
    modeAgentBtn.addEventListener('click', () => {
      if (typeof window.setMode === 'function') {
        window.setMode('agent');
      }
    });
  }

  const modePlanBtn = document.getElementById('modePlanBtn');
  if (modePlanBtn) {
    modePlanBtn.removeAttribute('onclick');
    modePlanBtn.addEventListener('click', () => {
      if (typeof window.setMode === 'function') {
        window.setMode('plan');
      }
    });
  }

  // Legacy mode buttons con onclick
  const modeButtons = document.querySelectorAll('.mode-btn[onclick]');
  modeButtons.forEach(btn => {
    const onclick = btn.getAttribute('onclick');
    if (onclick) {
      btn.removeAttribute('onclick');
      const match = onclick.match(/setMode\(['"]([^'"]+)['"]\)/);
      if (match) {
        btn.addEventListener('click', () => {
          if (typeof window.setMode === 'function') {
            window.setMode(match[1]);
          }
        });
      }
    }
  });

  // API toggle
  const apiToggle = document.getElementById('apiToggle');
  if (apiToggle) {
    apiToggle.removeAttribute('onchange');
    apiToggle.addEventListener('change', () => {
      if (typeof window.toggleAPI === 'function') {
        window.toggleAPI();
      }
    });
  }

  // Tool buttons
  const cameraBtn = document.getElementById('cameraBtn');
  if (cameraBtn) {
    cameraBtn.removeAttribute('onclick');
    cameraBtn.addEventListener('click', () => {
      if (typeof window.openCameraForIA === 'function') {
        window.openCameraForIA();
      }
    });
  }

  const attachBtn = document.getElementById('attachBtn');
  if (attachBtn) {
    attachBtn.removeAttribute('onclick');
    attachBtn.addEventListener('click', () => {
      if (typeof window.attachImage === 'function') {
        window.attachImage();
      }
    });
  }

  // Stop button
  const stopBtn = document.getElementById('stopGenerationBtn') || document.querySelector('.stop-btn');
  if (stopBtn) {
    stopBtn.removeAttribute('onclick');
    stopBtn.addEventListener('click', () => {
      if (typeof window.stopGeneration === 'function') {
        window.stopGeneration();
      }
    });
  }

  // Remove attachment button
  const removeBtn = document.getElementById('removeAttachmentBtn') || document.querySelector('.remove-btn');
  if (removeBtn) {
    removeBtn.removeAttribute('onclick');
    removeBtn.addEventListener('click', () => {
      if (typeof window.removeAttachment === 'function') {
        window.removeAttachment();
      }
    });
  }

  // Modal buttons
  const modalCloses = document.querySelectorAll('.modal-close[onclick]');
  modalCloses.forEach(btn => {
    const onclick = btn.getAttribute('onclick');
    if (onclick) {
      btn.removeAttribute('onclick');
      const funcName = onclick.replace(/\(\)/g, '');
      btn.addEventListener('click', () => {
        if (typeof window[funcName] === 'function') {
          window[funcName]();
        }
      });
    }
  });

  // Settings nav
  const navItems = document.querySelectorAll('.nav-item[onclick]');
  navItems.forEach(item => {
    const onclick = item.getAttribute('onclick');
    if (onclick) {
      item.removeAttribute('onclick');
      const match = onclick.match(/showPanel\(['"]([^'"]+)['"]\)/);
      if (match) {
        item.addEventListener('click', () => {
          if (typeof window.showPanel === 'function') {
            window.showPanel(match[1]);
          }
        });
      }
    }
  });

  // Settings inputs
  const temperatureInput = document.getElementById('temperature');
  if (temperatureInput) {
    temperatureInput.removeAttribute('oninput');
    temperatureInput.addEventListener('input', (e) => {
      if (typeof window.updateTempValue === 'function') {
        window.updateTempValue(e.target);
      }
      // Actualizar display del valor
      const tempValue = document.getElementById('tempValue');
      if (tempValue) {
        tempValue.textContent = e.target.value;
      }
    });
  }

  // Add model button
  const addModelBtn = document.getElementById('addModelBtn') || document.querySelector('.add-model-btn');
  if (addModelBtn) {
    addModelBtn.removeAttribute('onclick');
    addModelBtn.addEventListener('click', () => {
      if (typeof window.showAddModelModal === 'function') {
        window.showAddModelModal();
      }
    });
  }

  // Capture button
  const captureBtn = document.getElementById('capturePhotoBtn') || document.querySelector('.capture-btn');
  if (captureBtn) {
    captureBtn.removeAttribute('onclick');
    captureBtn.addEventListener('click', () => {
      if (typeof window.capturePhoto === 'function') {
        window.capturePhoto();
      }
    });
  }

  // Close camera button
  const closeCameraBtn = document.getElementById('closeCameraBtn');
  if (closeCameraBtn) {
    closeCameraBtn.removeAttribute('onclick');
    closeCameraBtn.addEventListener('click', () => {
      if (typeof window.closeCamera === 'function') {
        window.closeCamera();
      }
    });
  }

  // Settings save/cancel
  const saveBtn = document.getElementById('saveSettingsBtn') || document.querySelector('.btn-save');
  if (saveBtn) {
    saveBtn.removeAttribute('onclick');
    saveBtn.addEventListener('click', () => {
      if (typeof window.saveSettings === 'function') {
        window.saveSettings();
      }
    });
  }

  const cancelBtn = document.getElementById('cancelSettingsBtn') || document.querySelector('.btn-cancel');
  if (cancelBtn) {
    cancelBtn.removeAttribute('onclick');
    cancelBtn.addEventListener('click', () => {
      if (typeof window.closeSettings === 'function') {
        window.closeSettings();
      }
    });
  }

  // Close settings button
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  if (closeSettingsBtn) {
    closeSettingsBtn.removeAttribute('onclick');
    closeSettingsBtn.addEventListener('click', () => {
      if (typeof window.closeSettings === 'function') {
        window.closeSettings();
      }
    });
  }

  // Add MCP Server button
  const addMCPServerBtn = document.getElementById('addMCPServerBtn');
  if (addMCPServerBtn) {
    addMCPServerBtn.removeAttribute('onclick');
    addMCPServerBtn.addEventListener('click', () => {
      if (typeof window.addMCPServer === 'function') {
        window.addMCPServer();
      }
    });
  }

  // File input
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.removeAttribute('onchange');
    fileInput.addEventListener('change', (e) => {
      if (typeof window.handleFileSelect === 'function') {
        window.handleFileSelect(e);
      }
    });
  }

  // Context menu items
  const contextItems = document.querySelectorAll('.context-item[data-action]');
  contextItems.forEach(item => {
    const action = item.getAttribute('data-action');
    if (action && typeof window[action] === 'function') {
      item.addEventListener('click', () => {
        window[action]();
      });
    }
  });

  // Legacy context menu items con onclick
  const contextItemsLegacy = document.querySelectorAll('.context-item[onclick]');
  contextItemsLegacy.forEach(item => {
    const onclick = item.getAttribute('onclick');
    if (onclick) {
      item.removeAttribute('onclick');
      const funcName = onclick.replace(/\(\)/g, '');
      if (typeof window[funcName] === 'function') {
        item.addEventListener('click', () => {
          window[funcName]();
        });
      }
    }
  });

  // History items
  const historyItems = document.querySelectorAll('.history-item');
  historyItems.forEach(item => {
    if (!item.hasAttribute('data-listener')) {
      item.setAttribute('data-listener', 'true');
      item.addEventListener('click', () => {
        // Handle history item click
        const title = item.querySelector('.history-title')?.textContent;
        if (title && typeof window.loadChat === 'function') {
          window.loadChat(title);
        }
      });
    }
  });
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEventListeners);
} else {
  initEventListeners();
}

// Exponer globalmente
window.initEventListeners = initEventListeners;

