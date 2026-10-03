// ========================================
// app.js - لوحة التحكم مع إحصائيات متقدمة
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentShopId = null;
let currentUser = null;
let salesChart = null;

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
// تحميل المتجر
// ========================================
async function loadShop() {
  const { data, error } = await supabaseClient
    .from('shops')
    .select('id, name, emoji, username')
    .eq('id', currentUser.shop_id)
    .single();

  if (error || !data) {
    console.error('خطأ تحميل المتجر:', error);
    document.getElementById('loading').innerHTML = '⚠️ لم يتم العثور على متجرك.';
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
}

// ========================================
// تحميل الإحصائيات المتقدمة
// ========================================
async function loadAdvancedStats() {
  try {
    const { data, error } = await supabaseClient
      .rpc('get_shop_advanced_stats', { shop_id_input: currentShopId });

    if (error) throw error;

    const stats = data;

    document.getElementById('total-orders').textContent = stats.total_orders || 0;
    document.getElementById('total-sales').textContent = (stats.total_sales || 0).toLocaleString('ar-DZ');
    document.getElementById('today-orders').textContent = stats.today_orders || 0;
    document.getElementById('avg-order').textContent = Math.round(stats.avg_order || 0).toLocaleString('ar-DZ');

    document.getElementById('week-orders').textContent = stats.week_orders || 0;
    document.getElementById('week-sales').textContent = (stats.week_sales || 0).toLocaleString('ar-DZ');
    document.getElementById('month-orders').textContent = stats.month_orders || 0;
    document.getElementById('month-sales').textContent = (stats.month_sales || 0).toLocaleString('ar-DZ');

  } catch (err) {
    console.error('خطأ الإحصائيات:', err);
  }
}

// ========================================
// رسم بياني للمبيعات
// ========================================
async function loadSalesChart() {
  try {
    const { data, error } = await supabaseClient
      .rpc('get_daily_sales', { shop_id_input: currentShopId });

    if (error) throw error;

    const labels = [];
    const salesData = [];

    // آخر 7 أيام
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = (data || []).find(d => d.date && d.date.startsWith(dateStr));
      labels.push(date.toLocaleDateString('ar-DZ', { weekday: 'short', day: 'numeric' }));
      salesData.push(dayData ? dayData.sales : 0);
    }

    const ctx = document.getElementById('sales-chart').getContext('2d');

    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'المبيعات (د.ج)',
          data: salesData,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#667eea',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toLocaleString('ar-DZ');
              }
            }
          }
        }
      }
    });

  } catch (err) {
    console.error('خطأ الرسم:', err);
  }
}

// ========================================
// المنتجات الأكثر مبيعاً
// ========================================
async function loadTopProducts() {
  try {
    const { data, error } = await supabaseClient
      .rpc('get_top_products', { shop_id_input: currentShopId });

    if (error) throw error;

    const container = document.getElementById('top-products');
    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا توجد بيانات بعد</p>';
      return;
    }

    data.forEach((product, index) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || '•';
      const card = document.createElement('div');
      card.className = 'top-card';
      card.innerHTML = `
        <div class="top-rank">${medal}</div>
        <div class="top-name">${product.name}</div>
        <div class="top-stat">${product.total_quantity} مبيعة</div>
        <div class="top-revenue">${(product.total_revenue || 0).toLocaleString('ar-DZ')} د.ج</div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error('خطأ المنتجات:', err);
  }
}

// ========================================
// العملاء الأكثر شراءً
// ========================================
async function loadTopCustomers() {
  try {
    const { data, error } = await supabaseClient
      .rpc('get_top_customers', { shop_id_input: currentShopId });

    if (error) throw error;

    const container = document.getElementById('top-customers');
    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا توجد بيانات بعد</p>';
      return;
    }

    data.forEach((customer, index) => {
      const medal = ['👑', '⭐', '🌟', '✨', '💫'][index] || '•';
      const card = document.createElement('div');
      card.className = 'top-card';
      card.innerHTML = `
        <div class="top-rank">${medal}</div>
        <div class="top-name">
          ${customer.customer_name}
          <small style="display:block;color:#888;font-weight:normal;">${customer.customer_phone || ''}</small>
        </div>
        <div class="top-stat">${customer.orders_count} طلب</div>
        <div class="top-revenue">${(customer.total_spent || 0).toLocaleString('ar-DZ')} د.ج</div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error('خطأ العملاء:', err);
  }
}

// ========================================
// الطلبات الأخيرة
// ========================================
async function loadOrders() {
  const { data, error } = await supabaseClient
    .from('orders')
    .select('*')
    .eq('shop_id', currentShopId)
    .order('created_at', { ascending: false })
    .limit(10);

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
// تحميل كل شيء
// ========================================
async function loadAll() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');

  await loadShop();
  if (!currentShopId) return;

  await Promise.all([
    loadAdvancedStats(),
    loadSalesChart(),
    loadTopProducts(),
    loadTopCustomers(),
    loadOrders()
  ]);

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

// ========================================
// التهيئة
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = loadUser();
  if (!currentUser) return;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  await loadAll();

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAll);
  }
});
