// Player 類別 - 管理 1P / 2P 玩家屬性、統計資料與準星繪製

class Player {
  constructor(id, color, inputType) {
    this.id = id;
    this.color = color;
    this.inputType = inputType; // 'mouse' 或 'gamepad'
    
    this.x = GAME_WIDTH / 2;
    this.y = GAME_HEIGHT / 2;
    
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.shotsWrong = 0;

    // 射擊動畫控制
    this.lastShotTime = 0;
    this.recoilDuration = 150; // 射擊回彈動畫持續時間 (ms)
  }

  // 重設統計資料
  reset() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.shotsWrong = 0;
    this.x = GAME_WIDTH / 2;
    this.y = GAME_HEIGHT / 2;
    this.lastShotTime = 0;
  }

  // 取得精準度
  getAccuracy() {
    if (this.shotsFired === 0) return 0;
    // 使用答對題數除以總開火次數
    return Math.round((this.shotsHit / this.shotsFired) * 100);
  }

  // 觸發射擊動畫
  triggerShoot() {
    this.shotsFired++;
    this.lastShotTime = Date.now();
  }

  // 增加連擊
  addCombo() {
    this.combo++;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
  }

  // 中斷連擊
  resetCombo() {
    this.combo = 0;
  }

  // 在 Canvas 上繪製準星
  drawCrosshair(ctx) {
    const now = Date.now();
    const timeSinceShot = now - this.lastShotTime;
    
    // 射擊時準星會有一個擴大後縮小的回彈效果
    let scale = 1.0;
    if (timeSinceShot < this.recoilDuration) {
      const t = timeSinceShot / this.recoilDuration;
      // 擴大到 1.6 倍，再線性回到 1.0
      scale = 1.0 + (1.0 - t) * 0.6;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;

    const baseRadius = 20 * scale;

    if (this.id === 1) {
      // 1P 準星：同心圓 + 十字線
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();

      ctx.beginPath();
      // 上
      ctx.moveTo(0, -baseRadius * 1.5);
      ctx.lineTo(0, -baseRadius * 0.6);
      // 下
      ctx.moveTo(0, baseRadius * 0.6);
      ctx.lineTo(0, baseRadius * 1.5);
      // 左
      ctx.moveTo(-baseRadius * 1.5, 0);
      ctx.lineTo(-baseRadius * 0.6, 0);
      // 右
      ctx.moveTo(baseRadius * 0.6, 0);
      ctx.lineTo(baseRadius * 1.5, 0);
      ctx.stroke();

      // 標示 "1P"
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Fredoka';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('1P', 0, -baseRadius * 1.6);

    } else {
      // 2P 準星：十字帶外圈與缺口
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 畫十字尖角
      ctx.beginPath();
      ctx.moveTo(0, -baseRadius * 1.3);
      ctx.lineTo(0, baseRadius * 1.3);
      ctx.moveTo(-baseRadius * 1.3, 0);
      ctx.lineTo(baseRadius * 1.3, 0);
      ctx.stroke();

      // 中心小圓點
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();

      // 標示 "2P"
      ctx.shadowBlur = 2;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Fredoka';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('2P', 0, -baseRadius * 1.6);
    }

    ctx.restore();
  }
}
