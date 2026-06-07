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
    this.isPopping = false;
    this.popProgress = 0.0;
  }

  // 更新氣球位置與擺動 (支援 dtScale 補償)
  update(dtScale = 1.0) {
    if (this.isPopping) {
      this.popProgress += 0.15 * dtScale; // 爆裂動畫速度
      if (this.popProgress >= 1.0) {
        this.active = false;
      }
      return 'active';
    }

    this.y += this.speed * dtScale;

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
    if (!this.active || this.isPopping) return false;
    
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

    // 處理漸隱與縮小動畫
    let currentRadius = this.radius;
    if (this.isPopping) {
      ctx.globalAlpha = Math.max(0, 1 - this.popProgress);
      currentRadius = this.radius * Math.max(0, 1 - this.popProgress);
    }

    // 1. 繪製氣球繩線與結
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    // 繪製微彎的細線
    ctx.moveTo(this.x, this.y + currentRadius);
    ctx.quadraticCurveTo(
      this.x + Math.sin(this.y * 0.05) * 8, 
      this.y + currentRadius + this.stringLength * 0.5,
      this.x, 
      this.y + currentRadius + this.stringLength
    );
    ctx.stroke();

    // 2. 氣球小三角形繫結
    ctx.beginPath();
    ctx.fillStyle = this.borderColor;
    ctx.moveTo(this.x, this.y + currentRadius - 2);
    ctx.lineTo(this.x - 8, this.y + currentRadius + 10);
    ctx.lineTo(this.x + 8, this.y + currentRadius + 10);
    ctx.closePath();
    ctx.fill();

    // 3. 氣球主體 (圓形帶有粉筆紋理)
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, currentRadius * 0.95, currentRadius * 1.05, 0, 0, Math.PI * 2);
    
    // 3a. 使用放射漸層填色，製造立體球體與高光效果
    const grad = ctx.createRadialGradient(
      this.x - currentRadius * 0.25, this.y - currentRadius * 0.3, currentRadius * 0.1,
      this.x, this.y, currentRadius * 1.2
    );
    grad.addColorStop(0, '#ffffff'); // 放射中心微亮高光
    grad.addColorStop(0.15, this.color); // 氣球亮面主色
    grad.addColorStop(1, this.borderColor); // 氣球暗面框色
    ctx.fillStyle = grad;
    ctx.fill();

    // 3b. clip 限制在氣球圓形內，繪製手繪粉筆斜刷質感 (Chalk Texture Overlay)
    ctx.save();
    ctx.clip();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // 半透明白
    ctx.lineWidth = 1.8;
    // 隨機傾斜的粉筆手繪掃描線
    for (let offset = -currentRadius * 1.5; offset < currentRadius * 1.5; offset += 5.5) {
      if (Math.random() > 0.35) { // 模擬粉筆在黑板摩擦產生的不均勻紋路
        ctx.beginPath();
        ctx.moveTo(this.x + offset - currentRadius, this.y - currentRadius);
        ctx.lineTo(this.x + offset + currentRadius, this.y + currentRadius);
        ctx.stroke();
      }
    }
    ctx.restore(); // 結束 clip 限制

    // 3c. 繪製手繪描邊 (粗細微抖動的手寫感)
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, currentRadius * 0.95, currentRadius * 1.05, 0, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.borderColor;
    ctx.stroke();

    // 重疊繪製第二次細框，製造複寫的手繪線條感
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    // 4. 氣球反光效果 (立體高光貼圖，略微調低透明度以融合粉筆視覺)
    ctx.beginPath();
    ctx.ellipse(this.x - currentRadius * 0.35, this.y - currentRadius * 0.4, currentRadius * 0.2, currentRadius * 0.1, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();

    // 5. 繪製注音文字 (增加粉筆灰邊緣微光效果)
    ctx.font = `900 ${currentRadius * 1.1}px Noto Sans TC`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 5a. 文字陰影 (粗描邊模擬黑板粉筆字黑影)
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeText(this.char, this.x, this.y);

    // 5b. 文字主體與粉筆粉塵微光
    ctx.save();
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.45)'; // 邊緣粉筆發散微光
    ctx.fillStyle = this.textColor;
    ctx.fillText(this.char, this.x, this.y);
    ctx.restore();

    ctx.restore();
  }
}
