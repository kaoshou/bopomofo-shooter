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
    this.isPinching = false;   // 體感是否處於捏合狀態
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
    this.isPinching = false;
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
    let shotProgress = 1.0;
    if (timeSinceShot < this.recoilDuration) {
      shotProgress = timeSinceShot / this.recoilDuration;
      // 擴大到 1.6 倍，再線性回到 1.0
      scale = 1.0 + (1.0 - shotProgress) * 0.6;
    }

    const isGrabActive = (this.inputType === 'webcam' && this.isPinching);
    let baseRadius = 20 * scale;
    if (isGrabActive) {
      baseRadius *= 0.72; // 體感捏合時外框收縮
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // 射擊瞬間的擴散波紋光環
    if (shotProgress < 1.0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 20 + shotProgress * 28, 0, Math.PI * 2);
      ctx.strokeStyle = '#fef08a';
      ctx.globalAlpha = (1.0 - shotProgress) * 0.75;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 外圍緩慢旋轉的輔助刻度虛線環
    ctx.save();
    const rotAngle = (now * 0.0012) * (this.id === 1 ? 1 : -1);
    ctx.rotate(rotAngle);
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 1.28, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = isGrabActive ? 5.5 : 3; // 捏合時線條加粗
    ctx.shadowBlur = isGrabActive ? 20 : 8; // 捏合時發光增強
    ctx.shadowColor = this.color;

    if (this.id === 1) {
      // 1P 準星：同心圓 + 十字線
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      // 捏合時中心實心圓變大
      ctx.arc(0, 0, baseRadius * (isGrabActive ? 0.72 : 0.35), 0, Math.PI * 2);
      ctx.fillStyle = isGrabActive ? '#fef08a' : this.color;
      ctx.fill();

      ctx.beginPath();
      // 上
      ctx.moveTo(0, -baseRadius * 1.55);
      ctx.lineTo(0, -baseRadius * (isGrabActive ? 0.8 : 0.6));
      // 下
      ctx.moveTo(0, baseRadius * (isGrabActive ? 0.8 : 0.6));
      ctx.lineTo(0, baseRadius * 1.55);
      // 左
      ctx.moveTo(-baseRadius * 1.55, 0);
      ctx.lineTo(-baseRadius * (isGrabActive ? 0.8 : 0.6), 0);
      // 右
      ctx.moveTo(baseRadius * (isGrabActive ? 0.8 : 0.6), 0);
      ctx.lineTo(baseRadius * 1.55, 0);
      ctx.stroke();

    } else {
      // 2P 準星：十字帶外圈與缺口
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 畫十字尖角
      ctx.beginPath();
      ctx.moveTo(0, -baseRadius * 1.45);
      ctx.lineTo(0, baseRadius * 1.45);
      ctx.moveTo(-baseRadius * 1.45, 0);
      ctx.lineTo(baseRadius * 1.45, 0);
      ctx.stroke();

      // 中心小圓點 (捏合時變為實心大圓)
      ctx.beginPath();
      ctx.arc(0, 0, isGrabActive ? baseRadius * 0.72 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isGrabActive ? '#fef08a' : this.color;
      ctx.fill();
    }

    // 高對比玩家標籤膠囊 ("1P" / "2P")
    const tagY = -baseRadius * 1.65 - 10;
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = this.color;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-14, tagY - 9, 28, 17, 8);
    } else {
      ctx.rect(-14, tagY - 9, 28, 17);
    }
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.id}P`, 0, tagY);

    ctx.restore();
  }
}
