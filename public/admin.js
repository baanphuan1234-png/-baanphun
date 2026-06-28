// Admin Dashboard Application Logic
let menuItems = [];
let orders = [];
let settings = { promptPayId: '', googleSheetsUrl: '' };

// Current Selected Section
let currentSection = 'orders-section';

// DOM Elements
const sidebarButtons = document.querySelectorAll('.sidebar-nav-btn');
const adminSections = document.querySelectorAll('.admin-section');
const syncStatus = document.getElementById('sync-status');
const themeToggle = document.getElementById('theme-toggle');

// Orders Section Elements
const ordersBoard = document.getElementById('orders-board');
const ordersLoading = document.getElementById('orders-loading');
const emptyOrdersMessage = document.getElementById('empty-orders-message');
const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
const newOrdersBadge = document.getElementById('new-orders-badge');

// Stats Section Elements
const statsTotalRevenue = document.getElementById('stats-total-revenue');
const statsTotalOrders = document.getElementById('stats-total-orders');
const statsTopItem = document.getElementById('stats-top-item');
const statsTableBody = document.getElementById('stats-table-body');
const emptyStatsMessage = document.getElementById('empty-stats-message');
const refreshStatsBtn = document.getElementById('refresh-stats-btn');
const todaySalesSidebar = document.getElementById('today-sales-sidebar');
const todayOrdersSidebar = document.getElementById('today-orders-sidebar');

// Stock Section Elements
const stockGrid = document.getElementById('stock-grid');
const stockLoading = document.getElementById('stock-loading');
const addItemBtn = document.getElementById('add-item-btn');
const productModal = document.getElementById('product-modal');
const closeProductModalBtn = document.getElementById('close-product-modal-btn');
const productForm = document.getElementById('product-form');
const productModalTitle = document.getElementById('product-modal-title');
const productIdInput = document.getElementById('product-id');
const productNameInput = document.getElementById('product-name');
const productPriceInput = document.getElementById('product-price');
const productStockInput = document.getElementById('product-stock');
const productImageFile = document.getElementById('product-image-file');
const productImageUrl = document.getElementById('product-image-url');
const productHasVariants = document.getElementById('product-has-variants');
const singleStockGroup = document.getElementById('single-stock-group');
const variantsGroup = document.getElementById('variants-group');
const addVariantOptionBtn = document.getElementById('add-variant-option-btn');
const variantsList = document.getElementById('variants-list');

// Edit Order Modal Elements
const editOrderModal = document.getElementById('edit-order-modal');
const closeEditOrderModalBtn = document.getElementById('close-edit-order-modal-btn');
const editOrderIdLabel = document.getElementById('edit-order-id-label');
const editOrderItemsList = document.getElementById('edit-order-items-list');
const addOrderProductSelect = document.getElementById('add-order-product-select');
const addOrderVariantSelect = document.getElementById('add-order-variant-select');
const addOrderQtyInput = document.getElementById('add-order-qty-input');
const addItemToOrderBtn = document.getElementById('add-item-to-order-btn');
const editOrderOldTotal = document.getElementById('edit-order-old-total');
const editOrderNewTotal = document.getElementById('edit-order-new-total');
const editOrderDiffBox = document.getElementById('edit-order-diff-box');
const saveEditOrderBtn = document.getElementById('save-edit-order-btn');
const imageUploadBox = document.getElementById('image-upload-box');
const uploadPlaceholder = document.getElementById('upload-placeholder');

// Settings Section Elements
const settingsPromptPayId = document.getElementById('settings-promptpay-id');
const settingsSheetUrl = document.getElementById('settings-sheet-url');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsAlert = document.getElementById('settings-alert');
const qrTableNumber = document.getElementById('qr-table-number');
const generateTableQrBtn = document.getElementById('generate-table-qr-btn');
const tableQrResult = document.getElementById('table-qr-result');
const tableQrImageContainer = document.getElementById('table-qr-image-container');
const tableQrLinkText = document.getElementById('table-qr-link-text');
const downloadTableQrBtn = document.getElementById('download-table-qr-btn');
const viewScriptBtn = document.getElementById('view-script-btn');

// Payment Modal Elements
const paymentModal = document.getElementById('payment-modal');
const closePaymentModalBtn = document.getElementById('close-payment-modal-btn');
const paymentModalBody = document.getElementById('payment-modal-body');

// Script Modal Elements
const scriptModal = document.getElementById('script-modal');
const closeScriptModalBtn = document.getElementById('close-script-modal-btn');
const appsScriptTextarea = document.getElementById('apps-script-textarea');
const copyScriptBtn = document.getElementById('copy-script-btn');

// Google Apps Script source code template
const APPS_SCRIPT_CODE = `var SHEET_NAME_MENU = "Menu";
var SHEET_NAME_ORDERS = "Orders";

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "getMenu") {
    var sheet = getOrCreateSheet(ss, SHEET_NAME_MENU, ["id", "name", "price", "stock", "image", "hasVariants", "variants"]);
    var data = getSheetData(sheet);
    return jsonResponse(data);
  }
  
  if (action === "getOrders") {
    var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ["id", "timestamp", "items", "total", "status", "paymentStatus", "table", "slipImage"]);
    var data = getSheetData(sheet);
    data.forEach(function(row) {
      try {
        row.items = JSON.parse(row.items);
      } catch (err) {
        row.items = [];
      }
    });
    return jsonResponse(data);
  }
  
  return jsonResponse({ error: "Invalid action" });
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var postData;
  try {
    postData = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: "Invalid JSON post body" });
  }
  
  var action = postData.action;
  
  if (action === "saveMenu") {
    var sheet = getOrCreateSheet(ss, SHEET_NAME_MENU, ["id", "name", "price", "stock", "image", "hasVariants", "variants"]);
    clearSheetData(sheet);
    var menuItems = postData.data || [];
    menuItems.forEach(function(item) {
      sheet.appendRow([item.id, item.name, item.price, item.stock, item.image, String(item.hasVariants), item.variants ? JSON.stringify(item.variants) : ""]);
    });
    return jsonResponse({ success: true });
  }
  
  if (action === "saveOrdersList") {
    var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ["id", "timestamp", "items", "total", "status", "paymentStatus", "table", "slipImage"]);
    clearSheetData(sheet);
    var ordersList = postData.data || [];
    ordersList.forEach(function(order) {
      var itemsStr = JSON.stringify(order.items);
      sheet.appendRow([order.id, order.timestamp, itemsStr, order.total, order.status, order.paymentStatus, order.table || "ทั่วไป", order.slipImage || ""]);
    });
    return jsonResponse({ success: true });
  }
  
  if (action === "saveOrder") {
    var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ["id", "timestamp", "items", "total", "status", "paymentStatus", "table", "slipImage"]);
    var order = postData.data;
    
    var rows = sheet.getDataRange().getValues();
    var foundIndex = -1;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] == order.id) {
        foundIndex = i + 1;
        break;
      }
    }
    
    var itemsStr = JSON.stringify(order.items);
    var rowData = [order.id, order.timestamp, itemsStr, order.total, order.status, order.paymentStatus, order.table || "ทั่วไป", order.slipImage || ""];
    
    if (foundIndex !== -1) {
      var range = sheet.getRange(foundIndex, 1, 1, rowData.length);
      range.setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return jsonResponse({ success: true });
  }
  
  return jsonResponse({ error: "Invalid post action" });
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function getSheetData(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  var headers = rows[0];
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    data.push(obj);
  }
  return data;
}

function clearSheetData(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

// Page initialization
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('adminToken');
  const loginWrapper = document.getElementById('login-wrapper');
  const dashboardLayout = document.getElementById('admin-dashboard-layout');

  const isLoggedIn = token && token.startsWith('admin_session_token_');
  if (isLoggedIn) {
    showDashboard(loginWrapper, dashboardLayout);
  } else {
    loginWrapper.style.display = 'flex';
    dashboardLayout.style.display = 'none';
  }

  setupLoginEventListeners(loginWrapper, dashboardLayout);
  setupEventListeners();

  // Set Apps Script code template text
  appsScriptTextarea.value = APPS_SCRIPT_CODE;
});

function showDashboard(loginWrapper, dashboardLayout) {
  loginWrapper.style.display = 'none';
  dashboardLayout.style.display = 'block';
  
  // Fetch initial data only after successful login
  fetchSettings();
  fetchMenu();
  fetchOrders();
  fetchStats();

  // Poll orders & stats every 5 seconds to keep admin updated
  setInterval(() => {
    if (localStorage.getItem('adminToken')) {
      fetchOrders(true); // silent fetch
      fetchStats(true);  // silent fetch
    }
  }, 5000);
}

function setupLoginEventListeners(loginWrapper, dashboardLayout) {
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      loginError.style.display = 'none';

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok && result.success) {
          localStorage.setItem('adminToken', result.token);
          showDashboard(loginWrapper, dashboardLayout);
        } else {
          loginError.textContent = result.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
          loginError.style.display = 'block';
        }
      } catch (err) {
        loginError.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
        loginError.style.display = 'block';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('adminToken');
      window.location.reload();
    });
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Sidebar navigation
  sidebarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const targetSection = btn.getAttribute('data-target');
      adminSections.forEach(sec => sec.classList.remove('active'));
      document.getElementById(targetSection).classList.add('active');
      currentSection = targetSection;
    });
  });

  // Theme Toggler
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeToggle.innerHTML = isDark ? `<i class="fa-solid fa-sun"></i> สลับโหมดสี` : `<i class="fa-solid fa-moon"></i> สลับโหมดสี`;
  });

  // Settings
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  // Script copier
  viewScriptBtn.addEventListener('click', () => scriptModal.classList.add('active'));
  closeScriptModalBtn.addEventListener('click', () => scriptModal.classList.remove('active'));
  copyScriptBtn.addEventListener('click', copyScriptToClipboard);

  // Tabletop QR code
  generateTableQrBtn.addEventListener('click', generateTableQrCode);

  // Modals close button clicks
  closeProductModalBtn.addEventListener('click', () => productModal.classList.remove('active'));
  closeEditOrderModalBtn.addEventListener('click', () => editOrderModal.classList.remove('active'));
  closePaymentModalBtn.addEventListener('click', () => paymentModal.classList.remove('active'));
  
  window.addEventListener('click', (e) => {
    if (e.target === productModal) productModal.classList.remove('active');
    if (e.target === paymentModal) paymentModal.classList.remove('active');
    if (e.target === scriptModal) scriptModal.classList.remove('active');
    if (e.target === editOrderModal) editOrderModal.classList.remove('active');
  });

  // Stock CRUD actions
  addItemBtn.addEventListener('click', openAddProductModal);
  productForm.addEventListener('submit', saveProduct);

  // Image Upload Clicking box
  imageUploadBox.addEventListener('click', () => productImageFile.click());
  productImageFile.addEventListener('change', handleImageUpload);

  // Variant Toggle & Add Buttons
  productHasVariants.addEventListener('change', () => {
    if (productHasVariants.checked) {
      singleStockGroup.style.display = 'none';
      variantsGroup.style.display = 'block';
      productStockInput.required = false;
    } else {
      singleStockGroup.style.display = 'block';
      variantsGroup.style.display = 'none';
      productStockInput.required = true;
    }
  });

  addVariantOptionBtn.addEventListener('click', () => {
    addVariantOptionRow("", 0);
  });

  // Manual refresh buttons
  refreshOrdersBtn.addEventListener('click', () => fetchOrders(false));
  refreshStatsBtn.addEventListener('click', () => fetchStats(false));

  // Edit Order modal event listeners
  if (addOrderProductSelect) {
    addOrderProductSelect.addEventListener('change', () => {
      const selectedProductId = addOrderProductSelect.value;
      const item = menuItems.find(p => p.id === selectedProductId);
      if (item && item.hasVariants && Array.isArray(item.variants)) {
        addOrderVariantSelect.style.display = 'inline-block';
        addOrderVariantSelect.innerHTML = item.variants.map(v => `<option value="${v.name}">${v.name} (คงเหลือ: ${v.stock})</option>`).join('');
      } else {
        addOrderVariantSelect.style.display = 'none';
        addOrderVariantSelect.innerHTML = '';
      }
    });
  }

  if (addItemToOrderBtn) {
    addItemToOrderBtn.addEventListener('click', addProductToEditOrder);
  }

  if (saveEditOrderBtn) {
    saveEditOrderBtn.addEventListener('click', saveEditOrder);
  }

  // Date filter for sales report
  const statsDateFilter = document.getElementById('stats-date-filter');
  const clearDateFilterBtn = document.getElementById('clear-date-filter-btn');

  if (statsDateFilter) {
    statsDateFilter.addEventListener('change', () => {
      selectedStatsDate = statsDateFilter.value;
      renderStats();
    });
  }

  if (clearDateFilterBtn) {
    clearDateFilterBtn.addEventListener('click', () => {
      statsDateFilter.value = '';
      selectedStatsDate = null;
      renderStats();
    });
  }
}

// Get App Settings
async function fetchSettings() {
  try {
    const response = await fetch('/api/settings');
    settings = await response.json();
    
    settingsPromptPayId.value = settings.promptPayId || '';
    settingsSheetUrl.value = settings.googleSheetsUrl || '';
    
    updateSyncStatusUI();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Update settings UI state
function updateSyncStatusUI() {
  if (settings.googleSheetsUrl) {
    syncStatus.innerHTML = `<i class="fa-solid fa-cloud text-success"></i> เชื่อมต่อ Google Sheet แล้ว`;
    syncStatus.style.color = 'var(--success)';
    syncStatus.style.borderColor = 'var(--success)';
  } else {
    syncStatus.innerHTML = `<i class="fa-solid fa-house"></i> ทำงานแบบ Local (ไม่ได้เชื่อมต่อ Sheet)`;
    syncStatus.style.color = 'var(--warning)';
    syncStatus.style.borderColor = 'var(--warning)';
  }
}

// Save settings to backend
async function saveSettings() {
  const promptPayId = settingsPromptPayId.value.trim();
  const googleSheetsUrl = settingsSheetUrl.value.trim();

  saveSettingsBtn.disabled = true;
  saveSettingsBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...`;

  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptPayId, googleSheetsUrl })
    });

    const result = await response.json();
    if (response.ok) {
      settings = result.settings;
      updateSyncStatusUI();
      settingsAlert.style.display = 'flex';
      setTimeout(() => {
        settingsAlert.style.display = 'none';
      }, 5000);
      
      // Reload everything in case sheet connection changes
      fetchMenu();
      fetchOrders();
      fetchStats();
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    alert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
  } finally {
    saveSettingsBtn.disabled = false;
    saveSettingsBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกการตั้งค่าทั้งหมด`;
  }
}

// Fetch Menu Items
async function fetchMenu() {
  stockLoading.style.display = 'block';
  try {
    const response = await fetch('/api/menu');
    menuItems = await response.json();
    renderStockGrid(menuItems);
  } catch (err) {
    console.error('Error fetching menu items:', err);
  } finally {
    stockLoading.style.display = 'none';
  }
}

// Render stock grid
function renderStockGrid(items) {
  if (items.length === 0) {
    stockGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
        <i class="fa-solid fa-circle-info" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
        <p>ยังไม่มีสินค้าในระบบสต็อก กดปุ่ม "เพิ่มสินค้าใหม่" เพื่อสร้างสินค้า</p>
      </div>
    `;
    return;
  }

  stockGrid.innerHTML = items.map(item => {
    const itemImageSrc = item.image || 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Product';
    
    let variantsHtml = '';
    let displayStock = `${item.stock}`;
    if (item.hasVariants && Array.isArray(item.variants)) {
      const sumStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
      displayStock = `${sumStock} (รวม)`;
      variantsHtml = `<div style="font-size: 0.75rem; margin-top: 0.5rem; color: var(--text-muted); border-top: 1px dashed var(--border-color); padding-top: 0.25rem; text-align: left;">` + 
        item.variants.map(v => `<div>• ${v.name}: <strong>${v.stock}</strong> ชิ้น</div>`).join('') +
        `</div>`;
    }

    return `
      <div class="stock-item-card">
        <img src="${itemImageSrc}" class="stock-item-img" alt="${item.name}" onerror="this.onerror=null; this.src='https://placehold.co/600x400/f1f5f9/94a3b8?text=Product';">
        <div class="stock-item-details">
          <div class="stock-item-name">${item.name}</div>
          <div class="stock-item-price">฿${item.price.toLocaleString()}</div>
          <div class="stock-item-qty">สต็อก: <strong>${displayStock}</strong> ชิ้น</div>
          ${variantsHtml}
        </div>
        <div class="stock-actions">
          <button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem;" onclick="openEditProductModal('${item.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-danger btn-sm" style="padding: 0.25rem 0.5rem; background-color: var(--danger);" onclick="deleteProduct('${item.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Image File Upload handling (base64)
async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  uploadPlaceholder.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>กำลังอัปโหลดรูปภาพ...</span>`;
  
  const reader = new FileReader();
  reader.readAsDataURL(file);
  
  reader.onload = async () => {
    const base64Data = reader.result;
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });
      
      const result = await response.json();
      if (response.ok && result.imageUrl) {
        productImageUrl.value = result.imageUrl;
        showImagePreview(result.imageUrl);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      alert(`อัปโหลดรูปภาพล้มเหลว: ${err.message}`);
      resetImagePreview();
    }
  };
}

function showImagePreview(url) {
  imageUploadBox.style.backgroundImage = `url('${url}')`;
  uploadPlaceholder.style.display = 'none';
}

function resetImagePreview() {
  imageUploadBox.style.backgroundImage = 'none';
  uploadPlaceholder.style.display = 'block';
  uploadPlaceholder.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i><span>คลิกเพื่ออัปโหลดไฟล์รูปภาพ</span>`;
}

// Product Form operations
function openAddProductModal() {
  productModalTitle.textContent = 'เพิ่มสินค้าใหม่';
  productIdInput.value = '';
  productForm.reset();
  variantsList.innerHTML = '';
  productHasVariants.checked = false;
  productHasVariants.dispatchEvent(new Event('change'));
  resetImagePreview();
  productModal.classList.add('active');
}

function openEditProductModal(id) {
  const item = menuItems.find(i => i.id === id);
  if (!item) return;

  productModalTitle.textContent = 'แก้ไขรายละเอียดสินค้า';
  productIdInput.value = item.id;
  productNameInput.value = item.name;
  productPriceInput.value = item.price;
  productStockInput.value = item.stock;
  productImageUrl.value = item.image || '';

  variantsList.innerHTML = '';
  if (item.hasVariants) {
    productHasVariants.checked = true;
    if (Array.isArray(item.variants)) {
      item.variants.forEach(v => addVariantOptionRow(v.name, v.stock));
    }
  } else {
    productHasVariants.checked = false;
  }
  productHasVariants.dispatchEvent(new Event('change'));

  if (item.image) {
    showImagePreview(item.image);
  } else {
    resetImagePreview();
  }

  productModal.classList.add('active');
}

function addVariantOptionRow(name = "", stock = 0) {
  const row = document.createElement('div');
  row.className = 'variant-option-row';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '2fr 1fr auto';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';
  row.style.marginBottom = '0.5rem';

  row.innerHTML = `
    <input type="text" class="form-control variant-name-input" placeholder="เช่น กลิ่นองุ่น" value="${name}" required style="padding: 0.35rem 0.5rem; font-size: 0.85rem;">
    <input type="number" class="form-control variant-stock-input" placeholder="สต็อก" min="0" value="${stock}" required style="padding: 0.35rem 0.5rem; font-size: 0.85rem;">
    <button type="button" class="btn btn-outline btn-sm btn-danger" style="padding: 0.35rem 0.5rem; border-color:var(--danger); color:var(--danger);" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-trash-can"></i>
    </button>
  `;
  variantsList.appendChild(row);
}

async function saveProduct(e) {
  e.preventDefault();
  const id = productIdInput.value;
  const name = productNameInput.value.trim();
  const price = parseFloat(productPriceInput.value);
  const image = productImageUrl.value.trim();
  
  const hasVariants = productHasVariants.checked;
  let stock = 0;
  let variants = [];

  if (hasVariants) {
    const rows = variantsList.querySelectorAll('.variant-option-row');
    rows.forEach(row => {
      const vName = row.querySelector('.variant-name-input').value.trim();
      const vStock = parseInt(row.querySelector('.variant-stock-input').value) || 0;
      if (vName) {
        variants.push({ name: vName, stock: vStock });
        stock += vStock;
      }
    });
  } else {
    stock = parseInt(productStockInput.value) || 0;
  }

  const payload = { name, price, stock, image, hasVariants, variants };
  const isEdit = !!id;
  
  const saveBtn = document.getElementById('save-product-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'กำลังบันทึก...';

  try {
    const url = isEdit ? `/api/menu/${id}` : '/api/menu';
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to save product');

    productModal.classList.remove('active');
    fetchMenu(); // reload list
  } catch (err) {
    alert(`เกิดข้อผิดพลาดในการบันทึกสินค้า: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'บันทึกสินค้า';
  }
}

async function deleteProduct(id) {
  if (!confirm('คุณแน่ใจหรือไม่ที่จะลบเมนูนี้ออกจากระบบ?')) return;
  
  try {
    const response = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete product');
    fetchMenu();
  } catch (err) {
    alert(`ลบไม่สำเร็จ: ${err.message}`);
  }
}

// Fetch Orders Queue
async function fetchOrders(silent = false) {
  if (!silent) ordersLoading.style.display = 'block';

  try {
    const response = await fetch('/api/orders');
    orders = await response.json();
    
    // Sort orders: oldest pending orders first, then completed/cancelled
    orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    renderOrdersBoard(orders);
    updateOrderBadges(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
  } finally {
    if (!silent) ordersLoading.style.display = 'none';
  }
}

// Update Order Badges / Sidebar summary
function updateOrderBadges(ordersList) {
  const pendingOrders = ordersList.filter(o => o.status === 'pending');
  if (pendingOrders.length > 0) {
    newOrdersBadge.textContent = pendingOrders.length;
    newOrdersBadge.style.display = 'inline-block';
  } else {
    newOrdersBadge.style.display = 'none';
  }

  // Today's summary (sidebar)
  const today = new Date().toLocaleDateString();
  const todayOrders = ordersList.filter(o => {
    const isToday = new Date(o.timestamp).toLocaleDateString() === today;
    return isToday && (o.status === 'completed' || o.paymentStatus === 'paid');
  });

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  todaySalesSidebar.textContent = `฿${todayRevenue.toLocaleString()}`;
  todayOrdersSidebar.textContent = `${todayOrders.length} ออเดอร์`;
}

// Render Orders list
function renderOrdersBoard(ordersList) {
  // Only display pending or unpaid orders in the active orders board
  const activeOrders = ordersList.filter(o => o.status === 'pending' || (o.status === 'completed' && o.paymentStatus === 'unpaid'));
  
  if (activeOrders.length === 0) {
    ordersBoard.innerHTML = '';
    emptyOrdersMessage.style.display = 'block';
    return;
  }
  emptyOrdersMessage.style.display = 'none';

  ordersBoard.innerHTML = activeOrders.map(order => {
    const itemsHtml = order.items.map(item => `
      <div class="order-item-row">
        <span>${item.name}${item.variant ? ' (' + item.variant + ')' : ''} x ${item.quantity}</span>
        <span>฿${(item.price * item.quantity).toLocaleString()}</span>
      </div>
    `).join('');

    const formattedTime = new Date(order.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const isPaid = order.paymentStatus === 'paid';
    const isCompleted = order.status === 'completed';

    let actionButtons = '';
    
    if (!isPaid) {
      actionButtons += `<button class="btn btn-success btn-sm" onclick="openPromptPayPayment('${order.id}', ${order.total})"><i class="fa-solid fa-qrcode"></i> ชำระเงิน (พร้อมเพย์)</button>`;
    } else {
      actionButtons += `<span class="text-success" style="font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-circle-check"></i> จ่ายเงินแล้ว</span>`;
    }

    if (!isCompleted) {
      actionButtons += `<button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${order.id}', 'completed')"><i class="fa-solid fa-box"></i> ส่งมอบแล้ว</button>`;
      actionButtons += `<button class="btn btn-outline btn-sm btn-danger" style="margin-left:auto; border-color:var(--danger); color:var(--danger);" onclick="updateOrderStatus('${order.id}', 'cancelled')"><i class="fa-solid fa-ban"></i></button>`;
      actionButtons += `<button class="btn btn-outline btn-sm" style="margin-left: 0.5rem; border-color: var(--primary); color: var(--primary);" onclick="openEditOrderModal('${order.id}')" title="แก้ไขรายการสินค้า"><i class="fa-solid fa-pen"></i> แก้ไข</button>`;
    } else {
      actionButtons += `<span class="text-success" style="font-size:0.85rem; font-weight:600; margin-left:1rem;"><i class="fa-solid fa-circle-check"></i> ส่งมอบสำเร็จ</span>`;
    }

    // Determine card styling based on payment
    const borderStyle = isPaid ? 'border-color: var(--success);' : 'border-color: var(--warning);';

    let slipHtml = '';
    if (order.slipImage) {
      slipHtml = `
        <div class="order-slip-preview mt-2" style="margin-top: 0.75rem; border-top: 1px dashed var(--border-color); padding-top: 0.75rem; text-align: center;">
          <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; text-align: left; color: var(--text-muted);">สลิปโอนเงินของลูกค้า:</div>
          <a href="${order.slipImage}" target="_blank" title="คลิกเพื่อดูรูปภาพสลิปเต็ม">
            <img src="${order.slipImage}" style="max-width: 100%; max-height: 180px; object-fit: contain; border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer;" onerror="this.onerror=null; this.src='https://placehold.co/120x160/f1f5f9/94a3b8?text=SlipNotFound';">
          </a>
        </div>
      `;
    }

    return `
      <div class="order-card" style="${borderStyle}">
        <div class="order-card-header">
          <div>
            <div class="order-id">รหัส: ${order.id.slice(-6)}</div>
            <div class="order-time">${formattedTime} น. | จุดบริการ: <strong>${order.table || 'ทั่วไป'}</strong></div>
          </div>
          <span class="order-status-badge status-${order.status}">${order.status === 'pending' ? 'รอดำเนินการ' : 'ส่งมอบสำเร็จ'}</span>
        </div>
        <div class="order-items-list">
          ${itemsHtml}
        </div>
        <div class="order-total-row">
          <span>ยอดรวม:</span>
          <span>฿${order.total.toLocaleString()}</span>
        </div>
        ${slipHtml}
        <div class="order-actions mt-4">
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
}

// Update Order status via PUT API
async function updateOrderStatus(orderId, status, paymentStatus) {
  const payload = {};
  if (status !== undefined) payload.status = status;
  if (paymentStatus !== undefined) payload.paymentStatus = paymentStatus;

  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to update order');
    
    // Refresh lists
    fetchOrders(true);
    fetchStats(true);
    fetchMenu(); // refresh stock numbers
  } catch (err) {
    alert(`อัปเดตออเดอร์ล้มเหลว: ${err.message}`);
  }
}

// Generate and Open Payment QR Code modal
async function openPromptPayPayment(orderId, amount) {
  if (!settings.promptPayId) {
    alert('กรุณาตั้งค่าเบอร์พร้อมเพย์ที่แท็บ "ตั้งค่าระบบ" ก่อนเรียกชำระเงิน');
    return;
  }

  paymentModalBody.innerHTML = `<div class="loading-spinner"></div>`;
  paymentModal.classList.add('active');

  try {
    const response = await fetch(`/api/promptpay-qr?amount=${amount}`);
    const result = await response.json();

    if (!response.ok) throw new Error(result.error);

    paymentModalBody.innerHTML = `
      <div class="qr-display">
        <img src="${result.qrImage}" alt="PromptPay QR Code">
        <div class="qr-amount-text">฿${amount.toLocaleString()}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">สแกนจ่ายไปยังเบอร์: ${settings.promptPayId}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        <button class="btn btn-success" style="width: 100%;" onclick="confirmPaymentSuccess('${orderId}')">
          <i class="fa-solid fa-circle-check"></i> ยืนยันชำระเงินสำเร็จ
        </button>
        <button class="btn btn-outline" style="width: 100%;" onclick="closePaymentModal()">
          ยกเลิก / ปิดหน้าต่าง
        </button>
      </div>
    `;
  } catch (err) {
    paymentModalBody.innerHTML = `
      <div class="alert-box alert-danger text-center">
        ไม่สามารถสร้าง QR Code: ${err.message}
      </div>
    `;
  }
}

window.confirmPaymentSuccess = function(orderId) {
  updateOrderStatus(orderId, undefined, 'paid');
  paymentModal.classList.remove('active');
};

window.closePaymentModal = function() {
  paymentModal.classList.remove('active');
};

// Statistics tab logic
let selectedStatsDate = null;

async function fetchStats(silent = false) {
  if (!silent) stockLoading.style.display = 'block';
  try {
    const response = await fetch('/api/orders');
    orders = await response.json();
    
    // Sort orders
    orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    renderOrdersBoard(orders);
    updateOrderBadges(orders);
    renderStats();
  } catch (err) {
    console.error('Error fetching statistics:', err);
  } finally {
    if (!silent) stockLoading.style.display = 'none';
  }
}

function renderStats() {
  const statsTotalRevenue = document.getElementById('stats-total-revenue');
  const statsTotalOrders = document.getElementById('stats-total-orders');
  const statsTopItem = document.getElementById('stats-top-item');
  const statsTableBody = document.getElementById('stats-table-body');
  const detailedHistoryTableBody = document.getElementById('detailed-history-table-body');
  const emptyStatsMessage = document.getElementById('empty-stats-message');
  const labelRevenue = document.getElementById('label-revenue');
  const labelOrders = document.getElementById('label-orders');

  // Filter orders based on selected date
  let filteredOrders = orders;
  if (selectedStatsDate) {
    filteredOrders = orders.filter(order => {
      const orderDateStr = order.timestamp.split('T')[0];
      return orderDateStr === selectedStatsDate;
    });
    
    const [y, m, d] = selectedStatsDate.split('-');
    labelRevenue.textContent = `ยอดขายวันที่ ${d}/${m}/${y}`;
    labelOrders.textContent = `ออเดอร์สำเร็จวันที่ ${d}/${m}/${y}`;
  } else {
    labelRevenue.textContent = 'ยอดขายสะสมทั้งหมด';
    labelOrders.textContent = 'ออเดอร์สำเร็จทั้งหมด';
  }

  // Calculate totals card metrics (Only count paid or completed)
  const completedPaidOrders = filteredOrders.filter(o => o.status === 'completed' || o.paymentStatus === 'paid');
  
  let totalRevenue = 0;
  let totalOrdersCount = completedPaidOrders.length;
  const itemsSold = {};

  completedPaidOrders.forEach(order => {
    totalRevenue += parseFloat(order.total) || 0;
    
    let items = order.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    
    if (Array.isArray(items)) {
      items.forEach(item => {
        const displayName = item.variant ? `${item.name} (${item.variant})` : item.name;
        if (!itemsSold[displayName]) itemsSold[displayName] = 0;
        itemsSold[displayName] += parseInt(item.quantity) || 0;
      });
    }
  });

  statsTotalRevenue.textContent = `฿${totalRevenue.toLocaleString()}`;
  statsTotalOrders.textContent = totalOrdersCount.toLocaleString();

  let topItemName = '-';
  let maxSold = 0;
  Object.keys(itemsSold).forEach(name => {
    if (itemsSold[name] > maxSold) {
      maxSold = itemsSold[name];
      topItemName = `${name} (${maxSold} ชิ้น)`;
    }
  });
  statsTopItem.textContent = topItemName;

  // 1. Group all orders by date for daily summaries table
  const dailyGroups = {};
  orders.forEach(order => {
    if (order.status !== 'completed' && order.paymentStatus !== 'paid') return;
    
    const dateStr = order.timestamp.split('T')[0];
    if (!dailyGroups[dateStr]) {
      dailyGroups[dateStr] = {
        revenue: 0,
        orders: 0,
        items: {}
      };
    }
    
    dailyGroups[dateStr].revenue += parseFloat(order.total) || 0;
    dailyGroups[dateStr].orders += 1;

    let items = order.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }
    if (Array.isArray(items)) {
      items.forEach(item => {
        const displayName = item.variant ? `${item.name} (${item.variant})` : item.name;
        if (!dailyGroups[dateStr].items[displayName]) dailyGroups[dateStr].items[displayName] = 0;
        dailyGroups[dateStr].items[displayName] += parseInt(item.quantity) || 0;
      });
    }
  });

  const sortedDates = Object.keys(dailyGroups).sort((a, b) => new Date(b) - new Date(a));
  
  if (sortedDates.length === 0) {
    emptyStatsMessage.style.display = 'block';
    statsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">ไม่มีสถิติยอดขายสำเร็จ</td></tr>';
  } else {
    emptyStatsMessage.style.display = 'none';
    statsTableBody.innerHTML = sortedDates.map(date => {
      const day = dailyGroups[date];
      const itemsListText = Object.keys(day.items).map(name => `${name} (${day.items[name]})`).join(', ');
      
      const [y, m, d] = date.split('-');
      const formattedDate = `${d}/${m}/${y}`;
      
      return `
        <tr>
          <td><strong>${formattedDate}</strong></td>
          <td>${day.orders} ออเดอร์</td>
          <td style="font-size: 0.85rem; color:var(--text-muted); max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsListText}">
            ${itemsListText || 'ไม่มีรายละเอียด'}
          </td>
          <td><strong class="text-success">฿${day.revenue.toLocaleString()}</strong></td>
        </tr>
      `;
    }).join('');
  }

  // 2. Render Detailed Transactions list (Filtered by selected date)
  if (filteredOrders.length === 0) {
    detailedHistoryTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);"><i class="fa-solid fa-folder-open" style="font-size:2rem;margin-bottom:0.5rem;display:block;"></i>ไม่มีข้อมูลประวัติการสั่งซื้อ</td></tr>';
  } else {
    detailedHistoryTableBody.innerHTML = filteredOrders.map(order => {
      const dt = new Date(order.timestamp);
      const dateStr = dt.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const formattedDateTime = `${dateStr} ${timeStr} น.`;

      let items = order.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }
      const itemsListHtml = Array.isArray(items) ? items.map(item => {
        const displayName = item.variant ? `${item.name} (${item.variant})` : item.name;
        return `<div>• ${displayName} x ${item.quantity}</div>`;
      }).join('') : 'ไม่มีรายการ';

      let paymentStatusBadge = '';
      if (order.paymentStatus === 'paid') {
        paymentStatusBadge = '<span class="text-success" style="font-weight:600;"><i class="fa-solid fa-circle-check"></i> ชำระแล้ว</span>';
        if (order.slipImage) {
          paymentStatusBadge += `<br><a href="${order.slipImage}" target="_blank" style="font-size: 0.75rem; text-decoration: underline; color: var(--success-hover);"><i class="fa-solid fa-image"></i> ดูสลิปโอนเงิน</a>`;
        }
      } else if (order.status === 'cancelled') {
        paymentStatusBadge = '<span class="text-danger" style="font-weight:600;"><i class="fa-solid fa-ban"></i> ยกเลิกออเดอร์</span>';
      } else {
        paymentStatusBadge = '<span class="text-primary" style="font-weight:600;"><i class="fa-solid fa-clock"></i> รอชำระเงิน</span>';
        if (order.slipImage) {
          paymentStatusBadge = '<span class="text-warning" style="font-weight:600;"><i class="fa-solid fa-file-invoice-dollar"></i> ส่งสลิปแล้ว</span>';
          paymentStatusBadge += `<br><a href="${order.slipImage}" target="_blank" style="font-size: 0.75rem; text-decoration: underline; color: var(--warning);"><i class="fa-solid fa-image"></i> ดูสลิปโอนเงิน</a>`;
        }
      }

      return `
        <tr>
          <td style="font-size:0.85rem;">${formattedDateTime}</td>
          <td><code style="font-size:0.8rem;">${order.id.slice(-6).toUpperCase()}</code></td>
          <td><strong>${order.table || 'ทั่วไป'}</strong></td>
          <td style="font-size:0.85rem; text-align:left;">${itemsListHtml}</td>
          <td><strong>฿${(parseFloat(order.total) || 0).toLocaleString()}</strong></td>
          <td>${paymentStatusBadge}</td>
          <td>
            <button class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem; border-color:var(--primary); color:var(--primary); margin-right:0.25rem;" onclick="openEditOrderModal('${order.id}')" title="แก้ไขออเดอร์">
              <i class="fa-solid fa-pen"></i> แก้ไข
            </button>
            <button class="btn btn-outline btn-sm btn-danger" style="padding: 0.25rem 0.5rem; border-color:var(--danger); color:var(--danger);" onclick="deleteOrderHistory('${order.id}')" title="ลบประวัติออเดอร์">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

window.deleteOrderHistory = async function(orderId) {
  if (!confirm(`คุณต้องการลบประวัติการสั่งซื้อรหัส ${orderId.slice(-6).toUpperCase()} ใช่หรือไม่?\nการลบนี้จะลบข้อมูลออกจากฐานข้อมูลและไฟล์ Google Sheets ด้วยอย่างถาวร`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    
    // Reload menu and stats
    await fetchOrders(true);
    renderStats();
    alert('ลบประวัติการสั่งซื้อเรียบร้อยแล้ว!');
  } catch (err) {
    alert(`เกิดข้อผิดพลาดในการลบประวัติ: ${err.message}`);
  }
};

// Tabletop QR code generator
async function generateTableQrCode() {
  const tableNum = qrTableNumber.value.trim();
  if (!tableNum) {
    alert('กรุณากรอกรหัสจุดบริการ/เลขโต๊ะ');
    return;
  }

  // Construct URL
  const tableUrl = `${window.location.origin}/?table=${tableNum}`;
  tableQrImageContainer.innerHTML = `<div class="loading-spinner"></div>`;
  tableQrResult.style.display = 'flex';

  try {
    const response = await fetch(`/api/qr?text=${encodeURIComponent(tableUrl)}`);
    const result = await response.json();

    if (!response.ok) throw new Error(result.error);

    tableQrImageContainer.innerHTML = `<img src="${result.qrImage}" style="width:200px;height:200px;" alt="Table QR Code">`;
    tableQrLinkText.textContent = `ลิงก์ของจุดบริการ ${tableNum}: ${tableUrl}`;
    
    // Set download button
    downloadTableQrBtn.onclick = () => {
      const link = document.createElement('a');
      link.href = result.qrImage;
      link.download = `table_${tableNum}_qrcode.png`;
      link.click();
    };

  } catch (err) {
    tableQrImageContainer.innerHTML = `<p class="text-danger">ไม่สามารถสร้างได้: ${err.message}</p>`;
  }
}

// Copy script code to clipboard
function copyScriptToClipboard() {
  appsScriptTextarea.select();
  appsScriptTextarea.setSelectionRange(0, 99999); // mobile support
  
  navigator.clipboard.writeText(appsScriptTextarea.value)
    .then(() => {
      alert('คัดลอกโค้ด Apps Script ไปยังคลิปบอร์ดแล้ว!');
    })
    .catch(err => {
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาลากดำคัดลอกโค้ดเองในช่องข้อความ');
    });
}


// --- EDIT ORDER ITEMS LOGIC ---
let editingOrderId = null;
let editingOrderOriginalTotal = 0;
let editingOrderItems = []; // [{ id, name, price, quantity, variant }]

window.openEditOrderModal = function(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  editingOrderId = orderId;
  editingOrderOriginalTotal = parseFloat(order.total) || 0;
  
  // Deep clone order items
  editingOrderItems = order.items.map(it => ({
    id: it.id,
    name: it.name,
    price: parseFloat(it.price) || 0,
    quantity: parseInt(it.quantity) || 1,
    variant: it.variant || ''
  }));

  editOrderIdLabel.textContent = orderId.slice(-6).toUpperCase();
  editOrderOldTotal.textContent = editingOrderOriginalTotal.toLocaleString();

  // Populate product dropdown selector
  if (addOrderProductSelect) {
    addOrderProductSelect.innerHTML = menuItems.map(p => `<option value="${p.id}">${p.name} (฿${p.price})</option>`).join('');
    // Trigger change event to populate variant select if needed
    addOrderProductSelect.dispatchEvent(new Event('change'));
  }
  
  if (addOrderQtyInput) {
    addOrderQtyInput.value = 1;
  }

  renderEditOrderItems();
  editOrderModal.classList.add('active');
};

function renderEditOrderItems() {
  if (editingOrderItems.length === 0) {
    editOrderItemsList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem;">ไม่มีสินค้าในออเดอร์นี้ (กรุณาเพิ่มสินค้า)</div>';
    editOrderNewTotal.textContent = '0';
    updateEditOrderDiff(0);
    return;
  }

  let total = 0;
  editOrderItemsList.innerHTML = editingOrderItems.map((item, index) => {
    total += item.price * item.quantity;
    
    // Check if product has variants to show flavor selection dropdown
    const product = menuItems.find(p => p.id === item.id);
    let variantDropdownHtml = '';
    
    if (product && product.hasVariants && Array.isArray(product.variants)) {
      variantDropdownHtml = `
        <select class="form-control" style="padding:0.25rem; font-size:0.8rem; height:28px;" onchange="updateEditOrderVariant(${index}, this)">
          ${product.variants.map(v => {
            const isSelected = v.name === item.variant;
            return `<option value="${v.name}" ${isSelected ? 'selected' : ''}>${v.name}</option>`;
          }).join('')}
        </select>
      `;
    } else {
      variantDropdownHtml = `<span style="font-size:0.8rem; color:var(--text-muted);">ไม่มีตัวเลือกย่อย</span>`;
    }

    return `
      <div style="display:grid; grid-template-columns: 2fr 1.5fr 1fr auto; gap:0.5rem; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
        <div>
          <div style="font-weight:600; font-size:0.9rem;">${item.name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">฿${item.price}</div>
        </div>
        <div>
          ${variantDropdownHtml}
        </div>
        <div style="display:flex; align-items:center; border:1px solid var(--border-color); border-radius:var(--radius-sm); overflow:hidden; background-color:var(--bg-main);">
          <button class="qty-btn" style="padding:2px 6px;" onclick="updateEditOrderQty(${index}, -1)">-</button>
          <span style="width:25px; text-align:center; font-size:0.85rem; font-weight:600;">${item.quantity}</span>
          <button class="qty-btn" style="padding:2px 6px;" onclick="updateEditOrderQty(${index}, 1)">+</button>
        </div>
        <button class="btn btn-outline btn-sm btn-danger" style="padding: 0.25rem 0.4rem;" onclick="removeProductFromEditOrder(${index})">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');

  editOrderNewTotal.textContent = total.toLocaleString();
  updateEditOrderDiff(total);
}

window.updateEditOrderQty = function(index, change) {
  const item = editingOrderItems[index];
  if (!item) return;

  const newQty = item.quantity + change;
  if (newQty <= 0) {
    removeProductFromEditOrder(index);
  } else {
    // Check stock limit for that product/variant
    const product = menuItems.find(p => p.id === item.id);
    let maxStock = 999;
    if (product) {
      if (product.hasVariants) {
        const v = product.variants.find(varObj => varObj.name === item.variant);
        maxStock = v ? v.stock : 0;
      } else {
        maxStock = product.stock;
      }
      
      // Since they are editing an existing order, the max limit should also include the quantity they ALREADY ordered
      // to not block them from keeping their current quantity!
      const originalOrder = orders.find(o => o.id === editingOrderId);
      const originalItem = originalOrder ? originalOrder.items.find(it => it.id === item.id && it.variant === item.variant) : null;
      const originalQty = originalItem ? originalItem.quantity : 0;
      maxStock += originalQty;
    }

    if (newQty <= maxStock) {
      item.quantity = newQty;
      renderEditOrderItems();
    } else {
      alert(`สต็อกไม่พอ! สามารถสั่งซื้อชิ้นนี้ได้สูงสุด ${maxStock} ชิ้น`);
    }
  }
};

window.updateEditOrderVariant = function(index, selectElement) {
  const item = editingOrderItems[index];
  if (!item) return;
  
  const oldVariant = item.variant;
  const newVariant = selectElement.value;
  item.variant = newVariant;

  // Validate stock of the new variant
  const product = menuItems.find(p => p.id === item.id);
  if (product) {
    const v = product.variants.find(varObj => varObj.name === newVariant);
    let maxStock = v ? v.stock : 0;

    // Adjust for current order quantities if they already ordered this variant originally
    const originalOrder = orders.find(o => o.id === editingOrderId);
    const originalItem = originalOrder ? originalOrder.items.find(it => it.id === item.id && it.variant === newVariant) : null;
    maxStock += originalItem ? originalItem.quantity : 0;

    if (item.quantity > maxStock) {
      alert(`สต็อกของกลิ่น ${newVariant} มีเพียง ${maxStock} ชิ้น! ทำการปรับจำนวนสั่งเป็นจำนวนสต็อกแทน`);
      item.quantity = maxStock > 0 ? maxStock : 1;
    }
  }
  
  renderEditOrderItems();
};

window.removeProductFromEditOrder = function(index) {
  editingOrderItems.splice(index, 1);
  renderEditOrderItems();
};

function addProductToEditOrder() {
  const selectedProductId = addOrderProductSelect.value;
  const product = menuItems.find(p => p.id === selectedProductId);
  if (!product) return;

  const variantName = addOrderVariantSelect.style.display !== 'none' ? addOrderVariantSelect.value : '';
  const qty = parseInt(addOrderQtyInput.value) || 1;

  // Validate stock
  let maxStock = product.stock;
  if (product.hasVariants) {
    const v = product.variants.find(varObj => varObj.name === variantName);
    maxStock = v ? v.stock : 0;
  }

  // Adjust for original quantities in this order
  const originalOrder = orders.find(o => o.id === editingOrderId);
  const originalItem = originalOrder ? originalOrder.items.find(it => it.id === selectedProductId && it.variant === variantName) : null;
  maxStock += originalItem ? originalItem.quantity : 0;

  // If already exists in editing list, sum them
  const existingIndex = editingOrderItems.findIndex(it => it.id === selectedProductId && it.variant === variantName);
  const currentEditingQty = existingIndex !== -1 ? editingOrderItems[existingIndex].quantity : 0;

  if (currentEditingQty + qty <= maxStock) {
    if (existingIndex !== -1) {
      editingOrderItems[existingIndex].quantity += qty;
    } else {
      editingOrderItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        variant: variantName
      });
    }
    renderEditOrderItems();
  } else {
    alert(`ขออภัย สต็อกไม่พอ! สามารถสั่งกลิ่น/สินค้านี้เพิ่มได้สูงสุดอีก ${maxStock - currentEditingQty} ชิ้น`);
  }
}

function updateEditOrderDiff(newTotal) {
  const diff = newTotal - editingOrderOriginalTotal;
  if (diff === 0) {
    editOrderDiffBox.style.display = 'none';
  } else if (diff > 0) {
    editOrderDiffBox.style.display = 'block';
    editOrderDiffBox.style.backgroundColor = 'var(--warning-light)';
    editOrderDiffBox.style.color = 'var(--warning-hover)';
    editOrderDiffBox.style.border = '1px solid var(--warning)';
    editOrderDiffBox.textContent = `ยอดใหม่เพิ่มขึ้น: ต้องเก็บเงินเพิ่ม +฿${diff.toLocaleString()}`;
  } else {
    editOrderDiffBox.style.display = 'block';
    editOrderDiffBox.style.backgroundColor = 'var(--success-light)';
    editOrderDiffBox.style.color = 'var(--success-hover)';
    editOrderDiffBox.style.border = '1px solid var(--success)';
    editOrderDiffBox.textContent = `ยอดใหม่ลดลง: ต้องทอนเงินคืนลูกค้า -฿${Math.abs(diff).toLocaleString()}`;
  }
}

async function saveEditOrder() {
  if (editingOrderItems.length === 0) {
    alert('กรุณาเพิ่มสินค้าอย่างน้อย 1 ชิ้นในออเดอร์!');
    return;
  }

  saveEditOrderBtn.disabled = true;
  saveEditOrderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกการแก้ไข...';

  try {
    const response = await fetch(`/api/orders/${editingOrderId}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: editingOrderItems.map(it => ({
          id: it.id,
          quantity: it.quantity,
          variant: it.variant
        }))
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to edit order');

    editOrderModal.classList.remove('active');
    
    // Refresh UI data
    await fetchOrders(true);
    renderStats();
    alert('แก้ไขรายการสินค้าและจำนวนสต็อกคงคลังเรียบร้อยแล้ว!');
  } catch (err) {
    alert(`เกิดข้อผิดพลาดในการบันทึกการแก้ไข: ${err.message}`);
  } finally {
    saveEditOrderBtn.disabled = false;
    saveEditOrderBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไขออเดอร์';
  }
}
