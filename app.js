// ========================================
// app.js - لوحة التحكم مع حماية المستخدم
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentShopId = null;
let currentUser = null;

// ========================================
// تحميل بيانات المستخدم
// ========================================
function loadUser() {
  const userStr = localStorage.getItem('atmata_user');
  if (!userStr) {
    window.location.href = 'login.html';
    return null;
  }

  try {
    return JSON.parse(userStr);
  } catch (e) {
    localStorage.removeItem('atmata_user');
    window.location.href = 'login.html';
    return null;
  }
}

// ========================================
// تسجيل الخروج
// ========================================
function logout() {
  localStorage.removeItem('atmata_user');
  window.location.href = 'login.html';
}

// ========================================
// تحميل المتجر (متجر المستخدم فقط)
// ========================================
async function loadShops() {
  const { data, error } = await supabaseClient
    .from('shops')
    .select('id, name, emoji, username')
    .eq('id', currentUser.shop_id)
    .single();

  if (error || !data) {
    console.error('خطأ تحميل المتجر:', error);
    document.getElementById('loading').innerHTML = '⚠️ لم يتم العثور على متجرك. تواصل مع الدعم.';
    return;
  }

  const select = document.getElementById('shop-select');
  select.innerHTML = '';

  const option = document.createElement('option');
  option.value = data.id;
  option.textContent = `${data.emoji || '🏪'} ${data.name} (@${data.username})`;
  option.selected = true;
  select.appendChild(option);

  currentShopId = data.id;

  // تحميل تلقائي
  await loadStats(currentShopId);
  await loadOrders(currentShopId);

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

// ========================================
// تحميل الإحصائيات
// ========================================
async function loadStats(shopId) {
  const { data: orders, error } = await supabaseClient
    .from('orders')
    .select('*')
    .eq('shop_id', shopId);

  if (error) {
    console.error('خطأ:', error);
    return;
  }

  const totalOrders = orders.length;
  const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const avgOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.created_at && o.created_at.startsWith(today)).length;

  document.getElementById('total-orders').textContent = totalOrders;
  document.getElementById('total-sales').textContent = totalSales.toLocaleString('ar-DZ');
  document.getElementById('today-orders').textContent = todayOrders;
  document.getElementById('avg-order').textContent = avgOrder.toLocaleString('ar-DZ');
}

// ========================================
// تحميل الطلبات
// ========================================
async function loadOrders(shopId) {
  const { data, error } = await supabaseClient
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('خطأ:', error);
    return;
  }

  const list = document.getElementById('orders-list');
  list.innerHTML = '';

  if (data.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا توجد طلبات بعد</p>';
    return;
  }

  data.forEach(order => {
    const card = document.createElement('div');
    card.className = `order-card ${order.status || 'pending'}`;

    const statusText = {
      pending: '🔵 قيد التحضير',
      shipping: '🟡 في الطريق',
      delivered: '🟢 تم التسليم',
      cancelled: '🔴 ملغى'
    }[order.status] || 'غير معروف';

    let itemsList = '';
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      itemsList = items.map(i => `${i.name} × ${i.quantity}`).join(' | ');
    } catch (e) {
      itemsList = '—';
    }

    card.innerHTML = `
      <div class="order-number">#${order.order_number}</div>
      <div class="order-customer">
        <strong>${order.customer_name || '—'}</strong>
        <small>${order.customer_phone || ''} - ${order.customer_wilaya || ''}</small>
        <small>${itemsList}</small>
      </div>
      <div class="order-total">${(order.total || 0).toLocaleString('ar-DZ')} د.ج</div>
      <div class="order-status status-${order.status || 'pending'}">${statusText}</div>
    `;

    list.appendChild(card);
  });
}

// ========================================
// التهيئة
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  // التحقق من تسجيل الدخول
  currentUser = loadUser();
  if (!currentUser) return;

  // زر تسجيل الخروج
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // تحميل متجر المستخدم
  await loadShops();

  // زر التحديث
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (currentShopId) {
        await loadStats(currentShopId);
        await loadOrders(currentShopId);
      }
    });
  }
});
