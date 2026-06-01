// main.js - 遊戲進入點與 DOM 事件綁定

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. 初始化遊戲
  gameManager.init();

  // 2. 綁定首頁 Scene 事件
  document.getElementById('btn-start-game').addEventListener('click', () => {
    gameManager.changeState('MODE_SELECT');
  });

  document.getElementById('btn-go-settings').addEventListener('click', () => {
    gameManager.changeState('SETTINGS');
    updateSettingsUI();
  });

  document.getElementById('btn-go-tutorial').addEventListener('click', () => {
    gameManager.changeState('TUTORIAL');
  });

  document.getElementById('btn-go-license').addEventListener('click', () => {
    gameManager.changeState('LICENSE');
  });

  // 全螢幕切換按鈕事件
  document.getElementById('btn-toggle-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("無法切換全螢幕: ", err);
      });
    } else {
      document.exitFullscreen();
    }
  });

  // 全螢幕狀態變化監聽，同步按鈕文字，保留 SVG 圖示
  document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('btn-toggle-fullscreen');
    if (btn) {
      const span = btn.querySelector('span');
      if (span) {
        span.textContent = document.fullscreenElement ? '視窗化' : '全螢幕';
      } else {
        btn.textContent = document.fullscreenElement ? '視窗化' : '全螢幕';
      }
    }
  });

  // 3. 綁定模式與難度選擇 Scene 事件
  const modeButtons = {
    '1p-mouse': document.getElementById('btn-mode-1p-mouse'),
    '1p-gun': document.getElementById('btn-mode-1p-gun'),
    '1p-webcam': document.getElementById('btn-mode-1p-webcam'),
    '2p-coop': document.getElementById('btn-mode-2p-coop'),
    '2p-vs': document.getElementById('btn-mode-2p-vs')
  };

  // 點擊模式按鈕切換
  Object.keys(modeButtons).forEach(mode => {
    modeButtons[mode]?.addEventListener('click', () => {
      gameManager.selectedMode = mode;
      
      // 根據選定模式啟動或關閉 Webcam 體感鏡頭
      if (mode === '1p-webcam') {
        inputManager.startWebcam();
      } else {
        inputManager.stopWebcam();
      }
      
      // 更新按鈕樣式選取狀態
      Object.keys(modeButtons).forEach(m => {
        const btn = modeButtons[m];
        if (btn) {
          if (m === mode) {
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-gray');
          } else {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-gray');
          }
        }
      });

      // 啟用開始挑戰按鈕 (若是鏡頭體感模式，按鈕狀態與文字交由 inputManager 自行管理)
      const confirmBtn = document.getElementById('btn-mode-confirm');
      if (confirmBtn && mode !== '1p-webcam') {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24">
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline>
          <line x1="13" y1="19" x2="19" y2="13"></line>
          <line x1="16" y1="16" x2="20" y2="20"></line>
          <line x1="19" y1="21" x2="21" y2="19"></line>
        </svg>開始挑戰`;
      }

      console.log(`已選擇模式: ${mode}`);
    });
  });

  // 難度卡片點擊切換
  const diffCards = document.querySelectorAll('.difficulty-card');
  diffCards.forEach(card => {
    card.addEventListener('click', () => {
      // 移除其他卡片的選取樣式
      diffCards.forEach(c => c.classList.remove('selected'));
      
      // 加上當前選取樣式
      card.classList.add('selected');
      gameManager.selectedDiff = card.getAttribute('data-diff');
      console.log(`已選擇難度: ${gameManager.selectedDiff}`);
    });
  });

  document.getElementById('btn-mode-back').addEventListener('click', () => {
    gameManager.changeState('HOME');
  });

  document.getElementById('btn-mode-confirm').addEventListener('click', () => {
    gameManager.changeState('PLAYING');
  });

  // 4. 綁定教學說明 Scene 事件
  document.getElementById('btn-tutorial-back').addEventListener('click', () => {
    gameManager.changeState('HOME');
  });
  
  document.getElementById('btn-tutorial-close').addEventListener('click', () => {
    gameManager.changeState('HOME');
  });

  // 4.5 綁定授權與版權宣告 Scene 事件
  document.getElementById('btn-license-back').addEventListener('click', () => {
    gameManager.changeState('HOME');
  });
  
  document.getElementById('btn-license-close').addEventListener('click', () => {
    gameManager.changeState('HOME');
  });

  // 5. 綁定配置設定 Scene 事件
  // 語音重播間隔調整
  document.getElementById('btn-setting-repeat-dec').addEventListener('click', () => {
    if (gameSettings.repeatInterval === 0) return;
    if (gameSettings.repeatInterval === 2) {
      gameSettings.repeatInterval = 0;
    } else {
      gameSettings.repeatInterval--;
    }
    updateSettingsUI();
    audioManager.playCorrect(); // 播放音效提供點擊回饋
  });

  document.getElementById('btn-setting-repeat-inc').addEventListener('click', () => {
    if (gameSettings.repeatInterval === 5) return;
    if (gameSettings.repeatInterval === 0) {
      gameSettings.repeatInterval = 2;
    } else {
      gameSettings.repeatInterval++;
    }
    updateSettingsUI();
    audioManager.playCorrect();
  });

  // 語音音量調整
  document.getElementById('btn-setting-voice-dec').addEventListener('click', () => {
    gameSettings.voiceVolume = Math.max(0, Math.round((gameSettings.voiceVolume - 0.1) * 10) / 10);
    updateSettingsUI();
    audioManager.playZhuyin('ㄅ'); // 測試播放以聽取音量變化
  });

  document.getElementById('btn-setting-voice-inc').addEventListener('click', () => {
    gameSettings.voiceVolume = Math.min(1.0, Math.round((gameSettings.voiceVolume + 0.1) * 10) / 10);
    updateSettingsUI();
    audioManager.playZhuyin('ㄅ');
  });

  // 音效音量調整
  document.getElementById('btn-setting-sfx-dec').addEventListener('click', () => {
    gameSettings.sfxVolume = Math.max(0, Math.round((gameSettings.sfxVolume - 0.1) * 10) / 10);
    updateSettingsUI();
    audioManager.playShoot(); // 測試播放音效
  });

  document.getElementById('btn-setting-sfx-inc').addEventListener('click', () => {
    gameSettings.sfxVolume = Math.min(1.0, Math.round((gameSettings.sfxVolume + 0.1) * 10) / 10);
    updateSettingsUI();
    audioManager.playShoot();
  });

  // 氣球下降速度調整
  document.getElementById('btn-setting-speed-dec').addEventListener('click', () => {
    if (gameSettings.speedScale === 0.7) return;
    if (gameSettings.speedScale === 1.0) {
      gameSettings.speedScale = 0.7;
    } else if (gameSettings.speedScale === 1.3) {
      gameSettings.speedScale = 1.0;
    }
    updateSettingsUI();
    audioManager.playCorrect();
  });

  document.getElementById('btn-setting-speed-inc').addEventListener('click', () => {
    if (gameSettings.speedScale === 1.3) return;
    if (gameSettings.speedScale === 1.0) {
      gameSettings.speedScale = 1.3;
    } else if (gameSettings.speedScale === 0.7) {
      gameSettings.speedScale = 1.0;
    }
    updateSettingsUI();
    audioManager.playCorrect();
  });



  // 光槍抗抖設定
  document.getElementById('btn-setting-smoothing-dec').addEventListener('click', () => {
    if (gameSettings.gunSmoothing === 0.15) return;
    if (gameSettings.gunSmoothing === 0.35) {
      gameSettings.gunSmoothing = 0.15;
    } else if (gameSettings.gunSmoothing === 0.6) {
      gameSettings.gunSmoothing = 0.35;
    }
    updateSettingsUI();
    audioManager.playCorrect();
  });
  document.getElementById('btn-setting-smoothing-inc').addEventListener('click', () => {
    if (gameSettings.gunSmoothing === 0.6) return;
    if (gameSettings.gunSmoothing === 0.35) {
      gameSettings.gunSmoothing = 0.6;
    } else if (gameSettings.gunSmoothing === 0.15) {
      gameSettings.gunSmoothing = 0.35;
    }
    updateSettingsUI();
    audioManager.playCorrect();
  });

  // 背景音樂音量調整
  document.getElementById('btn-setting-bgm-dec').addEventListener('click', () => {
    gameSettings.bgmVolume = Math.max(0, Math.round((gameSettings.bgmVolume - 0.1) * 10) / 10);
    updateSettingsUI();
    audioManager.playBGMFeedback(); // 播放音量測試回饋
  });
  document.getElementById('btn-setting-bgm-inc').addEventListener('click', () => {
    gameSettings.bgmVolume = Math.min(1.0, Math.round((gameSettings.bgmVolume + 0.1) * 10) / 10);
    updateSettingsUI();
    audioManager.playBGMFeedback();
  });

  // 遊戲時間調整
  document.getElementById('btn-setting-time-dec').addEventListener('click', () => {
    gameSettings.gameTime = Math.max(10, gameSettings.gameTime - 10);
    updateSettingsUI();
    audioManager.playCorrect();
  });
  document.getElementById('btn-setting-time-inc').addEventListener('click', () => {
    gameSettings.gameTime = Math.min(300, gameSettings.gameTime + 10);
    updateSettingsUI();
    audioManager.playCorrect();
  });

  // 確認並儲存
  document.getElementById('btn-settings-save').addEventListener('click', () => {
    gameSettings.save();
    gameManager.changeState('HOME');
  });

  // 更新配置面板 UI 輔助函式
  function updateSettingsUI() {
    document.getElementById('setting-repeat-val').textContent = 
      gameSettings.repeatInterval === 0 ? '不重播' : `${gameSettings.repeatInterval} 秒`;
    document.getElementById('setting-voice-val').textContent = `${Math.round(gameSettings.voiceVolume * 100)}%`;
    document.getElementById('setting-sfx-val').textContent = `${Math.round(gameSettings.sfxVolume * 100)}%`;
    
    // 下降速度文字對應
    let speedText = '標準';
    if (gameSettings.speedScale === 0.7) speedText = '慢速';
    if (gameSettings.speedScale === 1.3) speedText = '快速';
    document.getElementById('setting-speed-val').textContent = speedText;



    // 新增光槍抗抖對應
    let smoothText = '標準';
    if (gameSettings.gunSmoothing === 0.6) smoothText = '極速';
    if (gameSettings.gunSmoothing === 0.15) smoothText = '抗抖';
    document.getElementById('setting-smoothing-val').textContent = smoothText;

    // 新增背景音樂音量百分比對應
    document.getElementById('setting-bgm-val').textContent = gameSettings.bgmVolume === 0 ? '關閉' : `${Math.round(gameSettings.bgmVolume * 100)}%`;

    // 新增遊戲時間對應
    document.getElementById('setting-time-val').textContent = `${gameSettings.gameTime} 秒`;
  }

  // 6. 綁定暫停 Scene 事件
  document.getElementById('btn-pause-resume').addEventListener('click', () => {
    gameManager.resumeGame();
  });

  document.getElementById('btn-pause-restart').addEventListener('click', () => {
    gameManager.changeState('PLAYING');
  });

  document.getElementById('btn-pause-home').addEventListener('click', () => {
    gameManager.changeState('HOME');
  });

  // 7. 綁定結算 Scene 事件
  document.getElementById('btn-result-restart').addEventListener('click', () => {
    gameManager.changeState('PLAYING');
  });

  document.getElementById('btn-result-home').addEventListener('click', () => {
    gameManager.changeState('HOME');
  });

  // 8. 綁定 HUD 內的按鈕事件
  document.getElementById('btn-replay-audio').addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止點擊穿透到 Canvas 射擊
    if (gameManager.state === 'PLAYING') {
      audioManager.playZhuyin(gameManager.targetChar);
    }
  });

  document.getElementById('btn-pause-hud').addEventListener('click', (e) => {
    e.stopPropagation();
    gameManager.pauseGame();
  });

  // 9. 全域鍵盤快捷鍵監聽
  window.addEventListener('keydown', (e) => {
    // ESC 鍵暫停
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (gameManager.state === 'PLAYING') {
        gameManager.pauseGame();
      } else if (gameManager.state === 'PAUSED') {
        gameManager.resumeGame();
      }
    }
    
    // 空白鍵 (Space) 重聽語音
    if (e.key === ' ' || e.key === 'Spacebar') {
      // 只有在遊戲進行中才作用，並防止網頁滾動
      if (gameManager.state === 'PLAYING') {
        e.preventDefault();
        audioManager.playZhuyin(gameManager.targetChar);
      }
    }
  });
});
