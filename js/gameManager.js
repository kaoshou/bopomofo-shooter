// GameManager - 遊戲核心控制器，負責狀態機、遊戲循環、出題與碰撞判定

class GameManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = 'HOME'; // HOME, MODE_SELECT, TUTORIAL, CALIBRATION, PLAYING, PAUSED, RESULT
    
    // 遊戲參數
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
    
    // 題目資訊
    this.targetChar = ''; // 目前要射擊的注音字元
    this.lastSpawnTime = 0;
    this.lastVoicePlayTime = 0; // 記錄上次語音播放的時間
    this.isGameOverTriggered = false;

    // Boss 關卡資訊
    this.bossHp = 15;
    this.bossMaxHp = 15;

    // 精進功能屬性
    this.flashDuration = 0;
    this.mistakes = [];
    this.p1FlashAlpha = 0;
    this.p2FlashAlpha = 0;
    this.vsTexts = [];
    
    // 時間增量更新 (Delta Time) 變數
    this.lastFrameTime = 0;
  }

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // 初始化輸入管理器
    inputManager.init(this.canvas);
    
    // 註冊輸入管理器的射擊回呼
    inputManager.onShoot((playerNum, x, y, inputType) => this.handleShoot(playerNum, x, y, inputType));
    
    // 開始遊戲循環
    this.loop();
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
    
    const config = DIFFICULTY_CONFIG[this.selectedDiff];
    this.lives = config.lives;
    this.maxLives = config.lives;
    this.timeRemaining = (typeof gameSettings !== 'undefined' && gameSettings.gameTime) ? gameSettings.gameTime : config.timeLimit;
    
    // Boss 關血量
    if (this.selectedDiff === 'boss') {
      this.bossHp = config.bossHp;
      this.bossMaxHp = config.bossHp;
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
        
        if (this.timeRemaining <= 0) {
          this.endGame(true); // 時間到
        }
      }
    }, 1000);

    // 開始出題
    audioManager.initAudioContext(); // 確保 AudioContext 已啟動
    setTimeout(() => this.nextQuestion(), 500);
  }

  // 產生下一題
  nextQuestion() {
    if (this.state !== 'PLAYING') return;

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

    let hitAnything = false;

    // 從後往前檢查氣球，確保先擊中最上層的
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      if (b.active && b.checkCollision(x, y)) {
        hitAnything = true;
        b.isPopping = true; // 觸發氣球收縮爆裂動效
        this.flashDuration = 2; // 畫面閃光 2 幀
        
        // 產生爆裂粒子特效
        particleSystem.spawnExplosion(b.x, b.y, b.color, 25);

        if (b.isCorrect) {
          // 擊中正確注音！
          shooter.shotsHit++;
          shooter.addCombo();
          
          // 加分規則
          // 2P 合作模式：共同加分，且 Combo 數對雙方都有加成
          // 2P 對抗模式：擊中 correct 即加分並直接切換題目，防範對方搶答
          const points = 100 + shooter.combo * 10;
          
          if (this.selectedMode === '2p-coop') {
            this.p1.score += points;
            this.p2.score += points;
          } else {
            shooter.score += points;
          }

          // 2P 對抗模式搶答視覺提示
          const isVs = this.selectedMode && this.selectedMode.includes('vs');
          if (isVs) {
            if (playerNum === 1) {
              this.p1FlashAlpha = 0.45; // 閃爍 P1 半邊
            } else {
              this.p2FlashAlpha = 0.45; // 閃爍 P2 半邊
            }
            this.vsTexts.push({
              text: `P${playerNum} 搶答成功! +${points}`,
              x: b.x,
              y: b.y - 20,
              alpha: 1.0,
              color: playerNum === 1 ? '#60a5fa' : '#f87171',
              life: 50 // 幀數
            });
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
          shooter.resetCombo();
          
          // 扣分 (最低 0 分)
          const penalty = 50;
          if (this.selectedMode === '2p-coop') {
            this.p1.score = Math.max(0, this.p1.score - penalty);
            this.p2.score = Math.max(0, this.p2.score - penalty);
          } else {
            shooter.score = Math.max(0, shooter.score - penalty);
          }

          // 紀錄錯題
          this.mistakes.push({
            correct: this.targetChar,
            selected: b.char,
            type: 'wrong'
          });

          audioManager.playWrong();
          this.showFeedback('再聽一次！', 'wrong');
          
          // 扣生命值 (對抗模式不扣隊伍生命，只扣分數)
          const isVs = this.selectedMode && this.selectedMode.includes('vs');
          if (!isVs) {
            this.deductLife();
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

    // 剩餘時間
    document.getElementById('game-timer').textContent = Math.max(0, this.timeRemaining);

    // 生命值 (心形繪製)
    const livesContainer = document.getElementById('hud-lives-container');
    livesContainer.innerHTML = '';
    
    if (this.selectedDiff === 'boss') {
      // Boss 關卡：顯示 Boss 血量條與玩家血量，移除 😈
      livesContainer.innerHTML = `<span style="color:#ef4444; display: inline-flex; align-items: center; gap: 6px; font-weight: bold;"><svg class="icon-svg icon-svg-fill" viewBox="0 0 24 24" style="width: 1.5em; height: 1.5em;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm0-4h-2V7h2v7z"></path><path d="M5.3 4.9c.4.4.4 1 0 1.4l-1.4 1.4c-.4.4-1 .4-1.4 0s-.4-1 0-1.4l1.4-1.4c.4-.4 1-.4 1.4 0zm14.8 0c.4-.4 1-.4 1.4 0s.4 1 0 1.4l-1.4 1.4c-.4.4-1 .4-1.4 0s-.4-1 0-1.4l1.4-1.4z"></path></svg> Boss HP: ${this.bossHp}/${this.bossMaxHp}</span>`;
    } else {
      // 一般關卡：顯示愛心 SVG
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
    const isWin = isTimeUpOrWin && (this.selectedDiff !== 'boss' || this.bossHp <= 0);
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
    const isBossWin = this.selectedDiff === 'boss' && this.bossHp <= 0;
    
    // 設定標題，移除 Emoji 🎉 / 💀，使用 SVG 圖示
    const titleEl = document.getElementById('result-title');
    const winIcon = `<svg class="icon-svg icon-svg-fill" viewBox="0 0 24 24" style="color: #facc15; margin-right: 8px; width: 1.5em; height: 1.5em; vertical-align: middle;"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path><rect x="5" y="18" width="14" height="2"></rect></svg>`;
    const loseIcon = `<svg class="icon-svg" viewBox="0 0 24 24" style="color: #f87171; margin-right: 8px; width: 1.5em; height: 1.5em; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="15.01" y2="9"></line><line x1="9" y1="9" x2="9.01" y2="9"></line><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path></svg>`;
    
    if (this.selectedDiff === 'boss') {
      titleEl.innerHTML = isBossWin ? `${winIcon}擊敗大魔王！` : `${loseIcon}挑戰失敗！`;
    } else {
      titleEl.innerHTML = this.lives > 0 ? `${winIcon}挑戰成功！` : `${loseIcon}挑戰失敗！`;
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
        // 合作模式：展示團隊綜合評估
        if (evalEl) {
          evalEl.classList.remove('hidden');
          const totalScore = this.p1.score + this.p2.score;
          const avgAcc = Math.round((this.p1.getAccuracy() + this.p2.getAccuracy()) / 2);
          
          let rank = '💥 互相傷害 (C 級)';
          let desc = '確定沒有把子彈射在隊友準星上嗎？再多練習，培養一下默契吧！';
          
          if (totalScore >= 3000 && avgAcc >= 85) {
            rank = '👑 神射俠侶 (S 級)';
            desc = '合作無間，百發百中！你們的默契已經無人能敵，堪稱黃金拍檔！';
          } else if (totalScore >= 1800) {
            rank = '🎮 合作無間 (A 級)';
            desc = '配合得相當有默契！大部分氣球都被你們聯手擊破了，非常優秀！';
          } else if (totalScore >= 1000) {
            rank = '🎈 漸入佳境 (B 級)';
            desc = '氣球漏得不多，分工還可以再更細密一些，下次一定能拿 S 級！';
          }
          
          evalEl.innerHTML = `
            <div style="font-size: 1.3rem; font-weight: 900; color: var(--color-accent-yellow); margin-bottom: 8px;">團隊綜合評價：${rank}</div>
            <div style="font-size: 1rem; color: rgba(255,255,255,0.8); line-height: 1.5;">P1+P2 總分：<span style="color:#fff;font-weight:bold;">${totalScore}</span> | 團隊平均命中率：<span style="color:#fff;font-weight:bold;">${avgAcc}%</span></div>
            <div style="font-size: 0.95rem; color: var(--color-accent-pink); margin-top: 5px; font-style: italic;">"${desc}"</div>
          `;
        }
      }
    }

    // 渲染錯題溫習區
    const mistakesContainer = document.getElementById('mistakes-review-container');
    const mistakesList = document.getElementById('mistakes-list');
    
    if (mistakesContainer && mistakesList) {
      if (this.mistakes && this.mistakes.length > 0) {
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

      // 更新氣球位置並檢查越界
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

      // 更新對抗模式搶答漂浮文字
      for (let i = this.vsTexts.length - 1; i >= 0; i--) {
        const vt = this.vsTexts[i];
        vt.y -= 1.0; // 往上飄移
        vt.life--;
        vt.alpha = Math.max(0, vt.life / 50); // 隨生命遞減 Alpha
        if (vt.life <= 0) {
          this.vsTexts.splice(i, 1);
        }
      }

      // 遞減兩側閃爍透明度
      if (this.p1FlashAlpha > 0) this.p1FlashAlpha -= 0.015;
      if (this.p2FlashAlpha > 0) this.p2FlashAlpha -= 0.015;
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

      // 繪製對抗模式搶答兩側閃光
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

        // 繪製搶答漂浮文字
        if (this.vsTexts.length > 0) {
          this.ctx.save();
          this.vsTexts.forEach(vt => {
            this.ctx.globalAlpha = vt.alpha;
            this.ctx.font = 'bold 26px Noto Sans TC';
            this.ctx.fillStyle = vt.color;
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000000';
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

  // 繪製綠色黑板背景與手繪塗鴉風邊界
  drawBlackboardBackground() {
    const ctx = this.ctx;
    
    // 黑板深綠底色
    ctx.fillStyle = '#1e3f20';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // 黑板粉筆質感的微弱點陣或網格 (Rich Aesthetics)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      ctx.fillRect(x, 0, 1, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      ctx.fillRect(0, y, GAME_WIDTH, 1);
    }

    // 繪製黑板底部的木質板擦粉筆托盤視覺 (底部一條棕色條)
    ctx.fillStyle = '#5c3a1a';
    ctx.fillRect(0, GAME_HEIGHT - 12, GAME_WIDTH, 12);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, GAME_HEIGHT - 12, GAME_WIDTH, 4);

    // 遊戲中繪製底部一條紅色虛線 (氣球警戒線)
    if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(0, GAME_HEIGHT - 60);
      ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 60);
      ctx.stroke();

      // 標示「警戒線」文字
      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.font = 'bold 14px Noto Sans TC';
      ctx.textAlign = 'right';
      ctx.fillText('▲ 氣球落地警戒線', GAME_WIDTH - 20, GAME_HEIGHT - 70);
      ctx.restore();
    }
  }
}

// 建立全域遊戲管理器實例
const gameManager = new GameManager();
