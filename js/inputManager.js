// InputManager - 管理滑鼠與 Gamepad / GUN4IR 輸入

class InputManager {
  constructor() {
    this.canvas = null;
    this.mouseX = GAME_WIDTH / 2;
    this.mouseY = GAME_HEIGHT / 2;
    this.mouseClicked = false;

    // Gamepad 狀態
    this.gamepads = [];
    this.p1GamepadIndex = -1;
    this.p2GamepadIndex = -1;

    // 儲存光槍瞄準瀏覽器視窗 (Viewport) 的絕對 Client 座標
    this.p1ClientX = window.innerWidth / 2;
    this.p1ClientY = window.innerHeight / 2;
    this.p2ClientX = window.innerWidth / 2;
    this.p2ClientY = window.innerHeight / 2;

    // 預設校正區間，改為直接寫死標準的軸區間 [-1.0, 1.0]，不再讀取或儲存校正檔案
    this.calibration = {
      p1: { minX: -1.0, maxX: 1.0, minY: -1.0, maxY: 1.0 },
      p2: { minX: -1.0, maxX: 1.0, minY: -1.0, maxY: 1.0 }
    };

    // 紀錄上一個 frame 的按鍵狀態，用來偵測「剛按下 (just pressed)」
    this.prevButtons = {
      p1: [],
      p2: []
    };

    // 回呼函數 (當觸發射擊時呼叫)
    this.onShootCallback = null;

    // 用以追蹤上次偵測到的光槍數量，避免無效重複更新 DOM
    this.lastGunCount = -1;

    // 初始化 Gamepad 事件監聽
    window.addEventListener('gamepadconnected', (e) => this.handleGamepadConnect(e));
    window.addEventListener('gamepaddisconnected', (e) => this.handleGamepadDisconnect(e));
  }

  init(canvas) {
    this.canvas = canvas;
    
    // 滑鼠事件監聽
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    
    // 首次手動更新一次連接狀態
    this.updateGunsCount();
  }

  handleGamepadConnect(e) {
    console.log(`控制器連接: ${e.gamepad.id} (index: ${e.gamepad.index})`);
    this.updateGamepadList();
  }

  handleGamepadDisconnect(e) {
    console.log(`控制器斷開: ${e.gamepad.id} (index: ${e.gamepad.index})`);
    if (this.p1GamepadIndex === e.gamepad.index) this.p1GamepadIndex = -1;
    if (this.p2GamepadIndex === e.gamepad.index) this.p2GamepadIndex = -1;
    this.updateGamepadList();
  }

  updateGamepadList() {
    // 取得所有控制器
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    this.gamepads = [];
    let countText = [];
    
    for (let i = 0; i < gps.length; i++) {
      if (gps[i]) {
        this.gamepads.push(gps[i]);
        countText.push(`[${i}] ${gps[i].id.substring(0, 15)}...`);
      }
    }

    const detectedSpan = document.getElementById('detected-gamepads');
    if (detectedSpan) {
      detectedSpan.textContent = countText.length > 0 ? countText.join(', ') : '無偵測到控制器';
    }

    // 自動指派未綁定的 Gamepad
    if (this.p1GamepadIndex === -1 && this.gamepads.length > 0) {
      this.p1GamepadIndex = this.gamepads[0].index;
    }
    if (this.p2GamepadIndex === -1 && this.gamepads.length > 1) {
      this.p2GamepadIndex = this.gamepads[1].index;
    }
  }

  // 將滑鼠的 Client 座標映射到 Canvas 邏輯座標 (1280x720)
  handleMouseMove(e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    
    // 計算縮放比例
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
    
    // 限制在邊界內
    this.mouseX = Math.max(0, Math.min(GAME_WIDTH, this.mouseX));
    this.mouseY = Math.max(0, Math.min(GAME_HEIGHT, this.mouseY));
  }

  handleMouseDown(e) {
    // 只處理滑鼠左鍵
    if (e.button !== 0) return;
    
    if (this.onShootCallback) {
      this.onShootCallback(1, this.mouseX, this.mouseY, 'mouse');
    }
  }

  // 註冊射擊回呼
  onShoot(callback) {
    this.onShootCallback = callback;
  }

  // 輪詢更新 Gamepad 輸入狀態
  update() {
    // 即時偵測光槍數量並更新選單可用性
    this.updateGunsCount();

    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    
    // 篩選有效的 Gamepad
    let activeGamepads = [];
    for (let i = 0; i < gps.length; i++) {
      if (gps[i]) {
        activeGamepads.push(gps[i]);
      }
    }

    // 自動指派未綁定的 Gamepad 索引 (例如開網頁前就已插入的裝置)
    if (this.p1GamepadIndex === -1 && activeGamepads.length > 0) {
      this.p1GamepadIndex = activeGamepads[0].index;
      console.log(`自動偵測並綁定 P1 Gamepad: index ${this.p1GamepadIndex}`);
    }
    if (this.p2GamepadIndex === -1 && activeGamepads.length > 1) {
      this.p2GamepadIndex = activeGamepads[1].index;
      console.log(`自動偵測並綁定 P2 Gamepad: index ${this.p2GamepadIndex}`);
    }

    // 1P Gamepad 更新
    if (this.p1GamepadIndex !== -1 && gps[this.p1GamepadIndex]) {
      this.processGamepadInput(1, gps[this.p1GamepadIndex]);
    }
    
    // 2P Gamepad 更新
    if (this.p2GamepadIndex !== -1 && gps[this.p2GamepadIndex]) {
      this.processGamepadInput(2, gps[this.p2GamepadIndex]);
    }
  }

  // 偵測目前已連接且啟用的光槍數量
  updateGunsCount() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let count = 0;
    
    // 遍歷所有插槽，只要有回傳且不為空即算一隻
    for (let i = 0; i < gps.length; i++) {
      if (gps[i]) {
        count++;
      }
    }

    // 當數量改變時，更新 UI 狀態
    if (this.lastGunCount !== count) {
      this.lastGunCount = count;
      this.applyGunCountUI(count);
    }
  }

  // 根據光槍連接數量更新首頁狀態及禁用不可用的遊戲模式
  applyGunCountUI(count) {
    const statusDiv = document.getElementById('home-gun-status');
    const calibBtn = document.getElementById('btn-go-calibration');
    
    if (statusDiv) {
      if (count === 0) {
        statusDiv.innerHTML = `🔌 偵測到光線槍：0 支 (請射擊或扣動扳機啟用)`;
        statusDiv.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        statusDiv.style.color = '#f87171'; // 紅色
      } else {
        statusDiv.innerHTML = `🔌 偵測到光線槍：${count} 支 (已就緒)`;
        statusDiv.style.borderColor = 'rgba(74, 222, 128, 0.5)';
        statusDiv.style.color = '#4ade80'; // 綠色
      }
    }
    
    if (calibBtn) {
      // 只有連線光線槍才能點選校正
      calibBtn.disabled = (count === 0);
    }
    
    // 模式選擇按鈕控制
    const btnMouse = document.getElementById('btn-mode-1p-mouse');
    const btn1pGun = document.getElementById('btn-mode-1p-gun');
    const btn2pCoop = document.getElementById('btn-mode-2p-coop');
    const btn2pVs = document.getElementById('btn-mode-2p-vs');
    
    if (btnMouse && btn1pGun && btn2pCoop && btn2pVs) {
      if (count === 0) {
        btnMouse.disabled = false;
        btn1pGun.disabled = true;
        btn2pCoop.disabled = true;
        btn2pVs.disabled = true;
        
        // 若當前所選模式需要光線槍，重設為未選取，防止玩家硬闖
        if (typeof gameManager !== 'undefined' && gameManager.selectedMode && gameManager.selectedMode !== '1p-mouse') {
          gameManager.selectedMode = null;
          this.syncModeButtonsUI(null);
          const confirmBtn = document.getElementById('btn-mode-confirm');
          if (confirmBtn) confirmBtn.disabled = true;
        }
      } else if (count === 1) {
        btnMouse.disabled = false;
        btn1pGun.disabled = false;
        btn2pCoop.disabled = true;
        btn2pVs.disabled = true;
        
        // 若當前所選模式為雙人模式，重設為未選取
        if (typeof gameManager !== 'undefined' && gameManager.selectedMode && gameManager.selectedMode.startsWith('2p')) {
          gameManager.selectedMode = null;
          this.syncModeButtonsUI(null);
          const confirmBtn = document.getElementById('btn-mode-confirm');
          if (confirmBtn) confirmBtn.disabled = true;
        }
      } else {
        // 大於等於 2 支，全部模式解鎖
        btnMouse.disabled = false;
        btn1pGun.disabled = false;
        btn2pCoop.disabled = false;
        btn2pVs.disabled = false;
      }
    }
  }

  // 輔助函式：同步模式選擇按鈕的外觀選取狀態
  syncModeButtonsUI(activeMode) {
    const modes = ['1p-mouse', '1p-gun', '2p-coop', '2p-vs'];
    modes.forEach(m => {
      const btn = document.getElementById(`btn-mode-${m}`);
      if (btn) {
        if (m === activeMode) {
          btn.classList.add('btn-primary');
          btn.classList.remove('btn-gray');
        } else {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-gray');
        }
      }
    });
  }

  // 處理單個 Gamepad 的搖桿軸與按鍵
  processGamepadInput(playerNum, gp) {
    const key = playerNum === 1 ? 'p1' : 'p2';
    const calibration = this.calibration[key];

    // 1. 座標解析與映射 (相對於整個視窗 Viewport，與夜市射氣球.html 的作法一致)
    if (gp.axes && gp.axes.length >= 2) {
      const rawX = gp.axes[0];
      const rawY = gp.axes[1];

      // 只有在 axes 數值不為精確的 0 (防止出界/歸零彈回中心) 時才更新座標
      // 移除原有的 0.01 死區判定，避免螢幕正中央被誤判為出界死角
      if (rawX !== 0 || rawY !== 0) {
        // 使用校正邊界將 [-1.0, 1.0] 的 raw 數值轉換到 [0, 1] 比例
        const normX = (rawX - calibration.minX) / (calibration.maxX - calibration.minX);
        const normY = (rawY - calibration.minY) / (calibration.maxY - calibration.minY);
        
        const clampedX = Math.max(0, Math.min(1, normX));
        const clampedY = Math.max(0, Math.min(1, normY));

        // 映射到瀏覽器視窗 (Viewport) 的絕對 Client 畫素座標
        const clientX = clampedX * window.innerWidth;
        const clientY = clampedY * window.innerHeight;

        // 指數移動平均平滑濾波 (EMA Filter)
        const alpha = 0.35; // 平滑強度，越小越平滑，越大反應越快 (0.35 為黃金折衷值)
        
        if (playerNum === 1) {
          if (this.p1ClientX === undefined || isNaN(this.p1ClientX)) {
            this.p1ClientX = clientX;
            this.p1ClientY = clientY;
          } else {
            this.p1ClientX = this.p1ClientX + (clientX - this.p1ClientX) * alpha;
            this.p1ClientY = this.p1ClientY + (clientY - this.p1ClientY) * alpha;
          }
        } else {
          if (this.p2ClientX === undefined || isNaN(this.p2ClientX)) {
            this.p2ClientX = clientX;
            this.p2ClientY = clientY;
          } else {
            this.p2ClientX = this.p2ClientX + (clientX - this.p2ClientX) * alpha;
            this.p2ClientY = this.p2ClientY + (clientY - this.p2ClientY) * alpha;
          }
        }

        // 2. 將平滑化後的 Client 座標轉換成 Canvas 內部的邏輯座標 (1280x720) 供遊戲碰撞與繪製 Canvas 準星
        if (this.canvas) {
          const rect = this.canvas.getBoundingClientRect();
          
          // 算出 Canvas 的拉伸比例
          const scaleX = GAME_WIDTH / rect.width;
          const scaleY = GAME_HEIGHT / rect.height;
          
          const currentSmoothX = playerNum === 1 ? this.p1ClientX : this.p2ClientX;
          const currentSmoothY = playerNum === 1 ? this.p1ClientY : this.p2ClientY;

          // 將視窗座標轉換成 Canvas 邏輯座標
          const logicalX = (currentSmoothX - rect.left) * scaleX;
          const logicalY = (currentSmoothY - rect.top) * scaleY;

          if (playerNum === 1) {
            this.p1X = Math.max(0, Math.min(GAME_WIDTH, logicalX));
            this.p1Y = Math.max(0, Math.min(GAME_HEIGHT, logicalY));
          } else {
            this.p2X = Math.max(0, Math.min(GAME_WIDTH, logicalX));
            this.p2Y = Math.max(0, Math.min(GAME_HEIGHT, logicalY));
          }
        }
      }
    }

    // 2. 射擊按鍵邊緣觸發檢測
    if (gp.buttons && gp.buttons.length > 0) {
      const checkButtons = [0, 1, 2, 3];
      let pressedIndex = -1;
      
      for (const btnIdx of checkButtons) {
        if (gp.buttons[btnIdx] && gp.buttons[btnIdx].pressed) {
          pressedIndex = btnIdx;
          break;
        }
      }

      const prev = this.prevButtons[key];
      const currentPressed = pressedIndex !== -1;
      const wasPressed = prev.includes(pressedIndex);

      if (currentPressed && !wasPressed) {
        // 剛按下的瞬間
        const targetX = playerNum === 1 ? this.p1X : this.p2X;
        const targetY = playerNum === 1 ? this.p1Y : this.p2Y;
        const clientX = playerNum === 1 ? this.p1ClientX : this.p2ClientX;
        const clientY = playerNum === 1 ? this.p1ClientY : this.p2ClientY;

        // 如果是選單狀態 (非 PLAYING)，模擬網頁按鈕點擊
        if (typeof gameManager !== 'undefined' && gameManager.state !== 'PLAYING') {
          this.simulateMenuClick(clientX, clientY);
        } else {
          // 正常射擊
          if (this.onShootCallback && targetX !== undefined && targetY !== undefined) {
            this.onShootCallback(playerNum, targetX, targetY, 'gamepad');
          }
        }
      }

      // 儲存當前幀按下的所有按鍵
      this.prevButtons[key] = [];
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i] && gp.buttons[i].pressed) {
          this.prevButtons[key].push(i);
        }
      }
    }
  }

  // 模擬選單按鈕點擊 (直接使用視窗 Client 座標進行 Bounding Box 點擊判定)
  simulateMenuClick(clientX, clientY) {
    // 播放一次射擊音效，維持光線槍射擊回饋
    if (typeof audioManager !== 'undefined') {
      audioManager.playShoot();
    }
    
    // 獲取畫面上所有可能的點擊目標
    const clickables = document.querySelectorAll('button, .difficulty-card, .btn');
    
    for (let el of clickables) {
      // 安全且精確的隱藏元素判定 (包含祖先類別是否 hidden)
      const isHidden = el.offsetParent === null || el.classList.contains('hidden') || el.closest('.hidden') !== null;
      if (isHidden) continue;
      
      const rect = el.getBoundingClientRect();
      
      // 光槍輔助瞄準容差：對於寬或高較小的按鈕，給予外擴 15px 的射擊容差，以利精準命中
      let tolerance = 0;
      const isSmallBtn = rect.width < 80 || rect.height < 80 || el.classList.contains('btn-adjust');
      if (isSmallBtn) {
        tolerance = 15;
      }
      
      // 判定是否落在按鈕的矩形邊界內 (包含容差)
      if (clientX >= (rect.left - tolerance) && clientX <= (rect.right + tolerance) &&
          clientY >= (rect.top - tolerance) && clientY <= (rect.bottom + tolerance)) {
        console.log(`[光槍選單操作] 包圍盒判定擊中 (容差 ${tolerance}px):`, el.id || el.className);
        el.click();
        break; // 擊中一個元件即結束
      }
    }
  }

  // 將原始控制器軸座標映射到 Canvas 邏輯座標
  mapRawToLogical(rawX, rawY, calib) {
    // 依據校正所得的 min/max 區間做線性轉換
    const normX = (rawX - calib.minX) / (calib.maxX - calib.minX);
    const normY = (rawY - calib.minY) / (calib.maxY - calib.minY);

    // Clamp 在 0 ~ 1 之間
    const clampedX = Math.max(0, Math.min(1, normX));
    const clampedY = Math.max(0, Math.min(1, normY));

    return {
      x: clampedX * GAME_WIDTH,
      y: clampedY * GAME_HEIGHT
    };
  }


}

// 建立全域輸入管理器實例
const inputManager = new InputManager();
