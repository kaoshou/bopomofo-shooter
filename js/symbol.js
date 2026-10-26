// Balloon 類別 - 管理注音符號掉落氣球與夜市射氣球標靶 (彩色氣球、黃金氣球、加時氣球、危險炸彈)

class Balloon {
  constructor(char, x, y, radius, speed, isCorrect, difficulty, arcadeType = null) {
    this.char = char;           // 氣球內的注音符號或標記
    this.startX = x;            // 基準 X 座標
    this.x = x;                 // 當前 X 座標
    this.y = y;                 // 當前 Y 座標
    this.radius = radius;       // 碰撞半徑
    this.speed = speed;         // 移動速度
    this.isCorrect = isCorrect; // 是否為正確答案
    this.active = true;         // 是否仍在畫面上
    this.arcadeType = arcadeType; // null (注音模式) | 'normal' | 'gold' | 'time' | 'bomb'
    this.isArcade = arcadeType !== null;

    // 依據難度調整左右擺動幅度 (wobble)
    this.wobbleSpeed = 0.025 + Math.random() * 0.02;
    this.wobbleStrength = 0;
    
    if (difficulty === 'hard' || difficulty === 'boss') {
      this.wobbleStrength = 16 + Math.random() * 22; // 高級/Boss 會明顯左右擺動
    } else if (difficulty === 'medium') {
      this.wobbleStrength = 6 + Math.random() * 8;   // 中級微幅擺動
    } else if (this.isArcade) {
      this.wobbleStrength = 3 + Math.random() * 4;   // 夜市初級自然輕微飄動
    }

    this.wobbleOffset = Math.random() * Math.PI * 2; // 隨機相位差

    // 氣球外觀色彩
    const hue = Math.floor(Math.random() * 360);
    this.hue = hue;
    if (this.arcadeType === 'gold') {
      this.color = '#facc15';
      this.borderColor = '#ca8a04';
    } else if (this.arcadeType === 'time') {
      this.color = '#22d3ee';
      this.borderColor = '#0891b2';
    } else if (this.arcadeType === 'bomb') {
      this.color = '#334155';
      this.borderColor = '#0f172a';
    } else {
      this.color = `hsl(${hue}, 85%, 65%)`;
      this.borderColor = `hsl(${hue}, 85%, 45%)`;
    }
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
    this.stringLength = this.arcadeType === 'bomb' ? 0 : 42;
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

    if (this.isArcade) {
      // 夜市打氣球模式：氣球由下往上飛升
      this.y -= this.speed * dtScale;
    } else {
      // 注音聽音模式：氣球由上往下掉落
      this.y += this.speed * dtScale;
    }

    // 根據 Y 座標與正弦函數計算左右擺動與微幅鐘擺傾角
    const phase = this.y * this.wobbleSpeed + this.wobbleOffset;
    this.x = this.startX + Math.sin(phase) * this.wobbleStrength;
    // 確保左右擺動不超出畫布邊界
    this.x = Math.max(this.radius + 15, Math.min(GAME_WIDTH - this.radius - 15, this.x));
    this.tiltAngle = Math.cos(phase) * (this.wobbleStrength * 0.0045);

    if (this.isArcade) {
      // 夜市模式：檢查是否飛出畫面頂部
      if (this.y + this.radius + this.stringLength < -20) {
        this.active = false;
        return 'escaped';
      }
    } else {
      // 注音模式：檢查是否超出畫面底部
      if (this.y - this.radius > GAME_HEIGHT) {
        this.active = false;
        return 'missed'; // 代表漏答
      }
    }
    return 'active';
  }

  // 檢查是否擊中 (點到圓心的距離平方小於半徑平方，效率較佳)
  checkCollision(px, py) {
    if (!this.active || this.isPopping) return false;
    
    const dx = px - this.x;
    const dy = py - this.y;
    const distanceSq = dx * dx + dy * dy;
    
    // 稍微放寬碰撞判定，讓滑鼠與光線槍更好瞄準 (炸彈不額外放大容差以免誤傷，一般氣球增加 10px 容差)
    const hitRadius = this.arcadeType === 'bomb' ? this.radius + 2 : this.radius + 10;
    return distanceSq < hitRadius * hitRadius;
  }

  // 繪製危險炸彈標靶 (夜市模式專用)
  drawBomb(ctx, currentRadius) {
    const now = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.018);

    // 外圍紅色危險脈衝光圈
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius * (1.12 + pulse * 0.08), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 + pulse * 0.45})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.restore();

    ctx.translate(this.x, this.y);
    ctx.rotate(this.tiltAngle * 0.6);

    // 1. 炸彈頂部金屬引線底座
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-currentRadius * 0.22, -currentRadius * 1.12, currentRadius * 0.44, currentRadius * 0.22);
    ctx.fill();
    ctx.stroke();

    // 2. 彎曲引線
    ctx.beginPath();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.5;
    ctx.moveTo(0, -currentRadius * 1.12);
    ctx.quadraticCurveTo(currentRadius * 0.25, -currentRadius * 1.45, currentRadius * 0.42, -currentRadius * 1.32);
    ctx.stroke();

    // 3. 引線末端的動態跳動火花
    const sparkX = currentRadius * 0.42;
    const sparkY = -currentRadius * 1.32;
    ctx.save();
    ctx.translate(sparkX, sparkY);
    ctx.rotate((now * 0.01) % (Math.PI * 2));
    ctx.fillStyle = pulse > 0.5 ? '#fef08a' : '#f97316';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ef4444';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -8 - pulse * 5);
      ctx.strokeStyle = i % 2 === 0 ? '#fef08a' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. 炸彈黑色金屬球體
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(
      -currentRadius * 0.3, -currentRadius * 0.3, currentRadius * 0.08,
      0, 0, currentRadius * 1.05
    );
    grad.addColorStop(0, '#64748b');
    grad.addColorStop(0.25, '#1e293b');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    // 5. 炸彈表面高光
    ctx.beginPath();
    ctx.ellipse(-currentRadius * 0.35, -currentRadius * 0.35, currentRadius * 0.18, currentRadius * 0.09, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.fill();

    // 6. 中央醒目危險骷髏 / 叉叉標記
    ctx.rotate(-this.tiltAngle * 0.6);
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    const r = currentRadius * 0.34;
    ctx.beginPath();
    ctx.moveTo(-r, -r + 4);
    ctx.lineTo(r, r + 4);
    ctx.moveTo(r, -r + 4);
    ctx.lineTo(-r, r + 4);
    ctx.stroke();

    ctx.font = `900 ${currentRadius * 0.42}px "Fredoka", "Noto Sans TC", sans-serif`;
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOMB', 0, -currentRadius * 0.36);
  }

  // 在 Canvas 上繪製氣球與注音/夜市標靶
  draw(ctx) {
    if (!this.active) return;

    ctx.save();

    // 處理爆裂瞬態膨脹與漸隱動畫
    let currentRadius = this.radius;
    if (this.isPopping) {
      ctx.globalAlpha = Math.max(0, 1 - this.popProgress);
      currentRadius = this.radius * (1 + this.popProgress * 0.35);
    }

    // 如果是夜市模式的炸彈，呼叫炸彈專屬繪製
    if (this.isArcade && this.arcadeType === 'bomb') {
      this.drawBomb(ctx, currentRadius);
      ctx.restore();
      return;
    }

    // 注音模式下：接近底部警戒線 (GAME_HEIGHT - 60) 時，繪製柔和危險警示光暈
    const dangerZoneY = GAME_HEIGHT - 190;
    if (!this.isArcade && !this.isPopping && this.y > dangerZoneY) {
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

    // 黃金氣球專屬外圍閃耀光環
    if (this.arcadeType === 'gold' && !this.isPopping) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.02);
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius * (1.14 + pulse * 0.08), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(254, 240, 138, ${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 1. 繪製氣球繩線與結
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

    // 5. 繪製氣球中央文字或夜市圖騰 (取消傾角讓符號維持端正易讀)
    ctx.rotate(-this.tiltAngle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!this.isArcade) {
      // 注音模式：繪製注音符號
      ctx.font = `900 ${currentRadius * 1.1}px "Noto Sans TC", sans-serif`;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.strokeText(this.char, 0, 2);

      ctx.save();
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      ctx.fillStyle = this.textColor;
      ctx.fillText(this.char, 0, 0);
      ctx.restore();
    } else if (this.arcadeType === 'gold') {
      // 夜市黃金高分氣球：繪製 ★300
      ctx.font = `900 ${currentRadius * 0.62}px "Fredoka", "Noto Sans TC", sans-serif`;
      ctx.lineWidth = 4.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(66, 32, 6, 0.85)';
      ctx.strokeText('★300', 0, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('★300', 0, 0);
    } else if (this.arcadeType === 'time') {
      // 夜市時間獎勵氣球：繪製 +3s
      ctx.font = `900 ${currentRadius * 0.72}px "Fredoka", "Noto Sans TC", sans-serif`;
      ctx.lineWidth = 4.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(8, 51, 68, 0.85)';
      ctx.strokeText('+3s', 0, 2);
      ctx.fillStyle = '#fef08a';
      ctx.fillText('+3s', 0, 0);
    } else {
      // 夜市一般彩色氣球：繪製柔和手繪星芒光紋，呈現純粹夜市氣球感
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const sr = currentRadius * 0.22;
      ctx.beginPath();
      ctx.arc(0, currentRadius * 0.12, sr, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}
