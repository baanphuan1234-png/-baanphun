require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const generatePayload = require('promptpay-qr');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.error("❌ ERROR: Supabase credentials (SUPABASE_URL / SUPABASE_KEY) are missing in environment variables.");
  process.exit(1); // Stop execution as Supabase is mandatory now
} else {
  console.log("⚡ Supabase Client initialized successfully.");
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists (local fallback for upload temporary caching)
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("Unable to create uploads directory on startup (read-only environment):", err.message);
}

let inMemoryUploads = {}; // filename -> { buffer, mimeType } (Vercel Serverless in-memory upload cache)

// Helper to fetch settings from Supabase
async function getSettings() {
  try {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (!error && data) {
      return {
        promptPayId: data.prompt_pay_id || '',
        googleSheetsUrl: data.google_sheets_url || ''
      };
    }
  } catch (e) {
    console.error("Failed to read settings from Supabase:", e.message);
  }
  return {
    promptPayId: process.env.PROMPTPAY_ID || '',
    googleSheetsUrl: process.env.GOOGLE_SHEETS_URL || ''
  };
}

// Helper function to call Google Sheet Apps Script API
async function syncWithGoogleSheets(action, payload = null) {
  const settings = await getSettings();
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
    return null;
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

// Settings GET
app.get('/api/settings', async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

// Settings POST
app.post('/api/settings', async (req, res) => {
  const { promptPayId, googleSheetsUrl } = req.body;
  try {
    const { data, error } = await supabase.from('settings').upsert({
      id: 1,
      prompt_pay_id: promptPayId || '',
      google_sheets_url: googleSheetsUrl || ''
    }).select().single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      settings: {
        promptPayId: data.prompt_pay_id,
        googleSheetsUrl: data.google_sheets_url
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'บันทึกการตั้งค่าล้มเหลว: ' + err.message });
  }
});

// Menu Items GET
app.get('/api/menu', async (req, res) => {
  try {
    const { data, error } = await supabase.from('menu').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    
    const formatted = data.map(item => ({
      id: item.id,
      name: item.name,
      price: parseFloat(item.price) || 0,
      stock: parseInt(item.stock) || 0,
      image: item.image || '',
      hasVariants: item.has_variants,
      variants: item.variants || []
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'ดึงข้อมูลเมนูล้มเหลว: ' + err.message });
  }
});

// Menu Item POST
app.post('/api/menu', async (req, res) => {
  const { name, price, stock, image, hasVariants, variants } = req.body;
  const newItem = {
    id: 'item_' + Date.now(),
    name: name || 'Unnamed Item',
    price: parseFloat(price) || 0,
    stock: parseInt(stock) || 0,
    image: image || '',
    has_variants: !!hasVariants,
    variants: Array.isArray(variants) ? variants : []
  };

  try {
    const { error } = await supabase.from('menu').insert(newItem);
    if (error) throw error;

    const responseItem = {
      id: newItem.id,
      name: newItem.name,
      price: newItem.price,
      stock: newItem.stock,
      image: newItem.image,
      hasVariants: newItem.has_variants,
      variants: newItem.variants
    };

    // Google Sheets Sync in background
    syncMenuToSheets().catch(() => {});

    res.json(responseItem);
  } catch (err) {
    res.status(500).json({ error: 'เพิ่มรายการเมนูล้มเหลว: ' + err.message });
  }
});

// Menu Item PUT
app.put('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, stock, image, hasVariants, variants } = req.body;

  const updateObj = {};
  if (name !== undefined) updateObj.name = name;
  if (price !== undefined) updateObj.price = parseFloat(price);
  if (stock !== undefined) updateObj.stock = parseInt(stock);
  if (image !== undefined) updateObj.image = image;
  if (hasVariants !== undefined) updateObj.has_variants = !!hasVariants;
  if (variants !== undefined) updateObj.variants = Array.isArray(variants) ? variants : [];

  try {
    const { data, error } = await supabase.from('menu').update(updateObj).eq('id', id).select().single();
    if (error) throw error;

    const responseItem = {
      id: data.id,
      name: data.name,
      price: parseFloat(data.price) || 0,
      stock: parseInt(data.stock) || 0,
      image: data.image || '',
      hasVariants: data.has_variants,
      variants: data.variants || []
    };

    // Google Sheets Sync in background
    syncMenuToSheets().catch(() => {});

    res.json(responseItem);
  } catch (err) {
    res.status(500).json({ error: 'แก้ไขรายการเมนูล้มเหลว: ' + err.message });
  }
});

// Menu Item DELETE
app.delete('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('menu').delete().eq('id', id);
    if (error) throw error;

    // Google Sheets Sync in background
    syncMenuToSheets().catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'ลบรายการเมนูล้มเหลว: ' + err.message });
  }
});

// Helper for menu sheet sync
async function syncMenuToSheets() {
  try {
    const { data } = await supabase.from('menu').select('*').order('created_at', { ascending: true });
    if (data) {
      const formatted = data.map(item => ({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price) || 0,
        stock: parseInt(item.stock) || 0,
        image: item.image || '',
        hasVariants: item.has_variants,
        variants: item.variants || []
      }));
      await syncWithGoogleSheets('saveMenu', { data: formatted });
    }
  } catch (e) {}
}

// Orders GET
app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
    if (error) throw error;

    const formatted = data.map(order => ({
      id: order.id,
      timestamp: order.timestamp,
      items: order.items,
      total: parseFloat(order.total) || 0,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      table: order.table,
      slipImage: order.slip_image || ''
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'ดึงข้อมูลออเดอร์ล้มเหลว: ' + err.message });
  }
});

// Get Single Order status (for customer tracking)
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error || !data) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์' });
    }

    const formatted = {
      id: data.id,
      timestamp: data.timestamp,
      items: data.items,
      total: parseFloat(data.total) || 0,
      status: data.status,
      paymentStatus: data.payment_status,
      paymentMethod: data.payment_method,
      table: data.table,
      slipImage: data.slip_image || ''
    };
    res.json(formatted);
  } catch (err) {
    res.status(404).json({ error: 'ไม่พบออเดอร์' });
  }
});

// Create Order (customer adds order)
app.post('/api/orders', async (req, res) => {
  const { items, table, paymentMethod } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'ไม่มีสินค้าในออเดอร์' });
  }

  try {
    // 1. Fetch current menu items from Supabase
    const { data: menuData, error: menuError } = await supabase.from('menu').select('*');
    if (menuError) throw menuError;

    // Validate and update stock
    let hasStockError = false;
    const errorItems = [];

    const updatedMenu = menuData.map(menuItem => {
      const orderedItemsForThisProduct = items.filter(item => item.id === menuItem.id);
      
      if (orderedItemsForThisProduct.length > 0) {
        if (menuItem.has_variants && Array.isArray(menuItem.variants)) {
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
          
          const newTotalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
          return {
            ...menuItem,
            variants: updatedVariants,
            stock: newTotalStock
          };
        } else {
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

    // 2. Update stock in Supabase
    const promises = updatedMenu.map(m => {
      return supabase.from('menu').update({
        stock: m.stock,
        variants: m.variants
      }).eq('id', m.id);
    });
    await Promise.all(promises);

    // Calculate order total
    let total = 0;
    const orderItems = items.map(ordered => {
      const original = menuData.find(m => m.id === ordered.id);
      const itemTotal = (original ? parseFloat(original.price) : 0) * ordered.quantity;
      total += itemTotal;
      return {
        id: ordered.id,
        name: original ? original.name : 'Unknown Item',
        price: original ? parseFloat(original.price) : 0,
        quantity: ordered.quantity,
        variant: ordered.variant || ''
      };
    });

    const newOrder = {
      id: 'ord_' + Date.now() + '_' + Math.floor(1000 + Math.random() * 9000),
      timestamp: new Date().toISOString(),
      items: orderItems,
      total: total,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method: paymentMethod || 'โอนเงิน',
      table: table || 'ทั่วไป',
      slip_image: ''
    };

    // 3. Insert order into Supabase
    const { error: orderError } = await supabase.from('orders').insert(newOrder);
    if (orderError) throw orderError;

    // Convert keys for response compatibility
    const responseOrder = {
      id: newOrder.id,
      timestamp: newOrder.timestamp,
      items: newOrder.items,
      total: newOrder.total,
      status: newOrder.status,
      paymentStatus: newOrder.payment_status,
      paymentMethod: newOrder.payment_method,
      table: newOrder.table,
      slipImage: newOrder.slip_image
    };

    // Background sync to Google Sheets
    const formattedMenuForSheets = updatedMenu.map(m => ({
      id: m.id,
      name: m.name,
      price: parseFloat(m.price) || 0,
      stock: parseInt(m.stock) || 0,
      image: m.image || '',
      hasVariants: m.has_variants,
      variants: m.variants || []
    }));
    syncWithGoogleSheets('saveMenu', { data: formattedMenuForSheets }).catch(() => {});
    syncWithGoogleSheets('saveOrder', { data: responseOrder }).catch(() => {});

    res.json(responseOrder);
  } catch (err) {
    res.status(500).json({ error: 'สร้างคำสั่งซื้อล้มเหลว: ' + err.message });
  }
});

// Update Order (Admin/Customer pays, cancels, completes, etc.)
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, slipImage } = req.body;

  try {
    // 1. Fetch current order
    const { data: order, error: orderFetchError } = await supabase.from('orders').select('*').eq('id', id).single();
    if (orderFetchError) throw orderFetchError;

    // Handle cancellation: return items to stock
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const { data: menuData, error: menuFetchError } = await supabase.from('menu').select('*');
      if (menuFetchError) throw menuFetchError;

      const orderItems = order.items;
      const updatedMenu = menuData.map(menuItem => {
        const cancelledItemsForThisProduct = orderItems.filter(item => item.id === menuItem.id);
        
        if (cancelledItemsForThisProduct.length > 0) {
          if (menuItem.has_variants && Array.isArray(menuItem.variants)) {
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
            const totalQuantityToReturn = cancelledItemsForThisProduct.reduce((sum, c) => sum + c.quantity, 0);
            return {
              ...menuItem,
              stock: menuItem.stock + totalQuantityToReturn
            };
          }
        }
        return menuItem;
      });

      // Update stock in Supabase
      const promises = updatedMenu.map(m => {
        return supabase.from('menu').update({
          stock: m.stock,
          variants: m.variants
        }).eq('id', m.id);
      });
      await Promise.all(promises);

      // Sync menu to Sheets
      const formattedMenuForSheets = updatedMenu.map(m => ({
        id: m.id,
        name: m.name,
        price: parseFloat(m.price) || 0,
        stock: parseInt(m.stock) || 0,
        image: m.image || '',
        hasVariants: m.has_variants,
        variants: m.variants || []
      }));
      syncWithGoogleSheets('saveMenu', { data: formattedMenuForSheets }).catch(() => {});
    }

    // 2. Update order in Supabase
    const updateObj = {};
    if (status !== undefined) updateObj.status = status;
    if (paymentStatus !== undefined) updateObj.payment_status = paymentStatus;
    if (slipImage !== undefined) updateObj.slip_image = slipImage;

    const { data: updatedOrder, error: orderUpdateError } = await supabase.from('orders').update(updateObj).eq('id', id).select().single();
    if (orderUpdateError) throw orderUpdateError;

    const responseOrder = {
      id: updatedOrder.id,
      timestamp: updatedOrder.timestamp,
      items: updatedOrder.items,
      total: parseFloat(updatedOrder.total) || 0,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.payment_status,
      paymentMethod: updatedOrder.payment_method,
      table: updatedOrder.table,
      slipImage: updatedOrder.slip_image || ''
    };

    // Sync to Sheets
    syncWithGoogleSheets('saveOrder', { data: responseOrder }).catch(() => {});

    res.json(responseOrder);
  } catch (err) {
    res.status(500).json({ error: 'อัปเดตสถานะออเดอร์ล้มเหลว: ' + err.message });
  }
});

// Delete Order History
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;

    // Trigger full sheets sync in background to update order list
    syncAllOrdersToSheets().catch(() => {});

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'ลบประวัติออเดอร์ล้มเหลว: ' + err.message });
  }
});

// Edit Order Items (Swap products/flavors, change quantities)
app.put('/api/orders/:id/items', async (req, res) => {
  const { id } = req.params;
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid items array' });
  }

  try {
    // 1. Fetch order and menu
    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', id).single();
    if (orderError) throw orderError;

    const { data: menu, error: menuError } = await supabase.from('menu').select('*');
    if (menuError) throw menuError;

    const originalOrderItems = order.items;

    // Step 1: Temporarily add back stock of all items in the original order
    const tempMenu = menu.map(menuItem => {
      const originalItemsForThisProduct = originalOrderItems.filter(item => item.id === menuItem.id);
      if (originalItemsForThisProduct.length > 0) {
        if (menuItem.has_variants && Array.isArray(menuItem.variants)) {
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
        if (menuItem.has_variants && Array.isArray(menuItem.variants)) {
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
      const itemTotal = (original ? parseFloat(original.price) : 0) * ordered.quantity;
      total += itemTotal;
      return {
        id: ordered.id,
        name: original ? original.name : 'Unknown Item',
        price: original ? parseFloat(original.price) : 0,
        quantity: ordered.quantity,
        variant: ordered.variant || ''
      };
    });

    // 2. Update DB
    const stockPromises = updatedMenu.map(m => {
      return supabase.from('menu').update({
        stock: m.stock,
        variants: m.variants
      }).eq('id', m.id);
    });
    await Promise.all(stockPromises);

    const { data: updatedOrder, error: orderUpdateError } = await supabase.from('orders').update({
      items: updatedOrderItems,
      total: total
    }).eq('id', id).select().single();
    if (orderUpdateError) throw orderUpdateError;

    const responseOrder = {
      id: updatedOrder.id,
      timestamp: updatedOrder.timestamp,
      items: updatedOrder.items,
      total: parseFloat(updatedOrder.total) || 0,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.payment_status,
      paymentMethod: updatedOrder.payment_method,
      table: updatedOrder.table,
      slipImage: updatedOrder.slip_image || ''
    };

    // Sheets sync in background
    const formattedMenuForSheets = updatedMenu.map(m => ({
      id: m.id,
      name: m.name,
      price: parseFloat(m.price) || 0,
      stock: parseInt(m.stock) || 0,
      image: m.image || '',
      hasVariants: m.has_variants,
      variants: m.variants || []
    }));
    syncWithGoogleSheets('saveMenu', { data: formattedMenuForSheets }).catch(() => {});
    syncWithGoogleSheets('saveOrder', { data: responseOrder }).catch(() => {});

    res.json(responseOrder);
  } catch (err) {
    res.status(500).json({ error: 'แก้ไขคำสั่งซื้อล้มเหลว: ' + err.message });
  }
});

// Full sheets sync helper
async function syncAllOrdersToSheets() {
  try {
    const { data } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
    if (data) {
      const formatted = data.map(order => ({
        id: order.id,
        timestamp: order.timestamp,
        items: order.items,
        total: parseFloat(order.total) || 0,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        table: order.table,
        slipImage: order.slip_image || ''
      }));
      await syncWithGoogleSheets('saveOrdersList', { data: formatted });
    }
  } catch (e) {}
}

// Generate PromptPay QR
app.get('/api/promptpay-qr', async (req, res) => {
  const amount = parseFloat(req.query.amount);
  const settings = await getSettings();

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
  try {
    const { data: orders, error } = await supabase.from('orders').select('*');
    if (error) throw error;

    const stats = {};
    
    orders.forEach(order => {
      // Process only paid or completed orders
      if (order.payment_status !== 'paid' && order.status !== 'completed') return;

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
          itemsSold: {}
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
  } catch (err) {
    res.status(500).json({ error: 'ดึงสถิติล้มเหลว: ' + err.message });
  }
});

// Export app for Vercel Serverless Functions
module.exports = app;

// Start Server locally if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}
