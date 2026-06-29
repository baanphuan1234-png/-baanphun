require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const generatePayload = require('promptpay-qr');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("Unable to create directories on startup (likely read-only Vercel environment):", err.message);
}

// Database paths
const MENU_PATH = path.join(DATA_DIR, 'menu.json');
const ORDERS_PATH = path.join(DATA_DIR, 'orders.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

// In-memory fallbacks (essential for Vercel Serverless read-only filesystem)
let inMemoryMenu = [];
let inMemoryOrders = [];
let inMemorySettings = { promptPayId: '', googleSheetsUrl: '' };
let inMemoryUploads = {}; // filename -> { buffer, mimeType }

// Memory cache for Google Sheets responses to boost speed
const cache = {
  menu: { data: null, timestamp: 0 },
  orders: { data: null, timestamp: 0 }
};
const CACHE_DURATION_MENU = 60000; // 60 seconds cache
const CACHE_DURATION_ORDERS = 30000; // 30 seconds cache

// Try to initialize files locally if writeable
try {
  if (!fs.existsSync(MENU_PATH)) fs.writeFileSync(MENU_PATH, JSON.stringify([]));
  if (!fs.existsSync(ORDERS_PATH)) fs.writeFileSync(ORDERS_PATH, JSON.stringify([]));
  if (!fs.existsSync(SETTINGS_PATH)) fs.writeFileSync(SETTINGS_PATH, JSON.stringify({ promptPayId: '', googleSheetsUrl: '' }));
} catch (err) {
  console.warn("Unable to initialize local JSON files (likely read-only Vercel environment):", err.message);
}

// Helper functions for reading/writing local files with Vercel in-memory fallback
const readLocal = (filePath) => {
  try {
    if (filePath === MENU_PATH && inMemoryMenu.length > 0) return inMemoryMenu;
    if (filePath === ORDERS_PATH && inMemoryOrders.length > 0) return inMemoryOrders;
    if (filePath === SETTINGS_PATH && inMemorySettings.promptPayId) {
      return {
        promptPayId: inMemorySettings.promptPayId || process.env.PROMPTPAY_ID || '',
        googleSheetsUrl: inMemorySettings.googleSheetsUrl || process.env.GOOGLE_SHEETS_URL || ''
      };
    }

    if (!fs.existsSync(filePath)) {
      if (filePath === SETTINGS_PATH) {
        return {
          promptPayId: process.env.PROMPTPAY_ID || '',
          googleSheetsUrl: process.env.GOOGLE_SHEETS_URL || ''
        };
      }
      return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (filePath === SETTINGS_PATH) {
      return {
        promptPayId: data.promptPayId || process.env.PROMPTPAY_ID || '',
        googleSheetsUrl: data.googleSheetsUrl || process.env.GOOGLE_SHEETS_URL || ''
      };
    }
    return data;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    if (filePath === MENU_PATH) return inMemoryMenu;
    if (filePath === ORDERS_PATH) return inMemoryOrders;
    if (filePath === SETTINGS_PATH) {
      return {
        promptPayId: inMemorySettings.promptPayId || process.env.PROMPTPAY_ID || '',
        googleSheetsUrl: inMemorySettings.googleSheetsUrl || process.env.GOOGLE_SHEETS_URL || ''
      };
    }
    return [];
  }
};

const writeLocal = (filePath, data) => {
  // Always update the in-memory cache
  if (filePath === MENU_PATH) inMemoryMenu = data;
  if (filePath === ORDERS_PATH) inMemoryOrders = data;
  if (filePath === SETTINGS_PATH) inMemorySettings = data;

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn(`Disk write failed for ${filePath} (falling back to memory):`, err.message);
  }
};

// Helper function to call Google Sheet Apps Script API
async function syncWithGoogleSheets(action, payload = null) {
  const settings = readLocal(SETTINGS_PATH);
  if (!settings.googleSheetsUrl) return null;

  try {
    if (payload) {
      // POST Request
      const response = await fetch(settings.googleSheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      return await response.json();
    } else {
      // GET Request
      const url = `${settings.googleSheetsUrl}?action=${action}`;
      const response = await fetch(url);
      return await response.json();
    }
  } catch (err) {
    console.error(`Google Sheets Sync Error [Action: ${action}]:`, err.message);
    return null; // Return null so caller knows it failed and can fallback
  }
}

// --- API ENDPOINTS ---

// Admin Authentication (Login)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const correctUser = process.env.ADMIN_USERNAME || 'admin';
  const correctPass = process.env.ADMIN_PASSWORD || 'admin1234';

  if (username === correctUser && password === correctPass) {
    res.json({ success: true, token: 'admin_session_token_' + Date.now() });
  } else {
    res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
});

// Settings
app.get('/api/settings', (req, res) => {
  const settings = readLocal(SETTINGS_PATH);
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const { promptPayId, googleSheetsUrl } = req.body;
  const settings = {
    promptPayId: promptPayId || process.env.PROMPTPAY_ID || '',
    googleSheetsUrl: googleSheetsUrl || process.env.GOOGLE_SHEETS_URL || ''
  };
  writeLocal(SETTINGS_PATH, settings);
  res.json({ success: true, settings });
});

// Menu Items (Read, Create, Update, Delete)
app.get('/api/menu', async (req, res) => {
  const localMenu = readLocal(MENU_PATH);
  res.json(localMenu); // Respond instantly with local data

  const now = Date.now();
  if (!cache.menu.data || (now - cache.menu.timestamp >= CACHE_DURATION_MENU)) {
    syncWithGoogleSheets('getMenu').then(sheetMenu => {
      if (sheetMenu && Array.isArray(sheetMenu)) {
        const formattedMenu = sheetMenu.map(item => ({
          id: String(item.id),
          name: String(item.name),
          price: parseFloat(item.price) || 0,
          stock: parseInt(item.stock) || 0,
          image: String(item.image || ''),
          hasVariants: item.hasVariants === 'true' || item.hasVariants === true,
          variants: item.variants ? (typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants) : []
        }));
        writeLocal(MENU_PATH, formattedMenu);
        cache.menu = { data: formattedMenu, timestamp: Date.now() };
      }
    }).catch(err => console.error("Menu revalidation failed:", err));
  }
});

app.post('/api/menu', async (req, res) => {
  const { name, price, stock, image, hasVariants, variants } = req.body;
  const menu = readLocal(MENU_PATH);
  
  const newItem = {
    id: 'item_' + Date.now(),
    name: name || 'Unnamed Item',
    price: parseFloat(price) || 0,
    stock: parseInt(stock) || 0,
    image: image || '',
    hasVariants: !!hasVariants,
    variants: Array.isArray(variants) ? variants : []
  };
  
  menu.push(newItem);
  writeLocal(MENU_PATH, menu);
  
  // Invalidate cache
  cache.menu.timestamp = 0;
  
  // Sync to Google Sheets in background
  syncWithGoogleSheets('saveMenu', { data: menu }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveMenu):", err)
  );
  
  res.json(newItem);
});

app.put('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, stock, image, hasVariants, variants } = req.body;
  const menu = readLocal(MENU_PATH);
  
  const itemIndex = menu.findIndex(item => item.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  menu[itemIndex] = {
    ...menu[itemIndex],
    name: name !== undefined ? name : menu[itemIndex].name,
    price: price !== undefined ? parseFloat(price) : menu[itemIndex].price,
    stock: stock !== undefined ? parseInt(stock) : menu[itemIndex].stock,
    image: image !== undefined ? image : menu[itemIndex].image,
    hasVariants: hasVariants !== undefined ? !!hasVariants : menu[itemIndex].hasVariants,
    variants: variants !== undefined ? (Array.isArray(variants) ? variants : []) : menu[itemIndex].variants
  };
  
  writeLocal(MENU_PATH, menu);
  
  // Invalidate cache
  cache.menu.timestamp = 0;
  
  // Sync to Google Sheets in background
  syncWithGoogleSheets('saveMenu', { data: menu }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveMenu):", err)
  );
  
  res.json(menu[itemIndex]);
});

app.delete('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  let menu = readLocal(MENU_PATH);
  
  menu = menu.filter(item => item.id !== id);
  writeLocal(MENU_PATH, menu);
  
  // Invalidate cache
  cache.menu.timestamp = 0;
  
  // Sync to Google Sheets in background
  syncWithGoogleSheets('saveMenu', { data: menu }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveMenu):", err)
  );
  
  res.json({ success: true });
});

// Orders
app.get('/api/orders', async (req, res) => {
  const localOrders = readLocal(ORDERS_PATH);
  res.json(localOrders); // Respond instantly with local data

  const now = Date.now();
  if (!cache.orders.data || (now - cache.orders.timestamp >= CACHE_DURATION_ORDERS)) {
    syncWithGoogleSheets('getOrders').then(sheetOrders => {
      if (sheetOrders && Array.isArray(sheetOrders)) {
        writeLocal(ORDERS_PATH, sheetOrders);
        cache.orders = { data: sheetOrders, timestamp: Date.now() };
      }
    }).catch(err => console.error("Orders revalidation failed:", err));
  }
});

// Get Single Order (for customer status check)
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const orders = readLocal(ORDERS_PATH);
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Create Order (customer adds order)
app.post('/api/orders', async (req, res) => {
  const { items, table, paymentMethod } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in order' });
  }

  const menu = readLocal(MENU_PATH);
  const orders = readLocal(ORDERS_PATH);

  // Validate and update stock
  let hasStockError = false;
  const errorItems = [];

  const updatedMenu = menu.map(menuItem => {
    // Filter all order entries matching this menuItem.id
    const orderedItemsForThisProduct = items.filter(item => item.id === menuItem.id);
    
    if (orderedItemsForThisProduct.length > 0) {
      if (menuItem.hasVariants && Array.isArray(menuItem.variants)) {
        // This product has variants. We must check and deduct stock for each ordered variant.
        const updatedVariants = menuItem.variants.map(v => {
          const orderedVariant = orderedItemsForThisProduct.find(o => o.variant === v.name);
          if (orderedVariant) {
            if (v.stock < orderedVariant.quantity) {
              hasStockError = true;
              errorItems.push(`${menuItem.name} (${v.name}) สต็อกเหลือ ${v.stock}`);
            } else {
              return { ...v, stock: v.stock - orderedVariant.quantity };
            }
          }
          return v;
        });
        
        // Calculate total stock as sum of variants stock
        const newTotalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
        return {
          ...menuItem,
          variants: updatedVariants,
          stock: newTotalStock
        };
      } else {
        // Product has no variants. Deduct top-level stock.
        const totalQuantityOrdered = orderedItemsForThisProduct.reduce((sum, o) => sum + o.quantity, 0);
        if (menuItem.stock < totalQuantityOrdered) {
          hasStockError = true;
          errorItems.push(`${menuItem.name} สต็อกเหลือ ${menuItem.stock}`);
        } else {
          return {
            ...menuItem,
            stock: menuItem.stock - totalQuantityOrdered
          };
        }
      }
    }
    return menuItem;
  });

  if (hasStockError) {
    return res.status(400).json({ error: `สินค้าหมดหรือสต็อกไม่พอ: ${errorItems.join(', ')}` });
  }

  // Save stock change locally and to sheet in background
  writeLocal(MENU_PATH, updatedMenu);
  syncWithGoogleSheets('saveMenu', { data: updatedMenu }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveMenu):", err)
  );

  // Calculate order total
  let total = 0;
  const orderItems = items.map(ordered => {
    const original = menu.find(m => m.id === ordered.id);
    const itemTotal = (original ? original.price : 0) * ordered.quantity;
    total += itemTotal;
    return {
      id: ordered.id,
      name: original ? original.name : 'Unknown Item',
      price: original ? original.price : 0,
      quantity: ordered.quantity,
      variant: ordered.variant || '' // Keep track of selected variant/flavor
    };
  });

  const newOrder = {
    id: 'ord_' + Date.now() + '_' + Math.floor(1000 + Math.random() * 9000),
    timestamp: new Date().toISOString(),
    items: orderItems,
    total: total,
    status: 'pending', // pending, completed, cancelled
    paymentStatus: 'unpaid', // unpaid, paid
    table: table || 'ทั่วไป',
    paymentMethod: paymentMethod || 'โอนเงิน',
    slipImage: ''
  };

  orders.push(newOrder);
  writeLocal(ORDERS_PATH, orders);

  // Invalidate caches
  cache.orders.timestamp = 0;
  cache.menu.timestamp = 0;

  // Sync to Google Sheets in background
  syncWithGoogleSheets('saveOrder', { data: newOrder }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveOrder):", err)
  );

  res.json(newOrder);
});

// Update Order (Admin/Customer pays, cancels, completes, etc.)
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, slipImage } = req.body;
  const orders = readLocal(ORDERS_PATH);

  const orderIndex = orders.findIndex(o => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Handle cancellation: return items to stock
  if (status === 'cancelled' && orders[orderIndex].status !== 'cancelled') {
    const menu = readLocal(MENU_PATH);
    const orderItems = orders[orderIndex].items;
    
    const updatedMenu = menu.map(menuItem => {
      const cancelledItemsForThisProduct = orderItems.filter(item => item.id === menuItem.id);
      
      if (cancelledItemsForThisProduct.length > 0) {
        if (menuItem.hasVariants && Array.isArray(menuItem.variants)) {
          // Return stock to each specific variant
          const updatedVariants = menuItem.variants.map(v => {
            const cancelledVar = cancelledItemsForThisProduct.find(c => c.variant === v.name);
            if (cancelledVar) {
              return { ...v, stock: v.stock + cancelledVar.quantity };
            }
            return v;
          });
          const newTotalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
          return {
            ...menuItem,
            variants: updatedVariants,
            stock: newTotalStock
          };
        } else {
          // Return stock to top-level
          const totalQuantityToReturn = cancelledItemsForThisProduct.reduce((sum, c) => sum + c.quantity, 0);
          return {
            ...menuItem,
            stock: menuItem.stock + totalQuantityToReturn
          };
        }
      }
      return menuItem;
    });

    writeLocal(MENU_PATH, updatedMenu);
    syncWithGoogleSheets('saveMenu', { data: updatedMenu }).catch(err => 
      console.error("Google Sheets Background Sync Error (saveMenu):", err)
    );
  }

  orders[orderIndex] = {
    ...orders[orderIndex],
    status: status !== undefined ? status : orders[orderIndex].status,
    paymentStatus: paymentStatus !== undefined ? paymentStatus : orders[orderIndex].paymentStatus,
    slipImage: slipImage !== undefined ? slipImage : orders[orderIndex].slipImage
  };

  orders.forEach(order => {
     if (order.id === id) {
       order.status = orders[orderIndex].status;
       order.paymentStatus = orders[orderIndex].paymentStatus;
       order.slipImage = orders[orderIndex].slipImage;
     }
  });

  writeLocal(ORDERS_PATH, orders);

  // Invalidate caches
  cache.orders.timestamp = 0;
  cache.menu.timestamp = 0; // stock could return if cancelled

  // Sync to Google Sheets in background
  syncWithGoogleSheets('saveOrder', { data: orders[orderIndex] }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveOrder):", err)
  );

  res.json(orders[orderIndex]);
});

// Delete Order History
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  let orders = readLocal(ORDERS_PATH);

  orders = orders.filter(o => o.id !== id);
  writeLocal(ORDERS_PATH, orders);

  // Invalidate cache
  cache.orders.timestamp = 0;

  // Sync to Google Sheets by overwriting orders list in background
  syncWithGoogleSheets('saveOrdersList', { data: orders }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveOrdersList):", err)
  );

  res.json({ success: true });
});

// Edit Order Items (Swap products/flavors, change quantities)
app.put('/api/orders/:id/items', async (req, res) => {
  const { id } = req.params;
  const { items } = req.body; // array of { id, quantity, variant }
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid items array' });
  }

  const orders = readLocal(ORDERS_PATH);
  const orderIndex = orders.findIndex(o => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = orders[orderIndex];
  const menu = readLocal(MENU_PATH);
  const originalOrderItems = order.items;

  // Step 1: Temporarily add back stock of all items in the original order
  const tempMenu = menu.map(menuItem => {
    const originalItemsForThisProduct = originalOrderItems.filter(item => item.id === menuItem.id);
    if (originalItemsForThisProduct.length > 0) {
      if (menuItem.hasVariants && Array.isArray(menuItem.variants)) {
        const updatedVariants = menuItem.variants.map(v => {
          const originalVar = originalItemsForThisProduct.find(o => o.variant === v.name);
          if (originalVar) {
            return { ...v, stock: v.stock + originalVar.quantity };
          }
          return v;
        });
        const newTotalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
        return { ...menuItem, variants: updatedVariants, stock: newTotalStock };
      } else {
        const totalQuantityToReturn = originalItemsForThisProduct.reduce((sum, o) => sum + o.quantity, 0);
        return { ...menuItem, stock: menuItem.stock + totalQuantityToReturn };
      }
    }
    return menuItem;
  });

  // Step 2: Validate and deduct stock for the new items list from the tempMenu
  let hasStockError = false;
  const errorItems = [];

  const updatedMenu = tempMenu.map(menuItem => {
    const newItemsForThisProduct = items.filter(item => item.id === menuItem.id);
    if (newItemsForThisProduct.length > 0) {
      if (menuItem.hasVariants && Array.isArray(menuItem.variants)) {
        const updatedVariants = menuItem.variants.map(v => {
          const newItemVar = newItemsForThisProduct.find(n => n.variant === v.name);
          if (newItemVar) {
            if (v.stock < newItemVar.quantity) {
              hasStockError = true;
              errorItems.push(`${menuItem.name} (${v.name}) สต็อกเหลือ ${v.stock}`);
            } else {
              return { ...v, stock: v.stock - newItemVar.quantity };
            }
          }
          return v;
        });
        const newTotalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
        return { ...menuItem, variants: updatedVariants, stock: newTotalStock };
      } else {
        const totalQuantityOrdered = newItemsForThisProduct.reduce((sum, n) => sum + n.quantity, 0);
        if (menuItem.stock < totalQuantityOrdered) {
          hasStockError = true;
          errorItems.push(`${menuItem.name} สต็อกเหลือ ${menuItem.stock}`);
        } else {
          return { ...menuItem, stock: menuItem.stock - totalQuantityOrdered };
        }
      }
    }
    return menuItem;
  });

  if (hasStockError) {
    return res.status(400).json({ error: `สต็อกสินค้าไม่พอ: ${errorItems.join(', ')}` });
  }

  // Calculate order total
  let total = 0;
  const updatedOrderItems = items.map(ordered => {
    const original = menu.find(m => m.id === ordered.id);
    const itemTotal = (original ? original.price : 0) * ordered.quantity;
    total += itemTotal;
    return {
      id: ordered.id,
      name: original ? original.name : 'Unknown Item',
      price: original ? original.price : 0,
      quantity: ordered.quantity,
      variant: ordered.variant || ''
    };
  });

  // Update menu and order
  orders[orderIndex] = {
    ...orders[orderIndex],
    items: updatedOrderItems,
    total: total
  };

  // Write changes locally
  writeLocal(MENU_PATH, updatedMenu);
  writeLocal(ORDERS_PATH, orders);

  // Invalidate caches
  cache.orders.timestamp = 0;
  cache.menu.timestamp = 0;

  // Sync to Google Sheets in background
  syncWithGoogleSheets('saveMenu', { data: updatedMenu }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveMenu):", err)
  );
  syncWithGoogleSheets('saveOrder', { data: orders[orderIndex] }).catch(err => 
    console.error("Google Sheets Background Sync Error (saveOrder):", err)
  );

  res.json(orders[orderIndex]);
});

// Generate PromptPay QR
app.get('/api/promptpay-qr', async (req, res) => {
  const amount = parseFloat(req.query.amount);
  const settings = readLocal(SETTINGS_PATH);

  if (!settings.promptPayId) {
    return res.status(400).json({ error: 'ไม่ได้ตั้งค่าเบอร์พร้อมเพย์ในแผงควบคุมแอดมิน' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });
  }

  try {
    const payload = generatePayload(settings.promptPayId, { amount });
    const qrImage = await QRCode.toDataURL(payload);
    res.json({ qrImage, payload });
  } catch (err) {
    console.error('PromptPay QR Generation Error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้าง QR Code ได้' });
  }
});

// Generic QR Code Generator (For Table URLs)
app.get('/api/qr', async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.status(400).json({ error: 'กรุณาระบุข้อความ/ลิงก์สำหรับสร้าง QR Code' });
  }
  try {
    const qrImage = await QRCode.toDataURL(text);
    res.json({ qrImage });
  } catch (err) {
    console.error('QR Generation Error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้าง QR Code ได้' });
  }
});

// Route to serve uploaded images (supports both disk and in-memory Vercel fallback)
app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(UPLOADS_DIR, filename);
  
  if (fs.existsSync(filepath)) {
    return res.sendFile(filepath);
  }
  
  const cached = inMemoryUploads[filename];
  if (cached) {
    res.setHeader('Content-Type', cached.mimeType);
    return res.send(cached.buffer);
  }
  
  res.status(404).send('ไม่พบรูปภาพ');
});

// Image Upload (Base64)
app.post('/api/upload', (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  // Extract base64 data and file type
  const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return res.status(400).json({ error: 'Invalid base64 image format' });
  }

  const imageBuffer = Buffer.from(matches[2], 'base64');
  const mimeType = `image/${matches[1] === 'jpeg' ? 'jpeg' : matches[1]}`;
  const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const filename = `img_${Date.now()}.${extension}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  // Store in memory cache
  inMemoryUploads[filename] = {
    buffer: imageBuffer,
    mimeType: mimeType
  };

  try {
    fs.writeFileSync(filepath, imageBuffer);
  } catch (err) {
    console.warn('Disk write failed for upload (falling back to memory):', err.message);
  }
  
  const fileUrl = `/uploads/${filename}`;
  res.json({ imageUrl: fileUrl });
});

// Daily Sales Statistics Summary
app.get('/api/stats', async (req, res) => {
  // Use local orders directly (kept in sync via SWR in the background)
  const orders = readLocal(ORDERS_PATH);

  const stats = {};
  
  orders.forEach(order => {
    // Process only paid or completed orders
    if (order.paymentStatus !== 'paid' && order.status !== 'completed') return;

    // Extract date in YYYY-MM-DD format based on local time
    const dateObj = new Date(order.timestamp);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const localDate = `${yyyy}-${mm}-${dd}`;

    if (!stats[localDate]) {
      stats[localDate] = {
        totalRevenue: 0,
        orderCount: 0,
        itemsSold: {} // itemName -> quantity
      };
    }

    stats[localDate].totalRevenue += parseFloat(order.total) || 0;
    stats[localDate].orderCount += 1;

    // Support items parsing (if sheet returned items as string or array)
    let items = order.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }

    if (Array.isArray(items)) {
      items.forEach(item => {
        if (!stats[localDate].itemsSold[item.name]) {
          stats[localDate].itemsSold[item.name] = 0;
        }
        stats[localDate].itemsSold[item.name] += parseInt(item.quantity) || 0;
      });
    }
  });

  res.json(stats);
});

// Export app for Vercel Serverless Functions
module.exports = app;

// Start Server locally if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}
