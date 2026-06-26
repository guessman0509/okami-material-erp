/*
  公司材料管理 ERP 前端母版
  安全原則：
  1. 正式資料不得寫入 data.js
  2. 密碼與 API Key 不得寫入前端
  3. 所有正式資料操作都必須經 Apps Script session token 驗證
*/

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAl5Yt7SD3Eq06zAkSyhDuEYJYC-SHZq3TGfqcIsxeUVhyChDfTCOnk5sWHPSOUxG4/exec"; // 若重新部署 Apps Script，請更新這裡的 /exec 網址

const BRAND = {
  siteName: "大神材料 ERP v3.9 Mega",
  companyName: "大神燒肉 Okami Yakiniku",
  loginTitle: "大神燒肉 材料管理 ERP"
};

const MATERIAL_CATEGORIES = [
  "牛肉類", "牛內臟類", "豬肉類", "豬內臟類", "雞肉類", "雞內臟類",
  "海鮮類", "蔬菜類", "前菜小菜", "米飯主食", "甜點類",
  "酒水類", "無酒精飲品", "調味料", "醬料", "包材", "清潔耗材", "設備耗材", "其他"
];

const UNIT_OPTIONS = [
  "公克", "公斤", "台斤", "包", "盒", "袋", "瓶", "罐", "桶", "箱",
  "顆", "尾", "片", "份", "支", "組", "公升", "毫升"
];

const STANDARD_UNITS = ["公克", "公斤", "毫升", "公升", "個", "包", "盒", "份", "瓶", "桶", "箱"];

const FOOD_COST_CATEGORIES = ["牛肉類", "牛內臟類", "豬肉類", "豬內臟類", "雞肉類", "雞內臟類", "海鮮類", "蔬菜類", "前菜小菜", "米飯主食", "甜點類", "調味料", "醬料"];
const BEVERAGE_CATEGORIES = ["酒水類", "無酒精飲品"];

const UNIT_CONVERSIONS = {
  "公斤": { standardUnit: "公克", rate: 1000 },
  "公克": { standardUnit: "公克", rate: 1 },
  "台斤": { standardUnit: "公克", rate: 600 },
  "公升": { standardUnit: "毫升", rate: 1000 },
  "毫升": { standardUnit: "毫升", rate: 1 },
  "瓶": { standardUnit: "瓶", rate: 1 },
  "桶": { standardUnit: "桶", rate: 1 },
  "箱": { standardUnit: "箱", rate: 1 },
  "包": { standardUnit: "包", rate: 1 },
  "盒": { standardUnit: "盒", rate: 1 },
  "份": { standardUnit: "份", rate: 1 }
};

const state = {
  token: sessionStorage.getItem("erpSessionToken") || "",
  currentUser: readStoredUser(),
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
  $("#purchaseForm").addEventListener("input", handlePurchaseFormInput);
  $("#purchaseForm").addEventListener("change", handlePurchaseFormInput);
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

  bindExportButtons();
}

function setTodayDefault() {
  const dateInput = $('#purchaseForm [name="日期"]');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
}

async function handleLogin(event) {
  event.preventDefault();
  const account = $("#accountInput").value.trim();
  const password = $("#passwordInput").value.trim();
  if (!account) {
    $("#loginMessage").textContent = "請輸入員工帳號。";
    return;
  }
  if (!APPS_SCRIPT_URL) {
    $("#loginMessage").textContent = "尚未設定 Apps Script URL。";
    return;
  }

  try {
    $("#loginMessage").textContent = "登入中...";
    const result = await apiRequest("login", { account, password }, false);
    state.token = result.token;
    state.currentUser = result.user || null;
    sessionStorage.setItem("erpSessionToken", state.token);
    sessionStorage.setItem("erpCurrentUser", JSON.stringify(state.currentUser || {}));
    $("#passwordInput").value = "";
    showApp();
    await loadData();
  } catch (error) {
    $("#loginMessage").textContent = error.message || "登入失敗。";
  }
}

async function verifySession() {
  try {
    const result = await apiRequest("verifySession", {});
    if (result.user) {
      state.currentUser = result.user;
      sessionStorage.setItem("erpCurrentUser", JSON.stringify(state.currentUser || {}));
    }
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
  state.currentUser = null;
  sessionStorage.removeItem("erpSessionToken");
  sessionStorage.removeItem("erpCurrentUser");
}

function showLogin() {
  $("#loginView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
}

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  updateUserDisplay();
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
    if (result.currentUser) {
      state.currentUser = result.currentUser;
      sessionStorage.setItem("erpCurrentUser", JSON.stringify(state.currentUser || {}));
    }
    updateUserDisplay();
    renderAll();
    updateDatalists();
    updatePurchasePreview();
    hideMessage();
  } catch (error) {
    showMessage(error.message || "資料讀取失敗。", "error");
  }
}

async function handleAddPurchase(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = readForm(form);
  const validation = validatePurchaseInput(formData);
  if (!validation.ok) {
    showMessage(validation.message, "error");
    return;
  }

  try {
    showMessage("新增採購紀錄中...", "success");
    const result = await apiRequest("addPurchase", { purchase: formData, user: state.currentUser || {} });
    showMessage(`已新增採購紀錄：${result.purchaseId || "完成"}`, "success");
    if (form) form.reset();
    setTodayDefault();
    updatePurchasePreview();
    await loadData();
    switchTab("purchases");
  } catch (error) {
    showMessage(error.message || "新增失敗。", "error");
  }
}

function handlePurchaseFormInput(event) {
  const fieldName = event.target?.name;
  if (fieldName === "單位") applyUnitConversionPreset();
  if (fieldName === "品項") autoFillFromMaterial();
  updatePurchasePreview();
}

function validatePurchaseInput(data) {
  if (!data["供應商"]) return { ok: false, message: "供應商不可空白。" };
  if (!data["品項"]) return { ok: false, message: "品項不可空白。" };
  if (numberOrZero(data["數量"]) <= 0) return { ok: false, message: "數量必須大於 0。" };
  if (numberOrZero(data["單價"]) <= 0) return { ok: false, message: "單價必須大於 0。" };
  return { ok: true };
}

function applyUnitConversionPreset(force = false) {
  const form = $("#purchaseForm");
  if (!form) return;
  const unit = form.elements["單位"]?.value;
  const preset = UNIT_CONVERSIONS[unit];
  if (!preset) return;
  const rateInput = form.elements["換算倍率"];
  const standardUnitInput = form.elements["標準單位"];
  if (rateInput && (force || !rateInput.value || Number(rateInput.value) === 1)) rateInput.value = preset.rate;
  if (standardUnitInput && (force || !standardUnitInput.value)) standardUnitInput.value = preset.standardUnit;
}

function autoFillFromMaterial() {
  const form = $("#purchaseForm");
  if (!form) return;
  const itemName = normalize(form.elements["品項"]?.value);
  if (!itemName) return;
  const material = state.materials.find((item) => normalize(item["品項"]) === itemName || normalize(item["標準品項名稱"]) === itemName);
  if (!material) return;
  setIfEmpty(form.elements["標準品項名稱"], material["標準品項名稱"] || material["品項"]);
  setIfEmpty(form.elements["分類"], material["分類"] || "其他");
  setIfEmpty(form.elements["規格"], material["規格"] || "");
  setIfEmpty(form.elements["單位"], material["單位"] || "");
  setIfEmpty(form.elements["換算倍率"], material["換算倍率"] || "");
  setIfEmpty(form.elements["標準單位"], material["標準單位"] || "");
}

function setIfEmpty(input, value) {
  if (!input || value === undefined || value === null || value === "") return;
  if (!input.value) input.value = value;
}

function updatePurchasePreview() {
  const form = $("#purchaseForm");
  if (!form) return;
  const quantity = numberOrZero(form.elements["數量"]?.value);
  const unitPrice = numberOrZero(form.elements["單價"]?.value);
  const conversionRate = numberOrZero(form.elements["換算倍率"]?.value || 1) || 1;
  const amount = quantity * unitPrice;
  const standardQty = quantity * conversionRate;
  const standardUnitPrice = standardQty ? amount / standardQty : 0;

  setText("#amountPreview", money(amount));
  setText("#standardQtyPreview", `${formatNumber(standardQty)} ${form.elements["標準單位"]?.value || ""}`.trim());
  setText("#standardPricePreview", standardUnitPrice ? money(standardUnitPrice) : "$0");

  const item = form.elements["標準品項名稱"]?.value || form.elements["品項"]?.value;
  const alert = buildInlinePriceAlert(item, standardUnitPrice);
  const msg = $("#purchaseAssistMessage");
  if (msg) {
    msg.textContent = alert.message;
    msg.className = `assist-message ${alert.level}`;
  }
}

function buildInlinePriceAlert(itemName, standardUnitPrice) {
  if (!itemName || !standardUnitPrice) return { level: "neutral", message: "輸入數量與單價後，系統會即時計算金額與標準單價。" };
  const rows = state.purchases.filter((row) => normalize(row["標準品項名稱"] || row["品項"]) === normalize(itemName));
  if (rows.length < 2) return { level: "neutral", message: "此品項歷史資料較少，暫不做價格警示。" };
  const prices = rows.map((row) => numberOrZero(row["標準單位價格"] || row["單價"])).filter(Boolean);
  if (!prices.length) return { level: "neutral", message: "尚無可比較的標準單價。" };
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const diff = ((standardUnitPrice - avg) / avg) * 100;
  if (diff >= 30) return { level: "danger", message: `紅色警示：目前標準單價比歷史平均高 ${formatPercent(diff)}，建議確認報價。` };
  if (diff >= 15) return { level: "warning", message: `黃色提醒：目前標準單價比歷史平均高 ${formatPercent(diff)}。` };
  if (diff <= -10) return { level: "success", message: `漂亮，這次標準單價比歷史平均低 ${formatPercent(Math.abs(diff))}。` };
  return { level: "success", message: "價格落在正常範圍內。" };
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
    const result = await apiRequest("analyzeQuoteImage", {
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

  const todayRows = filterPurchasesByDate(state.purchases, new Date());
  setText("#metricTodayTotal", money(sumAmount(todayRows)));
  setText("#metricFoodCost", money(sumByCategories(filterThisMonthRows(state.purchases), FOOD_COST_CATEGORIES)));
  setText("#metricBeverageCost", money(sumByCategories(filterThisMonthRows(state.purchases), BEVERAGE_CATEGORIES)));

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
      <td>${escapeHtml(item["建立人姓名"] || item["建立人"] || "")}</td>
    </tr>
  `).join("") : emptyRow(11, "尚無採購紀錄");
}

function renderAnalysis() {
  const dashboard = state.dashboard || buildDashboardLocally(state.materials, state.purchases);
  renderBarChart("#supplierChart", dashboard.supplierTotals || []);
  renderBarChart("#categoryChart", dashboard.categoryTotals || []);
  renderBarChart("#monthlyChart", monthlyTotals(state.purchases, 6));

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
    <p class="muted">供應商：${escapeHtml(receipt.supplier || "待確認")} ｜ 日期：${escapeHtml(receipt.date || "待確認")} ｜ 報價單ID：${escapeHtml(receipt.quoteId || "未建立")}</p>
    ${receipt.fileUrl ? `<p class="muted"><a href="${escapeHtml(receipt.fileUrl)}" target="_blank" rel="noopener">開啟報價單檔案</a></p>` : ""}
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
        const item = { 日期: date, 供應商: supplier, 報價單ID: receipt.quoteId || "", 報價單檔案連結: receipt.fileUrl || "", AI辨識: "是", AI信心分數: receipt.confidence || "" };
        box.querySelectorAll("[data-field]").forEach((input) => { item[input.dataset.field] = input.value; });
        return item;
      });

      showMessage("寫入 AI 確認資料中...", "success");
      for (const purchase of purchaseItems) {
        await apiRequest("addPurchase", { purchase, user: state.currentUser || {} });
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

function updateDatalists() {
  fillDatalist("#supplierDatalist", unique(state.purchases.map((item) => item["供應商"]).concat(state.materials.map((item) => item["供應商"]))).filter(Boolean).sort());
  fillDatalist("#itemDatalist", unique(state.materials.map((item) => item["品項"]).concat(state.purchases.map((item) => item["品項"]))).filter(Boolean).sort());
}

function fillDatalist(selector, values) {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
}

function filterThisMonthRows(rows) {
  const key = monthKey(new Date());
  return rows.filter((row) => monthKey(parseDate(row["日期"])) === key);
}

function filterPurchasesByDate(rows, date) {
  const key = new Date(date).toISOString().slice(0, 10);
  return rows.filter((row) => String(row["日期"] || "").slice(0, 10) === key);
}

function sumByCategories(rows, categories) {
  const set = new Set(categories);
  return sumAmount(rows.filter((row) => set.has(row["分類"])));
}

function monthlyTotals(rows, months = 6) {
  const now = new Date();
  const labels = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(monthKey(d));
  }
  return labels.map((name) => ({
    name,
    amount: sumAmount(rows.filter((row) => monthKey(parseDate(row["日期"])) === name))
  }));
}

function setText(selector, value) {
  const target = $(selector);
  if (target) target.textContent = value;
}

function exportCsv(filename, rows, headers) {
  const csv = [headers.join(",")].concat(rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function bindExportButtons() {
  const purchaseButton = $("#exportPurchasesButton");
  const materialButton = $("#exportMaterialsButton");
  if (purchaseButton) purchaseButton.addEventListener("click", () => exportCsv(`purchases-${new Date().toISOString().slice(0, 10)}.csv`, state.purchases, ["採購ID", "日期", "供應商", "品項", "標準品項名稱", "分類", "規格", "數量", "單位", "單價", "金額", "標準單位價格", "報價單ID", "報價單檔案連結", "AI辨識", "AI信心分數", "備註", "建立人ID", "建立人姓名"]));
  if (materialButton) materialButton.addEventListener("click", () => exportCsv(`materials-${new Date().toISOString().slice(0, 10)}.csv`, state.materials, ["ERP代碼", "品項", "標準品項名稱", "分類", "規格", "單位", "最新單價", "標準單位價格", "供應商", "最近採購日", "使用中", "備註"]));
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


function readStoredUser() {
  try {
    const raw = sessionStorage.getItem("erpCurrentUser");
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function updateUserDisplay() {
  const user = state.currentUser || {};
  const name = user.name || user["姓名"] || "-";
  const role = user.role || user["角色"] || "-";
  setText("#currentUserName", name);
  setText("#currentUserRole", role);
  setText("#settingsCurrentUser", `${name} ｜ ${role}`);
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


/* =============================
   v3.2 採購編輯／作廢功能
   ============================= */

function isVoidedPurchase(row) {
  return String(row?.["狀態"] || "正常").trim() === "已作廢";
}

function activePurchases(rows = state.purchases) {
  return rows.filter((row) => !isVoidedPurchase(row));
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#logoutButton").addEventListener("click", handleLogout);
  $("#refreshButton").addEventListener("click", loadData);
  $("#purchaseForm").addEventListener("submit", handleAddPurchase);
  $("#purchaseForm").addEventListener("input", handlePurchaseFormInput);
  $("#purchaseForm").addEventListener("change", handlePurchaseFormInput);
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

  document.addEventListener("click", handlePurchaseActionClick);
  const editForm = $("#editPurchaseForm");
  if (editForm) {
    editForm.addEventListener("submit", handleEditPurchaseSubmit);
    editForm.addEventListener("input", updateEditPurchasePreview);
    editForm.addEventListener("change", updateEditPurchasePreview);
  }
  const voidForm = $("#voidPurchaseForm");
  if (voidForm) voidForm.addEventListener("submit", handleVoidPurchaseSubmit);

  ["#editPurchaseCloseButton", "#editPurchaseCancelButton"].forEach((selector) => {
    const el = $(selector);
    if (el) el.addEventListener("click", closeEditPurchaseModal);
  });
  ["#voidPurchaseCloseButton", "#voidPurchaseCancelButton"].forEach((selector) => {
    const el = $(selector);
    if (el) el.addEventListener("click", closeVoidPurchaseModal);
  });
  const editModal = $("#editPurchaseModal");
  if (editModal) editModal.addEventListener("click", (event) => {
    if (event.target === editModal) closeEditPurchaseModal();
  });
  const voidModal = $("#voidPurchaseModal");
  if (voidModal) voidModal.addEventListener("click", (event) => {
    if (event.target === voidModal) closeVoidPurchaseModal();
  });

  bindExportButtons();
}

function initOptions() {
  fillSelect($("#categorySelect"), MATERIAL_CATEGORIES, "其他");
  fillSelect($("#unitSelect"), UNIT_OPTIONS, "公斤");
  fillSelect($("#standardUnitSelect"), STANDARD_UNITS, "公克");
  fillSelect($("#editCategorySelect"), MATERIAL_CATEGORIES, "其他");
  fillSelect($("#editUnitSelect"), UNIT_OPTIONS, "公斤");
  fillSelect($("#editStandardUnitSelect"), STANDARD_UNITS, "公克");
}

async function handleAddPurchase(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = readForm(form);
  const validation = validatePurchaseInput(formData);
  if (!validation.ok) {
    showMessage(validation.message, "error");
    return;
  }

  try {
    showMessage("新增採購紀錄中...", "success");
    const result = await apiRequest("addPurchase", { purchase: formData, user: state.currentUser || {} });
    showMessage(`已新增採購紀錄：${result.purchaseId || "完成"}`, "success");
    if (form) form.reset();
    setTodayDefault();
    updatePurchasePreview();
    await loadData();
    switchTab("purchases");
  } catch (error) {
    showMessage(error.message || "新增失敗。", "error");
  }
}

function renderDashboard() {
  const activeRows = activePurchases(state.purchases);
  const dashboard = state.dashboard || buildDashboardLocally(state.materials, activeRows);
  const thisMonth = numberOrZero(dashboard.thisMonthTotal);
  const lastMonth = numberOrZero(dashboard.lastMonthTotal);
  const change = lastMonth ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  $("#metricThisMonth").textContent = money(thisMonth);
  $("#metricMonthChange").textContent = `較上月 ${formatPercent(change)}`;
  $("#metricMaterialCount").textContent = String(dashboard.activeMaterialCount ?? state.materials.length);

  const todayRows = filterPurchasesByDate(activeRows, new Date());
  setText("#metricTodayTotal", money(sumAmount(todayRows)));
  setText("#metricFoodCost", money(sumByCategories(filterThisMonthRows(activeRows), FOOD_COST_CATEGORIES)));
  setText("#metricBeverageCost", money(sumByCategories(filterThisMonthRows(activeRows), BEVERAGE_CATEGORIES)));

  const topSupplier = firstItem(dashboard.thisMonthSupplierTotals);
  $("#metricTopSupplier").textContent = topSupplier?.name || "-";
  $("#metricTopSupplierAmount").textContent = money(topSupplier?.amount || 0);

  const topCategory = firstItem(dashboard.thisMonthCategoryTotals);
  $("#metricTopCategory").textContent = topCategory?.name || "-";
  $("#metricTopCategoryAmount").textContent = money(topCategory?.amount || 0);

  const recent = dashboard.recentPurchases || activeRows.slice(-10).reverse();
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

function renderPurchases() {
  const keyword = normalize($("#purchaseSearch").value);
  const rows = state.purchases.filter((item) => normalize(Object.values(item).join(" ")).includes(keyword)).reverse();
  $("#purchasesBody").innerHTML = rows.length ? rows.map((item) => {
    const status = item["狀態"] || "正常";
    const isVoided = status === "已作廢";
    return `
      <tr class="${isVoided ? "voided-row" : ""}">
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
        <td><span class="status-badge ${isVoided ? "voided" : "normal"}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(item["建立人姓名"] || item["建立人"] || "")}</td>
        <td class="actions-cell">
          ${isVoided ? `<span class="muted">已作廢</span>` : `
            <button class="text-button purchase-edit" data-purchase-id="${escapeHtml(item["採購ID"] || "")}" type="button">編輯</button>
            <button class="text-button danger-text purchase-void" data-purchase-id="${escapeHtml(item["採購ID"] || "")}" type="button">作廢</button>
          `}
        </td>
      </tr>
    `;
  }).join("") : emptyRow(13, "尚無採購紀錄");
}

function renderAnalysis() {
  const activeRows = activePurchases(state.purchases);
  const dashboard = state.dashboard || buildDashboardLocally(state.materials, activeRows);
  renderBarChart("#supplierChart", dashboard.supplierTotals || []);
  renderBarChart("#categoryChart", dashboard.categoryTotals || []);
  renderBarChart("#monthlyChart", monthlyTotals(activeRows, 6));

  const select = $("#priceItemSelect");
  const items = unique(activeRows.map((item) => item["標準品項名稱"] || item["品項"]).filter(Boolean)).sort();
  const current = select.value;
  select.innerHTML = items.length ? items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("") : `<option value="">尚無品項</option>`;
  if (items.includes(current)) select.value = current;
  renderPriceHistory();
}

function renderPriceHistory() {
  const itemName = $("#priceItemSelect").value;
  const rows = activePurchases(state.purchases)
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

function buildDashboardLocally(materials, purchases) {
  const activeRows = activePurchases(purchases);
  const now = new Date();
  const thisMonthKey = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = monthKey(lastMonthDate);

  const thisMonthRows = activeRows.filter((item) => monthKey(parseDate(item["日期"])) === thisMonthKey);
  const lastMonthRows = activeRows.filter((item) => monthKey(parseDate(item["日期"])) === lastMonthKey);

  return {
    thisMonthTotal: sumAmount(thisMonthRows),
    lastMonthTotal: sumAmount(lastMonthRows),
    activeMaterialCount: materials.filter((item) => String(item["使用中"] || "是") !== "否").length,
    supplierTotals: totalsBy(activeRows, "供應商"),
    categoryTotals: totalsBy(activeRows, "分類"),
    thisMonthSupplierTotals: totalsBy(thisMonthRows, "供應商"),
    thisMonthCategoryTotals: totalsBy(thisMonthRows, "分類"),
    recentPurchases: activeRows.slice(-10).reverse(),
    cheapestByItem: cheapestByItem(activeRows),
    priceAlerts: []
  };
}

function handlePurchaseActionClick(event) {
  const editButton = event.target.closest?.(".purchase-edit");
  const voidButton = event.target.closest?.(".purchase-void");
  if (editButton) {
    openEditPurchaseModal(editButton.dataset.purchaseId);
  }
  if (voidButton) {
    openVoidPurchaseModal(voidButton.dataset.purchaseId);
  }
}

function findPurchaseById(purchaseId) {
  return state.purchases.find((item) => String(item["採購ID"]) === String(purchaseId));
}

function openEditPurchaseModal(purchaseId) {
  const purchase = findPurchaseById(purchaseId);
  if (!purchase) {
    showMessage("找不到這筆採購紀錄。", "error");
    return;
  }
  if (isVoidedPurchase(purchase)) {
    showMessage("已作廢的採購紀錄不可編輯。", "error");
    return;
  }
  const form = $("#editPurchaseForm");
  if (!form) return;
  ["採購ID", "日期", "供應商", "品項", "標準品項名稱", "分類", "規格", "數量", "單位", "換算倍率", "標準數量", "標準單位", "單價", "備註"].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = purchase[key] || "";
  });
  if (form.elements["分類"] && !form.elements["分類"].value) form.elements["分類"].value = "其他";
  if (form.elements["單位"] && !form.elements["單位"].value) form.elements["單位"].value = "公斤";
  if (form.elements["標準單位"] && !form.elements["標準單位"].value) form.elements["標準單位"].value = "公克";
  updateEditPurchasePreview();
  $("#editPurchaseModal").classList.remove("hidden");
}

function closeEditPurchaseModal() {
  const modal = $("#editPurchaseModal");
  if (modal) modal.classList.add("hidden");
}

function updateEditPurchasePreview() {
  const form = $("#editPurchaseForm");
  const target = $("#editPurchasePreview");
  if (!form || !target) return;
  const quantity = numberOrZero(form.elements["數量"]?.value);
  const unitPrice = numberOrZero(form.elements["單價"]?.value);
  const conversionRate = numberOrZero(form.elements["換算倍率"]?.value || 1) || 1;
  const amount = quantity * unitPrice;
  const standardQty = quantity * conversionRate;
  const standardUnitPrice = standardQty ? amount / standardQty : 0;
  target.textContent = `修改後金額：${money(amount)}｜標準數量：${formatNumber(standardQty)} ${form.elements["標準單位"]?.value || ""}｜標準單價：${standardUnitPrice ? money(standardUnitPrice) : "$0"}`;
}

async function handleEditPurchaseSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = readForm(form);
  const validation = validatePurchaseInput(data);
  if (!validation.ok) {
    showMessage(validation.message, "error");
    return;
  }
  try {
    showMessage("儲存採購紀錄修改中...", "success");
    const result = await apiRequest("updatePurchase", {
      purchaseId: data["採購ID"],
      purchase: data,
      user: state.currentUser || {}
    });
    showMessage(`已更新採購紀錄：${result.purchaseId || data["採購ID"]}`, "success");
    closeEditPurchaseModal();
    await loadData();
    switchTab("purchases");
  } catch (error) {
    showMessage(error.message || "修改失敗。", "error");
  }
}

function openVoidPurchaseModal(purchaseId) {
  const purchase = findPurchaseById(purchaseId);
  if (!purchase) {
    showMessage("找不到這筆採購紀錄。", "error");
    return;
  }
  const form = $("#voidPurchaseForm");
  if (!form) return;
  form.reset();
  form.elements["採購ID"].value = purchaseId;
  setText("#voidPurchaseSummary", `準備作廢：${purchaseId}｜${purchase["供應商"] || ""}｜${purchase["品項"] || ""}｜${money(purchase["金額"])}`);
  $("#voidPurchaseModal").classList.remove("hidden");
}

function closeVoidPurchaseModal() {
  const modal = $("#voidPurchaseModal");
  if (modal) modal.classList.add("hidden");
}

async function handleVoidPurchaseSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const purchaseId = form.elements["採購ID"]?.value;
  const reason = form.elements["作廢原因"]?.value.trim();
  if (!reason) {
    showMessage("請填寫作廢原因。", "error");
    return;
  }
  if (!confirm(`確定要作廢 ${purchaseId} 嗎？\n此動作不會刪除資料，但會排除 Dashboard 與分析。`)) return;
  try {
    showMessage("作廢採購紀錄中...", "success");
    const result = await apiRequest("voidPurchase", {
      purchaseId,
      reason,
      user: state.currentUser || {}
    });
    showMessage(`已作廢採購紀錄：${result.purchaseId || purchaseId}`, "success");
    closeVoidPurchaseModal();
    await loadData();
    switchTab("purchases");
  } catch (error) {
    showMessage(error.message || "作廢失敗。", "error");
  }
}

function bindExportButtons() {
  const purchaseButton = $("#exportPurchasesButton");
  const materialButton = $("#exportMaterialsButton");
  if (purchaseButton) purchaseButton.addEventListener("click", () => exportCsv(`purchases-${new Date().toISOString().slice(0, 10)}.csv`, state.purchases, ["採購ID", "日期", "供應商", "品項", "標準品項名稱", "分類", "規格", "數量", "單位", "單價", "金額", "標準單位價格", "狀態", "作廢原因", "作廢人ID", "作廢人姓名", "作廢時間", "報價單ID", "報價單檔案連結", "AI辨識", "AI信心分數", "備註", "建立人ID", "建立人姓名", "最後修改人ID", "最後修改人姓名"]));
  if (materialButton) materialButton.addEventListener("click", () => exportCsv(`materials-${new Date().toISOString().slice(0, 10)}.csv`, state.materials, ["ERP代碼", "品項", "標準品項名稱", "分類", "規格", "單位", "最新單價", "標準單位價格", "供應商", "最近採購日", "使用中", "備註"]));
}


/* =============================
   v3.3 員工權限控管
   ============================= */

const FRONTEND_ROLE_POLICIES_V33 = {
  "老闆": {
    canViewDashboard: true,
    canViewMaterials: true,
    canViewPurchases: true,
    canViewAnalysis: true,
    canAddPurchase: true,
    canEditAllPurchases: true,
    canEditOwnPurchases: true,
    canVoidPurchases: true,
    canUseAiReceipt: true,
    canManageMaterials: true,
    canExportCsv: true
  },
  "管理員": {
    canViewDashboard: true,
    canViewMaterials: true,
    canViewPurchases: true,
    canViewAnalysis: true,
    canAddPurchase: true,
    canEditAllPurchases: true,
    canEditOwnPurchases: true,
    canVoidPurchases: true,
    canUseAiReceipt: true,
    canManageMaterials: true,
    canExportCsv: true
  },
  "採購": {
    canViewDashboard: true,
    canViewMaterials: true,
    canViewPurchases: true,
    canViewAnalysis: true,
    canAddPurchase: true,
    canEditAllPurchases: false,
    canEditOwnPurchases: true,
    canVoidPurchases: false,
    canUseAiReceipt: true,
    canManageMaterials: false,
    canExportCsv: true
  },
  "員工": {
    canViewDashboard: true,
    canViewMaterials: true,
    canViewPurchases: true,
    canViewAnalysis: false,
    canAddPurchase: true,
    canEditAllPurchases: false,
    canEditOwnPurchases: false,
    canVoidPurchases: false,
    canUseAiReceipt: false,
    canManageMaterials: false,
    canExportCsv: false
  },
  "唯讀": {
    canViewDashboard: true,
    canViewMaterials: true,
    canViewPurchases: true,
    canViewAnalysis: true,
    canAddPurchase: false,
    canEditAllPurchases: false,
    canEditOwnPurchases: false,
    canVoidPurchases: false,
    canUseAiReceipt: false,
    canManageMaterials: false,
    canExportCsv: true
  }
};

function fallbackPermissionsV33(user = state.currentUser || {}) {
  const role = user.role || user["角色"] || "員工";
  return Object.assign({}, FRONTEND_ROLE_POLICIES_V33[role] || FRONTEND_ROLE_POLICIES_V33["員工"]);
}

function setPermissionsV33(user, permissions) {
  state.permissions = Object.assign({}, fallbackPermissionsV33(user), permissions || user?.permissions || {});
}

function hasPermissionV33(key) {
  if (!state.permissions) setPermissionsV33(state.currentUser || {}, null);
  return !!state.permissions[key];
}

function permissionLabelsV33() {
  const items = [];
  if (hasPermissionV33("canAddPurchase")) items.push("新增採購");
  if (hasPermissionV33("canEditAllPurchases")) items.push("編輯全部");
  else if (hasPermissionV33("canEditOwnPurchases")) items.push("編輯自己建立");
  if (hasPermissionV33("canVoidPurchases")) items.push("作廢採購");
  if (hasPermissionV33("canUseAiReceipt")) items.push("AI辨識");
  if (hasPermissionV33("canManageMaterials")) items.push("材料管理");
  if (hasPermissionV33("canExportCsv")) items.push("匯出CSV");
  return items.length ? items : ["唯讀瀏覽"];
}

function isOwnPurchaseV33(row) {
  const user = state.currentUser || {};
  const userId = String(user.id || user["員工ID"] || "").trim();
  const userName = String(user.name || user["姓名"] || "").trim();
  const creatorId = String(row?.["建立人ID"] || "").trim();
  const creatorName = String(row?.["建立人姓名"] || row?.["建立人"] || "").trim();
  return (!!userId && userId === creatorId) || (!!userName && userName === creatorName);
}

function canEditPurchaseV33(row) {
  if (isVoidedPurchase(row)) return false;
  if (hasPermissionV33("canEditAllPurchases")) return true;
  return hasPermissionV33("canEditOwnPurchases") && isOwnPurchaseV33(row);
}

function canVoidPurchaseV33(row) {
  if (isVoidedPurchase(row)) return false;
  return hasPermissionV33("canVoidPurchases");
}

function updatePermissionUiV33() {
  setPermissionsV33(state.currentUser || {}, state.permissions || null);

  const quickAddNav = $('.nav-item[data-tab="quickAdd"]');
  if (quickAddNav) quickAddNav.classList.toggle("hidden", !hasPermissionV33("canAddPurchase"));

  const aiNav = $('.nav-item[data-tab="aiReceipt"]');
  if (aiNav) aiNav.classList.toggle("hidden", !hasPermissionV33("canUseAiReceipt"));

  const analysisNav = $('.nav-item[data-tab="analysis"]');
  if (analysisNav) analysisNav.classList.toggle("hidden", !hasPermissionV33("canViewAnalysis"));

  const addButton = $('#purchaseForm button[type="submit"]');
  if (addButton) {
    addButton.disabled = !hasPermissionV33("canAddPurchase");
    addButton.textContent = hasPermissionV33("canAddPurchase") ? "新增採購紀錄" : "此帳號無新增權限";
  }

  const analyzeButton = $('#analyzeReceiptButton');
  if (analyzeButton) {
    analyzeButton.disabled = !hasPermissionV33("canUseAiReceipt");
    analyzeButton.textContent = hasPermissionV33("canUseAiReceipt") ? "上傳並辨識" : "此帳號無 AI 辨識權限";
  }

  const exportButtons = ['#exportPurchasesButton', '#exportMaterialsButton'];
  exportButtons.forEach((selector) => {
    const button = $(selector);
    if (button) button.disabled = !hasPermissionV33("canExportCsv");
  });

  if (state.activeTab === "quickAdd" && !hasPermissionV33("canAddPurchase")) switchTab("dashboard");
  if (state.activeTab === "aiReceipt" && !hasPermissionV33("canUseAiReceipt")) switchTab("dashboard");
  if (state.activeTab === "analysis" && !hasPermissionV33("canViewAnalysis")) switchTab("dashboard");
}

function updateUserDisplay() {
  const user = state.currentUser || {};
  const name = user.name || user["姓名"] || "-";
  const role = user.role || user["角色"] || "-";
  setPermissionsV33(user, state.permissions || user.permissions || null);
  const labels = permissionLabelsV33().join("、");
  setText("#currentUserName", name);
  // v3.9.2：側邊欄只顯示角色，避免權限清單過長造成左側選單交疊。
  setText("#currentUserRole", role);
  setText("#settingsCurrentUser", `${name} ｜ ${role}`);
  setText("#settingsPermissionList", labels);
  updatePermissionUiV33();
}

async function handleLogin(event) {
  event.preventDefault();
  const account = $("#accountInput").value.trim();
  const password = $("#passwordInput").value.trim();
  if (!account) {
    $("#loginMessage").textContent = "請輸入員工帳號。";
    return;
  }
  if (!APPS_SCRIPT_URL) {
    $("#loginMessage").textContent = "尚未設定 Apps Script URL。";
    return;
  }

  try {
    $("#loginMessage").textContent = "登入中...";
    const result = await apiRequest("login", { account, password }, false);
    state.token = result.token;
    state.currentUser = result.user || null;
    setPermissionsV33(state.currentUser || {}, result.permissions || state.currentUser?.permissions || null);
    sessionStorage.setItem("erpSessionToken", state.token);
    sessionStorage.setItem("erpCurrentUser", JSON.stringify(state.currentUser || {}));
    sessionStorage.setItem("erpPermissions", JSON.stringify(state.permissions || {}));
    $("#passwordInput").value = "";
    showApp();
    await loadData();
  } catch (error) {
    $("#loginMessage").textContent = error.message || "登入失敗。";
  }
}

async function verifySession() {
  try {
    const result = await apiRequest("verifySession", {});
    if (result.user) {
      state.currentUser = result.user;
      sessionStorage.setItem("erpCurrentUser", JSON.stringify(state.currentUser || {}));
    }
    setPermissionsV33(state.currentUser || {}, result.permissions || state.currentUser?.permissions || null);
    sessionStorage.setItem("erpPermissions", JSON.stringify(state.permissions || {}));
    showApp();
    await loadData();
  } catch (_error) {
    clearSession();
    showLogin();
  }
}

function clearSession() {
  state.token = "";
  state.currentUser = null;
  state.permissions = {};
  sessionStorage.removeItem("erpSessionToken");
  sessionStorage.removeItem("erpCurrentUser");
  sessionStorage.removeItem("erpPermissions");
}

function readStoredUser() {
  try {
    const rawUser = sessionStorage.getItem("erpCurrentUser");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch (_error) {
    return null;
  }
}

async function loadData() {
  try {
    showMessage("資料讀取中...", "success");
    const result = await apiRequest("getBootstrapData", {});
    state.materials = Array.isArray(result.materials) ? result.materials : [];
    state.purchases = Array.isArray(result.purchases) ? result.purchases : [];
    state.dashboard = result.dashboard || buildDashboardLocally(state.materials, state.purchases);
    if (result.currentUser) {
      state.currentUser = result.currentUser;
      sessionStorage.setItem("erpCurrentUser", JSON.stringify(state.currentUser || {}));
    }
    setPermissionsV33(state.currentUser || {}, result.permissions || state.currentUser?.permissions || null);
    sessionStorage.setItem("erpPermissions", JSON.stringify(state.permissions || {}));
    updateUserDisplay();
    renderAll();
    updateDatalists();
    updatePurchasePreview();
    hideMessage();
  } catch (error) {
    showMessage(error.message || "資料讀取失敗。", "error");
  }
}

async function handleAddPurchase(event) {
  event.preventDefault();
  if (!hasPermissionV33("canAddPurchase")) {
    showMessage("此帳號沒有新增採購紀錄權限。", "error");
    return;
  }
  const form = event.currentTarget;
  const formData = readForm(form);
  const validation = validatePurchaseInput(formData);
  if (!validation.ok) {
    showMessage(validation.message, "error");
    return;
  }

  try {
    showMessage("新增採購紀錄中...", "success");
    const result = await apiRequest("addPurchase", { purchase: formData, user: state.currentUser || {} });
    showMessage(`已新增採購紀錄：${result.purchaseId || "完成"}`, "success");
    if (form) form.reset();
    setTodayDefault();
    updatePurchasePreview();
    await loadData();
    switchTab("purchases");
  } catch (error) {
    showMessage(error.message || "新增失敗。", "error");
  }
}

async function handleAnalyzeReceipt() {
  if (!hasPermissionV33("canUseAiReceipt")) {
    showMessage("此帳號沒有 AI 單據辨識權限。", "error");
    return;
  }
  const fileInput = $("#receiptFile");
  const file = fileInput.files?.[0];
  if (!file) {
    showMessage("請先選擇單據照片或 PDF。", "error");
    return;
  }

  try {
    showMessage("AI 辨識中，請稍候...", "success");
    const filePayload = await readFileAsBase64(file);
    const result = await apiRequest("analyzeQuoteImage", {
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

function renderPurchases() {
  const keyword = normalize($("#purchaseSearch").value);
  const rows = state.purchases.filter((item) => normalize(Object.values(item).join(" ")).includes(keyword)).reverse();
  $("#purchasesBody").innerHTML = rows.length ? rows.map((item) => {
    const status = item["狀態"] || "正常";
    const isVoided = status === "已作廢";
    const editAllowed = canEditPurchaseV33(item);
    const voidAllowed = canVoidPurchaseV33(item);
    const actionHtml = isVoided
      ? `<span class="muted">已作廢</span>`
      : [
          editAllowed ? `<button class="text-button purchase-edit" data-purchase-id="${escapeHtml(item["採購ID"] || "")}" type="button">編輯</button>` : "",
          voidAllowed ? `<button class="text-button danger-text purchase-void" data-purchase-id="${escapeHtml(item["採購ID"] || "")}" type="button">作廢</button>` : ""
        ].filter(Boolean).join(" ") || `<span class="muted">無操作權限</span>`;

    return `
      <tr class="${isVoided ? "voided-row" : ""}">
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
        <td><span class="status-badge ${isVoided ? "voided" : "normal"}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(item["建立人姓名"] || item["建立人"] || "")}</td>
        <td class="actions-cell">${actionHtml}</td>
      </tr>
    `;
  }).join("") : emptyRow(13, "尚無採購紀錄");
}

function openEditPurchaseModal(purchaseId) {
  const purchase = findPurchaseById(purchaseId);
  if (!purchase) {
    showMessage("找不到這筆採購紀錄。", "error");
    return;
  }
  if (!canEditPurchaseV33(purchase)) {
    showMessage("此帳號沒有編輯這筆採購紀錄的權限。", "error");
    return;
  }
  const form = $("#editPurchaseForm");
  if (!form) return;
  ["採購ID", "日期", "供應商", "品項", "標準品項名稱", "分類", "規格", "數量", "單位", "換算倍率", "標準數量", "標準單位", "單價", "備註"].forEach((key) => {
    if (form.elements[key]) form.elements[key].value = purchase[key] || "";
  });
  if (form.elements["分類"] && !form.elements["分類"].value) form.elements["分類"].value = "其他";
  if (form.elements["單位"] && !form.elements["單位"].value) form.elements["單位"].value = "公斤";
  if (form.elements["標準單位"] && !form.elements["標準單位"].value) form.elements["標準單位"].value = "公克";
  updateEditPurchasePreview();
  $("#editPurchaseModal").classList.remove("hidden");
}

function openVoidPurchaseModal(purchaseId) {
  const purchase = findPurchaseById(purchaseId);
  if (!purchase) {
    showMessage("找不到這筆採購紀錄。", "error");
    return;
  }
  if (!canVoidPurchaseV33(purchase)) {
    showMessage("此帳號沒有作廢採購紀錄的權限。", "error");
    return;
  }
  const form = $("#voidPurchaseForm");
  if (!form) return;
  form.reset();
  form.elements["採購ID"].value = purchaseId;
  setText("#voidPurchaseSummary", `準備作廢：${purchaseId}｜${purchase["供應商"] || ""}｜${purchase["品項"] || ""}｜${money(purchase["金額"])}`);
  $("#voidPurchaseModal").classList.remove("hidden");
}

function bindExportButtons() {
  const purchaseButton = $("#exportPurchasesButton");
  const materialButton = $("#exportMaterialsButton");
  if (purchaseButton) purchaseButton.addEventListener("click", () => {
    if (!hasPermissionV33("canExportCsv")) {
      showMessage("此帳號沒有匯出 CSV 權限。", "error");
      return;
    }
    exportCsv(`purchases-${new Date().toISOString().slice(0, 10)}.csv`, state.purchases, ["採購ID", "日期", "供應商", "品項", "標準品項名稱", "分類", "規格", "數量", "單位", "單價", "金額", "標準單位價格", "狀態", "作廢原因", "作廢人ID", "作廢人姓名", "作廢時間", "報價單ID", "報價單檔案連結", "AI辨識", "AI信心分數", "備註", "建立人ID", "建立人姓名", "最後修改人ID", "最後修改人姓名"]);
  });
  if (materialButton) materialButton.addEventListener("click", () => {
    if (!hasPermissionV33("canExportCsv")) {
      showMessage("此帳號沒有匯出 CSV 權限。", "error");
      return;
    }
    exportCsv(`materials-${new Date().toISOString().slice(0, 10)}.csv`, state.materials, ["ERP代碼", "品項", "標準品項名稱", "分類", "規格", "單位", "最新單價", "標準單位價格", "供應商", "最近採購日", "使用中", "備註"]);
  });
}


function init() {
  applyBrand();
  initOptions();
  bindEvents();
  setTodayDefault();
  try {
    const rawPerm = sessionStorage.getItem("erpPermissions");
    state.permissions = rawPerm ? JSON.parse(rawPerm) || {} : {};
  } catch (_error) {
    state.permissions = {};
  }

  $("#appsScriptUrlText").textContent = APPS_SCRIPT_URL || "尚未設定";
  if (!APPS_SCRIPT_URL) $("#setupWarning")?.classList.remove("hidden");

  if (state.token && APPS_SCRIPT_URL) {
    verifySession();
  } else {
    showLogin();
  }
}


/* =============================
   v3.4 手機快速 Key-in 與卡片式紀錄
   ============================= */

const MOBILE_COMMON_ITEMS_V34 = ["牛五花", "牛肋條", "雞腿肉", "豬五花", "牛大腸", "生啤", "可爾必思", "垃圾袋"];
const MOBILE_COMMON_SUPPLIERS_V34 = ["肉品商", "蔬菜商", "酒商", "包材商"];

function isMobileLayoutV34() {
  return window.matchMedia && window.matchMedia("(max-width: 820px)").matches;
}

function topValuesV34(rows, field, limit = 8, fallback = []) {
  const map = new Map();
  rows.forEach((row) => {
    const value = String(row?.[field] || "").trim();
    if (!value) return;
    map.set(value, (map.get(value) || 0) + 1);
  });
  const values = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([value]) => value);
  return unique(values.concat(fallback)).slice(0, limit);
}

function renderMobileQuickToolsV34() {
  const supplierTarget = $("#mobileSupplierChips");
  const itemTarget = $("#mobileItemChips");
  if (!supplierTarget || !itemTarget) return;

  const suppliers = topValuesV34(state.purchases, "供應商", 8, MOBILE_COMMON_SUPPLIERS_V34);
  const materialItems = state.materials.map((item) => item["品項"] || item["標準品項名稱"]).filter(Boolean);
  const purchaseItems = state.purchases.map((item) => item["品項"] || item["標準品項名稱"]).filter(Boolean);
  const itemRows = materialItems.concat(purchaseItems).map((品項) => ({ 品項 }));
  const items = topValuesV34(itemRows, "品項", 10, MOBILE_COMMON_ITEMS_V34);

  supplierTarget.innerHTML = suppliers.length
    ? suppliers.map((name) => `<button class="quick-chip mobile-supplier-chip" type="button" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")
    : `<span class="muted">尚無供應商資料</span>`;
  itemTarget.innerHTML = items.length
    ? items.map((name) => `<button class="quick-chip mobile-item-chip" type="button" data-value="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")
    : `<span class="muted">尚無品項資料</span>`;
}

function setQuickAddFieldV34(fieldName, value) {
  const form = $("#purchaseForm");
  if (!form || !form.elements[fieldName]) return;
  form.elements[fieldName].value = value;
  if (fieldName === "品項") autoFillFromMaterial();
  updatePurchasePreview();
}

function renderPurchaseCardsV34(rows) {
  const target = $("#purchaseCards");
  if (!target) return;
  target.innerHTML = rows.length ? rows.map((item) => {
    const status = item["狀態"] || "正常";
    const isVoided = status === "已作廢";
    const editAllowed = canEditPurchaseV33(item);
    const voidAllowed = canVoidPurchaseV33(item);
    const purchaseId = escapeHtml(item["採購ID"] || "");
    const actions = isVoided
      ? `<span class="muted">已作廢</span>`
      : [
          editAllowed ? `<button class="secondary purchase-edit" data-purchase-id="${purchaseId}" type="button">編輯</button>` : "",
          voidAllowed ? `<button class="danger purchase-void" data-purchase-id="${purchaseId}" type="button">作廢</button>` : ""
        ].filter(Boolean).join("") || `<span class="muted">無操作權限</span>`;
    return `
      <article class="purchase-mobile-card ${isVoided ? "voided" : ""}">
        <div class="purchase-mobile-head">
          <div>
            <strong>${escapeHtml(item["品項"] || "未命名品項")}</strong>
            <span>${escapeHtml(item["供應商"] || "")}</span>
          </div>
          <span class="status-badge ${isVoided ? "voided" : "normal"}">${escapeHtml(status)}</span>
        </div>
        <div class="purchase-mobile-main">
          <span>${escapeHtml(item["日期"] || "")}</span>
          <span>${formatNumber(item["數量"])} ${escapeHtml(item["單位"] || "")}</span>
          <span>${money(item["單價"])}</span>
        </div>
        <div class="purchase-mobile-total">
          <span>總額</span>
          <strong>${money(item["金額"])}</strong>
        </div>
        <div class="purchase-mobile-meta">建立人：${escapeHtml(item["建立人姓名"] || item["建立人"] || "-")}</div>
        <div class="purchase-mobile-actions">${actions}</div>
      </article>
    `;
  }).join("") : `<div class="list empty">尚無採購紀錄</div>`;
}

function renderPurchases() {
  const keyword = normalize($("#purchaseSearch").value);
  const rows = state.purchases.filter((item) => normalize(Object.values(item).join(" ")).includes(keyword)).reverse();
  $("#purchasesBody").innerHTML = rows.length ? rows.map((item) => {
    const status = item["狀態"] || "正常";
    const isVoided = status === "已作廢";
    const editAllowed = canEditPurchaseV33(item);
    const voidAllowed = canVoidPurchaseV33(item);
    const actionHtml = isVoided
      ? `<span class="muted">已作廢</span>`
      : [
          editAllowed ? `<button class="text-button purchase-edit" data-purchase-id="${escapeHtml(item["採購ID"] || "")}" type="button">編輯</button>` : "",
          voidAllowed ? `<button class="text-button danger-text purchase-void" data-purchase-id="${escapeHtml(item["採購ID"] || "")}" type="button">作廢</button>` : ""
        ].filter(Boolean).join(" ") || `<span class="muted">無操作權限</span>`;

    return `
      <tr class="${isVoided ? "voided-row" : ""}">
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
        <td><span class="status-badge ${isVoided ? "voided" : "normal"}">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(item["建立人姓名"] || item["建立人"] || "")}</td>
        <td class="actions-cell">${actionHtml}</td>
      </tr>
    `;
  }).join("") : emptyRow(13, "尚無採購紀錄");
  renderPurchaseCardsV34(rows);
}

function updateDatalists() {
  fillDatalist("#supplierDatalist", unique(state.purchases.map((item) => item["供應商"]).concat(state.materials.map((item) => item["供應商"]))).filter(Boolean).sort());
  fillDatalist("#itemDatalist", unique(state.materials.map((item) => item["品項"]).concat(state.purchases.map((item) => item["品項"]))).filter(Boolean).sort());
  renderMobileQuickToolsV34();
}

function handlePurchaseActionClick(event) {
  const supplierChip = event.target.closest?.(".mobile-supplier-chip");
  const itemChip = event.target.closest?.(".mobile-item-chip");
  const todayButton = event.target.closest?.(".quick-fill-today");
  if (supplierChip) {
    setQuickAddFieldV34("供應商", supplierChip.dataset.value || supplierChip.textContent.trim());
    $("#purchaseForm")?.elements["品項"]?.focus();
    return;
  }
  if (itemChip) {
    setQuickAddFieldV34("品項", itemChip.dataset.value || itemChip.textContent.trim());
    $("#purchaseForm")?.elements["數量"]?.focus();
    return;
  }
  if (todayButton) {
    setTodayDefault();
    showMessage("日期已帶入今天。", "success");
    return;
  }

  const editButton = event.target.closest?.(".purchase-edit");
  const voidButton = event.target.closest?.(".purchase-void");
  if (editButton) openEditPurchaseModal(editButton.dataset.purchaseId);
  if (voidButton) openVoidPurchaseModal(voidButton.dataset.purchaseId);
}

function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  updateUserDisplay();
  if (isMobileLayoutV34() && state.activeTab === "dashboard" && hasPermissionV33("canAddPurchase")) {
    switchTab("quickAdd");
  }
}

window.addEventListener("resize", () => {
  if (state.purchases) renderPurchaseCardsV34(state.purchases.filter((item) => normalize(Object.values(item).join(" ")).includes(normalize($("#purchaseSearch")?.value || ""))).reverse());
});


/* =============================
   v3.9 Mega：v3.5 + v3.6 + v3.8 + v3.9
   供應商管理、標準品項、月報表、AI待確認
   ============================= */

const V39_VERSION_LABEL = "Okami ERP v3.9 Mega";

window.addEventListener("DOMContentLoaded", () => {
  initV39Enhancements();
});

function initV39Enhancements() {
  BRAND.siteName = "大神材料 ERP v3.9 Mega";
  setText("#siteName", BRAND.siteName);
  fillSelect($("#materialFormCategorySelect"), MATERIAL_CATEGORIES, "其他");
  fillSelect($("#materialFormUnitSelect"), UNIT_OPTIONS, "公斤");
  fillSelect($("#materialFormStandardUnitSelect"), STANDARD_UNITS, "公克");

  const monthInput = $("#reportMonthInput");
  if (monthInput && !monthInput.value) monthInput.value = monthKey(new Date());

  bindV39Events();
}

function bindV39Events() {
  const bindings = [
    ["#supplierSearch", "input", renderSuppliersV39],
    ["#itemAdminSearch", "input", renderItemAdminV39],
    ["#reportMonthInput", "change", renderReportsV39],
    ["#openSupplierFormButton", "click", () => openSupplierFormV39()],
    ["#supplierFormCloseButton", "click", closeSupplierFormV39],
    ["#supplierFormCancelButton", "click", closeSupplierFormV39],
    ["#supplierForm", "submit", handleSupplierFormSubmitV39],
    ["#openMaterialFormButton", "click", () => openMaterialFormV39()],
    ["#materialFormCloseButton", "click", closeMaterialFormV39],
    ["#materialFormCancelButton", "click", closeMaterialFormV39],
    ["#materialForm", "submit", handleMaterialFormSubmitV39],
    ["#exportReportButton", "click", exportMonthlyReportV39],
    ["#aiReviewCloseButton", "click", closeAiReviewModalV39]
  ];
  bindings.forEach(([selector, eventName, handler]) => {
    const el = $(selector);
    if (el) el.addEventListener(eventName, handler);
  });
  document.addEventListener("click", handleV39DocumentClick);
}

async function loadData() {
  try {
    showMessage("資料讀取中...", "success");
    const result = await apiRequest("getBootstrapData", {});
    state.materials = Array.isArray(result.materials) ? result.materials : [];
    state.purchases = Array.isArray(result.purchases) ? result.purchases : [];
    state.suppliers = Array.isArray(result.suppliers) ? result.suppliers : deriveSuppliersV39(state.purchases, []);
    state.quotes = Array.isArray(result.quotes) ? result.quotes : [];
    state.reports = result.reports || null;
    state.dashboard = result.dashboard || buildDashboardLocally(state.materials, activePurchases(state.purchases));
    if (result.currentUser) {
      state.currentUser = result.currentUser;
      sessionStorage.setItem("erpCurrentUser", JSON.stringify(state.currentUser || {}));
    }
    if (result.permissions) {
      setPermissionsV33(state.currentUser || {}, result.permissions);
      sessionStorage.setItem("erpPermissions", JSON.stringify(state.permissions || {}));
    }
    updateUserDisplay();
    renderAll();
    updateDatalists();
    updatePurchasePreview();
    updateV39AccessUi();
    hideMessage();
  } catch (error) {
    showMessage(error.message || "資料讀取失敗。", "error");
  }
}

function renderAll() {
  renderDashboard();
  renderMaterials();
  renderPurchases();
  renderAnalysis();
  renderSuppliersV39();
  renderItemAdminV39();
  renderReportsV39();
  renderPendingAiV39();
}

function updateV39AccessUi() {
  const canManage = hasPermissionV33("canManageMaterials");
  const canAi = hasPermissionV33("canUseAiReceipt");
  const canReports = hasPermissionV33("canViewAnalysis");
  ["#openSupplierFormButton", "#openMaterialFormButton"].forEach((selector) => {
    const el = $(selector);
    if (el) el.disabled = !canManage;
  });
  const reportsNav = $('.nav-item[data-tab="reports"]');
  if (reportsNav) reportsNav.classList.toggle("hidden", !canReports);
  const pendingNav = $('.nav-item[data-tab="pendingAi"]');
  if (pendingNav) pendingNav.classList.toggle("hidden", !canAi);
}

function activeRowsV39() {
  return activePurchases(state.purchases || []);
}

function deriveSuppliersV39(purchases, baseSuppliers) {
  const activeRows = activePurchases(purchases || []);
  const map = new Map();
  (baseSuppliers || []).forEach((supplier) => {
    const name = supplier["供應商名稱"] || supplier["供應商"];
    if (!name) return;
    map.set(name, Object.assign({}, supplier, { "供應商名稱": name }));
  });
  activeRows.forEach((row) => {
    const name = row["供應商"] || "未命名供應商";
    const current = map.get(name) || { "供應商名稱": name, "主要品項": "", "是否使用中": "是" };
    const amount = numberOrZero(row["金額"]);
    current.__total = numberOrZero(current.__total) + amount;
    if (monthKey(parseDate(row["日期"])) === monthKey(new Date())) current.__thisMonth = numberOrZero(current.__thisMonth) + amount;
    current.__lastDate = current.__lastDate && String(current.__lastDate) > String(row["日期"]) ? current.__lastDate : row["日期"];
    const items = new Set(String(current.__items || current["主要品項"] || "").split(/[、,，]/).map((x) => x.trim()).filter(Boolean));
    if (row["品項"]) items.add(row["品項"]);
    current.__items = Array.from(items).slice(0, 8).join("、");
    map.set(name, current);
  });
  return Array.from(map.values()).map((s) => Object.assign({}, s, {
    "主要品項": s["主要品項"] || s.__items || "",
    "最後採購日": s["最後採購日"] || s.__lastDate || "",
    "本月採購金額": numberOrZero(s["本月採購金額"] || s.__thisMonth),
    "累計採購金額": numberOrZero(s["累計採購金額"] || s.__total),
    "推薦狀態": s["推薦狀態"] || "正常"
  })).sort((a, b) => numberOrZero(b["累計採購金額"]) - numberOrZero(a["累計採購金額"]));
}

function renderSuppliersV39() {
  const keyword = normalize($("#supplierSearch")?.value || "");
  const suppliers = deriveSuppliersV39(state.purchases || [], state.suppliers || []);
  const rows = suppliers.filter((s) => normalize(Object.values(s).join(" ")).includes(keyword));
  const top = rows[0];
  const rising = priceMoversV39(activeRowsV39()).filter((x) => x.diffPercent >= 15).length;
  const insight = $("#supplierInsightCards");
  if (insight) {
    insight.innerHTML = `
      <article class="mini-card"><span>供應商數</span><strong>${suppliers.length}</strong></article>
      <article class="mini-card"><span>最大供應商</span><strong>${escapeHtml(top?.["供應商名稱"] || "-")}</strong></article>
      <article class="mini-card"><span>需關注漲價品項</span><strong>${rising}</strong></article>
    `;
  }
  const body = $("#suppliersBody");
  if (!body) return;
  body.innerHTML = rows.length ? rows.map((s) => `
    <tr>
      <td>${escapeHtml(s["供應商名稱"] || "")}</td>
      <td>${escapeHtml(s["聯絡人"] || "")}</td>
      <td>${escapeHtml(s["電話"] || "")}</td>
      <td>${escapeHtml(s["主要品項"] || "")}</td>
      <td class="num">${money(s["本月採購金額"])}</td>
      <td class="num">${money(s["累計採購金額"])}</td>
      <td>${escapeHtml(s["最後採購日"] || "")}</td>
      <td><span class="badge-soft ${s["推薦狀態"] === "推薦" ? "ok" : s["推薦狀態"] === "觀察" ? "warn" : ""}">${escapeHtml(s["推薦狀態"] || "正常")}</span></td>
    </tr>
  `).join("") : emptyRow(8, "沒有符合條件的供應商");
}

function openSupplierFormV39(supplier = {}) {
  if (!hasPermissionV33("canManageMaterials")) {
    showMessage("此帳號沒有供應商管理權限。", "error");
    return;
  }
  const form = $("#supplierForm");
  if (!form) return;
  form.reset();
  Object.keys(supplier).forEach((key) => { if (form.elements[key]) form.elements[key].value = supplier[key] || ""; });
  $("#supplierFormModal")?.classList.remove("hidden");
}
function closeSupplierFormV39() { $("#supplierFormModal")?.classList.add("hidden"); }
async function handleSupplierFormSubmitV39(event) {
  event.preventDefault();
  const data = readForm(event.currentTarget);
  if (!data["供應商名稱"]) { showMessage("供應商名稱不可空白。", "error"); return; }
  try {
    showMessage("儲存供應商中...", "success");
    await apiRequest("upsertSupplier", { supplier: data });
    closeSupplierFormV39();
    await loadData();
    switchTab("suppliers");
  } catch (error) { showMessage(error.message || "儲存供應商失敗。", "error"); }
}

function renderItemAdminV39() {
  const keyword = normalize($("#itemAdminSearch")?.value || "");
  const rows = (state.materials || []).filter((item) => normalize(Object.values(item).join(" ")).includes(keyword));
  const movers = priceMoversV39(activeRowsV39());
  setText("#standardItemCount", unique((state.materials || []).map((m) => m["標準品項名稱"] || m["品項"]).filter(Boolean)).length);
  setText("#aliasRiskCount", aliasRiskCountV39(state.purchases || []));
  setText("#risingItemCount", movers.filter((x) => x.diffPercent >= 15).length);
  const body = $("#itemAdminBody");
  if (!body) return;
  body.innerHTML = rows.length ? rows.map((m) => `
    <tr>
      <td>${escapeHtml(m["品項"] || "")}</td>
      <td>${escapeHtml(m["標準品項名稱"] || m["品項"] || "")}</td>
      <td>${escapeHtml(m["品項別名"] || "")}</td>
      <td>${escapeHtml(m["分類"] || "")}</td>
      <td>${escapeHtml(m["預設供應商"] || m["供應商"] || "")}</td>
      <td>${escapeHtml(m["單位"] || "")}</td>
      <td class="num">${money(m["最新單價"])}</td>
      <td>${escapeHtml(m["最近採購日"] || "")}</td>
      <td>${escapeHtml(m["使用中"] || "是")}</td>
      <td><button class="text-button material-edit-v39" data-item="${escapeHtml(m["品項"] || "")}" type="button">編輯</button></td>
    </tr>
  `).join("") : emptyRow(10, "沒有符合條件的品項");
}

function aliasRiskCountV39(purchases) {
  const groups = new Map();
  activePurchases(purchases || []).forEach((p) => {
    const std = normalize(p["標準品項名稱"] || p["品項"]);
    const raw = p["品項"] || "";
    if (!std || !raw) return;
    if (!groups.has(std)) groups.set(std, new Set());
    groups.get(std).add(raw);
  });
  return Array.from(groups.values()).filter((set) => set.size >= 2).length;
}

function openMaterialFormV39(material = {}) {
  if (!hasPermissionV33("canManageMaterials")) {
    showMessage("此帳號沒有品項管理權限。", "error");
    return;
  }
  const form = $("#materialForm");
  if (!form) return;
  form.reset();
  Object.keys(material).forEach((key) => { if (form.elements[key]) form.elements[key].value = material[key] || ""; });
  if (form.elements["分類"] && !form.elements["分類"].value) form.elements["分類"].value = "其他";
  if (form.elements["單位"] && !form.elements["單位"].value) form.elements["單位"].value = "公斤";
  if (form.elements["標準單位"] && !form.elements["標準單位"].value) form.elements["標準單位"].value = "公克";
  $("#materialFormModal")?.classList.remove("hidden");
}
function closeMaterialFormV39() { $("#materialFormModal")?.classList.add("hidden"); }
async function handleMaterialFormSubmitV39(event) {
  event.preventDefault();
  const data = readForm(event.currentTarget);
  if (!data["品項"] || !data["標準品項名稱"]) { showMessage("品項與標準品項名稱不可空白。", "error"); return; }
  try {
    showMessage("儲存標準品項中...", "success");
    await apiRequest("updateMaterial", { material: data });
    closeMaterialFormV39();
    await loadData();
    switchTab("itemAdmin");
  } catch (error) { showMessage(error.message || "儲存品項失敗。", "error"); }
}

function renderReportsV39() {
  const month = $("#reportMonthInput")?.value || monthKey(new Date());
  const rows = activeRowsV39();
  const monthRows = rows.filter((r) => monthKey(parseDate(r["日期"])) === month);
  const prev = new Date(month + "-01");
  const prevMonth = monthKey(new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const prevRows = rows.filter((r) => monthKey(parseDate(r["日期"])) === prevMonth);
  const total = sumAmount(monthRows);
  const prevTotal = sumAmount(prevRows);
  const change = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0;
  const catTotals = totalsBy(monthRows, "分類");
  const supTotals = totalsBy(monthRows, "供應商");
  const topCat = catTotals[0];
  setText("#reportTotal", money(total));
  setText("#reportMonthChange", `較上月 ${formatPercent(change)}`);
  setText("#reportFoodTotal", money(sumByCategories(monthRows, FOOD_COST_CATEGORIES)));
  setText("#reportBeverageTotal", money(sumByCategories(monthRows, BEVERAGE_CATEGORIES)));
  setText("#reportTopCategory", topCat?.name || "-");
  setText("#reportTopCategoryAmount", money(topCat?.amount || 0));
  renderBarChart("#reportCategoryChart", catTotals);
  renderBarChart("#reportSupplierChart", supTotals);
  const alerts = priceMoversV39(rows).slice(0, 20);
  const body = $("#reportPriceAlertsBody");
  if (body) body.innerHTML = alerts.length ? alerts.map((a) => `
    <tr>
      <td>${escapeHtml(a.item)}</td>
      <td>${escapeHtml(a.supplier || "")}</td>
      <td class="num">${money(a.latestPrice)}</td>
      <td class="num">${money(a.averagePrice)}</td>
      <td class="num ${a.diffPercent >= 0 ? "price-up" : "price-down"}">${formatPercent(a.diffPercent)}</td>
      <td>${escapeHtml(a.diffPercent >= 30 ? "紅色：請確認報價" : a.diffPercent >= 15 ? "黃色：建議追蹤" : a.diffPercent <= -10 ? "比平均便宜" : "正常")}</td>
    </tr>
  `).join("") : emptyRow(6, "目前沒有可比較的價格資料");
}

function priceMoversV39(rows) {
  const active = activePurchases(rows || []);
  const groups = new Map();
  active.forEach((r) => {
    const item = r["標準品項名稱"] || r["品項"];
    const price = numberOrZero(r["標準單位價格"] || r["單價"]);
    if (!item || !price) return;
    if (!groups.has(item)) groups.set(item, []);
    groups.get(item).push(r);
  });
  const movers = [];
  groups.forEach((list, item) => {
    list.sort((a, b) => String(b["日期"] || "").localeCompare(String(a["日期"] || "")));
    if (list.length < 2) return;
    const latest = list[0];
    const latestPrice = numberOrZero(latest["標準單位價格"] || latest["單價"]);
    const history = list.slice(1).map((x) => numberOrZero(x["標準單位價格"] || x["單價"])).filter(Boolean);
    if (!history.length) return;
    const averagePrice = history.reduce((a, b) => a + b, 0) / history.length;
    const diffPercent = averagePrice ? ((latestPrice - averagePrice) / averagePrice) * 100 : 0;
    movers.push({ item, supplier: latest["供應商"], latestPrice, averagePrice, diffPercent, date: latest["日期"] });
  });
  return movers.sort((a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent));
}

function exportMonthlyReportV39() {
  if (!hasPermissionV33("canExportCsv")) { showMessage("此帳號沒有匯出權限。", "error"); return; }
  const month = $("#reportMonthInput")?.value || monthKey(new Date());
  const rows = activeRowsV39().filter((r) => monthKey(parseDate(r["日期"])) === month);
  exportCsv(`okami-monthly-report-${month}.csv`, rows, ["採購ID", "日期", "供應商", "品項", "標準品項名稱", "分類", "規格", "數量", "單位", "單價", "金額", "標準單位價格", "建立人姓名"]);
}

function renderPendingAiV39() {
  const target = $("#pendingAiList");
  if (!target) return;
  const quotes = (state.quotes || []).slice().reverse();
  const pending = quotes.filter((q) => ["待確認", "辨識完成", "待人工確認", ""].includes(q["AI辨識狀態"] || q["確認狀態"] || "待確認"));
  const rows = pending.length ? pending : quotes.slice(0, 20);
  target.innerHTML = rows.length ? rows.map((q) => {
    const status = q["AI辨識狀態"] || q["確認狀態"] || "待確認";
    const cls = status === "已確認" ? "ok" : status === "辨識失敗" ? "error" : "warn";
    return `
      <article class="quote-card">
        <div class="quote-card-head">
          <div class="quote-card-title">
            <strong>${escapeHtml(q["報價單ID"] || "未命名單據")}</strong>
            <span class="muted">${escapeHtml(q["檔案名稱"] || "")}</span>
          </div>
          <span class="badge-soft ${cls}">${escapeHtml(status)}</span>
        </div>
        <div class="quote-card-meta">
          <span>上傳：${escapeHtml(q["上傳日期"] || "")}</span>
          <span>上傳人：${escapeHtml(q["上傳人姓名"] || "")}</span>
          <span>${escapeHtml(q["AI辨識摘要"] || "")}</span>
        </div>
        <div class="quote-card-actions" style="margin-top:10px;">
          ${q["檔案連結"] ? `<a class="text-button" href="${escapeHtml(q["檔案連結"])}" target="_blank" rel="noopener">開啟檔案</a>` : `<span></span>`}
          ${status === "已確認" ? `<span class="muted">已入帳</span>` : `<button class="primary quote-review-v39" data-quote-id="${escapeHtml(q["報價單ID"] || "")}" type="button">人工確認</button>`}
        </div>
      </article>
    `;
  }).join("") : `<div class="list empty">目前沒有 AI 待確認單據。</div>`;
}

function handleV39DocumentClick(event) {
  const materialButton = event.target.closest?.(".material-edit-v39");
  if (materialButton) {
    const itemName = materialButton.dataset.item;
    const material = (state.materials || []).find((m) => m["品項"] === itemName);
    openMaterialFormV39(material || {});
    return;
  }
  const reviewButton = event.target.closest?.(".quote-review-v39");
  if (reviewButton) {
    openAiReviewModalV39(reviewButton.dataset.quoteId);
    return;
  }
}

function openAiReviewModalV39(quoteId) {
  const quote = (state.quotes || []).find((q) => q["報價單ID"] === quoteId);
  if (!quote) { showMessage("找不到此 AI 單據。", "error"); return; }
  let receipt = null;
  try { receipt = JSON.parse(quote["AI原始JSON"] || "{}"); } catch (_error) { receipt = null; }
  if (!receipt || !Array.isArray(receipt.items)) {
    showMessage("此單據沒有可確認的 AI 明細，請重新上傳或手動建檔。", "error");
    return;
  }
  renderAiReviewContentV39(quote, receipt);
  $("#aiReviewModal")?.classList.remove("hidden");
}
function closeAiReviewModalV39() { $("#aiReviewModal")?.classList.add("hidden"); }

function renderAiReviewContentV39(quote, receipt) {
  const target = $("#aiReviewContent");
  if (!target) return;
  const supplier = receipt.supplier || quote["供應商"] || "待確認供應商";
  const date = receipt.date || quote["上傳日期"] || new Date().toISOString().slice(0, 10);
  target.innerHTML = `
    <p class="muted">報價單ID：${escapeHtml(quote["報價單ID"])}｜供應商：${escapeHtml(supplier)}｜日期：${escapeHtml(date)}</p>
    <div class="ai-review-grid">
      ${receipt.items.map((item, idx) => `
        <div class="ai-review-row" data-index="${idx}">
          <label>品項<input data-field="品項" value="${escapeHtml(item.name || item["品項"] || "")}" /></label>
          <label>分類<select data-field="分類">${MATERIAL_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${(item.category || item["分類"] || "其他") === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select></label>
          <label>數量<input data-field="數量" type="number" step="0.001" value="${escapeHtml(item.quantity || item["數量"] || "")}" /></label>
          <label>單位<input data-field="單位" value="${escapeHtml(item.unit || item["單位"] || "")}" /></label>
          <label>單價<input data-field="單價" type="number" step="0.01" value="${escapeHtml(item.unitPrice || item["單價"] || "")}" /></label>
          <label>備註<input data-field="備註" value="${escapeHtml(item.needsReview ? "AI待確認" : "AI人工確認")}" /></label>
        </div>
      `).join("")}
    </div>
    <div class="form-actions" style="margin-top:14px;">
      <button id="confirmAiQuoteButtonV39" class="primary" type="button">確認並批次寫入</button>
      <button class="secondary" type="button" onclick="document.querySelector('#aiReviewModal').classList.add('hidden')">取消</button>
    </div>
  `;
  $("#confirmAiQuoteButtonV39")?.addEventListener("click", async () => {
    const purchases = $$("#aiReviewContent .ai-review-row").map((row) => {
      const obj = { 日期: date, 供應商: supplier, 報價單ID: quote["報價單ID"], 報價單檔案連結: quote["檔案連結"] || "", AI辨識: "是", AI信心分數: receipt.confidence || "" };
      row.querySelectorAll("[data-field]").forEach((input) => { obj[input.dataset.field] = input.value; });
      return obj;
    });
    try {
      showMessage("AI 單據確認寫入中...", "success");
      await apiRequest("confirmAiQuote", { quoteId: quote["報價單ID"], purchases });
      closeAiReviewModalV39();
      await loadData();
      switchTab("purchases");
      showMessage(`已確認並寫入 ${purchases.length} 筆採購紀錄。`, "success");
    } catch (error) { showMessage(error.message || "確認 AI 單據失敗。", "error"); }
  });
}

function renderAiResult(receipt) {
  const target = $("#aiResult");
  const data = receipt.receipt || receipt;
  const items = Array.isArray(data.items) ? data.items : [];
  target.classList.remove("hidden");
  if (!items.length) {
    target.innerHTML = `<strong>辨識結果</strong><p class="muted">AI 沒有辨識到可寫入的採購品項，請改用快速建檔。</p>`;
    return;
  }
  target.innerHTML = `
    <strong>辨識完成：已進入待確認流程</strong>
    <p class="muted">供應商：${escapeHtml(data.supplier || "待確認")} ｜ 日期：${escapeHtml(data.date || "待確認")} ｜ 報價單ID：${escapeHtml(data.quoteId || "未建立")}</p>
    <p class="muted">AI 不會直接入帳，請到「AI待確認」頁面人工確認後再批次寫入。</p>
    <div class="form-actions"><button class="primary" type="button" data-jump="pendingAi">前往 AI 待確認</button></div>
  `;
  target.querySelector("[data-jump]")?.addEventListener("click", () => switchTab("pendingAi"));
  loadData();
}

/* =============================
   v3.9.3 Sidebar Final Fix
   側邊欄只顯示姓名與角色；完整權限只放設定頁，避免左側交疊
   ============================= */
function updateUserDisplay() {
  const user = state.currentUser || {};
  const name = user.name || user["姓名"] || "-";
  const role = user.role || user["角色"] || "-";
  if (typeof setPermissionsV33 === "function") {
    setPermissionsV33(user, state.permissions || user.permissions || null);
  }
  const labels = typeof permissionLabelsV33 === "function" ? permissionLabelsV33().join("、") : "";
  setText("#currentUserName", name);
  setText("#currentUserRole", role);
  setText("#settingsCurrentUser", `${name} ｜ ${role}`);
  setText("#settingsCurrentPermissions", labels || role);
}
