// ========================================
// admin.js - لوحة الإدارة
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// تشفير كلمة المرور
// ========================================
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'atmata_admin_salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ========================================
// تسجيل دخول الإدارة
// ========================================
async function handleAdminLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');
  const btn = document.getElementById('login-btn');

  errorMsg.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ التحقق...';

  try {
    const passwordHash = await hashPassword(password);

    const { data, error } = await supabaseClient
      .from('admins')
      .select('id, email, password_hash')
      .eq('email', email)
      .single();

    if (error || !data) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    if (data.password_hash !== passwordHash) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    localStorage.setItem('atmata_admin', JSON.stringify({
      id: data.id,
      email: data.email,
      login_at: new Date().toISOString()
    }));

    window.location.href = 'admin.html';

  } catch (err) {
    console.error('خطأ:', err);
    errorMsg.textContent = '⚠️ ' + err.message;
    errorMsg.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🔐 دخول الإدارة';
  }
}

// ========================================
// تسجيل خروج الإدارة
// ========================================
function adminLogout() {
  localStorage.removeItem('atmata_admin');
  window.location.href = 'admin-login.html';
}

// ========================================
// تحميل الإحصائيات العامة
// ========================================
async function loadGlobalStats() {
  try {
    const { data: shops } = await supabaseClient.from('shops').select('id');
    const { data: orders } = await supabaseClient.from('orders').select('total');
    const { data: users } = await supabaseClient.from('users').select('id');

    const totalShops = shops?.length || 0;
    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
    const totalUsers = users?.length || 0;

    document.getElementById('total-shops').textContent = totalShops;
    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('total-revenue').textContent = totalRevenue.toLocaleString('ar-DZ');
    document.getElementById('total-users').textContent = totalUsers;
  } catch (err) {
    console.error('خطأ:', err);
  }
}

// ========================================
// تحميل المتاجر
// ========================================
async function loadShops() {
  try {
    const { data, error } = await supabaseClient
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = document.getElementById('shops-list');
    list.innerHTML = '';

    if (!data || data.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا توجد متاجر</p>';
      return;
    }

    data.forEach(shop => {
      const card = document.createElement('div');
      card.className = 'data-card';
      card.innerHTML = `
        <div>
          <div class="label">المتجر</div>
          <div class="value">${shop.emoji || '🏪'} ${shop.name}</div>
        </div>
        <div>
          <div class="label">اسم المستخدم</div>
          <div class="value">@${shop.username}</div>
        </div>
        <div>
          <div class="label">الهاتف</div>
          <div class="value">${shop.phone || '—'}</div>
        </div>
        <div>
          <div class="label">الخطة</div>
          <div class="value">
            <span class="badge badge-${shop.plan || 'free'}">
              ${shop.plan === 'pro' ? '👑 احترافي' : shop.plan === 'basic' ? '⭐ أساسي' : '🆓 مجاني'}
            </span>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('خطأ:', err);
  }
}

// ========================================
// تحميل الطلبات
// ========================================
async function loadOrders() {
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const list = document.getElementById('orders-list');
    list.innerHTML = '';

    if (!data || data.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا توجد طلبات</p>';
      return;
    }

    data.forEach(order => {
      const card = document.createElement('div');
      card.className = 'data-card';
      const statusText = {
        pending: '🔵 قيد التحضير',
        shipping: '🟡 في الطريق',
        delivered: '🟢 تم التسليم',
        cancelled: '🔴 ملغى'
      }[order.status] || '—';

      card.innerHTML = `
        <div>
          <div class="label">رقم الطلب</div>
          <div class="value">#${order.order_number}</div>
        </div>
        <div>
          <div class="label">العميل</div>
          <div class="value">${order.customer_name || '—'}</div>
        </div>
        <div>
          <div class="label">المجموع</div>
          <div class="value">${(order.total || 0).toLocaleString('ar-DZ')} د.ج</div>
        </div>
        <div>
          <div class="label">الحالة</div>
          <div class="value">
            <span class="badge badge-${order.status || 'pending'}">${statusText}</span>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('خطأ:', err);
  }
}

// ========================================
// تحميل المستخدمين
// ========================================
async function loadUsers() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = document.getElementById('users-list');
    list.innerHTML = '';

    if (!data || data.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا يوجد مستخدمون</p>';
      return;
    }

    data.forEach(user => {
      const card = document.createElement('div');
      card.className = 'data-card';
      card.innerHTML = `
        <div>
          <div class="label">البريد</div>
          <div class="value">${user.email}</div>
        </div>
        <div>
          <div class="label">Shop ID</div>
          <div class="value">#${user.shop_id || '—'}</div>
        </div>
        <div>
          <div class="label">تاريخ التسجيل</div>
          <div class="value">${new Date(user.created_at).toLocaleDateString('ar-DZ')}</div>
        </div>
        <div>
          <div class="label">آخر دخول</div>
          <div class="value">${user.last_login ? new Date(user.last_login).toLocaleDateString('ar-DZ') : '—'}</div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('خطأ:', err);
  }
}

// ========================================
// التهيئة
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  // صفحة تسجيل الدخول
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleAdminLogin);
    return;
  }

  // صفحة لوحة الإدارة
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', adminLogout);
  }

  // التبويبات
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById(`tab-${target}`).classList.remove('hidden');

      // إخفاء التحميل
      document.querySelectorAll('.loading').forEach(l => l.classList.add('hidden'));

      // تحميل البيانات
      if (target === 'shops') loadShops();
      if (target === 'orders') loadOrders();
      if (target === 'users') loadUsers();
    });
  });

  // تحميل أولي
  await loadGlobalStats();
  await loadShops();
});
