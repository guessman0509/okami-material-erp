/*
  公司材料管理 ERP 前端母版
  安全原則：
  1. 正式資料不得寫入 data.js
  2. 密碼與 API Key 不得寫入前端
  3. 所有正式資料操作都必須經 Apps Script session token 驗證
*/

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAl5Yt7SD3Eq06zAkSyhDuEYJYC-SHZq3TGfqcIsxeUVhyChDfTCOnk5sWHPSOUxG4/exec";

const BRAND = {
  siteName: "公司材料管理",
  companyName: "Internal System",
  loginTitle: "公司材料管理 ERP"
};

const MATERIAL_CATEGORIES = [
  "肉品", "海鮮", "蔬菜", "飲品", "酒類", "調味料", "包材", "耗材", "設備", "其他"
];

const UNIT_OPTIONS = [
  "個", "包", "盒", "袋", "瓶", "罐", "公斤", "公克", "台斤", "公升", "毫升", "箱", "組", "份"
];

const STANDARD_UNITS = ["公克", "公斤", "毫升", "公升", "個", "包", "盒", "份"];

const state = {
  token: sessionStorage.getItem("erpSessionToken") || "",
  materials: [],
  purchases: [],
  dashboard: null,
  activeTab: "dashboard"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

window.addEventListener("DOMContentLoaded", init);

function init() {
  applyBrand();
  initOptions();
  bindEvents();
  setTodayDefault();

  $("#appsScriptUrlText").textContent = APPS_SCRIPT_URL || "尚未設定";
  if (!APPS_SCRIPT_URL) $("#setupWarning")?.classList.remove("hidden");

  if (state.token && APPS_SCRIPT_URL) {
    verifySession();
  } else {
    showLogin();
  }
}

function applyBrand() {
  $("#siteName").textContent = BRAND.siteName;
  $("#companyName").textContent = BRAND.companyName;
  $("#loginTitle").textContent = BRAND.loginTitle;
  document.title = BRAND.loginTitle;
}

function initOptions() {
  fillSelect($("#categorySelect"), MATERIAL_CATEGORIES, "其他");
  fillSelect($("#unitSelect"), UNIT_OPTIONS, "公斤");
  fillSelect($("#standardUnitSelect"), STANDARD_UNITS, "公克");
}

function fillSelect(select, options, selectedValue = "") {
  if (!select) return;
  select.innerHTML = options.map((item) => `<option value="${escapeHtml(item)}" ${item === selectedValue ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#logoutButton").addEventListener("click", handleLogout);
  $("#refreshButton").addEventListener("click", loadData);
  $("#purchaseForm").addEventListener("submit", handleAddPurchase);
  $("#materialSearch").addEventListener("input", renderMaterials);
  $("#purchaseSearch").addEventListener("input", renderPurchases);
  $("#priceItemSelect").addEventListener("change", renderPriceHistory);
  $("#analyzeReceiptButton").addEventListener("click", handleAnalyzeReceipt);
  $("#receiptFile").addEventListener("change", previewReceiptFile);

  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  $$('[data-jump]').forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.jump));
  });
}

function setTodayDefault() {
  const dateInput = $('#purchaseForm [name="日期"]');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
}

async function handleLogin(event) {
  event.preventDefault();
  const password = $("#passwordInput").value.trim();
  if (!APPS_SCRIPT_URL) {
    $("#loginMessage").textContent = "尚未設定 Apps Script URL。";
    return;
  }

  try {
    $("#loginMessage").textContent = "登入中...";
    const result = await apiRequest("login", { password }, false);
    state.token = result.token;
    sessionStorage.setItem("erpSessionToken", state.token);
    $("#passwordInput").value = "";
    showApp();
    await loadData();
  } catch (error) {
    $("#loginMessage").textContent = error.message || "登入失敗。";
  }
}

async function verifySession() {
  try {
    await apiRequest("verifySession", {});
    showApp();
    await loadData();
  } catch (_error) {
    clearSession();
    showLogin();
  }
}

async function handleLogout() {
  try {
    if (state.token && APPS_SCRIPT_URL) await apiRequest("logout", {});
  } catch (_error) {
    // 即使後端登出失敗，也清除前端 session。
  }
  clearSession();
  showLogin();
}

function clearSession() {
  state.token = "";
  sessionStorage.removeItem("erpSessionToken");
}

function showLogin() {
  $("#loginView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
}

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
}

function switchTab(tabName) {
  state.activeTab = tabName;
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabName));
  const activeButton = $(`.nav-item[data-tab="${tabName}"]`);
  $("#pageTitle").textContent = activeButton ? activeButton.textContent : "Dashboard";
}

async function loadData() {
  try {
    showMessage("資料讀取中...", "success");
    const result = await apiRequest("getBootstrapData", {});
    state.materials = Array.isArray(result.materials) ? result.materials : [];
    state.purchases = Array.isArray(result.purchases) ? result.purchases : [];
    state.dashboard = result.dashboard || buildDashboardLocally(state.materials, state.purchases);
    renderAll();
    hideMessage();
  } catch (error) {
    showMessage(error.message || "資料讀取失敗。", "error");
  }
}

async function handleAddPurchase(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = readForm(form);

  try {
    showMessage("新增採購紀錄中...", "success");

    const result = await apiRequest("addPurchase", { purchase: formData });

    showMessage(`已新增採購紀錄：${result.purchaseId || "完成"}`, "success");

    if (form) {
      form.reset();
    }

    setTodayDefault();
    await loadData();
    switchTab("purchases");
  } catch (error) {
    showMessage(error.message || "新增失敗。", "error");
  }
}

async function handleAnalyzeReceipt() {
  const fileInput = $("#receiptFile");
  const file = fileInput.files?.[0];
  if (!file) {
    showMessage("請先選擇單據照片或 PDF。", "error");
    return;
  }

  try {
    showMessage("AI 辨識中，請稍候...", "success");
    const filePayload = await readFileAsBase64(file);
    const result = await apiRequest("analyzeReceiptImage", {
      file: {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: filePayload.base64
      }
    });
    renderAiResult(result.receipt || result);
    hideMessage();
  } catch (error) {
    showMessage(error.message || "AI 辨識失敗。", "error");
  }
}

function previewReceiptFile() {
  const file = $("#receiptFile").files?.[0];
  const preview = $("#receiptPreview");
  preview.classList.add("hidden");
  preview.innerHTML = "";
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<strong>單據預覽</strong><img src="${reader.result}" alt="單據預覽" />`;
    preview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function renderAll() {
  renderDashboard();
  renderMaterials();
  renderPurchases();
  renderAnalysis();
}

function renderDashboard() {
  const dashboard = state.dashboard || buildDashboardLocally(state.materials, state.purchases);
  const thisMonth = numberOrZero(dashboard.thisMonthTotal);
  const lastMonth = numberOrZero(dashboard.lastMonthTotal);
  const change = lastMonth ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  $("#metricThisMonth").textContent = money(thisMonth);
  $("#metricMonthChange").textContent = `較上月 ${formatPercent(change)}`;
  $("#metricMaterialCount").textContent = String(dashboard.activeMaterialCount ?? state.materials.length);

  const topSupplier = firstItem(dashboard.thisMonthSupplierTotals);
  $("#metricTopSupplier").textContent = topSupplier?.name || "-";
  $("#metricTopSupplierAmount").textContent = money(topSupplier?.amount || 0);

  const topCategory = firstItem(dashboard.thisMonthCategoryTotals);
  $("#metricTopCategory").textContent = topCategory?.name || "-";
  $("#metricTopCategoryAmount").textContent = money(topCategory?.amount || 0);

  const recent = dashboard.recentPurchases || state.purchases.slice(-10).reverse();
  $("#recentPurchasesBody").innerHTML = recent.length ? recent.map((item) => `
    <tr>
      <td>${escapeHtml(item["日期"] || "")}</td>
      <td>${escapeHtml(item["供應商"] || "")}</td>
      <td>${escapeHtml(item["品項"] || "")}</td>
      <td class="num">${money(item["金額"])}</td>
    </tr>
  `).join("") : emptyRow(4, "尚無採購紀錄");

  const alerts = dashboard.priceAlerts || [];
  $("#priceAlerts").innerHTML = alerts.length ? alerts.map((alert) => `
    <div class="alert-item ${alert.level === "red" ? "danger" : ""}">
      <strong>${escapeHtml(alert.item || "未命名品項")}</strong>
      <p>本次標準單價 ${money(alert.latestPrice)}，近180天平均 ${money(alert.averagePrice)}，高出 ${formatPercent(alert.diffPercent || 0)}。</p>
      <small>${escapeHtml(alert.supplier || "")} ｜ ${escapeHtml(alert.date || "")}</small>
    </div>
  `).join("") : `<div class="list empty">目前沒有價格異常提醒。</div>`;

  const cheapest = dashboard.cheapestByItem || [];
  $("#cheapestBody").innerHTML = cheapest.length ? cheapest.slice(0, 20).map((item) => `
    <tr>
      <td>${escapeHtml(item.item || "")}</td>
      <td>${escapeHtml(item.supplier || "")}</td>
      <td class="num">${money(item.standardUnitPrice)}</td>
      <td>${escapeHtml(item.date || "")}</td>
    </tr>
  `).join("") : emptyRow(4, "尚無可比較資料");
}

function renderMaterials() {
  const keyword = normalize($("#materialSearch").value);
  const rows = state.materials.filter((item) => normalize(Object.values(item).join(" ")).includes(keyword));
  $("#materialsBody").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${escapeHtml(item["ERP代碼"] || "")}</td>
      <td>${escapeHtml(item["品項"] || "")}</td>
      <td>${escapeHtml(item["分類"] || "")}</td>
      <td>${escapeHtml(item["規格"] || "")}</td>
      <td>${escapeHtml(item["單位"] || "")}</td>
      <td class="num">${money(item["最新單價"])}</td>
      <td>${escapeHtml(item["供應商"] || "")}</td>
      <td>${escapeHtml(item["最近採購日"] || "")}</td>
      <td>${escapeHtml(item["使用中"] || "是")}</td>
    </tr>
  `).join("") : emptyRow(9, "沒有符合條件的材料");
}

function renderPurchases() {
  const keyword = normalize($("#purchaseSearch").value);
  const rows = state.purchases.filter((item) => normalize(Object.values(item).join(" ")).includes(keyword)).reverse();
  $("#purchasesBody").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${escapeHtml(item["採購ID"] || "")}</td>
      <td>${escapeHtml(item["日期"] || "")}</td>
      <td>${escapeHtml(item["供應商"] || "")}</td>
      <td>${escapeHtml(item["品項"] || "")}</td>
      <td>${escapeHtml(item["分類"] || "")}</td>
      <td>${escapeHtml(item["規格"] || "")}</td>
      <td class="num">${formatNumber(item["數量"])}</td>
      <td>${escapeHtml(item["單位"] || "")}</td>
      <td class="num">${money(item["單價"])}</td>
      <td class="num">${money(item["金額"])}</td>
    </tr>
  `).join("") : emptyRow(10, "尚無採購紀錄");
}

function renderAnalysis() {
  const dashboard = state.dashboard || buildDashboardLocally(state.materials, state.purchases);
  renderBarChart("#supplierChart", dashboard.supplierTotals || []);
  renderBarChart("#categoryChart", dashboard.categoryTotals || []);

  const select = $("#priceItemSelect");
  const items = unique(state.purchases.map((item) => item["標準品項名稱"] || item["品項"]).filter(Boolean)).sort();
  const current = select.value;
  select.innerHTML = items.length ? items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("") : `<option value="">尚無品項</option>`;
  if (items.includes(current)) select.value = current;
  renderPriceHistory();
}

function renderBarChart(selector, rows) {
  const target = $(selector);
  const topRows = rows.slice(0, 10);
  const max = Math.max(...topRows.map((row) => numberOrZero(row.amount)), 1);
  target.innerHTML = topRows.length ? topRows.map((row) => {
    const width = Math.max(2, Math.round((numberOrZero(row.amount) / max) * 100));
    return `
      <div class="bar-row">
        <div class="bar-meta"><strong>${escapeHtml(row.name || "未分類")}</strong><span>${money(row.amount)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="--value:${width}%"></div></div>
      </div>
    `;
  }).join("") : `<div class="list empty">尚無分析資料。</div>`;
}

function renderPriceHistory() {
  const itemName = $("#priceItemSelect").value;
  const rows = state.purchases
    .filter((item) => (item["標準品項名稱"] || item["品項"]) === itemName)
    .sort((a, b) => String(b["日期"] || "").localeCompare(String(a["日期"] || "")));

  $("#priceHistoryBody").innerHTML = rows.length ? rows.map((item) => `
    <tr>
      <td>${escapeHtml(item["日期"] || "")}</td>
      <td>${escapeHtml(item["供應商"] || "")}</td>
      <td>${escapeHtml(item["品項"] || "")}</td>
      <td>${escapeHtml(item["規格"] || "")}</td>
      <td class="num">${money(item["標準單位價格"] || item["單價"])}</td>
      <td class="num">${money(item["金額"])}</td>
    </tr>
  `).join("") : emptyRow(6, "尚無歷史價格資料");
}

function renderAiResult(receipt) {
  const target = $("#aiResult");
  const items = Array.isArray(receipt.items) ? receipt.items : [];

  target.classList.remove("hidden");
  if (!items.length) {
    target.innerHTML = `<strong>辨識結果</strong><p class="muted">AI 沒有辨識到可寫入的採購品項，請改用快速建檔。</p>`;
    return;
  }

  target.innerHTML = `
    <strong>辨識結果：請人工確認後再寫入</strong>
    <p class="muted">供應商：${escapeHtml(receipt.supplier || "待確認")} ｜ 日期：${escapeHtml(receipt.date || "待確認")}</p>
    ${items.map((item, index) => `
      <div class="ai-item" data-index="${index}">
        <label>品項<input data-field="品項" value="${escapeHtml(item.name || item["品項"] || "")}" /></label>
        <label>分類<input data-field="分類" value="${escapeHtml(item.category || item["分類"] || "其他")}" /></label>
        <label>規格<input data-field="規格" value="${escapeHtml(item.spec || item["規格"] || "")}" /></label>
        <label>數量<input data-field="數量" type="number" step="0.001" value="${escapeHtml(item.quantity || item["數量"] || "")}" /></label>
        <label>單位<input data-field="單位" value="${escapeHtml(item.unit || item["單位"] || "")}" /></label>
        <label>單價<input data-field="單價" type="number" step="0.01" value="${escapeHtml(item.unitPrice || item["單價"] || "")}" /></label>
        <label>備註<input data-field="備註" value="${escapeHtml(item.needsReview ? "AI標示待確認" : "AI辨識後人工確認")}" /></label>
      </div>
    `).join("")}
    <div class="form-actions" style="margin-top:14px;">
      <button id="confirmAiWriteButton" class="primary" type="button">確認並寫入採購紀錄</button>
    </div>
  `;

  $("#confirmAiWriteButton").addEventListener("click", async () => {
    try {
      const supplier = receipt.supplier || "待確認供應商";
      const date = receipt.date || new Date().toISOString().slice(0, 10);
      const purchaseItems = $$(".ai-item").map((box) => {
        const item = { 日期: date, 供應商: supplier };
        box.querySelectorAll("[data-field]").forEach((input) => { item[input.dataset.field] = input.value; });
        return item;
      });

      showMessage("寫入 AI 確認資料中...", "success");
      for (const purchase of purchaseItems) {
        await apiRequest("addPurchase", { purchase });
      }
      showMessage(`已寫入 ${purchaseItems.length} 筆採購紀錄。`, "success");
      target.classList.add("hidden");
      target.innerHTML = "";
      await loadData();
      switchTab("purchases");
    } catch (error) {
      showMessage(error.message || "AI 資料寫入失敗。", "error");
    }
  });
}

async function apiRequest(action, payload = {}, includeToken = true) {
  if (!APPS_SCRIPT_URL) throw new Error("尚未設定 Apps Script URL。請先修改 app.js。 ");

  const body = {
    action,
    payload,
    token: includeToken ? state.token : ""
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      // 使用 text/plain 避免瀏覽器發出 CORS preflight。
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_error) {
    throw new Error("後端回應不是 JSON。請確認 Apps Script 部署網址與權限設定。 ");
  }

  if (!response.ok || data.ok === false) throw new Error(data.error || "後端請求失敗。 ");
  return data.data || {};
}

function readForm(form) {
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = String(value).trim(); });
  return data;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("檔案讀取失敗。"));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      resolve({ dataUrl, base64: dataUrl.split(",")[1] || "" });
    };
    reader.readAsDataURL(file);
  });
}

function buildDashboardLocally(materials, purchases) {
  const now = new Date();
  const thisMonthKey = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = monthKey(lastMonthDate);

  const thisMonthRows = purchases.filter((item) => monthKey(parseDate(item["日期"])) === thisMonthKey);
  const lastMonthRows = purchases.filter((item) => monthKey(parseDate(item["日期"])) === lastMonthKey);

  const supplierTotals = totalsBy(purchases, "供應商");
  const categoryTotals = totalsBy(purchases, "分類");
  const thisMonthSupplierTotals = totalsBy(thisMonthRows, "供應商");
  const thisMonthCategoryTotals = totalsBy(thisMonthRows, "分類");

  return {
    thisMonthTotal: sumAmount(thisMonthRows),
    lastMonthTotal: sumAmount(lastMonthRows),
    activeMaterialCount: materials.filter((item) => String(item["使用中"] || "是") !== "否").length,
    supplierTotals,
    categoryTotals,
    thisMonthSupplierTotals,
    thisMonthCategoryTotals,
    recentPurchases: purchases.slice(-10).reverse(),
    cheapestByItem: cheapestByItem(purchases),
    priceAlerts: []
  };
}

function totalsBy(rows, field) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row[field] || "未分類";
    map.set(key, (map.get(key) || 0) + numberOrZero(row["金額"]));
  });
  return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

function cheapestByItem(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const item = row["標準品項名稱"] || row["品項"];
    const price = numberOrZero(row["標準單位價格"] || row["單價"]);
    if (!item || !price) return;
    const current = map.get(item);
    if (!current || price < current.standardUnitPrice) {
      map.set(item, { item, supplier: row["供應商"], standardUnitPrice: price, date: row["日期"] });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.item.localeCompare(b.item, "zh-Hant"));
}

function firstItem(rows = []) { return rows[0] || null; }
function sumAmount(rows) { return rows.reduce((total, row) => total + numberOrZero(row["金額"]), 0); }
function numberOrZero(value) { const num = Number(value); return Number.isFinite(num) ? num : 0; }
function formatNumber(value) { return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 3 }).format(numberOrZero(value)); }
function money(value) { return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(numberOrZero(value)); }
function formatPercent(value) { const sign = value > 0 ? "+" : ""; return `${sign}${Number(value || 0).toFixed(1)}%`; }
function unique(values) { return Array.from(new Set(values)); }
function normalize(value) { return String(value || "").trim().toLowerCase(); }
function emptyRow(colspan, text) { return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(text)}</td></tr>`; }
function parseDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? new Date(0) : date; }
function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}
function showMessage(text, type = "success") {
  const target = $("#globalMessage");
  target.textContent = text;
  target.className = `message-area ${type}`;
  target.classList.remove("hidden");
}
function hideMessage() { $("#globalMessage").classList.add("hidden"); }
