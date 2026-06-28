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
    var sheet = getOrCreateSheet(ss, SHEET_NAME_MENU, ["id", "name", "price", "stock", "image"]);
    var data = getSheetData(sheet);
    return jsonResponse(data);
  }
  
  if (action === "getOrders") {
    var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ["id", "timestamp", "items", "total", "status", "paymentStatus"]);
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
    var sheet = getOrCreateSheet(ss, SHEET_NAME_MENU, ["id", "name", "price", "stock", "image"]);
    clearSheetData(sheet);
    var menuItems = postData.data || [];
    menuItems.forEach(function(item) {
      sheet.appendRow([item.id, item.name, item.price, item.stock, item.image]);
    });
    return jsonResponse({ success: true });
  }
  
  if (action === "saveOrder") {
    var sheet = getOrCreateSheet(ss, SHEET_NAME_ORDERS, ["id", "timestamp", "items", "total", "status", "paymentStatus"]);
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
    var rowData = [order.id, order.timestamp, itemsStr, order.total, order.status, order.paymentStatus];
    
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
  closePaymentModalBtn.addEventListener('click', () => paymentModal.classList.remove('active'));
  
  window.addEventListener('click', (e) => {
    if (e.target === productModal) productModal.classList.remove('active');
    if (e.target === paymentModal) paymentModal.classList.remove('active');
    if (e.target === scriptModal) scriptModal.classList.remove('active');
  });

  // Stock CRUD actions
  addItemBtn.addEventListener('click', openAddProductModal);
  productForm.addEventListener('submit', saveProduct);

  // Image Upload Clicking box
  imageUploadBox.addEventListener('click', () => productImageFile.click());
  productImageFile.addEventListener('change', handleImageUpload);

  // Manual refresh buttons
  refreshOrdersBtn.addEventListener('click', () => fetchOrders(false));
  refreshStatsBtn.addEventListener('click', () => fetchStats(false));
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
    const itemImageSrc = item.image || 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Food';
    return `
      <div class="stock-item-card">
        <img src="${itemImageSrc}" class="stock-item-img" alt="${item.name}" onerror="this.onerror=null; this.src='https://placehold.co/600x400/f1f5f9/94a3b8?text=Food';">
        <div class="stock-item-details">
          <div class="stock-item-name">${item.name}</div>
          <div class="stock-item-price">฿${item.price.toLocaleString()}</div>
          <div class="stock-item-qty">สต็อก: <strong>${item.stock}</strong> ชิ้น</div>
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

  if (item.image) {
    showImagePreview(item.image);
  } else {
    resetImagePreview();
  }

  productModal.classList.add('active');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = productIdInput.value;
  const name = productNameInput.value.trim();
  const price = parseFloat(productPriceInput.value);
  const stock = parseInt(productStockInput.value);
  const image = productImageUrl.value.trim();

  const payload = { name, price, stock, image };
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
        <span>${item.name} x ${item.quantity}</span>
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
      actionButtons += `<button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${order.id}', 'completed')"><i class="fa-solid fa-utensils"></i> เสิร์ฟแล้ว</button>`;
      actionButtons += `<button class="btn btn-outline btn-sm btn-danger" style="margin-left:auto; border-color:var(--danger); color:var(--danger);" onclick="updateOrderStatus('${order.id}', 'cancelled')"><i class="fa-solid fa-ban"></i></button>`;
    } else {
      actionButtons += `<span class="text-success" style="font-size:0.85rem; font-weight:600; margin-left:1rem;"><i class="fa-solid fa-circle-check"></i> เสิร์ฟเสร็จสิ้น</span>`;
    }

    // Determine card styling based on payment
    const borderStyle = isPaid ? 'border-color: var(--success);' : 'border-color: var(--warning);';

    return `
      <div class="order-card" style="${borderStyle}">
        <div class="order-card-header">
          <div>
            <div class="order-id">รหัส: ${order.id.slice(-6)}</div>
            <div class="order-time">${formattedTime} น. | โต๊ะ: <strong>${order.table || 'ทั่วไป'}</strong></div>
          </div>
          <span class="order-status-badge status-${order.status}">${order.status === 'pending' ? 'รอดำเนินการ' : 'เสิร์ฟเสร็จสิ้น'}</span>
        </div>
        <div class="order-items-list">
          ${itemsHtml}
        </div>
        <div class="order-total-row">
          <span>ยอดรวม:</span>
          <span>฿${order.total.toLocaleString()}</span>
        </div>
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
async function fetchStats(silent = false) {
  try {
    const response = await fetch('/api/stats');
    const statsData = await response.json();
    renderStats(statsData);
  } catch (err) {
    console.error('Error fetching statistics:', err);
  }
}

// Render Stats Table and Cards
function renderStats(stats) {
  const dates = Object.keys(stats).sort((a, b) => new Date(b) - new Date(a));
  
  if (dates.length === 0) {
    emptyStatsMessage.style.display = 'block';
    statsTableBody.innerHTML = '';
    statsTotalRevenue.textContent = '฿0';
    statsTotalOrders.textContent = '0';
    statsTopItem.textContent = '-';
    return;
  }
  
  emptyStatsMessage.style.display = 'none';

  let grandTotalRevenue = 0;
  let grandTotalOrders = 0;
  const globalItemsSold = {}; // itemName -> count

  let tableHtml = '';

  dates.forEach(date => {
    const dayData = stats[date];
    grandTotalRevenue += dayData.totalRevenue;
    grandTotalOrders += dayData.orderCount;

    // Items list column text
    const itemsTextList = Object.keys(dayData.itemsSold).map(name => {
      const qty = dayData.itemsSold[name];
      
      // Keep track of top selling items globally
      if (!globalItemsSold[name]) globalItemsSold[name] = 0;
      globalItemsSold[name] += qty;

      return `${name} (${qty})`;
    }).join(', ');

    // Convert date string back to Thai format
    const [y, m, d] = date.split('-');
    const thaiDate = `${d}/${m}/${y}`;

    tableHtml += `
      <tr>
        <td><strong>${thaiDate}</strong></td>
        <td>${dayData.orderCount} ออเดอร์</td>
        <td style="font-size: 0.85rem; color:var(--text-muted); max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsTextList}">
          ${itemsTextList || 'ไม่มีเมนู (ยกเลิก)'}
        </td>
        <td><strong class="text-success">฿${dayData.totalRevenue.toLocaleString()}</strong></td>
      </tr>
    `;
  });

  statsTableBody.innerHTML = tableHtml;

  // Render stats cards
  statsTotalRevenue.textContent = `฿${grandTotalRevenue.toLocaleString()}`;
  statsTotalOrders.textContent = grandTotalOrders.toLocaleString();

  // Find best selling item
  let topItemName = '-';
  let maxSold = 0;
  Object.keys(globalItemsSold).forEach(name => {
    if (globalItemsSold[name] > maxSold) {
      maxSold = globalItemsSold[name];
      topItemName = `${name} (${maxSold} ชิ้น)`;
    }
  });
  statsTopItem.textContent = topItemName;
}

// Tabletop QR code generator
async function generateTableQrCode() {
  const tableNum = qrTableNumber.value.trim();
  if (!tableNum) {
    alert('กรุณากรอกเลขโต๊ะอาหาร');
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
    tableQrLinkText.textContent = `ลิงก์ของโต๊ะ ${tableNum}: ${tableUrl}`;
    
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
