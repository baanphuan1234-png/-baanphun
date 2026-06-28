// Customer Application Logic
let menuItems = [];
let cart = {}; // { itemId: quantity }
let tableNumber = 'ทั่วไป';
let pollingInterval = null;

// DOM Elements
const menuGrid = document.getElementById('menu-grid');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyMenuMessage = document.getElementById('empty-menu-message');
const searchInput = document.getElementById('search-input');
const cartItemsContainer = document.getElementById('cart-items-container');
const emptyCartMessage = document.getElementById('empty-cart-message');
const cartCount = document.getElementById('cart-count');
const cartTotalVal = document.getElementById('cart-total-val');
const submitOrderBtn = document.getElementById('submit-order-btn');
const cartPanel = document.getElementById('cart-panel');
const cartHeaderToggle = document.getElementById('cart-header-toggle');
const cartChevron = document.getElementById('cart-chevron');
const viewOrderStatusBtn = document.getElementById('view-order-status-btn');
const orderStatusModal = document.getElementById('order-status-modal');
const closeStatusModalBtn = document.getElementById('close-status-modal-btn');
const orderStatusContent = document.getElementById('order-status-content');
const notificationBanner = document.getElementById('notification-banner');
const notificationMessage = document.getElementById('notification-message');
const closeBannerBtn = document.getElementById('close-banner-btn');
const tableNumberDisplay = document.getElementById('table-number-display');

// Initialize Customer Page
window.addEventListener('DOMContentLoaded', () => {
  // Parse table number from URL params, e.g., ?table=5
  const urlParams = new URLSearchParams(window.location.search);
  const table = urlParams.get('table');
  if (table) {
    tableNumber = table;
    tableNumberDisplay.textContent = `โต๊ะที่ ${tableNumber}`;
  }

  fetchMenu();
  checkExistingOrder();
  setupEventListeners();

  // Polling for menu stock updates every 30 seconds
  setInterval(fetchMenu, 30000);
});

// Setup Events
function setupEventListeners() {
  searchInput.addEventListener('input', filterMenu);
  
  submitOrderBtn.addEventListener('click', submitOrder);
  
  // Mobile cart collapsible toggling
  cartHeaderToggle.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      cartPanel.classList.toggle('expanded');
      const isExpanded = cartPanel.classList.contains('expanded');
      cartChevron.className = isExpanded ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up";
    }
  });

  // Track order button
  viewOrderStatusBtn.addEventListener('click', showOrderStatus);
  closeStatusModalBtn.addEventListener('click', () => orderStatusModal.classList.remove('active'));
  closeBannerBtn.addEventListener('click', () => notificationBanner.style.display = 'none');

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === orderStatusModal) {
      orderStatusModal.classList.remove('active');
    }
  });

  // Handle mobile cart chevron display
  const handleResize = () => {
    if (window.innerWidth <= 900) {
      cartChevron.style.display = 'block';
    } else {
      cartChevron.style.display = 'none';
      cartPanel.classList.remove('expanded');
    }
  };
  window.addEventListener('resize', handleResize);
  handleResize();
}

// Fetch Menu Items
async function fetchMenu() {
  try {
    const response = await fetch('/api/menu');
    if (!response.ok) throw new Error('Failed to fetch menu');
    menuItems = await response.json();
    loadingSpinner.style.display = 'none';
    renderMenu(menuItems);
  } catch (error) {
    console.error('Error loading menu:', error);
    loadingSpinner.style.display = 'none';
    emptyMenuMessage.style.display = 'block';
    emptyMenuMessage.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--danger); margin-bottom: 1rem;"></i><p>ไม่สามารถโหลดเมนูได้ กรุณาลองใหม่อีกครั้ง</p>`;
  }
}

// Render Menu
function renderMenu(items) {
  if (items.length === 0) {
    emptyMenuMessage.style.display = 'block';
    menuGrid.innerHTML = '';
    return;
  }
  emptyMenuMessage.style.display = 'none';

  menuGrid.innerHTML = items.map(item => {
    const qtyInCart = cart[item.id] || 0;
    
    // Determine stock status and tags
    let stockTagClass = 'stock-ok';
    let stockText = `คงเหลือ: ${item.stock}`;
    let isOutOfStock = item.stock <= 0;
    let addBtnHtml = '';

    if (item.stock === 0) {
      stockTagClass = 'stock-out';
      stockText = 'หมดชั่วคราว';
      addBtnHtml = `<button class="btn btn-outline btn-sm" disabled style="width: 100%;">สินค้าหมด</button>`;
    } else {
      if (item.stock <= 5) {
        stockTagClass = 'stock-low';
        stockText = `เหลือเพียง ${item.stock} ชิ้น`;
      }
      
      if (qtyInCart > 0) {
        addBtnHtml = `
          <div class="quantity-control" style="width: 100%; justify-content: space-between;">
            <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
            <span class="qty-val">${qtyInCart}</span>
            <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)" ${qtyInCart >= item.stock ? 'disabled' : ''}>+</button>
          </div>
        `;
      } else {
        addBtnHtml = `<button class="btn btn-primary btn-sm" style="width: 100%;" onclick="addToCart('${item.id}')"><i class="fa-solid fa-plus"></i> เพิ่มใส่ตะกร้า</button>`;
      }
    }

    const itemImageSrc = item.image || 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Food';

    return `
      <div class="menu-item-card" data-id="${item.id}">
        <img src="${itemImageSrc}" class="menu-item-img" alt="${item.name}" onerror="this.onerror=null; this.src='https://placehold.co/600x400/f1f5f9/94a3b8?text=Food';">
        <div class="menu-item-info">
          <div class="menu-item-name">${item.name}</div>
          <div class="menu-item-price">฿${item.price.toLocaleString()}</div>
          <div class="menu-item-stock">
            <span class="stock-tag ${stockTagClass}">${stockText}</span>
          </div>
          <div style="margin-top: auto; padding-top: 0.5rem;">
            ${addBtnHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Filter Menu Items by search
function filterMenu() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    renderMenu(menuItems);
    return;
  }
  
  const filtered = menuItems.filter(item => 
    item.name.toLowerCase().includes(query)
  );
  renderMenu(filtered);
}

// Add Item to Cart
function addToCart(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item || item.stock <= 0) return;
  
  cart[itemId] = 1;
  updateCartUI();
  renderMenu(menuItems); // re-render item buttons
}

// Update Cart Quantity
function updateCartQty(itemId, change) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  const currentQty = cart[itemId] || 0;
  const newQty = currentQty + change;

  if (newQty <= 0) {
    delete cart[itemId];
  } else if (newQty <= item.stock) {
    cart[itemId] = newQty;
  } else {
    alert(`ขออภัย สามารถสั่งซื้อ ${item.name} ได้สูงสุด ${item.stock} ชิ้น`);
  }

  updateCartUI();
  renderMenu(menuItems);
}

// Update Cart Panel UI
function updateCartUI() {
  const cartItemIds = Object.keys(cart);
  
  if (cartItemIds.length === 0) {
    emptyCartMessage.style.display = 'block';
    cartItemsContainer.innerHTML = '';
    cartCount.textContent = '0';
    cartTotalVal.textContent = '0';
    submitOrderBtn.disabled = true;
    return;
  }

  emptyCartMessage.style.display = 'none';
  submitOrderBtn.disabled = false;

  let totalItemsCount = 0;
  let totalPrice = 0;

  cartItemsContainer.innerHTML = cartItemIds.map(itemId => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return '';

    const qty = cart[itemId];
    totalItemsCount += qty;
    totalPrice += item.price * qty;

    return `
      <div class="cart-item">
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">฿${item.price.toLocaleString()} x ${qty}</div>
        </div>
        <div class="quantity-control">
          <button class="qty-btn" onclick="updateCartQty('${itemId}', -1)">-</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${itemId}', 1)" ${qty >= item.stock ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join('');

  cartCount.textContent = totalItemsCount;
  cartTotalVal.textContent = totalPrice.toLocaleString();
}

// Submit Order (Customer places order)
async function submitOrder() {
  const cartItemIds = Object.keys(cart);
  if (cartItemIds.length === 0) return;

  submitOrderBtn.disabled = true;
  submitOrderBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งออเดอร์...`;

  const orderItems = cartItemIds.map(id => ({
    id,
    quantity: cart[id]
  }));

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: orderItems,
        table: tableNumber
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to place order');
    }

    // Reset Cart
    cart = {};
    updateCartUI();
    
    // Save to LocalStorage
    localStorage.setItem('lastOrderId', result.id);
    checkExistingOrder();
    
    // Refresh Menu to update stocks
    await fetchMenu();

    // Show banner
    showNotification('ส่งออเดอร์โต๊ะของคุณเสร็จสิ้น! สามารถติดตามความคืบหน้าได้ที่ปุ่ม "ติดตามออเดอร์"');

    // Close mobile cart panel if open
    cartPanel.classList.remove('expanded');
    cartChevron.className = "fa-solid fa-chevron-up";

  } catch (error) {
    console.error('Submit order error:', error);
    alert(`เกิดข้อผิดพลาดในการสั่งอาหาร: ${error.message}`);
    submitOrderBtn.disabled = false;
    submitOrderBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ยืนยันและสั่งอาหาร`;
  }
}

// Show Notification Banner
function showNotification(msg) {
  notificationMessage.textContent = msg;
  notificationBanner.style.display = 'flex';
  setTimeout(() => {
    notificationBanner.style.display = 'none';
  }, 10000);
}

// Check if customer already placed an order in this browser session
function checkExistingOrder() {
  const lastOrderId = localStorage.getItem('lastOrderId');
  if (lastOrderId) {
    viewOrderStatusBtn.style.display = 'inline-flex';
    // Start polling status
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(pollOrderStatus, 8000);
    pollOrderStatus(); // first fetch immediate
  } else {
    viewOrderStatusBtn.style.display = 'none';
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }
}

// Poll order status to show live changes (e.g. Paid, cooking, cancelled)
async function pollOrderStatus() {
  const lastOrderId = localStorage.getItem('lastOrderId');
  if (!lastOrderId) return;

  try {
    const response = await fetch('/api/orders');
    const orders = await response.json();
    const myOrder = orders.find(o => o.id === lastOrderId);

    if (!myOrder) {
      localStorage.removeItem('lastOrderId');
      checkExistingOrder();
      return;
    }

    // If order was completed and paid, we can let user clean it or automatically dismiss after a while
    if (myOrder.status === 'completed' && myOrder.paymentStatus === 'paid') {
      // Order done! We can keep button visible but notify user
      // Stop polling to save resource
      clearInterval(pollingInterval);
      pollingInterval = null;
    }

    // If modal is open, refresh contents
    if (orderStatusModal.classList.contains('active')) {
      renderOrderStatusDetails(myOrder);
    }
  } catch (e) {
    console.error('Error polling order status:', e);
  }
}

// Open and show order status details modal
async function showOrderStatus() {
  const lastOrderId = localStorage.getItem('lastOrderId');
  if (!lastOrderId) return;

  orderStatusContent.innerHTML = `<div class="loading-spinner"></div>`;
  orderStatusModal.classList.add('active');

  try {
    const response = await fetch('/api/orders');
    const orders = await response.json();
    const myOrder = orders.find(o => o.id === lastOrderId);

    if (!myOrder) {
      orderStatusContent.innerHTML = `<p class="text-center text-muted">ไม่พบประวัติออเดอร์นี้</p>`;
      return;
    }

    renderOrderStatusDetails(myOrder);
  } catch (error) {
    orderStatusContent.innerHTML = `<p class="text-center text-danger">เกิดข้อผิดพลาดในการดึงข้อมูล</p>`;
  }
}

// Render Order Status inside modal
function renderOrderStatusDetails(order) {
  let statusText = 'กำลังดำเนินการ';
  let statusColor = 'var(--warning)';
  let stepIndex = 1; // 1: sent, 2: cooking/serving/paying, 3: completed

  if (order.status === 'pending') {
    statusText = 'กำลังรอแอดมินยืนยันออเดอร์';
    statusColor = 'var(--warning)';
    stepIndex = 1;
  } else if (order.status === 'completed') {
    statusText = 'เสิร์ฟอาหารเรียบร้อยแล้ว';
    statusColor = 'var(--success)';
    stepIndex = 3;
  } else if (order.status === 'cancelled') {
    statusText = 'ออเดอร์ถูกยกเลิก';
    statusColor = 'var(--danger)';
    stepIndex = 0;
  }

  let paymentText = 'รอชำระเงิน';
  let paymentColor = 'var(--warning)';
  if (order.paymentStatus === 'paid') {
    paymentText = 'ชำระเงินเรียบร้อยแล้ว';
    paymentColor = 'var(--success)';
    if (stepIndex === 1) stepIndex = 2; // Paid but food cooking
  }

  // Generate Items lines
  const itemsHtml = order.items.map(item => `
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
      <span>${item.name} x ${item.quantity}</span>
      <span>฿${(item.price * item.quantity).toLocaleString()}</span>
    </div>
  `).join('');

  orderStatusContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">รหัสออเดอร์: ${order.id}</div>
      <div style="font-size: 1.5rem; font-weight: 700; color: ${statusColor};">${statusText}</div>
      <div style="font-size: 1rem; font-weight: 600; color: ${paymentColor}; margin-top: 0.25rem;">สถานะชำระเงิน: ${paymentText}</div>
    </div>

    <!-- Stepper indicator -->
    <div style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 2rem; position: relative;">
      <div style="position: absolute; height: 2px; background-color: var(--border-color); left: 15%; right: 15%; top: 15px; z-index: 1;"></div>
      
      <div style="text-align: center; z-index: 2;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${stepIndex >= 1 ? 'var(--primary)' : 'var(--bg-input)'}; color: ${stepIndex >= 1 ? 'white' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto 0.5rem auto;">1</div>
        <div style="font-size: 0.75rem; font-weight: 500;">ส่งออเดอร์</div>
      </div>
      
      <div style="text-align: center; z-index: 2;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${stepIndex >= 2 ? 'var(--primary)' : (order.paymentStatus === 'paid' ? 'var(--success)' : 'var(--bg-input)')}; color: ${stepIndex >= 2 || order.paymentStatus === 'paid' ? 'white' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto 0.5rem auto;">2</div>
        <div style="font-size: 0.75rem; font-weight: 500;">ชำระเงิน</div>
      </div>

      <div style="text-align: center; z-index: 2;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${stepIndex >= 3 ? 'var(--success)' : 'var(--bg-input)'}; color: ${stepIndex >= 3 ? 'white' : 'var(--text-muted)'}; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto 0.5rem auto;">3</div>
        <div style="font-size: 0.75rem; font-weight: 500;">ทานอาหาร/เสร็จสิ้น</div>
      </div>
    </div>

    <!-- Items Details Card -->
    <div class="card" style="padding: 1rem; margin-bottom: 1.5rem; background-color: var(--bg-input); border: none;">
      <h4 style="margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">รายละเอียดออเดอร์</h4>
      ${itemsHtml}
      <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem; border-top: 1px dashed var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
        <span>ยอดรวมทั้งหมด:</span>
        <span>฿${order.total.toLocaleString()}</span>
      </div>
    </div>

    ${order.status === 'cancelled' ? `
      <div class="alert-box alert-danger text-center">
        ออเดอร์นี้ถูกยกเลิกโดยแอดมินหรือสินค้าหมด
      </div>
    ` : ''}

    ${order.status === 'completed' && order.paymentStatus === 'paid' ? `
      <div class="alert-box alert-success text-center" style="flex-direction: column; gap: 0.25rem;">
        <span><i class="fa-solid fa-circle-check"></i> ออเดอร์และชำระเงินเรียบร้อยแล้ว</span>
        <button class="btn btn-outline btn-sm mt-4" style="width: 100%; border-color: var(--success); color: var(--success-hover);" onclick="clearSavedOrder()">สั่งใหม่อีกครั้ง / ล้างประวัติ</button>
      </div>
    ` : `
      <p style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">เมื่อชำระเงินที่ร้านเสร็จสิ้น แอดมินจะกดยืนยันการรับชำระเงิน หน้านี้จะอัปเดตโดยอัตโนมัติ</p>
    `}
  `;
}

// Clear order cache in client to allow ordering again
window.clearSavedOrder = function() {
  localStorage.removeItem('lastOrderId');
  orderStatusModal.classList.remove('active');
  checkExistingOrder();
  alert('คุณสามารถเลือกเมนูใหม่และส่งออเดอร์ถัดไปได้แล้วครับ');
};
