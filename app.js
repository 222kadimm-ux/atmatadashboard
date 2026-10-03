const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentShopId = null;

async function loadShops() {
  const { data, error } = await supabaseClient
    .from('shops')
    .select('id, name, emoji, username')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('خطأ:', error);
    return;
  }

  const select = document.getElementById('shop-select');
  select.innerHTML = '<option value="">-- اختر متجراً --</option>';

  data.forEach(shop => {
    const option = document.createElement('option');
    option.value = shop.id;
    option.textContent = `${shop.emoji || '🏪'} ${shop.name} (@${shop.username})`;
    select.appendChild(option);
  });
}

async function loadStats(shopId) {
  const { data: orders, error } = await supabaseClient
    .from('orders')
    .select('*')
    .eq('shop_id', shopId);

  if (error) return;

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

async function loadOrders(shopId) {
  const { data, error } = await supabaseClient
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return;

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

document.addEventListener('DOMContentLoaded', async () => {
  await loadShops();

  document.getElementById('shop-select').addEventListener('change', async (e) => {
    const shopId = e.target.value;

    if (!shopId) {
      document.getElementById('dashboard').classList.add('hidden');
      return;
    }

    currentShopId = shopId;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    await loadStats(shopId);
    await loadOrders(shopId);

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  });

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    if (currentShopId) {
      await loadStats(currentShopId);
      await loadOrders(currentShopId);
    }
  });
});
