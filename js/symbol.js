// Balloon 類別 - 管理掉落的注音符號氣球

class Balloon {
  constructor(char, x, y, radius, speed, isCorrect, difficulty) {
    this.char = char;         // 氣球內的注音符號
    this.startX = x;          // 基準 X 座標
    this.x = x;               // 當前 X 座標
    this.y = y;               // 當前 Y 座標
    this.radius = radius;     // 碰撞半徑
    this.speed = speed;       // 掉落速度
    this.isCorrect = isCorrect; // 是否為正確答案
    this.active = true;       // 是否仍在畫面上

    // 依據難度調整左右擺動幅度 (wobble)
    this.wobbleSpeed = 0.03 + Math.random() * 0.02;
    this.wobbleStrength = 0;
    
    if (difficulty === 'hard' || difficulty === 'boss') {
      this.wobbleStrength = 15 + Math.random() * 20; // 高級/Boss 會左右擺動
    } else if (difficulty === 'medium') {
      this.wobbleStrength = 5 + Math.random() * 5;   // 中級微幅擺動
    }

    this.wobbleOffset = Math.random() * Math.PI * 2; // 隨機相位差

    // 氣球外觀色彩 - 使用明亮和諧的粉嫩 HSL 色彩
    const hue = Math.floor(Math.random() * 360);
    this.color = `hsl(${hue}, 85%, 65%)`;
    this.borderColor = `hsl(${hue}, 85%, 45%)`;
    this.textColor = '#ffffff';

    // 氣球繩線長度與擺動
    this.stringLength = 40;
  }

  // 更新氣球位置與擺動
  update() {
    this.y += this.speed;

    // 根據 Y 座標與正弦函數計算左右擺動
    this.x = this.startX + Math.sin(this.y * this.wobbleSpeed + this.wobbleOffset) * this.wobbleStrength;

    // 檢查是否超出畫面底部
    if (this.y - this.radius > GAME_HEIGHT) {
      this.active = false;
      return 'missed'; // 代表漏答
    }
    return 'active';
  }

  // 檢查是否擊中 (點到圓心的距離平方小於半徑平方，效率較佳)
  checkCollision(px, py) {
    if (!this.active) return false;
    
    const dx = px - this.x;
    const dy = py - this.y;
    const distanceSq = dx * dx + dy * dy;
    
    // 稍微放寬碰撞判定，讓滑鼠與光線槍更好瞄準 (增加 10px 判定容差)
    const hitRadius = this.radius + 10;
    return distanceSq < hitRadius * hitRadius;
  }

  // 在 Canvas 上繪製氣球與注音
  draw(ctx) {
    if (!this.active) return;

    ctx.save();

    // 1. 繪製氣球繩線與結
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    // 繪製微彎的細線
    ctx.moveTo(this.x, this.y + this.radius);
    ctx.quadraticCurveTo(
      this.x + Math.sin(this.y * 0.05) * 8, 
      this.y + this.radius + this.stringLength * 0.5,
      this.x, 
      this.y + this.radius + this.stringLength
    );
    ctx.stroke();

    // 2. 氣球小三角形繫結
    ctx.beginPath();
    ctx.fillStyle = this.borderColor;
    ctx.moveTo(this.x, this.y + this.radius - 2);
    ctx.lineTo(this.x - 8, this.y + this.radius + 10);
    ctx.lineTo(this.x + 8, this.y + this.radius + 10);
    ctx.closePath();
    ctx.fill();

    // 3. 氣球主體 (圓形)
    ctx.beginPath();
    // 為了讓氣球看起來更像真氣球，使用稍微拉長橢圓
    ctx.ellipse(this.x, this.y, this.radius * 0.95, this.radius * 1.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.borderColor;
    ctx.stroke();

    // 4. 氣球反光效果 (立體感)
    ctx.beginPath();
    ctx.ellipse(this.x - this.radius * 0.35, this.y - this.radius * 0.4, this.radius * 0.2, this.radius * 0.1, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    // 5. 繪製注音文字
    ctx.font = `900 ${this.radius * 1.1}px Noto Sans TC`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 文字陰影 / 描邊
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeText(this.char, this.x, this.y);

    ctx.fillStyle = this.textColor;
    ctx.fillText(this.char, this.x, this.y);

    ctx.restore();
  }
}
