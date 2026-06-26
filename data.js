// 安全母版：正式公司資料不得寫入此檔案。
// 所有正式資料皆由 Google Apps Script 驗證 session token 後，從私人 Google Sheet 讀取。
window.MATERIAL_ERP_SAFE_DATA = {
  materials: [],
  purchases: []
};
