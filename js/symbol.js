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
    this.hue = hue;
    this.color = `hsl(${hue}, 85%, 65%)`;
    this.borderColor = `hsl(${hue}, 85%, 45%)`;
    this.textColor = '#ffffff';

    // 預先生成固定的手繪粉筆斜刷紋理 (避免每幀重算造成閃爍與效能消耗)
    this.chalkStrokes = [];
    for (let offset = -1.45; offset <= 1.45; offset += 0.11) {
      if (Math.random() > 0.32) {
        this.chalkStrokes.push({
          offsetRatio: offset,
          alpha: 0.1 + Math.random() * 0.12,
          width: 1.2 + Math.random() * 1.2
        });
      }
    }

    // 氣球繩線長度與擺動
    this.stringLength = 42;
    this.tiltAngle = 0;
    this.isPopping = false;
    this.popProgress = 0.0;
  }

  // 更新氣球位置與擺動 (支援 dtScale 補償)
  update(dtScale = 1.0) {
    if (this.isPopping) {
      this.popProgress += 0.18 * dtScale; // 爆裂動畫速度
      if (this.popProgress >= 1.0) {
        this.active = false;
      }
      return 'active';
    }

    this.y += this.speed * dtScale;

    // 根據 Y 座標與正弦函數計算左右擺動與微幅鐘擺傾角
    const phase = this.y * this.wobbleSpeed + this.wobbleOffset;
    this.x = this.startX + Math.sin(phase) * this.wobbleStrength;
    this.tiltAngle = Math.cos(phase) * (this.wobbleStrength * 0.0045);

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

    // 處理爆裂瞬態膨脹與漸隱動畫
    let currentRadius = this.radius;
    if (this.isPopping) {
      ctx.globalAlpha = Math.max(0, 1 - this.popProgress);
      currentRadius = this.radius * (1 + this.popProgress * 0.35);
    }

    // 接近底部警戒線 (GAME_HEIGHT - 60) 時，繪製柔和危險警示光暈
    const dangerZoneY = GAME_HEIGHT - 190;
    if (!this.isPopping && this.y > dangerZoneY) {
      const dangerRatio = Math.min(1, (this.y - dangerZoneY) / 130);
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.015);
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius * (1.15 + pulse * 0.1), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(248, 113, 113, ${dangerRatio * (0.4 + pulse * 0.45)})`;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // 1. 繪製氣球繩線與結 (在旋轉座標系外或隨球體微擺)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    const bottomY = this.y + currentRadius * 1.04;
    ctx.moveTo(this.x, bottomY);
    ctx.bezierCurveTo(
      this.x + Math.sin(this.y * 0.05) * 10,
      bottomY + this.stringLength * 0.35,
      this.x - Math.sin(this.y * 0.05) * 8,
      bottomY + this.stringLength * 0.7,
      this.x + Math.sin(this.y * 0.03) * 4,
      bottomY + this.stringLength
    );
    ctx.stroke();

    // 將座標原點移至氣球中心並套用微幅擺動傾角
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tiltAngle);

    // 2. 氣球小三角形繫結
    ctx.beginPath();
    ctx.fillStyle = this.borderColor;
    ctx.moveTo(0, currentRadius - 2);
    ctx.lineTo(-8, currentRadius + 9);
    ctx.lineTo(8, currentRadius + 9);
    ctx.closePath();
    ctx.fill();

    // 3. 氣球主體 (圓形帶有粉筆紋理)
    ctx.beginPath();
    ctx.ellipse(0, 0, currentRadius * 0.95, currentRadius * 1.05, 0, 0, Math.PI * 2);
    
    // 3a. 使用放射漸層填色，製造立體球體與高光效果
    const grad = ctx.createRadialGradient(
      -currentRadius * 0.28, -currentRadius * 0.32, currentRadius * 0.08,
      0, 0, currentRadius * 1.15
    );
    grad.addColorStop(0, '#ffffff'); // 放射中心微亮高光
    grad.addColorStop(0.16, this.color); // 氣球亮面主色
    grad.addColorStop(1, this.borderColor); // 氣球暗面框色
    ctx.fillStyle = grad;
    ctx.fill();

    // 3b. clip 限制在氣球圓形內，繪製穩定的手繪粉筆斜刷質感 (Chalk Texture Overlay)
    ctx.save();
    ctx.clip();
    
    for (let i = 0; i < this.chalkStrokes.length; i++) {
      const s = this.chalkStrokes[i];
      const offset = s.offsetRatio * currentRadius;
      ctx.strokeStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(offset - currentRadius, -currentRadius);
      ctx.lineTo(offset + currentRadius, currentRadius);
      ctx.stroke();
    }
    ctx.restore(); // 結束 clip 限制

    // 3c. 繪製手繪描邊 (雙層粉筆線條感)
    ctx.beginPath();
    ctx.ellipse(0, 0, currentRadius * 0.95, currentRadius * 1.05, 0, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.borderColor;
    ctx.stroke();

    // 重疊繪製第二次細框，製造複寫的手繪粉筆線條感
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.stroke();

    // 4. 氣球反光效果 (立體高光貼圖 + 次要小反光點)
    ctx.beginPath();
    ctx.ellipse(-currentRadius * 0.35, -currentRadius * 0.4, currentRadius * 0.2, currentRadius * 0.1, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-currentRadius * 0.48, -currentRadius * 0.18, currentRadius * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();

    // 5. 繪製注音文字 (取消傾角讓注音符號維持端正易讀，並增加粉筆微光)
    ctx.rotate(-this.tiltAngle);
    ctx.font = `900 ${currentRadius * 1.1}px "Noto Sans TC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 5a. 文字陰影 (粗描邊模擬黑板粉筆字立體襯底)
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.strokeText(this.char, 0, 2);

    // 5b. 文字主體與粉筆粉塵微光
    ctx.save();
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.fillStyle = this.textColor;
    ctx.fillText(this.char, 0, 0);
    ctx.restore();

    ctx.restore();
  }
}
