# bopomofo-shooter

ㄅㄆㄇㄈ大挑戰是一套專為注音符號辨識與學習設計的網頁聽音射擊遊戲。本專案整合滑鼠、實體光線槍（Gamepad API）以及網路攝影機（MediaPipe Hands 手勢追蹤）等多元輸入技術，提供單人挑戰、雙人同畫面合作與對抗等多種模式，旨在以遊戲化學習提升學習者的注音符號辨識力。

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bopomofo.yuhan.tw-blueviolet.svg)](https://bopomofo.yuhan.tw/)
[![License](https://img.shields.io/badge/License-CC%20BY--NC--ND%203.0%20TW-orange.svg)](https://creativecommons.org/licenses/by-nc-nd/3.0/tw/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow.svg)](https://developer.mozilla.org/zh-TW/docs/Web/JavaScript)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-green.svg)](https://github.com/google/mediapipe)

## 線上體驗

本專案已部署於網頁伺服器，可直接線上遊玩：
[https://bopomofo.yuhan.tw/](https://bopomofo.yuhan.tw/)

---

## 目錄

- [核心特色](#核心特色)
- [使用技術](#使用技術)
- [專案檔案結構](#專案檔案結構)
- [快速開始](#快速開始)
  - [方法一：連網直接執行](#方法一連網直接執行)
  - [方法二：完全離線運行](#方法二完全離線運行)
- [部署指南](#部署指南)
- [授權條款](#授權條款)

---

## 核心特色

*   **手繪粉筆黑板風格**：採用擬真黑板背景與手繪質感字體，並具備豐富的動態粒子爆裂特效，重溫溫馨的教室氛圍。
*   **教育部官方語音授權**：音檔源自中華民國教育部全球資訊網《國語注音符號手冊》官方資源，發音標準精確。
*   **多元輸入模式支援**：
    *   **滑鼠模式**：使用滑鼠移動，左鍵射擊，具備最高的系統相容性。
    *   **鏡頭體感模式**：免購買硬體！只需舉起單手手掌即可控制畫面準星，在空中做出「握拳」動作即可觸發射擊。系統內建先進的歐式距離 (Euclidean Distance) 成本追蹤演算法，精準鎖定並區分 P1 與 P2，有效防止雙手交叉或單手放下時的準星抖動與瞬間互換。
    *   **光線槍模式**：免去繁瑣的校正步驟，隨插即用（支援 GUN4IR、OpenFIRE 等相容 Gamepad API 的光線槍設備，建議切換全螢幕）。
*   **雙人遊玩支援 (2P)**：
    *   **2P 合作模式**（支援光線槍與鏡頭體感）：兩名玩家同畫面擊碎氣球，共享分數與 Combo 連擊加成，共同爭奪最高評分與默契評價。
    *   **2P 對抗模式**（支援光線槍與鏡頭體感）：兩名玩家同畫面競技搶答，擊中正確氣球即可得分並切換下一題（防範對方搶答），擊中錯誤氣球會扣分，限時結束看誰勝出。
*   **射擊防抖冷卻系統**：核心內建 250 毫秒射擊冷卻（Debounce/Cooldown）限制，能自動過濾視訊鏡頭體感偵測雜訊與實體光槍扳機的物理彈跳，避免「無效空槍」稀釋命中率。
*   **個人化配置設定**：支援語音重播間隔調整、題目語音/背景音樂/遊戲音效獨立音量控制、氣球下降速度（提供慢速/標準/快速/超快/極速/瘋狂六種選擇）以及光線槍抗抖平滑度調整。

---

## 使用技術

*   **前端核心**：HTML5 Canvas、Vanilla JavaScript、Vanilla CSS（純原生開發，無需安裝前端框架，啟動極速）。
*   **手勢識別**：Google MediaPipe Hands 機器學習手勢追蹤技術。
*   **離線模型優化**：本專案已將 MediaPipe 必要的 `.wasm`、`.tflite` 模型與 JS 資源本地化至 `js/lib/mediapipe/`，無網路連接時依然能 100% 離線執行體感偵測。
*   **硬體串接**：HTML5 Gamepad API（用於對接光線槍的搖桿與按鍵訊號）。

---

## 專案檔案結構

```text
bopomofo-shooter/
├── audio/                   # 標準注音朗讀音檔與遊戲音效 (.mp3)
├── css/
│   └── style.css            # 遊戲樣式表
├── js/
│   ├── lib/
│   │   └── mediapipe/       # MediaPipe 本地離線模型與 JS 資源
│   ├── audioManager.js      # 音效與語音播放管理器
│   ├── config.js            # 關卡難度與速度參數配置
│   ├── gameManager.js       # 狀態機、遊戲主循環、碰撞判定與加分邏輯
│   ├── inputManager.js      # 滑鼠、光線槍、體感鏡頭之輸入與平滑化處理
│   ├── player.js            # 玩家物件（儲存分數、準星位置與樣式）
│   ├── particle.js          # 氣球擊碎時的粒子特效系統
│   ├── symbol.js            # 氣球物理運行與繪製邏輯
│   └── main.js              # DOM 事件綁定與程式初始化入口
├── index.html               # 網頁遊戲主入口
├── run_server.ps1           # Windows 本地伺服器啟動指令檔
├── download_audio.ps1       # 注音音檔下載與整理腳本
└── README.md                # 專案說明文件（本檔案）
```

---

## 快速開始

本專案為純前端網頁應用，支援兩種執行方式，程式會自動根據載入通訊協定切換檔案來源，避開瀏覽器的跨域限制：

### 方法一：連網直接執行

1. 將專案複製（Clone）至本地。
2. 雙擊點開 `index.html` 即可直接啟動。
3. **技術原理**：當偵測到使用 `file://` 協定開啟時，程式會自動將 MediaPipe 體感模型導向至公用 CDN 載入，因此您不需要啟動任何本地伺服器便能直接使用鏡頭體感功能。

### 方法二：完全離線運行

如果您處於無網路（離線）環境，或想更流暢地載入本地資源：

1. 開啟 PowerShell 或終端機，切換至專案根目錄。
2. 執行專案內建的伺服器啟動腳本：
   ```powershell
   .\run_server.ps1
   ```
3. 伺服器將會在 `http://localhost:8080/` 啟動並自動在瀏覽器中開啟。此時將完全載入本地的離線模型與音檔，支援 100% 離線遊玩。

---

## 部署指南

本專案為純靜態網頁應用，您可以將專案目錄下的所有檔案直接上傳至任何網頁伺服器（如 Apache、Nginx、IIS 或各式靜態網站代管服務，例如 GitHub Pages、Vercel 等）進行部署。

### 部署注意事項

1. **同源載入**：當網頁程式與 MediaPipe 本地離線模型（位於 `js/lib/mediapipe/`）部署在同一個伺服器網域下時，瀏覽器會以同源（Same-Origin）方式載入，不會遇到 CORS 限制。
2. **HTTPS 協定要求**：由於鏡頭體感模式需要存取 Webcam，根據瀏覽器安全規範，網頁必須在 **HTTPS 安全連線**（或本地 `http://localhost`）下，才允許請求並啟用相機權限。請確保部署後的網站已配置 SSL 憑證。

---

## 授權條款

[![License](https://img.shields.io/badge/License-CC%20BY--NC--ND%203.0%20TW-orange.svg)](https://creativecommons.org/licenses/by-nc-nd/3.0/tw/)

本專案之遊戲程式碼與介面設計採用 [創用 CC 姓名標示-非商業性-禁止改作 3.0 台灣 授權條款 (CC BY-NC-ND 3.0 TW)](https://creativecommons.org/licenses/by-nc-nd/3.0/tw/) 進行授權。

### 外部資源授權

1.  **教育部標準注音發音音檔**：版權歸中華民國教育部所有，本專案依教育部官方網站之「政府網站資料開放宣告」，引用其《國語注音符號手冊》之語音資源，適用中華民國政府資料開放授權條款。
2.  **開源字型**：Fredoka 及 Noto Sans TC 均採用 SIL Open Font License (OFL) 授權。
3.  **MediaPipe Hands**：採用 Apache License 2.0 協議授權。
