// AudioManager - 管理注音讀音與音效

class AudioManager {
  constructor() {
    this.ctx = null; // Web Audio API Context (延遲初始化)
    this.speechSynthesis = window.speechSynthesis;
    this.chineseVoice = null;
    this.currentAudio = null; // 快取當前正在播放的 Audio 物件
    
    // 初始化語音
    this.initVoice();
    if (this.speechSynthesis && this.speechSynthesis.onvoiceschanged !== undefined) {
      this.speechSynthesis.onvoiceschanged = () => this.initVoice();
    }
  }

  // 初始化 Web Audio API (需在使用者互動後呼叫)
  initAudioContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 尋找適合的中文語音 (偏好台灣 zh-TW，其次 zh-HK / zh-CN)
  initVoice() {
    if (!this.speechSynthesis) return;
    const voices = this.speechSynthesis.getVoices();
    
    // 優先尋找台灣 (zh-TW) 語音
    this.chineseVoice = voices.find(voice => voice.lang.includes('zh-TW') || voice.lang.includes('zh_TW')) ||
                        voices.find(voice => voice.lang.includes('zh-HK') || voice.lang.includes('zh_HK')) ||
                        voices.find(voice => voice.lang.includes('zh-CN') || voice.lang.includes('zh_CN')) ||
                        voices.find(voice => voice.lang.toLowerCase().includes('zh'));
  }

  // 播放注音讀音 (優先使用本機教育部官方標準音檔，TTS 為輔)
  playZhuyin(char) {
    // 教育部官方音檔順序 (聲母 21 -> 韻母 13 -> 介母 3)
    const ZHUYIN_AUDIO_MAP = {
      'ㄅ': 1, 'ㄆ': 2, 'ㄇ': 3, 'ㄈ': 4, 'ㄉ': 5, 'ㄊ': 6, 'ㄋ': 7, 'ㄌ': 8,
      'ㄍ': 9, 'ㄎ': 10, 'ㄏ': 11, 'ㄐ': 12, 'ㄑ': 13, 'ㄒ': 14,
      'ㄓ': 15, 'ㄔ': 16, 'ㄕ': 17, 'ㄖ': 18, 'ㄗ': 19, 'ㄘ': 20, 'ㄙ': 21,
      'ㄚ': 22, 'ㄛ': 23, 'ㄜ': 24, 'ㄝ': 25, 'ㄞ': 26, 'ㄟ': 27, 'ㄠ': 28, 'ㄡ': 29,
      'ㄢ': 30, 'ㄣ': 31, 'ㄤ': 32, 'ㄥ': 33, 'ㄦ': 34,
      'ㄧ': 35, 'ㄨ': 36, 'ㄩ': 37
    };
    
    const audioNum = ZHUYIN_AUDIO_MAP[char];
    
    if (audioNum) {
      // 改用本機專案目錄的音檔路徑，實現 100% 離線執行且載入零延遲
      const audioUrl = `audio/F${audioNum}.WAV`;

      // 停止先前正在播的語音，防止多重發音混疊
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // 同步暫停 TTS fallback 避免混音
      if (this.speechSynthesis) {
        this.speechSynthesis.cancel();
      }

      // 動態建立 Audio 物件進行高音質標準朗讀
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = typeof gameSettings !== 'undefined' ? gameSettings.voiceVolume : 1.0;
      
      this.currentAudio.play().then(() => {
        console.log(`成功播放教育部標準發音檔 [F${audioNum}.WAV] (${char})`);
      }).catch(err => {
        console.warn(`本機發音檔播放失敗， fallback 使用 TTS 合成音`, err);
        this.playZhuyinTTS(char);
      });
    } else {
      this.playZhuyinTTS(char);
    }
  }

  // TTS 語音發音 Fallback
  playZhuyinTTS(char) {
    if (!this.speechSynthesis) return;
    this.speechSynthesis.cancel();

    // 將注音符號對應至 100% 穩定的同音漢字，避免瀏覽器語音引擎朗讀注音字元時無聲
    const PRONUNCIATION_MAP = {
      'ㄅ': '波', 'ㄆ': '坡', 'ㄇ': '摸', 'ㄈ': '佛',
      'ㄉ': '得', 'ㄊ': '特', 'ㄋ': '呢', 'ㄌ': '勒',
      'ㄍ': '哥', 'ㄎ': '科', 'ㄏ': '喝',
      'ㄐ': '雞', 'ㄑ': '七', 'ㄒ': '西',
      'ㄓ': '知', 'ㄔ': '吃', 'ㄕ': '獅', 'ㄖ': '日',
      'ㄗ': '資', 'ㄘ': '刺', 'ㄙ': '絲',
      'ㄧ': '衣', 'ㄨ': '屋', 'ㄩ': '魚',
      'ㄚ': '阿', 'ㄛ': '喔', 'ㄜ': '鵝', 'ㄝ': '誒',
      'ㄞ': '哀', 'ㄟ': '欸', 'ㄠ': '熬', 'ㄡ': '歐',
      'ㄢ': '安', 'ㄣ': '恩', 'ㄤ': '昂', 'ㄥ': '哼', 'ㄦ': '兒'
    };

    const speakWord = PRONUNCIATION_MAP[char] || char;
    const textToSpeak = `${speakWord}，，${speakWord}`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (this.chineseVoice) {
      utterance.voice = this.chineseVoice;
    }
    utterance.rate = 0.65; 
    utterance.pitch = 1.0; 
    utterance.volume = typeof gameSettings !== 'undefined' ? gameSettings.voiceVolume : 1.0;

    this.speechSynthesis.speak(utterance);
  }

  // 播放射擊音效 (Web Audio API 合成)
  playShoot() {
    this.initAudioContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    // 模擬鐳射槍：頻率快速從高到低
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);
    
    // 音量快速衰減 (乘上音效音量)
    const vol = typeof gameSettings !== 'undefined' ? gameSettings.sfxVolume : 0.8;
    gain.gain.setValueAtTime(0.2 * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * vol, this.ctx.currentTime + 0.15);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // 播放答對音效 (Web Audio API 合成：快速上升的雙音節嗶嗶聲)
  playCorrect() {
    this.initAudioContext();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const vol = typeof gameSettings !== 'undefined' ? gameSettings.sfxVolume : 0.8;
    
    const playNote = (pitch, startTime, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25 * vol, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01 * vol, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // 播放 C5 (523Hz) -> G5 (784Hz)
    playNote(523, time, 0.1);
    playNote(784, time + 0.08, 0.25);
  }

  // 播放答錯音效 (Web Audio API 合成：低沉下行的警報聲)
  playWrong() {
    this.initAudioContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sawtooth';
    // 模擬低沉逼逼聲：180Hz -> 90Hz
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.35);
    
    const vol = typeof gameSettings !== 'undefined' ? gameSettings.sfxVolume : 0.8;
    gain.gain.setValueAtTime(0.3 * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * vol, this.ctx.currentTime + 0.35);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.36);
  }

  // 播放連擊 (Combo) 音效 (隨 Combo 數提高頻率的清脆叮咚聲)
  playCombo(comboCount) {
    this.initAudioContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sine';
    
    // 基礎音高為 E5 (659Hz)，每多 1 Combo 提升半音
    const baseFreq = 659.25;
    const semitones = Math.min(12, comboCount); // 最多升 12 個半音 (一個八度)
    const freq = baseFreq * Math.pow(1.059463, semitones);
    
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    const vol = typeof gameSettings !== 'undefined' ? gameSettings.sfxVolume : 0.8;
    gain.gain.setValueAtTime(0.2 * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01 * vol, this.ctx.currentTime + 0.25);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  // 播放遊戲勝利音效 (歡樂的琶音)
  playWin() {
    this.initAudioContext();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const vol = typeof gameSettings !== 'undefined' ? gameSettings.sfxVolume : 0.8;
    
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + index * 0.1);
      
      gain.gain.setValueAtTime(0, time + index * 0.1);
      gain.gain.linearRampToValueAtTime(0.15 * vol, time + index * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01 * vol, time + index * 0.1 + 0.3);
      
      osc.start(time + index * 0.1);
      osc.stop(time + index * 0.1 + 0.35);
    });
  }

  // 播放遊戲結束 / 失敗音效 (悲傷的下行音調)
  playLose() {
    this.initAudioContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330, this.ctx.currentTime); // E4
    osc.frequency.linearRampToValueAtTime(165, this.ctx.currentTime + 0.8); // E3
    
    const vol = typeof gameSettings !== 'undefined' ? gameSettings.sfxVolume : 0.8;
    gain.gain.setValueAtTime(0.2 * vol, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2 * vol, this.ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01 * vol, this.ctx.currentTime + 0.8);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.81);
  }
}

// 建立全域音效管理器實例
const audioManager = new AudioManager();
