// GameManager - 遊戲核心控制器，負責狀態機、遊戲循環、出題與碰撞判定

class GameManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = 'HOME'; // HOME, MODE_SELECT, TUTORIAL, CALIBRATION, PLAYING, PAUSED, RESULT
    
    // 遊戲大類與參數 ('zhuyin': 注音聽音挑戰, 'arcade': 夜市射氣球)
    this.gameCategory = 'zhuyin';
    this.selectedMode = null; // 預設設為 null (未選取)，要求玩家手動選擇
    this.selectedDiff = 'easy'; // easy, medium, hard, boss
    this.lives = 5;
    this.maxLives = 5;
    this.timeRemaining = 60;
    this.timerInterval = null;
    
    // 實體
    this.p1 = new Player(1, '#3b82f6', 'mouse'); // 藍色準星
    this.p2 = new Player(2, '#ef4444', 'gamepad'); // 紅色準星
    this.balloons = [];
    
    // 題目資訊 (注音模式)
    this.targetChar = ''; // 目前要射擊的注音字元
    this.lastSpawnTime = 0;
    this.lastVoicePlayTime = 0; // 記錄上次語音播放的時間
    this.isGameOverTriggered = false;

    // 夜市射氣球模式統計與生成計時
    this.arcadeBalloonsPopped = 0;
    this.arcadeGoldPopped = 0;
    this.arcadeTimePopped = 0;
    this.arcadeBombsHit = 0;
    this.lastArcadeSpawnTime = 0;

    // Boss 關卡資訊
    this.bossHp = 15;
    this.bossMaxHp = 15;

    // 精進功能屬性
    this.flashDuration = 0;
    this.mistakes = [];
    this.p1FlashAlpha = 0;
    this.p2FlashAlpha = 0;
    this.vsTexts = [];
    this.bgCanvas = null; // 離屏黑板背景快取
    
    // 時間增量更新 (Delta Time) 變數
    this.lastFrameTime = 0;
  }

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // 預先渲染靜態黑板背景快取，大幅提升每幀繪圖效能並強化視覺細節
    this.initBlackboardCache();

    // 初始化輸入管理器
    inputManager.init(this.canvas);
    
    // 註冊輸入管理器的射擊回呼
    inputManager.onShoot((playerNum, x, y, inputType) => this.handleShoot(playerNum, x, y, inputType));
    
    // 開始遊戲循環
    this.loop();
  }

  // 切換遊戲玩法分類 ('zhuyin' | 'arcade') 並同步更新選單介面文字
  setGameCategory(category) {
    this.gameCategory = category === 'arcade' ? 'arcade' : 'zhuyin';

    const btnZhuyin = document.getElementById('btn-cat-zhuyin');
    const btnArcade = document.getElementById('btn-cat-arcade');
    const titleEl = document.getElementById('mode-select-title');

    if (btnZhuyin && btnArcade) {
      if (this.gameCategory === 'arcade') {
        btnArcade.classList.add('btn-accent');
        btnArcade.classList.remove('btn-gray', 'btn-primary');
        btnZhuyin.classList.add('btn-gray');
        btnZhuyin.classList.remove('btn-primary', 'btn-accent');
      } else {
        btnZhuyin.classList.add('btn-primary');
        btnZhuyin.classList.remove('btn-gray', 'btn-accent');
        btnArcade.classList.add('btn-gray');
        btnArcade.classList.remove('btn-primary', 'btn-accent');
      }
    }

    if (titleEl) {
      titleEl.textContent = this.gameCategory === 'arcade'
        ? '選擇模式與難度 — 🎈 夜市射氣球'
        : '選擇模式與難度 — 🎯 注音聽音挑戰';
    }

    // 動態更新 4 張難度卡片的標題與描述
    const zhuyinDescriptions = {
      easy: '只出現常見 8 個符號，掉落速度慢，干擾少。適合初學者。',
      medium: '加入更多符號，掉落速度加快，干擾氣球變多。',
      hard: '包含所有 37 個注音，速度極快，氣球晃動，多重干擾。',
      boss: '限時連續聽音！魔王會不斷丟出氣球，快速射擊來削減魔王血量！'
    };

    ['easy', 'medium', 'hard', 'boss'].forEach(diff => {
      const nameEl = document.getElementById(`diff-name-${diff}`);
      const descEl = document.getElementById(`diff-desc-${diff}`);
      if (this.gameCategory === 'arcade' && typeof ARCADE_DIFFICULTY_CONFIG !== 'undefined') {
        const cfg = ARCADE_DIFFICULTY_CONFIG[diff];
        if (nameEl && cfg) nameEl.textContent = cfg.name;
        if (descEl && cfg) descEl.textContent = cfg.desc;
      } else if (typeof DIFFICULTY_CONFIG !== 'undefined') {
        const cfg = DIFFICULTY_CONFIG[diff];
        if (nameEl && cfg) nameEl.textContent = cfg.name;
        if (descEl) descEl.textContent = zhuyinDescriptions[diff] || '';
      }
    });
  }

  // 遊戲狀態機切換
  changeState(newState) {
    console.log(`狀態切換: ${this.state} -> ${newState}`);
    
    // 切換回首頁或非體感相關場景時，自動關閉鏡頭以維護隱私與效能
    if (newState === 'HOME' || newState === 'LICENSE' || newState === 'TUTORIAL' || newState === 'SETTINGS') {
      if (typeof inputManager !== 'undefined') {
        inputManager.stopWebcam();
      }
    }
    
    // 隱藏舊場景 DOM
    this.getSceneElement(this.state)?.classList.add('hidden');
    this.state = newState;
    
    // 顯示新場景 DOM
    this.getSceneElement(newState)?.classList.remove('hidden');

    // 狀態特定初始化
    if (newState === 'PLAYING') {
      document.getElementById('hud-overlay').classList.remove('hidden');
      this.startGameplay();
      if (typeof audioManager !== 'undefined') {
        audioManager.startBGM();
      }
    } else {
      // 非遊玩中隱藏 HUD Overlay (除了 PAUSED 狀態要留著 HUD)
      if (newState !== 'PAUSED') {
        document.getElementById('hud-overlay').classList.add('hidden');
        clearInterval(this.timerInterval);
        if (typeof audioManager !== 'undefined') {
          audioManager.stopBGM();
        }
      }
    }

    if (newState === 'MODE_SELECT') {
      this.selectedMode = null;
      this.setGameCategory(this.gameCategory);
      // 重置模式按鈕樣式與開始挑戰按鈕的狀態
      if (typeof inputManager !== 'undefined') {
        inputManager.syncModeButtonsUI(null);
      }
      const confirmBtn = document.getElementById('btn-mode-confirm');
      if (confirmBtn) confirmBtn.disabled = true;

      // 重置為 1P 分類顯示，避免上次選單殘留
      const btnType1p = document.getElementById('btn-player-type-1p');
      const btnType2p = document.getElementById('btn-player-type-2p');
      const container1p = document.getElementById('mode-1p-container');
      const container2p = document.getElementById('mode-2p-container');
      if (btnType1p && btnType2p && container1p && container2p) {
        btnType1p.classList.add('btn-primary');
        btnType1p.classList.remove('btn-gray');
        btnType2p.classList.add('btn-gray');
        btnType2p.classList.remove('btn-primary');
        
        container1p.style.display = 'flex';
        container2p.classList.add('hidden');
        container2p.style.display = 'none';
      }
    }

    if (newState === 'RESULT') {
      this.populateResults();
    }
  }

  getSceneElement(state) {
    switch (state) {
      case 'HOME': return document.getElementById('home-scene');
      case 'MODE_SELECT': return document.getElementById('mode-select-scene');
      case 'TUTORIAL': return document.getElementById('tutorial-scene');
      case 'LICENSE': return document.getElementById('license-scene');
      case 'SETTINGS': return document.getElementById('settings-scene');
      case 'PAUSED': return document.getElementById('pause-scene');
      case 'RESULT': return document.getElementById('result-scene');
      default: return null;
    }
  }

  // 初始化遊戲開始
  startGameplay() {
    this.isGameOverTriggered = false;
    particleSystem.reset();
    this.mistakes = [];
    this.p1FlashAlpha = 0;
    this.p2FlashAlpha = 0;
    this.vsTexts = [];
    this.arcadeBalloonsPopped = 0;
    this.arcadeGoldPopped = 0;
    this.arcadeTimePopped = 0;
    this.arcadeBombsHit = 0;
    
    const isArcade = this.gameCategory === 'arcade';
    const config = isArcade ? ARCADE_DIFFICULTY_CONFIG[this.selectedDiff] : DIFFICULTY_CONFIG[this.selectedDiff];
    this.lives = config.lives;
    this.maxLives = config.lives;
    this.timeRemaining = (typeof gameSettings !== 'undefined' && gameSettings.gameTime) ? gameSettings.gameTime : config.timeLimit;
    
    // Boss 關血量 (僅注音模式使用)
    if (!isArcade && this.selectedDiff === 'boss') {
      this.bossHp = config.bossHp;
      this.bossMaxHp = config.bossHp;
    }

    // 根據遊戲類別切換 HUD 中央顯示與重聽發音按鈕
    const hudQuestionLabel = document.getElementById('hud-question-label');
    const btnReplayAudio = document.getElementById('btn-replay-audio');
    if (isArcade) {
      if (btnReplayAudio) btnReplayAudio.classList.add('hidden');
      if (hudQuestionLabel) {
        const shortTitle = config.name.split(' ')[0];
        hudQuestionLabel.innerHTML = `<span style="color: #fef08a;">🎈 ${shortTitle}</span>｜擊破: <span id="question-char" style="color: #4ade80; font-weight: 900;">0</span>`;
      }
    } else {
      if (btnReplayAudio) btnReplayAudio.classList.remove('hidden');
      if (hudQuestionLabel) {
        hudQuestionLabel.innerHTML = `目標發音: <span id="question-char" style="color: var(--color-accent-yellow); font-weight: 900;">？</span>`;
      }
    }

    // 重設玩家
    this.p1.reset();
    this.p1.inputType = this.selectedMode === '1p-mouse' ? 'mouse' : ((this.selectedMode === '1p-webcam' || this.selectedMode.endsWith('-webcam')) ? 'webcam' : 'gamepad');
    
    this.p2.reset();
    
    // 依據模式顯示 2P HUD
    const p2Panel = document.getElementById('hud-p2-panel');
    if (this.selectedMode.startsWith('2p')) {
      p2Panel.classList.remove('hidden');
      this.p2.inputType = this.selectedMode.endsWith('-webcam') ? 'webcam' : 'gamepad';
    } else {
      p2Panel.classList.add('hidden');
    }

    this.balloons = [];
    this.updateHUD();
    
    // 啟動倒數計時器
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state === 'PLAYING') {
        this.timeRemaining--;
        this.updateHUD();
        
        if (this.timeRemaining <= 10 && this.timeRemaining > 0) {
          audioManager.playCountdownTick(this.timeRemaining <= 3);
        }

        if (this.timeRemaining <= 0) {
          this.endGame(true); // 時間到
        }
      }
    }, 1000);

    // 確保 AudioContext 已啟動
    audioManager.initAudioContext();

    if (isArcade) {
      // 夜市射氣球模式：立即生成第一波氣球
      this.spawnInitialArcadeWave();
      this.lastArcadeSpawnTime = performance.now();
    } else {
      // 注音聽音挑戰：開始出題
      setTimeout(() => this.nextQuestion(), 500);
    }
  }

  // 夜市射氣球模式：開局預先生出第一波氣球
  spawnInitialArcadeWave() {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const initY = GAME_HEIGHT + 20 + i * 55;
      this.spawnArcadeBalloon(initY, i === 0); // 第一顆保證為一般氣球
    }
  }

  // 夜市射氣球模式：連續生成單顆氣球或炸彈 (由底部往上飄升)
  spawnArcadeBalloon(initialY = null, forceNormal = false) {
    if (this.state !== 'PLAYING' || this.gameCategory !== 'arcade') return;

    const config = ARCADE_DIFFICULTY_CONFIG[this.selectedDiff];
    const activeCount = this.balloons.filter(b => b.active && !b.isPopping).length;
    if (activeCount >= config.maxBalloons) return;

    // 決定標靶種類 ('normal' | 'gold' | 'time' | 'bomb')
    let arcadeType = 'normal';
    if (!forceNormal) {
      const activeBombs = this.balloons.filter(b => b.active && !b.isPopping && b.arcadeType === 'bomb').length;
      const maxAllowedBombs = Math.ceil(config.maxBalloons * 0.42);
      const roll = Math.random();

      if (roll < config.bombChance && activeBombs < maxAllowedBombs) {
        arcadeType = 'bomb';
      } else if (roll < config.bombChance + config.goldChance) {
        arcadeType = 'gold';
      } else if (roll < config.bombChance + config.goldChance + config.timeChance) {
        arcadeType = 'time';
      }
    }

    // 決定尺寸與飄升速度
    let speedScale = typeof gameSettings !== 'undefined' ? gameSettings.speedScale : 1.0;
    // 最後 20 秒加速製造緊張高潮
    const timeBoost = this.timeRemaining <= 15 ? 1.22 : (this.timeRemaining <= 30 ? 1.1 : 1.0);
    const baseSpeed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);

    let radius = 48;
    let speed = baseSpeed * speedScale * timeBoost;

    if (arcadeType === 'gold') {
      radius = 36; // 黃金氣球較小顆、飛得特別快
      speed *= 1.35;
    } else if (arcadeType === 'time') {
      radius = 44;
      speed *= 1.12;
    } else if (arcadeType === 'bomb') {
      radius = 45;
      speed *= 0.96;
    } else {
      radius = 46 + Math.floor(Math.random() * 7);
    }

    // 挑選不易與底部剛生成的氣球重疊的 X 座標
    let x = 100 + Math.random() * (GAME_WIDTH - 200);
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidateX = 95 + Math.random() * (GAME_WIDTH - 190);
      const tooClose = this.balloons.some(b => b.active && b.y > GAME_HEIGHT - 160 && Math.abs(b.x - candidateX) < 105);
      if (!tooClose) {
        x = candidateX;
        break;
      }
    }

    const y = initialY !== null ? initialY : (GAME_HEIGHT + radius + 15 + Math.random() * 35);
    const isTarget = arcadeType !== 'bomb';

    this.balloons.push(new Balloon('', x, y, radius, speed, isTarget, this.selectedDiff, arcadeType));
  }

  // 產生下一題 (注音聽音模式)
  nextQuestion() {
    if (this.state !== 'PLAYING' || this.gameCategory !== 'zhuyin') return;

    const config = DIFFICULTY_CONFIG[this.selectedDiff];
    
    // 1. 決定正確答案 (從難度允許的名單中隨機挑選)
    const allowed = config.allowedSymbols;
    this.targetChar = allowed[Math.floor(Math.random() * allowed.length)];
    
    // 更新 HUD 題目顯示 (強制設為 ？ 以防視覺透題，進行純聽音訓練)
    const qChar = document.getElementById('question-char');
    if (qChar) {
      qChar.textContent = '？';
      qChar.style.color = '#ffffff';
    }
    
    // 2. 播放注音發音
    audioManager.playZhuyin(this.targetChar);
    this.lastVoicePlayTime = Date.now();

    // 3. 清空舊有氣球，準備產生新氣球
    this.balloons = [];

    // 4. 決定干擾字
    const distractors = [];
    const availableDistractors = allowed.filter(char => char !== this.targetChar);
    const balloonCount = config.balloonCount;
    while (distractors.length < balloonCount - 1 && availableDistractors.length > 0) {
      const idx = Math.floor(Math.random() * availableDistractors.length);
      distractors.push(availableDistractors[idx]);
      availableDistractors.splice(idx, 1); // 避免重複干擾字
    }

    // 5. 產生氣球 (正確答案隨機排在其中一個位置)
    const allChars = [this.targetChar, ...distractors];
    // 隨機打亂
    allChars.sort(() => Math.random() - 0.5);

    // 為了防止氣球重疊，將 Canvas 寬度切分為多個欄位 (Columns)
    const cols = allChars.length;
    const colWidth = GAME_WIDTH / cols;

    allChars.forEach((char, index) => {
      // 每個氣球分配在一個 Column 的中心區域，加上一點隨機偏移
      const minX = index * colWidth + 60;
      const maxX = (index + 1) * colWidth - 60;
      const x = minX + Math.random() * (maxX - minX);
      
      // Y 軸起點在上方，隨機交錯高度以利視覺層次
      const y = -80 - Math.random() * 120;
      
      // 隨機速度 (乘上配置設定的掉落速度倍率)
      const baseSpeed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      let speedScale = typeof gameSettings !== 'undefined' ? gameSettings.speedScale : 1.0;

      const speed = baseSpeed * speedScale;
      const isCorrect = (char === this.targetChar);
      const radius = 50; // 氣球半徑
      
      this.balloons.push(new Balloon(char, x, y, radius, speed, isCorrect, this.selectedDiff));
    });

    this.lastSpawnTime = Date.now();
  }

  // 處理射擊判定
  handleShoot(playerNum, x, y, inputType) {
    if (this.state !== 'PLAYING') return;

    // 防止玩家輸入與設定的模式不符 (例如 1P 滑鼠模式不處理 Gamepad 射擊，反之亦然)
    if (this.selectedMode === '1p-mouse' && inputType !== 'mouse') return;
    if (this.selectedMode === '1p-gun' && inputType !== 'gamepad') return;
    if (this.selectedMode === '1p-webcam' && inputType !== 'webcam') return;
    if (this.selectedMode.endsWith('-webcam') && inputType !== 'webcam') return;
    if (this.selectedMode.startsWith('2p') && !this.selectedMode.endsWith('-webcam') && inputType !== 'gamepad') return;

    const shooter = playerNum === 1 ? this.p1 : this.p2;

    // 增加射擊冷卻防抖判定 (250ms)，防範 Gamepad 按鍵抖動或 Webcam 手勢雜訊重複觸發射擊
    const now = Date.now();
    if (now - shooter.lastShotTime < 250) {
      console.log(`[射擊防抖] 忽略玩家 ${playerNum} 的重複射擊訊號 (間隔: ${now - shooter.lastShotTime}ms)`);
      return;
    }

    shooter.triggerShoot();
    audioManager.playShoot();

    const isCoop = this.selectedMode && this.selectedMode.includes('coop');
    const isVs = this.selectedMode && this.selectedMode.includes('vs');

    // 分流：夜市射氣球模式碰撞與獎懲判定
    if (this.gameCategory === 'arcade') {
      this.handleArcadeShootHit(playerNum, shooter, x, y, isCoop, isVs);
      return;
    }

    // 從後往前檢查氣球，確保先擊中最上層的 (注音聽音模式)
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.active && b.checkCollision(x, y)) {
        b.isPopping = true; // 觸發氣球爆裂動效
        this.flashDuration = 2; // 畫面閃光 2 幀
        
        // 產生爆裂粒子與震波特效 (區分正確/錯誤視覺)
        particleSystem.spawnExplosion(b.x, b.y, b.color, b.isCorrect ? 26 : 16, b.isCorrect);

        if (b.isCorrect) {
          // 擊中正確注音！
          shooter.shotsHit++;
          if (isCoop) {
            // 雙人合作模式：雙方共享 Combo 連擊與分數
            this.p1.addCombo();
            this.p2.addCombo();
          } else {
            shooter.addCombo();
          }
          
          const points = 100 + shooter.combo * 10;
          
          if (isCoop) {
            this.p1.score += points;
            this.p2.score += points;
          } else {
            shooter.score += points;
          }

          // 擊中得分與連擊動態飄字回饋
          if (isVs) {
            if (playerNum === 1) {
              this.p1FlashAlpha = 0.45;
            } else {
              this.p2FlashAlpha = 0.45;
            }
            this.vsTexts.push({
              text: `P${playerNum} 搶答! +${points}`,
              x: b.x,
              y: b.y - 20,
              alpha: 1.0,
              color: playerNum === 1 ? '#60a5fa' : '#f87171',
              fontSize: 26,
              life: 52,
              maxLife: 52
            });
          } else {
            this.vsTexts.push({
              text: `+${points}`,
              x: b.x,
              y: b.y - 15,
              alpha: 1.0,
              color: '#4ade80',
              fontSize: 28,
              life: 45,
              maxLife: 45
            });
            if (shooter.combo >= 2) {
              this.vsTexts.push({
                text: `${shooter.combo} COMBO!`,
                x: b.x,
                y: b.y - 48,
                alpha: 1.0,
                color: '#fef08a',
                fontSize: 22,
                life: 48,
                maxLife: 48
              });
            }
          }

          // 連擊音效或一般正確音效
          if (shooter.combo >= 3) {
            audioManager.playCombo(shooter.combo);
          } else {
            audioManager.playCorrect();
          }

          // 顯示答對回饋
          this.showFeedback('答對了！', 'correct');

          // Boss 關扣血
          if (this.selectedDiff === 'boss') {
            this.bossHp--;
            if (this.bossHp <= 0) {
              this.updateHUD();
              this.endGame(true); // 擊敗 Boss 獲勝
              return;
            }
          }

          this.updateHUD();

          // 進入下一題 (等一下下讓粒子飛一下)
          setTimeout(() => this.nextQuestion(), 400);
          break; // 一發子彈只會擊碎一個氣球

        } else {
          // 擊中錯誤注音！
          shooter.shotsWrong++;
          if (isCoop) {
            this.p1.resetCombo();
            this.p2.resetCombo();
          } else {
            shooter.resetCombo();
          }
          
          // 扣分 (最低 0 分)
          const penalty = 50;
          if (isCoop) {
            this.p1.score = Math.max(0, this.p1.score - penalty);
            this.p2.score = Math.max(0, this.p2.score - penalty);
          } else {
            shooter.score = Math.max(0, shooter.score - penalty);
          }

          // 錯誤扣分飄字
          this.vsTexts.push({
            text: `-${penalty}`,
            x: b.x,
            y: b.y - 15,
            alpha: 1.0,
            color: '#f87171',
            fontSize: 26,
            life: 40,
            maxLife: 40
          });

          // 紀錄錯題
          this.mistakes.push({
            correct: this.targetChar,
            selected: b.char,
            type: 'wrong'
          });

          audioManager.playWrong();
          this.showFeedback('再聽一次！', 'wrong');
          
          // 扣生命值 (對抗模式不扣隊伍生命，只扣分數)
          if (!isVs) {
            this.deductLife();
          }

          this.updateHUD();
          break;
        }
      }
    }
  }

  // 夜市射氣球模式：處理射擊命中氣球或誤擊炸彈
  handleArcadeShootHit(playerNum, shooter, x, y, isCoop, isVs) {
    const config = ARCADE_DIFFICULTY_CONFIG[this.selectedDiff];

    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.active && !b.isPopping && b.checkCollision(x, y)) {
        b.isPopping = true;
        this.flashDuration = 2;

        if (b.arcadeType === 'bomb') {
          // 💥 誤擊危險炸彈！
          this.arcadeBombsHit++;
          shooter.shotsWrong++;

          if (isCoop) {
            this.p1.resetCombo();
            this.p2.resetCombo();
          } else {
            shooter.resetCombo();
          }

          const penalty = config.bombPenalty || 250;
          if (isCoop) {
            this.p1.score = Math.max(0, this.p1.score - penalty);
            this.p2.score = Math.max(0, this.p2.score - penalty);
          } else {
            shooter.score = Math.max(0, shooter.score - penalty);
          }

          // 強烈雙層爆炸粒子與震波
          particleSystem.spawnExplosion(b.x, b.y, '#ef4444', 36, false);
          particleSystem.spawnExplosion(b.x, b.y, '#f97316', 22, false);
          audioManager.playBombExplode();

          // 畫面紅閃與強烈震動
          const container = document.getElementById('game-container');
          if (container) {
            container.classList.add('flash-red', 'shake-screen');
            setTimeout(() => container.classList.remove('flash-red', 'shake-screen'), 430);
          }

          this.vsTexts.push({
            text: isVs ? `💥 P${playerNum} 誤擊炸彈! -${penalty}` : `💥 爆炸! -${penalty}`,
            x: b.x,
            y: b.y - 18,
            alpha: 1.0,
            color: '#f87171',
            fontSize: 30,
            life: 52,
            maxLife: 52
          });

          if (isVs) {
            // 雙人對抗模式：只重扣誤擊者分數，不扣共用生命
            this.showFeedback(`💥 P${playerNum} 誤擊炸彈！`, 'wrong');
            this.updateHUD();
          } else if (config.bombInstantKill) {
            // 一擊必殺模式：誤擊炸彈直接出局
            this.lives = 0;
            this.showFeedback('💥 引爆炸彈！一擊出局！', 'wrong');
            this.updateHUD();
            this.endGame(false);
          } else {
            this.showFeedback('💥 誤擊炸彈！', 'wrong');
            this.deductLife();
            this.updateHUD();
          }
          break;

        } else {
          // 🎈 擊中得分氣球 ('normal' | 'gold' | 'time')
          this.arcadeBalloonsPopped++;
          shooter.shotsHit++;

          if (isCoop) {
            this.p1.addCombo();
            this.p2.addCombo();
          } else {
            shooter.addCombo();
          }

          let basePoints = 100;
          let comboBonus = shooter.combo * 12;
          if (b.arcadeType === 'gold') {
            this.arcadeGoldPopped++;
            basePoints = 300;
            comboBonus = shooter.combo * 25;
          } else if (b.arcadeType === 'time') {
            this.arcadeTimePopped++;
            basePoints = 150;
            this.timeRemaining += 3; // 獎勵 +3 秒
          }

          const points = basePoints + comboBonus;
          if (isCoop) {
            this.p1.score += points;
            this.p2.score += points;
          } else {
            shooter.score += points;
          }

          // 產生繽紛粒子特效
          particleSystem.spawnExplosion(b.x, b.y, b.color, b.arcadeType === 'gold' ? 36 : 24, true);

          // 播放音效
          if (b.arcadeType === 'gold' || b.arcadeType === 'time') {
            audioManager.playBonusHit();
            this.showFeedback(b.arcadeType === 'gold' ? '★ 黃金氣球 +300！' : '⏱️ 時間 +3 秒！', 'correct');
          } else if (shooter.combo >= 5 && shooter.combo % 5 === 0) {
            audioManager.playCombo(shooter.combo);
          } else {
            audioManager.playBalloonPop(shooter.combo);
          }

          // 動態飄字回饋
          if (isVs) {
            if (playerNum === 1) this.p1FlashAlpha = 0.35;
            else this.p2FlashAlpha = 0.35;
          }

          let mainPopupText = isVs ? `P${playerNum} +${points}` : `+${points}`;
          let popupColor = isVs ? (playerNum === 1 ? '#60a5fa' : '#f87171') : '#4ade80';
          let popupSize = 28;

          if (b.arcadeType === 'gold') {
            mainPopupText = isVs ? `★ P${playerNum} 黃金 +${points}!` : `★ 黃金氣球 +${points}!`;
            popupColor = '#facc15';
            popupSize = 31;
          } else if (b.arcadeType === 'time') {
            mainPopupText = isVs ? `⏱️ P${playerNum} +3秒! +${points}` : `⏱️ 時間 +3秒! +${points}`;
            popupColor = '#38bdf8';
            popupSize = 29;
          }

          this.vsTexts.push({
            text: mainPopupText,
            x: b.x,
            y: b.y - 15,
            alpha: 1.0,
            color: popupColor,
            fontSize: popupSize,
            life: 46,
            maxLife: 46
          });

          if (shooter.combo >= 2) {
            this.vsTexts.push({
              text: `${shooter.combo} COMBO!`,
              x: b.x,
              y: b.y - 46,
              alpha: 1.0,
              color: '#fef08a',
              fontSize: 22,
              life: 44,
              maxLife: 44
            });
          }

          this.updateHUD();
          break;
        }
      }
    }
  }

  // 扣減生命值
  deductLife() {
    this.lives--;
    
    // 畫面紅色閃爍特效
    const container = document.getElementById('game-container');
    container.classList.add('flash-red');
    setTimeout(() => container.classList.remove('flash-red'), 300);

    if (this.lives <= 0) {
      this.endGame(false); // 生命值歸零
    }
  }

  // 顯示答對答錯文字 overlay
  showFeedback(text, type) {
    const feedback = document.getElementById('feedback-overlay');
    feedback.textContent = text;
    feedback.className = `show ${type}`;
    
    setTimeout(() => {
      feedback.classList.remove('show');
    }, 800);
  }

  // 更新遊戲畫面上方的 HUD
  updateHUD() {
    const isArcade = this.gameCategory === 'arcade';

    // 1P 分數與 Combo
    document.getElementById('p1-score').textContent = this.p1.score;
    const p1ComboEl = document.getElementById('p1-combo');
    if (this.p1.combo > 0) {
      p1ComboEl.textContent = `${this.p1.combo} Combo`;
      p1ComboEl.classList.add('visible');
    } else {
      p1ComboEl.classList.remove('visible');
    }

    // 2P 分數與 Combo
    if (this.selectedMode && this.selectedMode.startsWith('2p')) {
      document.getElementById('p2-score').textContent = this.p2.score;
      const p2ComboEl = document.getElementById('p2-combo');
      if (this.p2.combo > 0) {
        p2ComboEl.textContent = `${this.p2.combo} Combo`;
        p2ComboEl.classList.add('visible');
      } else {
        p2ComboEl.classList.remove('visible');
      }
    }

    // 夜市射氣球模式：即時更新中央擊破數
    if (isArcade) {
      const qChar = document.getElementById('question-char');
      if (qChar) {
        qChar.textContent = `${this.arcadeBalloonsPopped}`;
      }
    }

    // 剩餘時間與最後 10 秒緊急閃爍狀態
    const timerValEl = document.getElementById('game-timer');
    if (timerValEl) {
      timerValEl.textContent = Math.max(0, this.timeRemaining);
      const timerContainer = timerValEl.closest('.hud-timer');
      if (timerContainer) {
        if (this.timeRemaining <= 10 && this.timeRemaining > 0 && this.state === 'PLAYING') {
          timerContainer.classList.add('urgent');
        } else {
          timerContainer.classList.remove('urgent');
        }
      }
    }

    // 生命值與 Boss 血量條繪製
    const livesContainer = document.getElementById('hud-lives-container');
    livesContainer.innerHTML = '';
    
    if (!isArcade && this.selectedDiff === 'boss') {
      // 注音模式 Boss 關卡：顯示動態漸層血量槽 + 玩家愛心生命值
      const hpPercent = Math.max(0, Math.min(100, (this.bossHp / this.bossMaxHp) * 100));
      const bossWrapper = document.createElement('div');
      bossWrapper.className = 'boss-hp-wrapper';
      bossWrapper.innerHTML = `
        <span class="boss-hp-label">
          <svg class="icon-svg icon-svg-fill" viewBox="0 0 24 24" style="color: #ef4444; width: 1.25em; height: 1.25em;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm0-4h-2V7h2v7z"></path>
          </svg>BOSS
        </span>
        <div class="boss-hp-bar-track">
          <div class="boss-hp-bar-fill" style="width: ${hpPercent}%;"></div>
        </div>
        <span class="boss-hp-text">${this.bossHp}/${this.bossMaxHp}</span>
      `;
      livesContainer.appendChild(bossWrapper);
    } else if (isArcade && this.selectedDiff === 'boss') {
      // 夜市模式「一擊必殺」難度：顯示高張力警示徽章
      const suddenDeathBadge = document.createElement('span');
      suddenDeathBadge.className = 'boss-hp-label';
      suddenDeathBadge.style.marginRight = '6px';
      suddenDeathBadge.innerHTML = `⚡ 一擊必殺`;
      livesContainer.appendChild(suddenDeathBadge);
    }

    // 繪製玩家愛心 SVG (對抗模式不扣命故不需愛心，其餘含 Boss 模式皆顯示玩家生命)
    const isVs = this.selectedMode && this.selectedMode.includes('vs');
    if (!isVs) {
      for (let i = 0; i < this.maxLives; i++) {
        const heart = document.createElement('span');
        if (i < this.lives) {
          heart.className = 'hud-heart active';
          heart.innerHTML = `<svg class="icon-svg icon-svg-fill" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;
        } else {
          heart.className = 'hud-heart empty';
          heart.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24" style="stroke-width: 1.5;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>`;
        }
        livesContainer.appendChild(heart);
      }
    }
  }

  // 遊戲結束
  endGame(isTimeUpOrWin) {
    if (this.isGameOverTriggered) return;
    this.isGameOverTriggered = true;
    
    clearInterval(this.timerInterval);

    // 播放音效
    const isArcade = this.gameCategory === 'arcade';
    const isWin = isArcade
      ? (isTimeUpOrWin && this.lives > 0)
      : (isTimeUpOrWin && (this.selectedDiff !== 'boss' || this.bossHp <= 0));

    if (isWin) {
      audioManager.playWin();
    } else {
      audioManager.playLose();
    }

    // 延遲切換到結算畫面，以便玩家看清最後氣球爆破
    setTimeout(() => {
      this.changeState('RESULT');
    }, 1000);
  }

  // 填寫結算資料
  populateResults() {
    const isArcade = this.gameCategory === 'arcade';
    const isBossWin = !isArcade && this.selectedDiff === 'boss' && this.bossHp <= 0;
    
    // 設定標題，使用 SVG 圖示
    const titleEl = document.getElementById('result-title');
    const winIcon = `<svg class="icon-svg icon-svg-fill" viewBox="0 0 24 24" style="color: #facc15; margin-right: 8px; width: 1.5em; height: 1.5em; vertical-align: middle;"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path><rect x="5" y="18" width="14" height="2"></rect></svg>`;
    const loseIcon = `<svg class="icon-svg" viewBox="0 0 24 24" style="color: #f87171; margin-right: 8px; width: 1.5em; height: 1.5em; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="15.01" y2="9"></line><line x1="9" y1="9" x2="9.01" y2="9"></line><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path></svg>`;
    
    if (isArcade) {
      titleEl.innerHTML = this.lives > 0 ? `${winIcon}夜市神射手！` : `${loseIcon}引爆炸彈出局！`;
    } else if (this.selectedDiff === 'boss') {
      titleEl.innerHTML = isBossWin ? `${winIcon}擊敗大魔王！` : `${loseIcon}挑戰失敗！`;
    } else {
      titleEl.innerHTML = this.lives > 0 ? `${winIcon}挑戰成功！` : `${loseIcon}挑戰失敗！`;
    }

    const resHitLabel = document.getElementById('res-hit-label');
    if (resHitLabel) {
      resHitLabel.textContent = isArcade ? '擊破氣球 / 射擊次數：' : '答對題數 / 射擊次數：';
    }

    const singleRes = document.getElementById('single-results');
    const coopVsRes = document.getElementById('coop-vs-results');

    if (this.selectedMode.startsWith('1p')) {
      // 單人模式
      singleRes.classList.remove('hidden');
      coopVsRes.classList.add('hidden');

      document.getElementById('res-score').textContent = this.p1.score;
      document.getElementById('res-combo').textContent = this.p1.maxCombo;
      document.getElementById('res-accuracy-count').textContent = `${this.p1.shotsHit} / ${this.p1.shotsFired}`;
      document.getElementById('res-accuracy').textContent = `${this.p1.getAccuracy()}%`;

    } else {
      // 雙人模式 (合作或對抗)
      singleRes.classList.add('hidden');
      coopVsRes.classList.remove('hidden');

      document.getElementById('res-p1-score').textContent = this.p1.score;
      document.getElementById('res-p1-combo').textContent = this.p1.maxCombo;
      document.getElementById('res-p1-acc').textContent = `${this.p1.getAccuracy()}%`;

      document.getElementById('res-p2-score').textContent = this.p2.score;
      document.getElementById('res-p2-combo').textContent = this.p2.maxCombo;
      document.getElementById('res-p2-acc').textContent = `${this.p2.getAccuracy()}%`;

      const winBanner1 = document.getElementById('vs-winner-p1');
      const winBanner2 = document.getElementById('vs-winner-p2');
      const card1 = document.getElementById('vs-card-p1');
      const card2 = document.getElementById('vs-card-p2');

      winBanner1.classList.add('hidden');
      winBanner2.classList.add('hidden');
      card1.classList.remove('winner');
      card2.classList.remove('winner');
      
      const evalEl = document.getElementById('coop-team-evaluation');
      if (evalEl) evalEl.classList.add('hidden');

      const isVs = this.selectedMode && this.selectedMode.includes('vs');
      if (isVs) {
        // 對抗模式：顯示獲勝者
        if (this.p1.score > this.p2.score) {
          winBanner1.classList.remove('hidden');
          card1.classList.add('winner');
        } else if (this.p2.score > this.p1.score) {
          winBanner2.classList.remove('hidden');
          card2.classList.add('winner');
        } else {
          // 平手比精準度
          if (this.p1.getAccuracy() > this.p2.getAccuracy()) {
            winBanner1.classList.remove('hidden');
            card1.classList.add('winner');
          } else if (this.p2.getAccuracy() > this.p1.getAccuracy()) {
            winBanner2.classList.remove('hidden');
            card2.classList.add('winner');
          }
        }
      } else {
        // 合作模式：展示團隊綜合評估 (合作模式下 p1 與 p2 為共享團隊總分)
        if (evalEl) {
          evalEl.classList.remove('hidden');
          const teamScore = this.p1.score;
          const totalHits = this.p1.shotsHit + this.p2.shotsHit;
          const totalShots = this.p1.shotsFired + this.p2.shotsFired;
          const teamAcc = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0;
          
          let rank = '互相傷害 (C 級)';
          let desc = '確定沒有把子彈射在隊友準星上嗎？再多練習，培養一下默契吧！';
          
          if (teamScore >= 2500 && teamAcc >= 80) {
            rank = '神射拍檔 (S 級)';
            desc = '合作無間，百發百中！你們的默契已經無人能敵，堪稱黃金拍檔！';
          } else if (teamScore >= 1500) {
            rank = '合作無間 (A 級)';
            desc = '配合得相當有默契！大部分氣球都被你們聯手擊破了，非常優秀！';
          } else if (teamScore >= 800) {
            rank = '漸入佳境 (B 級)';
            desc = '氣球漏得不多，分工還可以再更細密一些，下次一定能拿 S 級！';
          }
          
          const hitUnit = isArcade ? '顆' : '題';
          evalEl.innerHTML = `
            <div style="font-size: 1.3rem; font-weight: 900; color: var(--color-accent-yellow); margin-bottom: 8px;">團隊綜合評價：${rank}</div>
            <div style="font-size: 1rem; color: rgba(255,255,255,0.85); line-height: 1.6;">團隊共同總分：<span style="color:#fef08a;font-weight:bold;">${teamScore}</span> ｜ 聯手擊破：<span style="color:#4ade80;font-weight:bold;">${totalHits} ${hitUnit}</span> (1P: ${this.p1.shotsHit} / 2P: ${this.p2.shotsHit}) ｜ 團隊命中率：<span style="color:#fff;font-weight:bold;">${teamAcc}%</span></div>
            <div style="font-size: 0.95rem; color: var(--color-accent-pink); margin-top: 6px; font-style: italic;">"${desc}"</div>
          `;
        }
      }
    }

    // 渲染錯題溫習區 (僅注音聽音模式顯示)
    const mistakesContainer = document.getElementById('mistakes-review-container');
    const mistakesList = document.getElementById('mistakes-list');
    
    if (mistakesContainer && mistakesList) {
      if (!isArcade && this.mistakes && this.mistakes.length > 0) {
        mistakesContainer.classList.remove('hidden');
        
        // 進行錯題去重：優先保留「選錯字」而非「漏答」的卡片
        const uniqueMistakes = [];
        const seen = new Set();
        
        const sortedMistakes = [...this.mistakes].sort((a, b) => {
          if (a.selected === '漏答' && b.selected !== '漏答') return 1;
          if (a.selected !== '漏答' && b.selected === '漏答') return -1;
          return 0;
        });

        for (const m of sortedMistakes) {
          if (!seen.has(m.correct)) {
            seen.add(m.correct);
            uniqueMistakes.push(m);
          }
        }
        
        // 限制最多顯示 8 個錯題
        const displayMistakes = uniqueMistakes.slice(0, 8);
        
        mistakesList.innerHTML = displayMistakes.map(m => {
          const labelText = m.selected === '漏答' ? '漏答' : `射成 ${m.selected}`;
          return `
            <div class="mistake-card" data-char="${m.correct}" title="點擊聆聽正確發音">
              <span class="mistake-char">${m.correct}</span>
              <span class="mistake-label">${labelText}</span>
            </div>
          `;
        }).join('');
      } else {
        mistakesContainer.classList.add('hidden');
        mistakesList.innerHTML = '';
      }
    }
  }

  // 暫停與繼續
  pauseGame() {
    if (this.state === 'PLAYING') {
      this.changeState('PAUSED');
    }
  }

  resumeGame() {
    if (this.state === 'PAUSED') {
      this.changeState('PLAYING');
    }
  }

  // 更新選單狀態下的光線槍 DOM 準星
  updateMenuCrosshairs() {
    const p1Crosshair = document.getElementById('dom-crosshair-p1');
    const p2Crosshair = document.getElementById('dom-crosshair-p2');
    
    // 只在選單狀態顯示 DOM 準星，避免跟遊戲中 Canvas 繪製的準星重疊
    const isMenuState = ['HOME', 'MODE_SELECT', 'TUTORIAL', 'LICENSE', 'SETTINGS', 'PAUSED', 'RESULT'].includes(this.state);
    
    if (isMenuState) {
      // 判定是否為體感模式
      const isWebcamMode = (this.selectedMode === '1p-webcam' || (this.selectedMode && this.selectedMode.endsWith('-webcam')));
      
      if (isWebcamMode && inputManager.isWebcamActive) {
        // P1 體感準星
        if (inputManager.isWebcamP1Active && inputManager.p1WebcamX !== undefined) {
          p1Crosshair?.classList.remove('hidden');
          if (p1Crosshair && this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = rect.left + (inputManager.p1WebcamX / GAME_WIDTH) * rect.width;
            const clientY = rect.top + (inputManager.p1WebcamY / GAME_HEIGHT) * rect.height;
            p1Crosshair.style.left = `${clientX}px`;
            p1Crosshair.style.top = `${clientY}px`;
          }
        } else {
          p1Crosshair?.classList.add('hidden');
        }

        // P2 體感準星
        if (this.selectedMode && this.selectedMode.startsWith('2p') && inputManager.isWebcamP2Active && inputManager.p2WebcamX !== undefined) {
          p2Crosshair?.classList.remove('hidden');
          if (p2Crosshair && this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = rect.left + (inputManager.p2WebcamX / GAME_WIDTH) * rect.width;
            const clientY = rect.top + (inputManager.p2WebcamY / GAME_HEIGHT) * rect.height;
            p2Crosshair.style.left = `${clientX}px`;
            p2Crosshair.style.top = `${clientY}px`;
          }
        } else {
          p2Crosshair?.classList.add('hidden');
        }
      } else {
        // 非體感模式，使用原本的 Gamepad/光槍 DOM 準星
        if (inputManager.p1GamepadIndex !== -1 && inputManager.p1ClientX !== undefined) {
          p1Crosshair?.classList.remove('hidden');
          if (p1Crosshair) {
            p1Crosshair.style.left = `${inputManager.p1ClientX}px`;
            p1Crosshair.style.top = `${inputManager.p1ClientY}px`;
          }
        } else {
          p1Crosshair?.classList.add('hidden');
        }

        if (inputManager.p2GamepadIndex !== -1 && inputManager.p2ClientX !== undefined) {
          p2Crosshair?.classList.remove('hidden');
          if (p2Crosshair) {
            p2Crosshair.style.left = `${inputManager.p2ClientX}px`;
            p2Crosshair.style.top = `${inputManager.p2ClientY}px`;
          }
        } else {
          p2Crosshair?.classList.add('hidden');
        }
      }
    } else {
      // 遊戲中或校正中，隱藏 DOM 準星
      p1Crosshair?.classList.add('hidden');
      p2Crosshair?.classList.add('hidden');
    }
  }

  // 主遊戲循環
  loop() {
    // 使用 requestAnimationFrame 不斷執行
    requestAnimationFrame(() => this.loop());

    // 計算 Delta Time 時間差
    const now = performance.now();
    if (!this.lastFrameTime) this.lastFrameTime = now;
    let dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // 限制合理的 dt 範圍 (例如 0.1ms 到 100ms)，防範背景分頁凍結重返時造成瞬移
    if (dt > 100) dt = 16.67;
    const dtScale = dt / 16.67;

    // 全天候更新輸入狀態，確保所有選單可由光槍控制
    inputManager.update();

    // 更新 DOM 準星
    this.updateMenuCrosshairs();

    // 1. 更新邏輯 (僅在 PLAYING 狀態下更新物理)
    if (this.state === 'PLAYING') {

      // 更新玩家位置
      if (this.p1.inputType === 'mouse') {
        this.p1.x = inputManager.mouseX;
        this.p1.y = inputManager.mouseY;
        this.p1.isPinching = false;
      } else if (this.p1.inputType === 'webcam') {
        this.p1.x = inputManager.p1WebcamX || (GAME_WIDTH / 2);
        this.p1.y = inputManager.p1WebcamY || (GAME_HEIGHT / 2);
        this.p1.isPinching = !!inputManager.isPinchingP1;
      } else {
        this.p1.x = inputManager.p1X || (GAME_WIDTH / 2);
        this.p1.y = inputManager.p1Y || (GAME_HEIGHT / 2);
        this.p1.isPinching = false;
      }

      if (this.selectedMode.startsWith('2p')) {
        if (this.p2.inputType === 'webcam') {
          this.p2.x = inputManager.p2WebcamX || (GAME_WIDTH / 2);
          this.p2.y = inputManager.p2WebcamY || (GAME_HEIGHT / 2);
          this.p2.isPinching = !!inputManager.isPinchingP2;
        } else {
          this.p2.x = inputManager.p2X || (GAME_WIDTH / 2);
          this.p2.y = inputManager.p2Y || (GAME_HEIGHT / 2);
          this.p2.isPinching = false;
        }
      }

      // 更新粒子特效
      particleSystem.update(dtScale);

      if (this.gameCategory === 'arcade') {
        // 🎈 夜市射氣球模式：連續生球與更新
        const config = ARCADE_DIFFICULTY_CONFIG[this.selectedDiff];
        const dynamicInterval = config.spawnInterval * (this.timeRemaining <= 15 ? 0.76 : (this.timeRemaining <= 30 ? 0.88 : 1.0));

        if (now - this.lastArcadeSpawnTime >= dynamicInterval) {
          this.spawnArcadeBalloon();
          // 若場上氣球過少，額外補生一顆，維持夜市攤位的豐富緊湊感
          const activeCount = this.balloons.filter(b => b.active && !b.isPopping).length;
          if (activeCount < Math.floor(config.maxBalloons * 0.45)) {
            this.spawnArcadeBalloon();
          }
          this.lastArcadeSpawnTime = now;
        }

        for (let i = this.balloons.length - 1; i >= 0; i--) {
          const b = this.balloons[i];
          const status = b.update(dtScale);
          if (status === 'escaped' || !b.active) {
            this.balloons.splice(i, 1);
          }
        }

      } else {
        // 🎯 注音聽音挑戰模式：更新氣球位置並檢查越界
        let correctCharMissed = false;
        
        for (let i = this.balloons.length - 1; i >= 0; i--) {
          const b = this.balloons[i];
          const status = b.update(dtScale);
          
          if (status === 'missed') {
            if (b.isCorrect) {
              correctCharMissed = true; // 正確答案氣球漏答了
              
              // 紀錄漏答
              this.mistakes.push({
                correct: this.targetChar,
                selected: '漏答',
                type: 'miss'
              });
            }
            this.balloons.splice(i, 1);
          } else if (!b.active) {
            // 被擊碎的氣球在此移除
            this.balloons.splice(i, 1);
          }
        }

        // 處理正確答案氣球掉出底部的懲罰
        if (correctCharMissed) {
          this.p1.resetCombo();
          this.p2.resetCombo();
          this.updateHUD();

          audioManager.playWrong();
          this.showFeedback('漏答了！', 'wrong');

          const isVs = this.selectedMode && this.selectedMode.includes('vs');
          if (!isVs) {
            this.deductLife();
          }

          // 直接進入下一題
          setTimeout(() => this.nextQuestion(), 500);
        }

        // 未答對前，依照設定的頻率自動重複播放題目語音
        const repeatMs = typeof gameSettings !== 'undefined' ? gameSettings.repeatInterval * 1000 : 3000;
        if (repeatMs > 0 && Date.now() - this.lastVoicePlayTime >= repeatMs && this.balloons.some(b => b.active && b.isCorrect)) {
          audioManager.playZhuyin(this.targetChar);
          this.lastVoicePlayTime = Date.now();
        }
      }

      // 更新動態得分與連擊漂浮文字 (支援 dtScale)
      for (let i = this.vsTexts.length - 1; i >= 0; i--) {
        const vt = this.vsTexts[i];
        vt.y -= 1.25 * dtScale; // 往上飄移
        vt.life -= dtScale;
        const maxLife = vt.maxLife || 50;
        vt.alpha = Math.max(0, vt.life / maxLife);
        if (vt.life <= 0) {
          this.vsTexts.splice(i, 1);
        }
      }

      // 遞減兩側閃爍透明度
      if (this.p1FlashAlpha > 0) this.p1FlashAlpha = Math.max(0, this.p1FlashAlpha - 0.015 * dtScale);
      if (this.p2FlashAlpha > 0) this.p2FlashAlpha = Math.max(0, this.p2FlashAlpha - 0.015 * dtScale);
    }

    // 2. 渲染畫面 (只要不是完全隱藏 Canvas 都要畫，或是每幀清除重繪)
    this.draw();
  }

  // 繪製 Canvas
  draw() {
    // 確保有 Context
    if (!this.ctx) return;

    // 清除畫布
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 繪製可愛懷舊黑板背景
    this.drawBlackboardBackground();

    // 只有在 PLAYING 或 PAUSED 狀態下繪製氣球與玩家準星
    if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      // 繪製氣球
      this.balloons.forEach(b => b.draw(this.ctx));

      // 繪製粒子
      particleSystem.draw(this.ctx);

      // 繪製對抗模式搶答兩側閃光与全模式浮動飄字
      if (this.state === 'PLAYING') {
        if (this.p1FlashAlpha > 0) {
          const gradP1 = this.ctx.createLinearGradient(0, 0, GAME_WIDTH * 0.4, 0);
          gradP1.addColorStop(0, `rgba(59, 130, 246, ${this.p1FlashAlpha})`);
          gradP1.addColorStop(1, 'rgba(59, 130, 246, 0)');
          this.ctx.fillStyle = gradP1;
          this.ctx.fillRect(0, 0, GAME_WIDTH * 0.4, GAME_HEIGHT);
        }
        if (this.p2FlashAlpha > 0) {
          const gradP2 = this.ctx.createLinearGradient(GAME_WIDTH, 0, GAME_WIDTH * 0.6, 0);
          gradP2.addColorStop(0, `rgba(239, 68, 68, ${this.p2FlashAlpha})`);
          gradP2.addColorStop(1, 'rgba(239, 68, 68, 0)');
          this.ctx.fillStyle = gradP2;
          this.ctx.fillRect(GAME_WIDTH * 0.6, 0, GAME_WIDTH * 0.4, GAME_HEIGHT);
        }

        // 繪製得分與連擊漂浮文字
        if (this.vsTexts.length > 0) {
          this.ctx.save();
          this.vsTexts.forEach(vt => {
            this.ctx.globalAlpha = vt.alpha;
            const size = vt.fontSize || 26;
            this.ctx.font = `900 ${size}px "Fredoka", "Noto Sans TC", sans-serif`;
            this.ctx.fillStyle = vt.color;
            this.ctx.textAlign = 'center';
            this.ctx.lineJoin = 'round';
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 5;
            this.ctx.strokeText(vt.text, vt.x, vt.y);
            this.ctx.fillText(vt.text, vt.x, vt.y);
          });
          this.ctx.restore();
        }
      }

      // 繪製玩家準星 (1P 永遠繪製)
      this.p1.drawCrosshair(this.ctx);

      // 2P 模式下繪製 2P 準星
      if (this.selectedMode && this.selectedMode.startsWith('2p')) {
        this.p2.drawCrosshair(this.ctx);
      }
    }

    // 繪製畫面射擊閃光 (Game Juice)
    if (this.flashDuration > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashDuration * 0.12})`;
      this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.flashDuration--;
    }
  }

  // 預先渲染靜態黑板背景快取 (含暗角、粉筆灰擦痕、手繪角花、木質粉筆槽與粉筆板擦)
  initBlackboardCache() {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = GAME_WIDTH;
    this.bgCanvas.height = GAME_HEIGHT;
    const ctx = this.bgCanvas.getContext('2d');

    // 1. 黑板深綠漸層底色 (中央柔和偏亮，四周自然暗角 Vignette)
    const boardGrad = ctx.createRadialGradient(
      GAME_WIDTH * 0.5, GAME_HEIGHT * 0.45, GAME_WIDTH * 0.1,
      GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH * 0.75
    );
    boardGrad.addColorStop(0, '#234926');
    boardGrad.addColorStop(0.65, '#1d3d1f');
    boardGrad.addColorStop(1, '#142b15');
    ctx.fillStyle = boardGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 2. 模擬黑板擦拭後的柔和粉筆灰雲霧紋理
    const smudges = [
      { x: 320, y: 220, r: 240, a: 0.022 },
      { x: 920, y: 280, r: 280, a: 0.02 },
      { x: 580, y: 480, r: 260, a: 0.018 },
      { x: 240, y: 520, r: 190, a: 0.016 },
      { x: 1020, y: 510, r: 210, a: 0.018 }
    ];
    smudges.forEach(s => {
      const g = ctx.createRadialGradient(s.x, s.y, 10, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(255, 255, 255, ${s.a})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    });

    // 3. 黑板細微參考暗格線
    ctx.fillStyle = 'rgba(255, 255, 255, 0.016)';
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      ctx.fillRect(x, 0, 1, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      ctx.fillRect(0, y, GAME_WIDTH, 1);
    }

    // 4. 黑板內緣手繪粉筆裝飾細框與四角星點
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(16, 16, GAME_WIDTH - 32, GAME_HEIGHT - 38);
    ctx.restore();

    // 5. 繪製黑板底部的立體木質粉筆槽
    ctx.fillStyle = '#4a2e14';
    ctx.fillRect(0, GAME_HEIGHT - 16, GAME_WIDTH, 16);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, GAME_HEIGHT - 16, GAME_WIDTH, 5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, GAME_HEIGHT - 16, GAME_WIDTH, 1.5);

    // 6. 在粉筆槽上繪製溫馨教室小物：黑板擦與彩色粉筆
    // 左側黑板擦
    ctx.save();
    ctx.fillStyle = '#334155'; // 板擦絨布深灰底
    ctx.fillRect(85, GAME_HEIGHT - 23, 56, 7);
    ctx.fillStyle = '#d97706'; // 板擦木柄橘棕色
    ctx.fillRect(83, GAME_HEIGHT - 32, 60, 10);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(98, GAME_HEIGHT - 29, 30, 4);

    // 散落的四色粉筆 (白、黃、粉紅、粉藍)
    const chalks = [
      { x: 165, w: 32, color: '#f8fafc' },
      { x: 210, w: 28, color: '#fef08a' },
      { x: 1040, w: 34, color: '#fbcfe8' },
      { x: 1086, w: 26, color: '#93c5fd' },
      { x: 1122, w: 30, color: '#f8fafc' }
    ];
    chalks.forEach(c => {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, GAME_HEIGHT - 21, c.w, 6);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(c.x, GAME_HEIGHT - 17, c.w, 2);
    });
    ctx.restore();
  }

  // 繪製綠色黑板背景與遊戲警戒線 / 夜市慶典裝飾
  drawBlackboardBackground() {
    const ctx = this.ctx;
    
    // 直接繪製預先快取的精緻黑板底圖 (效能極佳)
    if (this.bgCanvas) {
      ctx.drawImage(this.bgCanvas, 0, 0);
    } else {
      ctx.fillStyle = '#1e3f20';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      if (this.gameCategory === 'arcade') {
        // 夜市射氣球模式：於畫面上方兩側繪製手繪粉筆風「夜市慶典三角彩旗」與攤位提示
        ctx.save();
        const flagColors = ['#f87171', '#facc15', '#4ade80', '#38bdf8', '#c084fc', '#fb923c'];
        const flagCount = 18;
        const spacing = (GAME_WIDTH - 60) / flagCount;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 82);
        ctx.quadraticCurveTo(GAME_WIDTH * 0.5, 108, GAME_WIDTH - 20, 82);
        ctx.stroke();

        for (let i = 0; i < flagCount; i++) {
          const fx = 30 + i * spacing;
          const t = (i + 0.5) / flagCount;
          const fy = 82 + 4 * t * (1 - t) * 26;
          ctx.fillStyle = flagColors[i % flagColors.length];
          ctx.globalAlpha = 0.28;
          ctx.beginPath();
          ctx.moveTo(fx + 6, fy);
          ctx.lineTo(fx + spacing - 6, fy);
          ctx.lineTo(fx + spacing * 0.5, fy + 22);
          ctx.closePath();
          ctx.fill();
        }

        // 底部標示夜市氣球升起區與特殊標靶圖例
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 14px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('🎈 彩色氣球 +100 ｜ ★ 黃金氣球 +300 ｜ ⏱️ 時間氣球 +3秒 ｜ 💥 小心炸彈！', GAME_WIDTH - 24, GAME_HEIGHT - 44);
        ctx.restore();
      } else {
        // 注音聽音模式：繪製底部紅色虛線 (氣球落地警戒線)
        ctx.save();
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(20, GAME_HEIGHT - 60);
        ctx.lineTo(GAME_WIDTH - 20, GAME_HEIGHT - 60);
        ctx.stroke();

        // 標示「警戒線」文字
        ctx.fillStyle = 'rgba(252, 165, 165, 0.8)';
        ctx.font = 'bold 14px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('▲ 氣球落地警戒線', GAME_WIDTH - 24, GAME_HEIGHT - 68);
        ctx.restore();
      }
    }
  }
}

// 建立全域遊戲管理器實例
const gameManager = new GameManager();
