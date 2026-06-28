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
    tableNumberDisplay.textContent = `จุดบริการที่ ${tableNumber}`;
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
    // Determine stock status and tags
    let stockTagClass = 'stock-ok';
    let stockText = `คงเหลือ: ${item.stock}`;
    let isOutOfStock = item.stock <= 0;
    let addBtnHtml = '';

    if (item.hasVariants && Array.isArray(item.variants)) {
      const totalStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
      isOutOfStock = totalStock <= 0;
      if (isOutOfStock) {
        stockTagClass = 'stock-out';
        stockText = 'สินค้าหมด';
        addBtnHtml = `<button class="btn btn-outline btn-sm" disabled style="width: 100%;">สินค้าหมด</button>`;
      } else {
        if (totalStock <= 5) {
          stockTagClass = 'stock-low';
          stockText = `เหลือเพียง ${totalStock} ชิ้น`;
        } else {
          stockText = `มีตัวเลือก (${totalStock} ชิ้น)`;
        }
        addBtnHtml = `<button class="btn btn-primary btn-sm" style="width: 100%;" onclick="openProductDetailModal('${item.id}')"><i class="fa-solid fa-circle-info"></i> เลือกกลิ่น</button>`;
      }
    } else {
      const qtyInCart = cart[item.id] || 0;
      if (item.stock === 0) {
        stockTagClass = 'stock-out';
        stockText = 'สินค้าหมด';
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
    }

    const itemImageSrc = item.image || 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Product';

    return `
      <div class="menu-item-card" data-id="${item.id}" onclick="handleCardClick(event, '${item.id}')" style="cursor: pointer;">
        <img src="${itemImageSrc}" class="menu-item-img" alt="${item.name}" onerror="this.onerror=null; this.src='https://placehold.co/600x400/f1f5f9/94a3b8?text=Product';">
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

function handleCardClick(event, itemId) {
  if (event.target.closest('.quantity-control') || event.target.closest('.btn') || event.target.closest('.qty-btn')) {
    return;
  }
  openProductDetailModal(itemId);
}

let selectedProductId = null;
let selectedVariantName = null;
let currentDetailQty = 1;

const productDetailModal = document.getElementById('product-detail-modal');
const closeDetailModalBtn = document.getElementById('close-detail-modal-btn');
const detailProductName = document.getElementById('detail-product-name');
const detailProductImage = document.getElementById('detail-product-image');
const detailProductPrice = document.getElementById('detail-product-price');
const detailOverallStock = document.getElementById('detail-overall-stock');
const detailVariantsList = document.getElementById('detail-variants-list');
const detailQtyVal = document.getElementById('detail-qty-val');
const detailQtyMinusBtn = document.getElementById('detail-qty-minus-btn');
const detailQtyPlusBtn = document.getElementById('detail-qty-plus-btn');
const detailAddToCartBtn = document.getElementById('detail-add-to-cart-btn');

function openProductDetailModal(itemId) {
  const item = menuItems.find(m => m.id === itemId);
  if (!item) return;

  selectedProductId = itemId;
  selectedVariantName = null;
  currentDetailQty = 1;

  detailProductName.textContent = item.name;
  detailProductImage.src = item.image || 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Product';
  detailProductPrice.textContent = item.price.toLocaleString();
  detailQtyVal.textContent = '1';

  detailQtyMinusBtn.disabled = true;
  detailQtyPlusBtn.disabled = true;

  if (item.hasVariants && Array.isArray(item.variants)) {
    const totalStock = item.variants.reduce((sum, v) => sum + v.stock, 0);
    detailOverallStock.textContent = `คงเหลือรวม: ${totalStock} ชิ้น`;
    detailAddToCartBtn.disabled = true;

    detailVariantsList.innerHTML = item.variants.map(v => {
      const isOut = v.stock <= 0;
      const classAttr = isOut ? 'variant-pill disabled' : 'variant-pill';
      return `
        <div class="${classAttr}" data-name="${v.name}" onclick="selectVariant(this, '${v.name}', ${v.stock})">
          ${v.name} (${v.stock} ชิ้น)
        </div>
      `;
    }).join('');
    document.getElementById('detail-variants-container').style.display = 'block';
  } else {
    detailOverallStock.textContent = `คงเหลือ: ${item.stock} ชิ้น`;
    detailVariantsList.innerHTML = '';
    document.getElementById('detail-variants-container').style.display = 'none';
    
    selectedVariantName = null;
    detailAddToCartBtn.disabled = item.stock <= 0;
    if (item.stock > 0) {
      detailQtyPlusBtn.disabled = false;
    }
  }

  productDetailModal.classList.add('active');
}

function selectVariant(element, variantName, stock) {
  if (element.classList.contains('disabled')) return;

  const pills = detailVariantsList.querySelectorAll('.variant-pill');
  pills.forEach(p => p.classList.remove('active'));

  element.classList.add('active');
  selectedVariantName = variantName;

  currentDetailQty = 1;
  detailQtyVal.textContent = '1';
  updateDetailQtyControls(stock);

  detailAddToCartBtn.disabled = false;
}

function updateDetailQtyControls(stock) {
  detailQtyMinusBtn.disabled = currentDetailQty <= 1;
  detailQtyPlusBtn.disabled = currentDetailQty >= stock;
}

if (closeDetailModalBtn) {
  closeDetailModalBtn.addEventListener('click', () => {
    productDetailModal.classList.remove('active');
  });
}

if (detailQtyMinusBtn) {
  detailQtyMinusBtn.addEventListener('click', () => {
    if (currentDetailQty > 1) {
      currentDetailQty--;
      detailQtyVal.textContent = currentDetailQty;
      
      const item = menuItems.find(m => m.id === selectedProductId);
      if (item && item.hasVariants) {
        const v = item.variants.find(varObj => varObj.name === selectedVariantName);
        if (v) updateDetailQtyControls(v.stock);
      } else if (item) {
        updateDetailQtyControls(item.stock);
      }
    }
  });
}

if (detailQtyPlusBtn) {
  detailQtyPlusBtn.addEventListener('click', () => {
    const item = menuItems.find(m => m.id === selectedProductId);
    let maxStock = 0;
    if (item) {
      if (item.hasVariants) {
        const v = item.variants.find(varObj => varObj.name === selectedVariantName);
        maxStock = v ? v.stock : 0;
      } else {
        maxStock = item.stock;
      }
    }

    if (currentDetailQty < maxStock) {
      currentDetailQty++;
      detailQtyVal.textContent = currentDetailQty;
      updateDetailQtyControls(maxStock);
    }
  });
}

if (detailAddToCartBtn) {
  detailAddToCartBtn.addEventListener('click', () => {
    if (!selectedProductId) return;

    const cartKey = selectedVariantName ? `${selectedProductId}::${selectedVariantName}` : selectedProductId;
    
    if (cart[cartKey]) {
      cart[cartKey] += currentDetailQty;
    } else {
      cart[cartKey] = currentDetailQty;
    }

    productDetailModal.classList.remove('active');
    updateCartUI();
    renderMenu(menuItems);
    
    if (window.innerWidth <= 900) {
      cartPanel.classList.add('expanded');
      cartChevron.className = "fa-solid fa-chevron-down";
    }
  });
}

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

function addToCart(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item || item.stock <= 0) return;
  
  cart[itemId] = 1;
  updateCartUI();
  renderMenu(menuItems);
}

function updateCartQty(cartKey, change) {
  const [itemId, variantName] = cartKey.split('::');
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  let maxStock = item.stock;
  if (item.hasVariants && Array.isArray(item.variants)) {
    const v = item.variants.find(varObj => varObj.name === variantName);
    maxStock = v ? v.stock : 0;
  }

  const currentQty = cart[cartKey] || 0;
  const newQty = currentQty + change;

  if (newQty <= 0) {
    delete cart[cartKey];
  } else if (newQty <= maxStock) {
    cart[cartKey] = newQty;
  } else {
    alert(`ขออภัย สามารถสั่งซื้อ ${item.name} ${variantName ? '(' + variantName + ')' : ''} ได้สูงสุด ${maxStock} ชิ้น`);
  }

  updateCartUI();
  renderMenu(menuItems);
}

function updateCartUI() {
  const cartKeys = Object.keys(cart);
  
  if (cartKeys.length === 0) {
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

  cartItemsContainer.innerHTML = cartKeys.map(key => {
    const [itemId, variantName] = key.split('::');
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return '';

    const qty = cart[key];
    totalItemsCount += qty;
    totalPrice += item.price * qty;

    const displayName = variantName ? `${item.name} (${variantName})` : item.name;
    
    let maxStock = item.stock;
    if (item.hasVariants && Array.isArray(item.variants)) {
      const v = item.variants.find(varObj => varObj.name === variantName);
      maxStock = v ? v.stock : 0;
    }

    return `
      <div class="cart-item">
        <div class="cart-item-details">
          <div class="cart-item-name">${displayName}</div>
          <div class="cart-item-price">฿${item.price.toLocaleString()} x ${qty}</div>
        </div>
        <div class="quantity-control">
          <button class="qty-btn" onclick="updateCartQty('${key}', -1)">-</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${key}', 1)" ${qty >= maxStock ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join('');

  cartCount.textContent = totalItemsCount;
  cartTotalVal.textContent = totalPrice.toLocaleString();
}

async function submitOrder() {
  const cartKeys = Object.keys(cart);
  if (cartKeys.length === 0) return;

  submitOrderBtn.disabled = true;
  submitOrderBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งคำสั่งซื้อ...`;

  const orderItems = cartKeys.map(key => {
    const [itemId, variantName] = key.split('::');
    return {
      id: itemId,
      quantity: cart[key],
      variant: variantName || ''
    };
  });

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

    cart = {};
    updateCartUI();

    // Save to LocalStorage
    localStorage.setItem('lastOrderId', result.id);
    checkExistingOrder();
    
    // Refresh Menu to update stocks
    await fetchMenu();

    // Show banner and automatically pop up tracking modal with QR code
    showNotification('ส่งรายการสั่งซื้อของคุณเสร็จสิ้น! กำลังแสดงหน้าจอชำระเงิน...');
    setTimeout(() => {
      showOrderStatus();
    }, 800);

    // Close mobile cart panel if open
    cartPanel.classList.remove('expanded');
    cartChevron.className = "fa-solid fa-chevron-up";

  } catch (error) {
    console.error('Submit order error:', error);
    alert(`เกิดข้อผิดพลาดในการสั่งซื้อ: ${error.message}`);
    submitOrderBtn.disabled = false;
    submitOrderBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ยืนยันการสั่งซื้อ`;
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
    statusText = 'ส่งมอบสินค้าเรียบร้อยแล้ว';
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
      <span>${item.name}${item.variant ? ' (' + item.variant + ')' : ''} x ${item.quantity}</span>
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
        <div style="font-size: 0.75rem; font-weight: 500;">รับสินค้า/เสร็จสิ้น</div>
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

    ${order.status !== 'cancelled' && order.paymentStatus === 'unpaid' ? `
      <div id="order-qr-container" style="text-align: center; margin-top: 1rem; display: none;"></div>
      
      ${order.slipImage ? `
        <div style="text-align: center; margin-top: 1rem; border: 1.5px solid var(--border-color); padding: 1.25rem; border-radius: var(--radius-lg); background: var(--bg-input);">
          <div style="font-weight: 600; font-size: 0.95rem; color: var(--success); margin-bottom: 0.75rem;"><i class="fa-solid fa-circle-check"></i> ส่งสลิปโอนเงินแล้ว</div>
          <img src="${order.slipImage}" style="max-width: 100%; max-height: 220px; object-fit: contain; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 0.75rem; box-shadow: var(--shadow-sm);" onerror="this.onerror=null; this.src='https://placehold.co/200x200/f1f5f9/94a3b8?text=SlipNotFound';">
          <div class="slip-upload-wrapper">
            <label for="slip-file-input" class="btn btn-outline btn-sm slip-label" style="cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem; font-size: 0.8rem;">
              <i class="fa-solid fa-cloud-arrow-up"></i> เปลี่ยนสลิปใหม่
            </label>
            <input type="file" id="slip-file-input" accept="image/*" style="display: none;" onchange="uploadPaymentSlip(event, '${order.id}')">
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; font-weight: 500;">สถานะ: รอแอดมินยืนยันยอดเงิน</div>
        </div>
      ` : `
        <div class="slip-upload-wrapper" style="text-align: center; margin-top: 1rem; border: 2px dashed var(--border-color); padding: 1.5rem; border-radius: var(--radius-lg); background-color: var(--bg-card); cursor: pointer; transition: border-color var(--transition);">
          <label for="slip-file-input" class="slip-label" style="cursor: pointer; display: block; width: 100%;">
            <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.25rem; color: var(--primary); margin-bottom: 0.5rem;"></i>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">อัปโหลดสลิปเพื่อยืนยันเงินโอน</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">เมื่อโอนเงินแล้วกรุณาแนบภาพสลิปที่นี่</div>
          </label>
          <input type="file" id="slip-file-input" accept="image/*" style="display: none;" onchange="uploadPaymentSlip(event, '${order.id}')">
        </div>
      `}
    ` : ''}

    ${order.status === 'completed' && order.paymentStatus === 'paid' ? `
      <div class="alert-box alert-success text-center" style="flex-direction: column; gap: 0.25rem;">
        <span><i class="fa-solid fa-circle-check"></i> ออเดอร์และชำระเงินเรียบร้อยแล้ว</span>
        <button class="btn btn-outline btn-sm mt-4" style="width: 100%; border-color: var(--success); color: var(--success-hover);" onclick="clearSavedOrder()">สั่งใหม่อีกครั้ง / ล้างประวัติ</button>
      </div>
    ` : `
      <p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; margin-top: 1rem;">เมื่อชำระเงินเรียบร้อยแล้วและแอดมินกดยืนยันการรับชำระเงิน หน้านี้จะอัปเดตโดยอัตโนมัติ</p>
    `}
  `;

  if (order.paymentStatus === 'unpaid' && order.status !== 'cancelled') {
    setTimeout(() => loadOrderPaymentQR(order.id, order.total), 50);
  }
}

// Load QR code dynamically for the customer
async function loadOrderPaymentQR(orderId, total) {
  const qrContainer = document.getElementById('order-qr-container');
  if (!qrContainer) return;
  
  qrContainer.style.display = 'block';
  qrContainer.innerHTML = `
    <div style="padding: 1rem; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem;"></i>
      <p style="font-size: 0.85rem; margin-top: 0.5rem;">กำลังสร้าง QR Code พร้อมเพย์...</p>
    </div>
  `;
  
  try {
    const response = await fetch(`/api/promptpay-qr?amount=${total}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    
    qrContainer.innerHTML = `
      <div style="background-color: white; border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem; display: inline-block; margin-bottom: 0.75rem; text-align: center; width: 100%; max-width: 280px; box-shadow: var(--shadow-sm); margin-left: auto; margin-right: auto;">
        <img src="${result.qrImage}" style="width: 100%; max-width: 220px; aspect-ratio: 1; display: block; margin: 0 auto 0.75rem auto;" alt="PromptPay QR Code">
        <div style="font-size: 1.35rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">฿${total.toLocaleString()}</div>
        <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">สแกนเพื่อจ่ายเงิน</div>
      </div>
      <div style="margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
        <a class="btn btn-outline btn-sm" style="display: inline-flex; align-items: center; gap: 0.5rem; border-color: var(--primary); color: var(--primary);" href="${result.qrImage}" download="PromptPay-QR-${orderId.slice(-6)}.png">
          <i class="fa-solid fa-download"></i> บันทึกรูปภาพ QR Code
        </a>
      </div>
    `;
  } catch (err) {
    qrContainer.innerHTML = `
      <div style="color: var(--danger); font-size: 0.85rem; padding: 1rem; border: 1px solid var(--danger); border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.05);">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 1.25rem; margin-bottom: 0.25rem;"></i>
        <div>ล้มเหลวในการสร้าง QR Code: ${err.message}</div>
      </div>
    `;
  }
}

// Upload slip logic for customer
window.uploadPaymentSlip = async function(event, orderId) {
  const file = event.target.files[0];
  if (!file) return;

  const container = event.target.closest('.slip-upload-wrapper');
  const label = container.querySelector('.slip-label') || container;
  const originalHtml = label.innerHTML;
  
  label.innerHTML = `
    <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--primary);"></i>
    <div style="font-weight: 600; font-size: 0.9rem; margin-top: 0.5rem;">กำลังอัปโหลดสลิป...</div>
  `;

  const reader = new FileReader();
  reader.readAsDataURL(file);
  
  reader.onload = async () => {
    const base64Data = reader.result;
    
    try {
      // 1. Upload base64 image
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });
      
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadResult.imageUrl) {
        throw new Error(uploadResult.error || 'Failed to upload image');
      }
      
      const imageUrl = uploadResult.imageUrl;
      
      // 2. Put order status update with slipImage URL
      const orderResponse = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slipImage: imageUrl })
      });
      
      const orderResult = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderResult.error || 'Failed to update order with slip');
      }
      
      // Reload order details popup
      showOrderStatus(); 
      
    } catch (err) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
      label.innerHTML = originalHtml;
    }
  };
};

// Clear order cache in client to allow ordering again
window.clearSavedOrder = function() {
  localStorage.removeItem('lastOrderId');
  orderStatusModal.classList.remove('active');
  checkExistingOrder();
  alert('คุณสามารถเลือกเมนูใหม่และส่งออเดอร์ถัดไปได้แล้วครับ');
};
