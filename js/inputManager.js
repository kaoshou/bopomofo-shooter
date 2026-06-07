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

    // Webcam 體感狀態
    this.webcamX = GAME_WIDTH / 2;
    this.webcamY = GAME_HEIGHT / 2;
    this.isWebcamActive = false;
    this.webcamStarting = false; // 追蹤攝影機是否正在非同步啟動中
    this.hands = null;
    this.isPinching = false;
    this.webcamStream = null;

    // 雙人體感追蹤變數
    this.p1WebcamX = GAME_WIDTH / 2;
    this.p1WebcamY = GAME_HEIGHT / 2;
    this.p2WebcamX = GAME_WIDTH / 2;
    this.p2WebcamY = GAME_HEIGHT / 2;
    this.p1WebcamTargetX = GAME_WIDTH / 2;
    this.p1WebcamTargetY = GAME_HEIGHT / 2;
    this.p2WebcamTargetX = GAME_WIDTH / 2;
    this.p2WebcamTargetY = GAME_HEIGHT / 2;
    this.isPinchingP1 = false;
    this.isPinchingP2 = false;
    this.isWebcamP1Active = false;
    this.isWebcamP2Active = false;

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

    // Webcam 體感準星更新 (60 FPS 平滑插值)
    if (this.isWebcamActive) {
      const alpha = 0.25; // 60 FPS 下的平滑係數，能防手震並提供即時跟隨
      
      if (this.isWebcamP1Active) {
        this.p1WebcamX = this.p1WebcamX + (this.p1WebcamTargetX - this.p1WebcamX) * alpha;
        this.p1WebcamY = this.p1WebcamY + (this.p1WebcamTargetY - this.p1WebcamY) * alpha;
        this.p1WebcamX = Math.max(0, Math.min(GAME_WIDTH, this.p1WebcamX));
        this.p1WebcamY = Math.max(0, Math.min(GAME_HEIGHT, this.p1WebcamY));
        
        // 相容單人模式變數
        this.webcamX = this.p1WebcamX;
        this.webcamY = this.p1WebcamY;
      }
      
      if (this.isWebcamP2Active) {
        this.p2WebcamX = this.p2WebcamX + (this.p2WebcamTargetX - this.p2WebcamX) * alpha;
        this.p2WebcamY = this.p2WebcamY + (this.p2WebcamTargetY - this.p2WebcamY) * alpha;
        this.p2WebcamX = Math.max(0, Math.min(GAME_WIDTH, this.p2WebcamX));
        this.p2WebcamY = Math.max(0, Math.min(GAME_HEIGHT, this.p2WebcamY));
      }
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
    const btn2pCoopWebcam = document.getElementById('btn-mode-2p-coop-webcam');
    const btn2pVsWebcam = document.getElementById('btn-mode-2p-vs-webcam');
    
    if (btn2pCoopWebcam) btn2pCoopWebcam.disabled = false;
    if (btn2pVsWebcam) btn2pVsWebcam.disabled = false;
    
    if (btnMouse && btn1pGun && btn2pCoop && btn2pVs) {
      if (count === 0) {
        btnMouse.disabled = false;
        btn1pGun.disabled = true;
        btn2pCoop.disabled = true;
        btn2pVs.disabled = true;
        
        // 若當前所選模式需要光線槍，重設為未選取，防止玩家硬闖
        if (typeof gameManager !== 'undefined' && gameManager.selectedMode && 
            gameManager.selectedMode !== '1p-mouse' && 
            gameManager.selectedMode !== '1p-webcam' && 
            !gameManager.selectedMode.endsWith('-webcam')) {
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
        
        // 若當前所選模式為雙人光槍模式，重設為未選取 (雙人體感模式不用重設)
        if (typeof gameManager !== 'undefined' && gameManager.selectedMode && 
            gameManager.selectedMode.startsWith('2p') && 
            !gameManager.selectedMode.endsWith('-webcam')) {
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
    const modes = ['1p-mouse', '1p-gun', '1p-webcam', '2p-coop', '2p-vs', '2p-coop-webcam', '2p-vs-webcam'];
    modes.forEach(m => {
      const btn = document.getElementById(`btn-mode-${m}`);
      if (btn) {
        if (m === activeMode) {
          btn.classList.add('btn-primary');
          btn.classList.remove('btn-gray', 'btn-accent');
        } else {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-gray'); // 沒選中通通是灰色
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
        const alpha = typeof gameSettings !== 'undefined' ? gameSettings.gunSmoothing : 0.35;
        
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

  // 啟動 Webcam 與手勢偵測
  async startWebcam() {
    if (this.isWebcamActive || this.webcamStarting) return;

    this.webcamStarting = true; // 標記正在啟動中，防範 Race Condition
    this.isWebcamReady = false; // 重置就緒狀態
    const container = document.getElementById('webcam-container');
    const statusDiv = document.getElementById('webcam-status');
    const video = document.getElementById('webcam-video');
    const confirmBtn = document.getElementById('btn-mode-confirm');

    if (container) container.classList.remove('hidden');
    if (statusDiv) statusDiv.textContent = '載入體感引擎...';

    // 模式選擇確認按鈕置為等待狀態
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>📷 載入體感中...`;
    }

    try {
      // 1. 取得使用者攝影機權限與串流
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: { ideal: 30 } },
        audio: false
      });

      // 檢查在 await 的非同步空檔中，使用者是否已返回或呼叫了 stopWebcam()
      if (!this.webcamStarting) {
        stream.getTracks().forEach(track => track.stop());
        console.log('在獲取相機串流後檢測到停止請求，已釋放該相機資源。');
        return;
      }

      this.webcamStream = stream;
      video.srcObject = this.webcamStream;
      video.play();

      // 權限已獲取，更新按鈕提示請伸出手掌
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v4"></path>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>✋ 請在鏡頭前伸出手掌...`;
      }

      // 2. 初始化 MediaPipe Hands 體感識別引擎 (開源手勢追蹤技術，來源：Google MediaPipe Hands)
      // 原因用途：藉由追蹤手掌中心控制準星，並利用握拳/抓取 (Fist Grab) 動作實現免硬體光線槍的體感射擊與點擊。
      if (!this.hands) {
        this.hands = new Hands({
          locateFile: (file) => {
            // 如果是透過本地 file:// 協定直接點開網頁，CORS 會阻擋讀取本地模型檔，此時自動切換至 CDN 來源（CDN 支援跨域 * 標頭）
            if (window.location.protocol === 'file:') {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
            // 否則（如 http://localhost 本地伺服器或 GitHub Pages）使用本地離線模型，以支援完全離線遊玩
            return `js/lib/mediapipe/${file}`;
          }
        });

        this.hands.onResults((results) => this.onHandResults(results));
      }

      const isDouble = typeof gameManager !== 'undefined' && gameManager.selectedMode && gameManager.selectedMode.startsWith('2p');
      this.hands.setOptions({
        maxNumHands: isDouble ? 2 : 1,
        modelComplexity: 0, // 降低模型複雜度以顯著提高執行效能，減少體感模式下的 CPU 消耗與延遲
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      // 再次檢查在初始化模型期間是否呼叫了 stopWebcam()
      if (!this.webcamStarting) {
        if (this.webcamStream) {
          this.webcamStream.getTracks().forEach(track => track.stop());
          this.webcamStream = null;
        }
        video.srcObject = null;
        console.log('在初始化體感引擎後檢測到停止請求，已關閉相機。');
        return;
      }
      
      this.isWebcamActive = true;
      this.webcamStarting = false; // 啟動完成
      
      // 啟動自主偵測循環
      this.tickWebcam();
      
      console.log('Webcam 體感模式已啟動');
    } catch (err) {
      this.webcamStarting = false;
      console.error('無法啟動攝影機: ', err);
      if (statusDiv) statusDiv.textContent = '相機啟動失敗';
      // 權限被拒或啟動出錯，更新按鈕提示
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>❌ 相機啟動失敗 (請授權)`;
      }
    }
  }

  // 關閉 Webcam，釋放資源
  stopWebcam() {
    this.webcamStarting = false; // 取消進行中的啟動
    this.isWebcamActive = false;
    this.isPinching = false;
    this.isPinchingP1 = false;
    this.isPinchingP2 = false;
    this.isWebcamP1Active = false;
    this.isWebcamP2Active = false;
    this.isWebcamReady = false; // 重置就緒狀態

    // 關閉影像軌道以關閉鏡頭硬體
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }

    const video = document.getElementById('webcam-video');
    if (video) {
      video.srcObject = null;
    }

    // 隱藏預覽容器並重設狀態
    const container = document.getElementById('webcam-container');
    if (container) {
      container.classList.add('hidden');
      container.classList.remove('shooting');
    }

    // 清除預覽 Canvas
    const canvas = document.getElementById('webcam-preview-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    console.log('Webcam 體感模式已停止並釋放相機資源');
  }

  // 自主讀取影格並發送至 MediaPipe 偵測之循環
  async tickWebcam() {
    if (!this.isWebcamActive) return;

    const video = document.getElementById('webcam-video');
    
    // readyState >= 3 代表 HAVE_FUTURE_DATA（影片有影格可播放且正常進行）
    if (video && !video.paused && video.readyState >= 3) {
      if (this.hands) {
        try {
          // 等待當前影格偵測完畢，才進行下一影格，防止背景隊列堆積 Lag (與官方 Camera 類別機制一致)
          await this.hands.send({ image: video });
        } catch (err) {
          console.error("MediaPipe 偵測出錯:", err);
        }
      }
    }

    // 再次確認 active，排程下一影格
    if (this.isWebcamActive) {
      requestAnimationFrame(() => this.tickWebcam());
    }
  }

  // 處理 MediaPipe 傳回的手勢偵測結果
  onHandResults(results) {
    if (!this.isWebcamActive) return;

    const canvas = document.getElementById('webcam-preview-canvas');
    const statusDiv = document.getElementById('webcam-status');
    const container = document.getElementById('webcam-container');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 1. 清除畫布並繪製目前的鏡頭影像
    ctx.clearRect(0, 0, width, height);
    if (results.image) {
      ctx.drawImage(results.image, 0, 0, width, height);
    }

    const isDoubleMode = typeof gameManager !== 'undefined' && gameManager.selectedMode && gameManager.selectedMode.startsWith('2p');

    // 2. 檢查是否偵測到手部
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      if (statusDiv) {
        statusDiv.textContent = `已連結體感 (${results.multiHandLandmarks.length}人)`;
      }
      
      // 當偵測到手掌時，若體感尚未就緒，將確認按鈕重設為就緒狀態並啟用
      if (!this.isWebcamReady) {
        this.isWebcamReady = true;
        const confirmBtn = document.getElementById('btn-mode-confirm');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24">
            <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline>
            <line x1="13" y1="19" x2="19" y2="13"></line>
            <line x1="16" y1="16" x2="20" y2="20"></line>
            <line x1="19" y1="21" x2="21" y2="19"></line>
          </svg>開始挑戰`;
        }
      }

      // 3D 空間距離輔助函數
      const dist3D = (p1, p2) => {
        return Math.sqrt(
          Math.pow(p1.x - p2.x, 2) +
          Math.pow(p1.y - p2.y, 2) +
          Math.pow(p1.z - p2.z, 2)
        );
      };

      // 解析所有偵測到的手部資料
      const detectedHands = [];
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const wrist = landmarks[0];
        const middleMcp = landmarks[9];

        const palmLength = dist3D(wrist, middleMcp);
        const palmX = (wrist.x + middleMcp.x) / 2;
        const palmY = (wrist.y + middleMcp.y) / 2;

        // 水平翻轉以提供鏡像體驗，並轉換為遊戲邏輯座標 (1280x720)
        const rawX = (1 - palmX) * GAME_WIDTH;
        const rawY = palmY * GAME_HEIGHT;

        // 偵測食指、中指、無名指、小指是否收攏進掌心 (握拳抓取)
        const dist8 = dist3D(landmarks[8], wrist) / palmLength;
        const dist12 = dist3D(landmarks[12], wrist) / palmLength;
        const dist16 = dist3D(landmarks[16], wrist) / palmLength;
        const dist20 = dist3D(landmarks[20], wrist) / palmLength;

        let curledCount = 0;
        if (dist8 < 1.15) curledCount++;
        if (dist12 < 1.15) curledCount++;
        if (dist16 < 1.15) curledCount++;
        if (dist20 < 1.15) curledCount++;

        const isGrabNow = curledCount >= 3;

        detectedHands.push({
          rawX,
          rawY,
          isGrabNow,
          landmarks
        });
      }

      // 將手部分配給 P1 與 P2
      let p1Hand = null;
      let p2Hand = null;

      if (detectedHands.length === 2) {
        if (isDoubleMode) {
          // 偵測到兩隻手，先以 X 座標區分左右
          let leftHand = detectedHands[0].rawX < detectedHands[1].rawX ? detectedHands[0] : detectedHands[1];
          let rightHand = detectedHands[0].rawX < detectedHands[1].rawX ? detectedHands[1] : detectedHands[0];
          
          // 若雙方前一幀都活躍，使用歐式距離來匹配，避免因為手部短暫交叉或雜訊導致 P1/P2 瞬間互換
          if (this.isWebcamP1Active && this.isWebcamP2Active) {
            const costNormal = Math.hypot(leftHand.rawX - this.p1WebcamX, leftHand.rawY - this.p1WebcamY) +
                               Math.hypot(rightHand.rawX - this.p2WebcamX, rightHand.rawY - this.p2WebcamY);
            const costSwapped = Math.hypot(rightHand.rawX - this.p1WebcamX, rightHand.rawY - this.p1WebcamY) +
                                Math.hypot(leftHand.rawX - this.p2WebcamX, leftHand.rawY - this.p2WebcamY);
            
            if (costSwapped < costNormal) {
              p1Hand = rightHand;
              p2Hand = leftHand;
            } else {
              p1Hand = leftHand;
              p2Hand = rightHand;
            }
          } else {
            p1Hand = leftHand;
            p2Hand = rightHand;
          }
        } else {
          // 單人模式，只取第一隻手
          p1Hand = detectedHands[0];
        }
      } else if (detectedHands.length === 1) {
        const hand = detectedHands[0];
        if (isDoubleMode) {
          // 混合 Tracking 演算法：優先考量上一幀的距離，若無上一幀或距離過遠，再以中線劃分
          const distP1 = Math.hypot(hand.rawX - this.p1WebcamX, hand.rawY - this.p1WebcamY);
          const distP2 = Math.hypot(hand.rawX - this.p2WebcamX, hand.rawY - this.p2WebcamY);
          
          const P1_ACTIVE = this.isWebcamP1Active;
          const P2_ACTIVE = this.isWebcamP2Active;

          if (P1_ACTIVE && P2_ACTIVE) {
            if (distP1 < distP2) p1Hand = hand;
            else p2Hand = hand;
          } else if (P1_ACTIVE && !P2_ACTIVE) {
            // 如果只有 P1 活躍，但這隻手突然出現在畫面極右側且距離 P1 很遠，這可能是 P2 剛把手舉起來
            if (hand.rawX > GAME_WIDTH * 0.6 && distP1 > GAME_WIDTH * 0.3) {
              p2Hand = hand;
            } else {
              p1Hand = hand;
            }
          } else if (!P1_ACTIVE && P2_ACTIVE) {
            // 如果只有 P2 活躍，但這隻手突然出現在畫面極左側且距離 P2 很遠，這可能是 P1 剛把手舉起來
            if (hand.rawX < GAME_WIDTH * 0.4 && distP2 > GAME_WIDTH * 0.3) {
              p1Hand = hand;
            } else {
              p2Hand = hand;
            }
          } else {
            // 兩者皆不活躍，直接用中線劃分
            if (hand.rawX < GAME_WIDTH * 0.5) p1Hand = hand;
            else p2Hand = hand;
          }
        } else {
          // 單人模式，一律歸為 P1
          p1Hand = hand;
        }
      }

      // 3. 更新 P1 狀態
      if (p1Hand) {
        this.isWebcamP1Active = true;
        this.p1WebcamTargetX = Math.max(0, Math.min(GAME_WIDTH, p1Hand.rawX));
        this.p1WebcamTargetY = Math.max(0, Math.min(GAME_HEIGHT, p1Hand.rawY));

        if (p1Hand.isGrabNow) {
          if (!this.isPinchingP1) {
            this.isPinchingP1 = true;
            this.triggerWebcamShoot(1, this.p1WebcamX, this.p1WebcamY);
          }
        } else {
          this.isPinchingP1 = false;
        }
        this.isPinching = this.isPinchingP1;
      } else {
        this.isWebcamP1Active = false;
        this.isPinchingP1 = false;
      }

      // 4. 更新 P2 狀態
      if (p2Hand && isDoubleMode) {
        this.isWebcamP2Active = true;
        this.p2WebcamTargetX = Math.max(0, Math.min(GAME_WIDTH, p2Hand.rawX));
        this.p2WebcamTargetY = Math.max(0, Math.min(GAME_HEIGHT, p2Hand.rawY));

        if (p2Hand.isGrabNow) {
          if (!this.isPinchingP2) {
            this.isPinchingP2 = true;
            this.triggerWebcamShoot(2, this.p2WebcamX, this.p2WebcamY);
          }
        } else {
          this.isPinchingP2 = false;
        }
      } else {
        this.isWebcamP2Active = false;
        this.isPinchingP2 = false;
      }

      // 更新 Webcam 容器的射擊發光效果
      const isAnyPinching = this.isPinchingP1 || this.isPinchingP2;
      if (isAnyPinching) {
        if (container) container.classList.add('shooting');
      } else {
        if (container) container.classList.remove('shooting');
      }

      // 5. 繪製骨架與瞄準器
      if (p1Hand) {
        this.drawSkeleton(ctx, p1Hand.landmarks, width, height, this.isPinchingP1, 1);
      }
      if (p2Hand && isDoubleMode) {
        this.drawSkeleton(ctx, p2Hand.landmarks, width, height, this.isPinchingP2, 2);
      }

    } else {
      if (statusDiv) statusDiv.textContent = isDoubleMode ? '請伸出雙手' : '請伸出手掌';
      if (container) container.classList.remove('shooting');
      this.isPinching = false;
      this.isPinchingP1 = false;
      this.isPinchingP2 = false;
      this.isWebcamP1Active = false;
      this.isWebcamP2Active = false;
    }
  }

  // 抽離的 Webcam 射擊觸發方法，整合選單模擬點擊與遊戲射擊
  triggerWebcamShoot(playerNum, webcamX, webcamY) {
    if (typeof gameManager !== 'undefined' && gameManager.state !== 'PLAYING') {
      if (this.canvas) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = rect.left + (webcamX / GAME_WIDTH) * rect.width;
        const clientY = rect.top + (webcamY / GAME_HEIGHT) * rect.height;
        this.simulateMenuClick(clientX, clientY);
      }
    } else {
      if (this.onShootCallback) {
        this.onShootCallback(playerNum, webcamX, webcamY, 'webcam');
      }
    }
  }

  // 繪製手部骨架與手掌中心準星在預覽 Canvas 上
  drawSkeleton(ctx, landmarks, width, height, isPinching, playerNum = 1) {
    const pColor = playerNum === 1 ? '#3b82f6' : '#ef4444'; // 1P 藍色, 2P 紅色
    const pFill = playerNum === 1 ? '#60a5fa' : '#f87171';

    ctx.strokeStyle = isPinching ? '#f87171' : pColor;
    ctx.lineWidth = 3;
    ctx.fillStyle = isPinching ? '#ef4444' : pFill;

    // 21 個關節點的骨架連接定義
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // 大拇指
      [0, 5], [5, 6], [6, 7], [7, 8],       // 食指
      [5, 9], [9, 10], [10, 11], [11, 12],  // 中指
      [9, 13], [13, 14], [14, 15], [15, 16],// 無名指
      [13, 17], [17, 18], [18, 19], [19, 20],// 小指
      [0, 17]                               // 手掌底
    ];

    // 繪製關節線
    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    // 繪製關節點
    for (let i = 0; i < landmarks.length; i++) {
      const p = landmarks[i];
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 繪製手掌中心 (準星定位點) 的十字瞄準標記 (提供更具回饋的科技感 UI)
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const palmX = ((wrist.x + middleMcp.x) / 2) * width;
    const palmY = ((wrist.y + middleMcp.y) / 2) * height;

    ctx.save();
    ctx.strokeStyle = isPinching ? '#ef4444' : '#facc15';
    ctx.lineWidth = 2;
    // 畫中心瞄準圓環
    ctx.beginPath();
    ctx.arc(palmX, palmY, 8, 0, 2 * Math.PI);
    ctx.stroke();
    // 畫十字線
    ctx.beginPath();
    ctx.moveTo(palmX - 12, palmY);
    ctx.lineTo(palmX + 12, palmY);
    ctx.moveTo(palmX, palmY - 12);
    ctx.lineTo(palmX, palmY + 12);
    ctx.stroke();

    // 繪製 "1P" 或 "2P" 標籤
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Fredoka';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${playerNum}P`, palmX, palmY - 14);

    ctx.restore();
  }
}

// 建立全域輸入管理器實例
const inputManager = new InputManager();
