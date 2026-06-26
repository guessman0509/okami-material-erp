# 大神燒肉 材料管理 ERP v3.0

這是一套以 GitHub Pages + Google Apps Script + 私人 Google Sheet 建置的輕量型材料管理 ERP。

## v3.0 新增重點

- 員工帳號 + 密碼登入
- 登入後顯示目前使用者姓名與角色
- 每筆採購紀錄自動寫入建立人 ID 與建立人姓名
- 採購紀錄列表新增「建立人」欄位
- 報價單 / 單據上傳 AI 辨識
- AI 協助品項拆分與分類建議
- AI 結果必須人工確認後才會寫入採購紀錄
- 可選擇將報價單附件保存到 Google Drive
- 新增「報價單紀錄」分頁，保存上傳人與 AI 辨識狀態

## 正式上線需要上傳的前端檔案

請將以下檔案上傳或覆蓋到 GitHub Repository 根目錄：

```text
index.html
app.js
style.css
data.js
README.md
```

## 後端 Apps Script

請將下列檔案內容貼到 Apps Script：

```text
google-apps-script/Code.gs
```

貼上後請確認最上方：

```javascript
const SPREADSHEET_ID = '你的 Google Sheet ID';
```

如果你使用的是原本測試資料庫，請確認它沒有被改成 `PUT_YOUR_SPREADSHEET_ID_HERE`。

每次修改 Apps Script 後，請重新部署：

```text
部署 → 管理部署作業 → 鉛筆 → 新版本 → 部署
```

只按儲存不會更新正式網站連到的版本。

## Google Sheet 分頁

v3.0 建議使用五個分頁：

```text
材料主檔
採購紀錄
供應商主檔
員工帳號
報價單紀錄
```

欄位請參考：

```text
docs/google-sheet-headers.md
```

## 員工帳號範例

在 `員工帳號` 分頁第二列建立：

```text
EMP-0001	阿狼	boss	你的測試密碼			老闆	是				系統管理者
```

登入時使用：

```text
帳號：boss
密碼：你的測試密碼
```

## Apps Script 指令碼屬性

基本必備：

```text
SESSION_SECRET
```

AI 報價單辨識需要：

```text
GEMINI_API_KEY
GEMINI_MODEL
```

報價單附件保存到 Drive 需要：

```text
DRIVE_FOLDER_ID
```

沒有設定 `DRIVE_FOLDER_ID` 時，AI 仍可辨識，但檔案不會保存到 Google Drive。

## 安全原則

請勿把以下資料放進 GitHub：

```text
員工密碼
SESSION_SECRET
GEMINI_API_KEY
Google Sheet 正式採購資料
供應商報價資料截圖
```

這些資料只應存在：

```text
Apps Script 指令碼屬性
私人 Google Sheet
私人 Google Drive 資料夾
```

## 測試流程

1. 覆蓋 GitHub 前端檔案
2. 覆蓋 Apps Script 的 `Code.gs`
3. Apps Script 重新部署新版本
4. Google Sheet 建立 `員工帳號` 分頁與 boss 帳號
5. 打開 GitHub Pages 網址
6. 使用 boss 帳號登入
7. 到「快速建檔」新增測試採購
8. 確認 `採購紀錄` 出現建立人 ID 與姓名
9. 若已設定 `GEMINI_API_KEY`，再測試「報價單 / 單據 AI 辨識」

## 建議測試資料

```text
日期：今天
供應商：員工測試供應商
品項：員工登入測試牛五花
分類：牛肉類
規格：1公斤/包
數量：1
單位：公斤
換算倍率：1000
標準單位：公克
單價：680
備註：v3.0 員工帳號測試
```

送出後請確認：

```text
建立人ID：EMP-0001
建立人姓名：阿狼
```
