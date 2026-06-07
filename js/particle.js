// Particle & ParticleSystem - 處理氣球爆炸時的彩色煙火/粒子特效

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    
    // 隨機爆發速度 (圓形放射)
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    // 粒子半徑
    this.radius = 3 + Math.random() * 5;
    
    // 壽命 (生命值)
    this.alpha = 1.0;
    this.decay = 0.015 + Math.random() * 0.02; // 每幀衰減量
    
    // 重力影響
    this.gravity = 0.12;
  }

  update(dtScale = 1.0) {
    this.x += this.vx * dtScale;
    this.y += this.vy * dtScale;
    
    // 套用重力
    this.vy += this.gravity * dtScale;
    
    // 隨機阻力 (微幅減速)
    this.vx *= Math.pow(0.98, dtScale);
    this.vy *= Math.pow(0.98, dtScale);
    
    // 減少透明度與大小
    this.alpha -= this.decay * dtScale;
    if (this.radius > 0.2) {
      this.radius -= 0.05 * dtScale;
    }
    
    return this.alpha > 0 && this.radius > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  // 重設/清空所有粒子
  reset() {
    this.particles = [];
  }

  // 在特定位置產生爆炸粒子
  spawnExplosion(x, y, color, count = 20) {
    // 如果傳入的顏色是 HSL，我們可以直接使用，或者搭配隨機亮色以獲得煙火色彩
    const isHsl = typeof color === 'string' && color.startsWith('hsl');
    
    for (let i = 0; i < count; i++) {
      let pColor = color;
      
      // 有些粒子可以使用隨機彩虹色，讓爆炸看起來更耀眼
      if (Math.random() > 0.6) {
        const randHue = Math.floor(Math.random() * 360);
        pColor = `hsl(${randHue}, 95%, 60%)`;
      }
      
      this.particles.push(new Particle(x, y, pColor));
    }
  }

  // 更新所有粒子 (支援 dtScale)
  update(dtScale = 1.0) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const active = this.particles[i].update(dtScale);
      if (!active) {
        this.particles.splice(i, 1);
      }
    }
  }

  // 繪製所有粒子
  draw(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx);
    }
  }
}

// 建立全域粒子系統實例
const particleSystem = new ParticleSystem();
