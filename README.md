# 公司材料管理 ERP 網站母版

這是一套輕量型公司內部材料管理網站母版，適合 GitHub Pages + Google Apps Script + 私人 Google Sheet 架構。

## 功能

- 密碼登入與短期 session token
- 材料主檔管理
- 採購紀錄新增與查詢
- Dashboard 本月支出統計
- 供應商支出分析
- 分類支出分析
- 同品項歷史價格比較
- 最便宜供應商提示
- 價格異常提醒
- AI 單據辨識安全流程：辨識 → 人工確認 → 寫入
- 私人 Google Sheet 資料同步

## 專案檔案

```text
index.html
app.js
style.css
data.js
README.md
google-apps-script/Code.gs
google-apps-script/appsscript.json
docs/google-sheet-headers.md
```

## 安全原則

1. `data.js` 不保存正式公司資料。
2. 密碼不可寫入 `app.js`。
3. API Key 不可上傳 GitHub。
4. Google Sheet 不可發布到網路。
5. Google Sheet 一般存取權請設定為「受限制」。
6. 所有正式資料操作都必須通過 Apps Script 後端 session token 驗證。

## 第一次安裝流程

### 1. 建立 Google Sheet

建立一份新的 Google Sheet，分頁名稱建議使用：

```text
材料主檔
採購紀錄
供應商主檔
```

第一列欄位可參考 `docs/google-sheet-headers.md`。

### 2. 複製試算表 ID

Google Sheet 網址格式大約如下：

```text
https://docs.google.com/spreadsheets/d/試算表ID/edit
```

複製 `/d/` 和 `/edit` 之間的 ID。

### 3. 建立 Apps Script 後端

在 Google Sheet 內開啟：

```text
擴充功能 → Apps Script
```

貼上：

```text
google-apps-script/Code.gs
```

修改：

```javascript
const SPREADSHEET_ID = 'PUT_YOUR_SPREADSHEET_ID_HERE';
```

換成你的試算表 ID。

### 4. 設定指令碼屬性

Apps Script → 專案設定 → 指令碼屬性，新增：

```text
ERP_PASSWORD = 你的內部登入密碼
SESSION_SECRET = 任意長字串
```

如果要使用 AI 拍照辨識，再新增：

```text
GEMINI_API_KEY = 你的 Gemini API Key
GEMINI_MODEL = gemini-2.5-flash
```

`GEMINI_MODEL` 可不填，預設使用 `gemini-2.5-flash`。

### 5. 選用：改用雜湊密碼

如果不想保留明碼密碼，可以：

1. 先設定 `ERP_PASSWORD`
2. 設定或不設定 `ERP_PASSWORD_SALT`
3. 在 Apps Script 編輯器手動執行：

```javascript
setupPasswordHash()
```

4. 確認可登入後，刪除 `ERP_PASSWORD`
5. 保留：

```text
ERP_PASSWORD_HASH
ERP_PASSWORD_SALT
SESSION_SECRET
```

### 6. 部署 Apps Script

操作：

```text
部署 → 新增部署作業 → 網頁應用程式
```

設定：

```text
執行身分：我
誰可以存取：任何人
```

完成後複製 `/exec` 網址。

每次修改 Apps Script 後，請記得：

```text
部署 → 管理部署作業 → 鉛筆 → 新版本 → 部署
```

只按「儲存」不會更新正式網站使用版本。

### 7. 連接前端

打開 `app.js`：

```javascript
const APPS_SCRIPT_URL = "";
```

填入 Apps Script `/exec` 網址：

```javascript
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/部署代碼/exec";
```

### 8. 更換品牌資料

在 `app.js` 修改：

```javascript
const BRAND = {
  siteName: "公司材料管理",
  companyName: "Internal System",
  loginTitle: "公司材料管理 ERP"
};
```

在 `style.css` 修改主色：

```css
--primary: #8f1f1f;
--accent: #b8852d;
```

在 `app.js` 修改分類與單位：

```javascript
const MATERIAL_CATEGORIES = [...];
const UNIT_OPTIONS = [...];
const STANDARD_UNITS = [...];
```

### 9. 上傳 GitHub Pages

將前端檔案推上 GitHub：

```bash
git add index.html app.js style.css data.js README.md docs google-apps-script
git commit -m "建立材料管理ERP母版"
git push origin main
```

到 GitHub Repository：

```text
Settings → Pages → Deploy from branch → main / root
```

## 上線前測試

### 登入測試

- 開啟網站只出現登入頁
- 錯誤密碼不能登入
- 正確密碼可以登入
- 登出後回到登入頁
- session 逾時後需重新登入

### 資料讀取測試

- 材料主檔正常顯示
- 採購紀錄正常顯示
- Dashboard 正常統計
- 每月支出正常計算
- 供應商統計正常
- 價格比較正常

### 寫入測試

新增測試資料：

```text
日期：今天
供應商：測試供應商
品項：同步測試品項
分類：其他
數量：1
單位：個
單價：1
```

確認：

- 採購紀錄新增一列
- 材料主檔新增或更新
- 供應商主檔新增或更新
- 網站重新讀取後能看到資料

### AI 測試

- 可上傳照片
- AI 能回傳可讀資料
- 模糊欄位標示待確認
- 修改後才能正式寫入
- AI 不會直接把未確認內容寫入資料庫

## 常見問題

### 1. 登入成功但讀不到資料

請確認：

- Apps Script 已部署新版
- `SPREADSHEET_ID` 正確
- Google Sheet 分頁名稱正確
- Apps Script 執行身分是「我」
- Google Sheet 沒有被刪除或移動到無權限帳號

### 2. 修改 Apps Script 後網站沒變

Apps Script 修改後必須重新部署新版。只按儲存不會更新 `/exec` 使用的正式版本。

### 3. AI 辨識不能用

請確認：

- 已設定 `GEMINI_API_KEY`
- API Key 有啟用 Gemini API
- 檔案不要太大
- 單據照片清楚、不要反光

### 4. 瀏覽器出現 CORS 或後端回應不是 JSON

本母版已用 `text/plain` 方式送出請求，盡量避開 preflight。若你的環境仍遇到 CORS，可改用以下方案：

1. 將前端也搬進 Apps Script HTML Service
2. 使用 Cloudflare Worker 作為中介代理
3. 改用 Firebase / Supabase / Cloud Run 等正式後端

小型公司內部使用通常 Apps Script 架構已足夠；若資料量、併發人數、權限層級開始變複雜，就應升級後端。

## 版本管理建議

每次修改前：

```bash
git fetch origin
```

提交前檢查：

```bash
node --check app.js
grep -nE '^(<<<<<<<|=======|>>>>>>>)' app.js
```

提交：

```bash
git add index.html app.js style.css data.js README.md google-apps-script docs
git commit -m "說明本次修改內容"
git push origin main
```

避免：

- 同時在 GitHub 網頁和 Codespaces 修改同一檔案
- 使用瀏覽器自動翻譯程式碼頁面
- 建立 `app.js.js`
- 留下 Git 合併衝突標記
- 使用 `git push --force`
- 未備份就覆蓋正式檔案
page rebuild test
