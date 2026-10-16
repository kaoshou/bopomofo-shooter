// Particle & ParticleSystem - 處理氣球爆炸時的彩色煙火、星形粒子與擴散震波特效

class Particle {
  constructor(x, y, color, shape = 'circle') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.shape = shape; // 'circle' | 'star'
    
    // 隨機爆發速度 (圓形放射)
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 6.8;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    // 粒子半徑與自轉角度
    this.radius = shape === 'star' ? (5 + Math.random() * 5) : (3 + Math.random() * 5);
    this.rotation = Math.random() * Math.PI * 2;
    this.vRot = (Math.random() - 0.5) * 0.2;
    
    // 壽命 (生命值)
    this.alpha = 1.0;
    this.decay = 0.015 + Math.random() * 0.018; // 每幀衰減量
    
    // 重力影響
    this.gravity = 0.12;
  }

  update(dtScale = 1.0) {
    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;
    this.rotation += this.vRot * dtScale;
    
    // 套用重力
    this.vy += this.gravity * dtScale;
    
    // 空氣阻力 (微幅減速)
    this.vx *= Math.pow(0.975, dtScale);
    this.vy *= Math.pow(0.975, dtScale);
    
    // 減少透明度與大小
    this.alpha -= this.decay * dtScale;
    if (this.radius > 0.2) {
      this.radius -= 0.045 * dtScale;
    }
    
    return this.alpha > 0 && this.radius > 0.2;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;

    if (this.shape === 'star') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.beginPath();
      const spikes = 5;
      const outerR = this.radius * 1.3;
      const innerR = this.radius * 0.55;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / spikes;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class ShockwaveRing {
  constructor(x, y, color, maxRadius = 85) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = 15;
    this.maxRadius = maxRadius;
    this.alpha = 0.85;
    this.lineWidth = 5;
  }

  update(dtScale = 1.0) {
    this.radius += (this.maxRadius - this.radius) * 0.18 * dtScale;
    this.alpha -= 0.045 * dtScale;
    this.lineWidth = Math.max(1, this.lineWidth - 0.18 * dtScale);
    return this.alpha > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash([10, 6]);
    ctx.stroke();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.rings = [];
  }

  // 重設/清空所有粒子
  reset() {
    this.particles = [];
    this.rings = [];
  }

  // 在特定位置產生爆炸粒子與震波環
  spawnExplosion(x, y, color, count = 24, isCorrect = true) {
    // 加入擴散震波環
    this.rings.push(new ShockwaveRing(x, y, isCorrect ? '#fef08a' : '#f87171', isCorrect ? 95 : 70));
    if (isCorrect) {
      this.rings.push(new ShockwaveRing(x, y, color, 65));
    }

    for (let i = 0; i < count; i++) {
      let pColor = color;
      let shape = 'circle';
      
      if (isCorrect) {
        // 答對時加入閃耀星星與繽紛色彩
        if (Math.random() > 0.55) {
          const randHue = Math.floor(Math.random() * 360);
          pColor = `hsl(${randHue}, 95%, 65%)`;
        }
        if (i % 3 === 0) {
          shape = 'star';
          pColor = '#fef08a';
        }
      } else {
        // 答錯時混入灰白粉筆灰與暗紅色
        if (Math.random() > 0.4) {
          pColor = 'rgba(220, 220, 220, 0.85)';
        } else {
          pColor = '#f87171';
        }
      }
      
      this.particles.push(new Particle(x, y, pColor, shape));
    }
  }

  // 更新所有粒子與震波 (支援 dtScale)
  update(dtScale = 1.0) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      if (!this.rings[i].update(dtScale)) {
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const active = this.particles[i].update(dtScale);
      if (!active) {
        this.particles.splice(i, 1);
      }
    }
  }

  // 繪製所有粒子與震波
  draw(ctx) {
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].draw(ctx);
    }
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx);
    }
  }
}

// 建立全域粒子系統實例
const particleSystem = new ParticleSystem();
