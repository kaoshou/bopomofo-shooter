// 遊戲全域設定與資料結構

// 37 個注音符號定義
const ZHUYIN_LIST = [
  // 聲母 (21)
  { char: 'ㄅ', group: 'consonant', name: 'ㄅ' },
  { char: 'ㄆ', group: 'consonant', name: 'ㄆ' },
  { char: 'ㄇ', group: 'consonant', name: 'ㄇ' },
  { char: 'ㄈ', group: 'consonant', name: 'ㄈ' },
  { char: 'ㄉ', group: 'consonant', name: 'ㄉ' },
  { char: 'ㄊ', group: 'consonant', name: 'ㄊ' },
  { char: 'ㄋ', group: 'consonant', name: 'ㄋ' },
  { char: 'ㄌ', group: 'consonant', name: 'ㄌ' },
  { char: 'ㄍ', group: 'consonant', name: 'ㄍ' },
  { char: 'ㄎ', group: 'consonant', name: 'ㄎ' },
  { char: 'ㄏ', group: 'consonant', name: 'ㄏ' },
  { char: 'ㄐ', group: 'consonant', name: 'ㄐ' },
  { char: 'ㄑ', group: 'consonant', name: 'ㄑ' },
  { char: 'ㄒ', group: 'consonant', name: 'ㄒ' },
  { char: 'ㄓ', group: 'consonant', name: 'ㄓ' },
  { char: 'ㄔ', group: 'consonant', name: 'ㄔ' },
  { char: 'ㄕ', group: 'consonant', name: 'ㄕ' },
  { char: 'ㄖ', group: 'consonant', name: 'ㄖ' },
  { char: 'ㄗ', group: 'consonant', name: 'ㄗ' },
  { char: 'ㄘ', group: 'consonant', name: 'ㄘ' },
  { char: 'ㄙ', group: 'consonant', name: 'ㄙ' },
  
  // 介母 (3)
  { char: 'ㄧ', group: 'medial', name: 'ㄧ' },
  { char: 'ㄨ', group: 'medial', name: 'ㄨ' },
  { char: 'ㄩ', group: 'medial', name: 'ㄩ' },
  
  // 韻母 (13)
  { char: 'ㄚ', group: 'vowel', name: 'ㄚ' },
  { char: 'ㄛ', group: 'vowel', name: 'ㄛ' },
  { char: 'ㄜ', group: 'vowel', name: 'ㄜ' },
  { char: 'ㄝ', group: 'vowel', name: 'ㄝ' },
  { char: 'ㄞ', group: 'vowel', name: 'ㄞ' },
  { char: 'ㄟ', group: 'vowel', name: 'ㄟ' },
  { char: 'ㄠ', group: 'vowel', name: 'ㄠ' },
  { char: 'ㄡ', group: 'vowel', name: 'ㄡ' },
  { char: 'ㄢ', group: 'vowel', name: 'ㄢ' },
  { char: 'ㄣ', group: 'vowel', name: 'ㄣ' },
  { char: 'ㄤ', group: 'vowel', name: 'ㄤ' },
  { char: 'ㄥ', group: 'vowel', name: 'ㄥ' },
  { char: 'ㄦ', group: 'vowel', name: 'ㄦ' }
];

// 難度設定
const DIFFICULTY_CONFIG = {
  easy: {
    label: '初級',
    description: '只出現常見 8 個符號，掉落速度慢，干擾少',
    allowedSymbols: ['ㄅ', 'ㄆ', 'ㄇ', 'ㄈ', 'ㄉ', 'ㄊ', 'ㄋ', 'ㄌ'],
    balloonCount: 3,        // 同時出現在畫面上的氣球數
    speedMin: 0.35,          // 最慢速度 (px/frame) - 調慢以利辨識與操作
    speedMax: 0.65,          // 最快速度
    spawnInterval: 2200,    // 氣球產生間隔 (ms)
    timeLimit: 60,          // 遊戲限時 (秒)
    lives: 5                // 生命值
  },
  medium: {
    label: '中級',
    description: '加入更多符號，掉落速度加快，干擾氣球變多',
    // 包含大部分聲母與韻母
    allowedSymbols: [
      'ㄅ', 'ㄆ', 'ㄇ', 'ㄈ', 'ㄉ', 'ㄊ', 'ㄋ', 'ㄌ', 
      'ㄍ', 'ㄎ', 'ㄏ', 'ㄐ', 'ㄑ', 'ㄒ', 'ㄧ', 'ㄨ', 'ㄩ', 
      'ㄚ', 'ㄛ', 'ㄜ', 'ㄝ'
    ],
    balloonCount: 4,
    speedMin: 0.55,
    speedMax: 0.95,
    spawnInterval: 1800,
    timeLimit: 60,
    lives: 5
  },
  hard: {
    label: '高級',
    description: '包含所有 37 個注音，速度極快，氣球晃動，多重干擾',
    allowedSymbols: ZHUYIN_LIST.map(s => s.char),
    balloonCount: 6,
    speedMin: 0.75,
    speedMax: 1.30,
    spawnInterval: 1300,
    timeLimit: 60,
    lives: 3
  },
  boss: {
    label: '魔王挑戰',
    description: '限時連續聽音！魔王會不斷丟出氣球，快速射擊來削減魔王血量！',
    allowedSymbols: ZHUYIN_LIST.map(s => s.char),
    balloonCount: 8,
    speedMin: 0.95,
    speedMax: 1.60,
    spawnInterval: 900,
    timeLimit: 45,
    lives: 3,
    bossHp: 15 // 需要答對 15 題擊敗 Boss
  }
};

// 全域常數設定
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const ASPECT_RATIO = 16 / 9;

// 遊戲配置設定（支援 localStorage 持久化）
const gameSettings = {
  repeatInterval: 3, // 語音重播間隔 (秒)，0 代表不重播
  sfxVolume: 0.8,    // 音效音量 (0.0 ~ 1.0)
  voiceVolume: 1.0,  // 語音音量 (0.0 ~ 1.0)
  speedScale: 1.0,   // 氣球掉落速度倍率 (0.7: 慢速, 1.0: 標準, 1.3: 快速, 1.6: 超快, 2.0: 極速, 2.5: 瘋狂)
  gunSmoothing: 0.35,// 光線槍瞄準平滑係數 (0.6: 極速, 0.35: 標準, 0.15: 抗抖)
  bgmVolume: 0.3,    // 背景音樂音量大小 (0.0 ~ 1.0, 預設 30%)
  gameTime: 60,      // 遊戲時間 (秒，預設 60 秒)
  
  load() {
    const saved = localStorage.getItem('bpmf_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.repeatInterval === 'number') this.repeatInterval = parsed.repeatInterval;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
        if (typeof parsed.voiceVolume === 'number') this.voiceVolume = parsed.voiceVolume;
        if (typeof parsed.speedScale === 'number') this.speedScale = parsed.speedScale;
        if (typeof parsed.gunSmoothing === 'number') this.gunSmoothing = parsed.gunSmoothing;
        if (typeof parsed.bgmVolume === 'number') this.bgmVolume = parsed.bgmVolume;
        if (typeof parsed.gameTime === 'number') this.gameTime = parsed.gameTime;
      } catch (e) {
        console.error("載入設定失敗，使用預設值", e);
      }
    }
  },
  
  save() {
    localStorage.setItem('bpmf_settings', JSON.stringify({
      repeatInterval: this.repeatInterval,
      sfxVolume: this.sfxVolume,
      voiceVolume: this.voiceVolume,
      speedScale: this.speedScale,
      gunSmoothing: this.gunSmoothing,
      bgmVolume: this.bgmVolume,
      gameTime: this.gameTime
    }));
  }
};

// 立即載入設定
gameSettings.load();
