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
  // Titlebar buttons - CRÍTICOS
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.removeAttribute('onclick');
    themeToggle.setAttribute('data-listener-added', 'true');
    themeToggle.addEventListener('click', () => {
      if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
      } else {
        console.error('window.toggleTheme no está disponible');
      }
    });
  }

  // Window controls - CRÍTICOS para funcionalidad de ventana
  // Usar función helper que reintenta si qwenValencia no está disponible
  function setupWindowControl(btnId, action) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.removeAttribute('onclick');
    btn.setAttribute('data-listener-added', 'true');

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();

      // Intentar usar qwenValencia si está disponible
      if (window.qwenValencia && typeof window.qwenValencia[action] === 'function') {
        try {
          window.qwenValencia[action]();
        } catch (error) {
          console.error(`Error ejecutando ${action}:`, error);
          // Fallback: usar IPC directamente si está disponible
          if (window.require) {
            try {
              const { ipcRenderer } = window.require('electron');
              ipcRenderer.send(`window-${action}`);
            } catch (ipcError) {
              console.error('Error usando IPC directo:', ipcError);
            }
          }
        }
      } else {
        // Fallback: usar IPC directamente
        if (window.require) {
          try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send(`window-${action}`);
          } catch (ipcError) {
            console.error(
              `window.qwenValencia.${action} no está disponible y IPC falló:`,
              ipcError
            );
          }
        } else {
          console.error(`window.qwenValencia.${action} no está disponible`);
        }
      }
    });
  }

  setupWindowControl('minimizeBtn', 'minimize');
  setupWindowControl('maximizeBtn', 'maximize');
  setupWindowControl('closeBtn', 'close');

  // Menu options - usar data-action o onclick legacy
  const menuOptions = document.querySelectorAll('.menu-option[data-action], .menu-option[onclick]');
  menuOptions.forEach(option => {
    const action = option.getAttribute('data-action');
    const onclick = option.getAttribute('onclick');
    const funcName = action || (onclick ? onclick.replace(/\(\)/g, '') : null);

    if (onclick) {
      option.removeAttribute('onclick');
    }

    if (funcName && !option.hasAttribute('data-listener-added')) {
      option.setAttribute('data-listener-added', 'true');
      option.addEventListener('click', () => {
        if (typeof window[funcName] === 'function') {
          window[funcName]();
        } else {
          console.warn(`Función ${funcName} no está disponible`);
        }
      });
    }
  });

  // Sidebar buttons
  const collapseBtn =
    document.getElementById('collapseSidebarBtn') || document.querySelector('.collapse-btn');
  if (collapseBtn) {
    collapseBtn.removeAttribute('onclick');
    collapseBtn.addEventListener('click', () => {
      if (typeof window.toggleSidebar === 'function') {
        window.toggleSidebar();
      }
    });
  }

  const newChatBtn =
    document.getElementById('newChatSidebarBtn') || document.querySelector('.new-chat-btn');
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

  // Avatar mode buttons - usar data-mode-value si está disponible
  const avatarModeButtons = document.querySelectorAll(
    '.avatar-mode-btn[data-mode], .avatar-mode-btn[data-action="setAvatarMode"]'
  );
  avatarModeButtons.forEach(btn => {
    btn.removeAttribute('onclick');
    if (!btn.hasAttribute('data-listener-added')) {
      btn.setAttribute('data-listener-added', 'true');
      const mode = btn.getAttribute('data-mode-value') || btn.getAttribute('data-mode');
      btn.addEventListener('click', () => {
        if (typeof window.setAvatarMode === 'function' && mode) {
          window.setAvatarMode(mode);
        } else {
          console.warn('window.setAvatarMode no está disponible');
        }
      });
    }
  });

  // Legacy avatar controls con onclick
  const avatarControls = document.querySelectorAll(
    '.avatar-control-btn[onclick], .avatar-mode-btn[onclick]'
  );
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
  const settingsBtn =
    document.getElementById('openSettingsBtn') ||
    document.getElementById('settingsSidebarBtn') ||
    document.querySelector('.settings-btn');
  if (settingsBtn) {
    settingsBtn.removeAttribute('onclick');
    settingsBtn.setAttribute('data-listener-added', 'true');
    settingsBtn.addEventListener('click', () => {
      if (typeof window.openSettings === 'function') {
        window.openSettings();
      } else {
        console.warn('window.openSettings no está disponible');
      }
    });
  }

  // Model selector
  const modelBtn =
    document.getElementById('modelMenuBtn') ||
    document.getElementById('modelSelectorBtn') ||
    document.querySelector('.model-btn');
  if (modelBtn) {
    modelBtn.removeAttribute('onclick');
    modelBtn.setAttribute('data-listener-added', 'true');
    modelBtn.addEventListener('click', () => {
      if (typeof window.toggleModelMenu === 'function') {
        window.toggleModelMenu();
      } else if (window.modelSelector && typeof window.modelSelector.toggleMenu === 'function') {
        window.modelSelector.toggleMenu();
      }
    });
  }

  // Model search
  const modelSearch = document.getElementById('modelSearch');
  if (modelSearch) {
    modelSearch.removeAttribute('oninput');
    modelSearch.addEventListener('input', e => {
      if (typeof window.filterModels === 'function') {
        window.filterModels(e.target.value);
      }
    });
  }

  // Model toggles - Asegurar que se configuren correctamente
  const autoToggle = document.getElementById('autoToggle');
  if (autoToggle) {
    autoToggle.removeAttribute('onchange');
    autoToggle.addEventListener('change', e => {
      if (typeof window.toggleAutoMode === 'function') {
        window.toggleAutoMode(e.target.checked);
      } else if (
        window.modelSelector &&
        typeof window.modelSelector.toggleAutoMode === 'function'
      ) {
        window.modelSelector.toggleAutoMode(e.target.checked);
      }
    });
  }

  const maxModeToggle = document.getElementById('maxModeToggle');
  if (maxModeToggle) {
    maxModeToggle.removeAttribute('onchange');
    maxModeToggle.addEventListener('change', e => {
      if (typeof window.toggleMaxMode === 'function') {
        window.toggleMaxMode(e.target.checked);
      } else if (window.modelSelector && typeof window.modelSelector.toggleMaxMode === 'function') {
        window.modelSelector.toggleMaxMode(e.target.checked);
      }
    });
  }

  const multiModelToggle = document.getElementById('multiModelToggle');
  if (multiModelToggle) {
    multiModelToggle.removeAttribute('onchange');
    multiModelToggle.addEventListener('change', e => {
      if (typeof window.toggleMultiModel === 'function') {
        window.toggleMultiModel(e.target.checked);
      } else if (
        window.modelSelector &&
        typeof window.modelSelector.toggleMultiModel === 'function'
      ) {
        window.modelSelector.toggleMultiModel(e.target.checked);
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
  const stopBtn =
    document.getElementById('stopGenerationBtn') || document.querySelector('.stop-btn');
  if (stopBtn) {
    stopBtn.removeAttribute('onclick');
    stopBtn.addEventListener('click', () => {
      if (typeof window.stopGeneration === 'function') {
        window.stopGeneration();
      }
    });
  }

  // Remove attachment button
  const removeBtn =
    document.getElementById('removeAttachmentBtn') || document.querySelector('.remove-btn');
  if (removeBtn) {
    removeBtn.removeAttribute('onclick');
    removeBtn.addEventListener('click', () => {
      if (typeof window.removeAttachment === 'function') {
        window.removeAttachment();
      }
    });
  }

  // Chat input buttons - CRÍTICOS para funcionalidad del chat
  const dictateBtn = document.getElementById('dictateBtn');
  if (dictateBtn) {
    dictateBtn.removeAttribute('onclick');
    dictateBtn.addEventListener('click', () => {
      if (typeof window.toggleDictation === 'function') {
        window.toggleDictation();
      }
    });
  }

  const voiceCallBtn = document.getElementById('voiceCallBtn');
  if (voiceCallBtn) {
    voiceCallBtn.removeAttribute('onclick');
    voiceCallBtn.addEventListener('click', () => {
      if (typeof window.startVoiceCall === 'function') {
        window.startVoiceCall();
      }
    });
  }

  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.removeAttribute('onclick');
    sendBtn.setAttribute('data-listener-added', 'true');
    sendBtn.addEventListener('click', () => {
      if (typeof window.sendMessage === 'function') {
        window.sendMessage();
      } else {
        console.error('window.sendMessage no está disponible');
      }
    });
  }

  // Chat input - Enter para enviar, Shift+Enter para nueva línea
  const chatInput = document.getElementById('chatInput');
  if (chatInput && !chatInput.hasAttribute('data-listener-added')) {
    chatInput.setAttribute('data-listener-added', 'true');
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (typeof window.sendMessage === 'function') {
          window.sendMessage();
        } else if (typeof window.handleKeydown === 'function') {
          window.handleKeydown(e);
        }
      } else if (typeof window.handleKeydown === 'function') {
        window.handleKeydown(e);
      }
    });

    // Auto-resize del textarea
    if (typeof window.autoResize === 'function') {
      chatInput.addEventListener('input', () => {
        window.autoResize(chatInput);
      });
    }
  }

  // Model selector button - Ya configurado arriba (línea 181), solo verificar que funcione
  // Si no se encontró arriba, intentar de nuevo aquí
  if (!modelBtn || !modelBtn.hasAttribute('data-listener-added')) {
    const modelBtnAlt = document.querySelector('.model-btn:not([data-listener-added])');
    if (modelBtnAlt) {
      modelBtnAlt.removeAttribute('onclick');
      modelBtnAlt.setAttribute('data-listener-added', 'true');
      modelBtnAlt.addEventListener('click', () => {
        if (typeof window.toggleModelMenu === 'function') {
          window.toggleModelMenu();
        } else if (window.modelSelector && typeof window.modelSelector.toggleMenu === 'function') {
          window.modelSelector.toggleMenu();
        }
      });
    }
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

  // Settings nav - usar data-action y data-panel-value
  const navItems = document.querySelectorAll(
    '.nav-item[data-action="showPanel"], .nav-item[data-panel], .nav-item[onclick]'
  );
  navItems.forEach(item => {
    const onclick = item.getAttribute('onclick');
    const panelValue = item.getAttribute('data-panel-value') || item.getAttribute('data-panel');

    if (onclick) {
      item.removeAttribute('onclick');
    }

    if (!item.hasAttribute('data-listener-added')) {
      item.setAttribute('data-listener-added', 'true');
      const match = onclick ? onclick.match(/showPanel\(['"]([^'"]+)['"]\)/) : null;
      const panel = panelValue || (match ? match[1] : null);

      if (panel) {
        item.addEventListener('click', () => {
          if (typeof window.showPanel === 'function') {
            window.showPanel(panel);
          } else {
            console.warn('window.showPanel no está disponible');
          }
        });
      }
    }
  });

  // Settings inputs
  const temperatureInput = document.getElementById('temperature');
  if (temperatureInput) {
    temperatureInput.removeAttribute('oninput');
    temperatureInput.addEventListener('input', e => {
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
  const addModelBtn =
    document.getElementById('addModelBtn') || document.querySelector('.add-model-btn');
  if (addModelBtn) {
    addModelBtn.removeAttribute('onclick');
    addModelBtn.setAttribute('data-listener-added', 'true');
    addModelBtn.addEventListener('click', () => {
      if (typeof window.showAddModelModal === 'function') {
        window.showAddModelModal();
      } else {
        console.warn('window.showAddModelModal no está disponible');
      }
    });
  }

  // Settings modal buttons
  const addMCPServerBtn = document.getElementById('addMCPServerBtn');
  if (addMCPServerBtn) {
    addMCPServerBtn.removeAttribute('onclick');
    addMCPServerBtn.setAttribute('data-listener-added', 'true');
    addMCPServerBtn.addEventListener('click', () => {
      if (typeof window.addMCPServer === 'function') {
        window.addMCPServer();
      } else {
        console.warn('window.addMCPServer no está disponible');
      }
    });
  }

  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  if (cancelSettingsBtn) {
    cancelSettingsBtn.removeAttribute('onclick');
    cancelSettingsBtn.setAttribute('data-listener-added', 'true');
    cancelSettingsBtn.addEventListener('click', () => {
      if (typeof window.closeSettings === 'function') {
        window.closeSettings();
      } else {
        console.warn('window.closeSettings no está disponible');
      }
    });
  }

  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.removeAttribute('onclick');
    saveSettingsBtn.setAttribute('data-listener-added', 'true');
    saveSettingsBtn.addEventListener('click', () => {
      if (typeof window.saveSettings === 'function') {
        window.saveSettings();
      } else {
        console.warn('window.saveSettings no está disponible');
      }
    });
  }

  // Context menu items
  const contextItems = document.querySelectorAll('.context-item[data-action]');
  contextItems.forEach(item => {
    if (!item.hasAttribute('data-listener-added')) {
      item.setAttribute('data-listener-added', 'true');
      const action = item.getAttribute('data-action');
      item.addEventListener('click', () => {
        if (typeof window[action] === 'function') {
          window[action]();
        } else {
          console.warn(`Función window.${action} no está disponible`);
        }
      });
    }
  });

  // Capture button
  const captureBtn =
    document.getElementById('capturePhotoBtn') || document.querySelector('.capture-btn');
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

  const cancelBtn =
    document.getElementById('cancelSettingsBtn') || document.querySelector('.btn-cancel');
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

  // Add MCP Server button - Ya está configurado arriba (línea 516), no duplicar

  // File input
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.removeAttribute('onchange');
    fileInput.addEventListener('change', e => {
      if (typeof window.handleFileSelect === 'function') {
        window.handleFileSelect(e);
      }
    });
  }

  // Context menu items - Ya procesados arriba (línea 556), no duplicar

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

// Inicializar cuando el DOM esté listo - EJECUTAR INMEDIATAMENTE para botones de ventana
// Los botones de ventana NO dependen de app.js, solo de preload.js que ya está cargado
function initWindowControls() {
  // Configurar botones de ventana INMEDIATAMENTE (no dependen de app.js)
  const minimizeBtn = document.getElementById('minimizeBtn');
  const maximizeBtn = document.getElementById('maximizeBtn');
  const closeBtn = document.getElementById('closeBtn');
  const themeToggle = document.getElementById('themeToggle');

  function setupWindowBtn(btn, action) {
    if (!btn) {
      console.warn(`Botón ${action} no encontrado`);
      return;
    }
    btn.removeAttribute('onclick');
    btn.setAttribute('data-listener-added', 'true');
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();

      // Intentar usar qwenValencia primero
      if (window.qwenValencia && typeof window.qwenValencia[action] === 'function') {
        try {
          window.qwenValencia[action]();
          return;
        } catch (error) {
          console.error(`Error ejecutando qwenValencia.${action}:`, error);
        }
      }

      // Fallback: usar IPC directamente si está disponible
      if (window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.send(`window-${action}`);
          return;
        } catch (ipcError) {
          console.error(`Error usando IPC para ${action}:`, ipcError);
        }
      }

      console.error(`No se pudo ejecutar ${action} - qwenValencia e IPC no disponibles`);
    });
  }

  setupWindowBtn(minimizeBtn, 'minimize');
  setupWindowBtn(maximizeBtn, 'maximize');
  setupWindowBtn(closeBtn, 'close');

  if (themeToggle) {
    themeToggle.removeAttribute('onclick');
    themeToggle.setAttribute('data-listener-added', 'true');
    themeToggle.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
      } else {
        console.error('window.toggleTheme no está disponible');
      }
    });
  } else {
    console.warn('Botón themeToggle no encontrado');
  }

  console.log('✅ Controles de ventana inicializados');
}

// Inicializar controles de ventana INMEDIATAMENTE
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWindowControls);
} else {
  initWindowControls();
}

// Inicializar el resto de event listeners cuando las funciones estén disponibles
function tryInitEventListeners() {
  // Verificar que las funciones críticas estén disponibles
  const criticalFunctions = ['sendMessage', 'newChat', 'toggleSidebar'];
  const allAvailable = criticalFunctions.every(fn => typeof window[fn] === 'function');

  if (allAvailable) {
    // Todas las funciones están disponibles, inicializar
    try {
      initEventListeners();
      console.log('✅ Event listeners inicializados correctamente');
    } catch (error) {
      console.error('❌ Error inicializando event listeners:', error);
    }
  } else {
    // Reintentar después de un breve delay (máximo 10 intentos = 1 segundo)
    const maxAttempts = 10;
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      const nowAvailable = criticalFunctions.every(fn => typeof window[fn] === 'function');
      if (nowAvailable || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        if (nowAvailable) {
          try {
            initEventListeners();
            console.log('✅ Event listeners inicializados correctamente (reintento)');
          } catch (error) {
            console.error('❌ Error inicializando event listeners:', error);
          }
        } else {
          console.warn(
            '⚠️ No se pudieron inicializar todos los event listeners - algunas funciones no están disponibles'
          );
        }
      }
    }, 100);
  }
}

// Inicializar cuando el DOM esté listo Y después de que app.js haya cargado
// app.js llamará a initEventListeners() cuando esté listo, pero también tenemos este fallback
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que app.js exponga las funciones
    setTimeout(tryInitEventListeners, 150);
  });
} else {
  // DOM ya está listo, pero esperar a que app.js exponga las funciones
  setTimeout(tryInitEventListeners, 150);
}

// Exponer globalmente
window.initEventListeners = initEventListeners;
