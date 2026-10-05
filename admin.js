// ========================================
// admin.js - لوحة الإدارة الآمنة (API)
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// Admin Token (مؤقت — سنطوره لاحقاً)
// ========================================
function getAdminToken() {
  const admin = localStorage.getItem('atmata_admin');
  if (!admin) return null;

  try {
    const data = JSON.parse(admin);
    return data.token || 'admin_session_' + data.id;
  } catch (e) {
    return null;
  }
}

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

    // حفظ الجلسة مع token
    localStorage.setItem('atmata_admin', JSON.stringify({
      id: data.id,
      email: data.email,
      token: 'admin_' + data.id + '_' + Date.now(),
      login_at: new Date().toISOString(),
      expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 ساعة
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
// التحقق من الجلسة
// ========================================
function checkAdminSession() {
  const adminStr = localStorage.getItem('atmata_admin');
  if (!adminStr) {
    window.location.href = 'admin-login.html';
    return false;
  }

  try {
    const admin = JSON.parse(adminStr);
    if (admin.expires_at && Date.now() > admin.expires_at) {
      localStorage.removeItem('atmata_admin');
      window.location.href = 'admin-login.html';
      return false;
    }
    return true;
  } catch (e) {
    localStorage.removeItem('atmata_admin');
    window.location.href = 'admin-login.html';
    return false;
  }
}

// ========================================
// Helper: طلب API
// ========================================
async function apiRequest(endpoint, options = {}) {
  const token = getAdminToken();
  if (!token) {
    window.location.href = 'admin-login.html';
    return null;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Error');
  }

  return await response.json();
}

// ========================================
// تحميل الإحصائيات العامة
// ========================================
async function loadGlobalStats() {
  try {
    const [shopsRes, ordersRes, usersRes, receiptsRes] = await Promise.all([
      apiRequest('/api/shops'),
      apiRequest('/api/orders'),
      apiRequest('/api/users'),
      apiRequest('/api/receipts')
    ]);

    const shops = shopsRes?.data || [];
    const orders = ordersRes?.data || [];
    const users = usersRes?.data || [];
    const receipts = receiptsRes?.data || [];

    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingReceipts = receipts.filter(r => r.status === 'pending').length;

    document.getElementById('total-shops').textContent = shops.length;
    document.getElementById('total-orders').textContent = orders.length;
    document.getElementById('total-revenue').textContent = totalRevenue.toLocaleString('ar-DZ');
    document.getElementById('total-users').textContent = users.length;

    const badge = document.getElementById('receipts-count');
    if (badge) {
      badge.textContent = pendingReceipts;
      badge.style.display = pendingReceipts > 0 ? 'inline-block' : 'none';
    }
  } catch (err) {
    console.error('خطأ:', err);
  }
}

// ========================================
// تحميل المتاجر
// ========================================
async function loadShops() {
  try {
    const res = await apiRequest('/api/shops');
    const data = res?.data || [];

    const list = document.getElementById('shops-list');
    list.innerHTML = '';

    if (data.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا توجد متاجر</p>';
      return;
    }

    data.forEach(shop => {
      const card = document.createElement('div');
      card.className = 'data-card';

      const planBadge = {
        free: '🆓 مجاني',
        basic: '⭐ أساسي',
        pro: '👑 احترافي'
      }[shop.plan] || '🆓 مجاني';

      const endDate = shop.subscription_end
        ? new Date(shop.subscription_end).toLocaleDateString('ar-DZ')
        : '—';

      card.innerHTML = `
        <div>
          <div class="label">المتجر</div>
          <div class="value">${shop.emoji || '🏪'} ${shop.name}</div>
        </div>
        <div>
          <div class="label">البريد</div>
          <div class="value">${shop.email || '—'}</div>
        </div>
        <div>
          <div class="label">الخطة</div>
          <div class="value"><span class="badge badge-${shop.plan || 'free'}">${planBadge}</span></div>
        </div>
        <div>
          <div class="label">ينتهي</div>
          <div class="value">${endDate}</div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('خطأ:', err);
    document.getElementById('shops-list').innerHTML = '<p style="text-align:center;color:#e74c3c;padding:20px;">⚠️ خطأ في التحميل</p>';
  }
}

// ========================================
// تحميل الطلبات
// ========================================
async function loadOrders() {
  try {
    const res = await apiRequest('/api/orders');
    const data = res?.data || [];

    const list = document.getElementById('orders-list');
    list.innerHTML = '';

    if (data.length === 0) {
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
          <div class="value"><span class="badge badge-${order.status || 'pending'}">${statusText}</span></div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('خطأ:', err);
    document.getElementById('orders-list').innerHTML = '<p style="text-align:center;color:#e74c3c;padding:20px;">⚠️ خطأ في التحميل</p>';
  }
}

// ========================================
// تحميل المستخدمين
// ========================================
async function loadUsers() {
  try {
    const res = await apiRequest('/api/users');
    const data = res?.data || [];

    const list = document.getElementById('users-list');
    list.innerHTML = '';

    if (data.length === 0) {
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
    document.getElementById('users-list').innerHTML = '<p style="text-align:center;color:#e74c3c;padding:20px;">⚠️ خطأ في التحميل</p>';
  }
}

// ========================================
// تحميل الإيصالات
// ========================================
async function loadReceipts() {
  try {
    const res = await apiRequest('/api/receipts');
    const data = res?.data || [];

    const list = document.getElementById('receipts-list');
    list.innerHTML = '';

    if (data.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">📭 لا توجد إيصالات</p>';
      return;
    }

    data.forEach(receipt => {
      const card = document.createElement('div');
      card.className = `receipt-card receipt-${receipt.status}`;

      const statusBadge = {
        pending: '⏳ قيد المراجعة',
        approved: '✅ مفعّل',
        rejected: '❌ مرفوض'
      }[receipt.status] || 'غير معروف';

      const planName = {
        basic: '⭐ أساسي',
        pro: '👑 احترافي'
      }[receipt.plan] || receipt.plan;

      const shopName = receipt.shops?.name || '—';
      const shopEmoji = receipt.shops?.emoji || '🏪';
      const shopEmail = receipt.shops?.email || '—';
      const createdDate = new Date(receipt.created_at).toLocaleString('ar-DZ');

      let actionsHtml = '';
      if (receipt.status === 'pending') {
        actionsHtml = `
          <div class="receipt-actions">
            <button class="btn-approve" onclick="approveReceipt(${receipt.id}, ${receipt.shop_id}, '${receipt.plan}', ${receipt.amount})">
              ✅ تفعيل
            </button>
            <button class="btn-reject" onclick="rejectReceipt(${receipt.id})">
              ❌ رفض
            </button>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="receipt-info">
          <div>
            <div class="label">المتجر</div>
            <div class="value">${shopEmoji} ${shopName}</div>
          </div>
          <div>
            <div class="label">البريد</div>
            <div class="value">${shopEmail}</div>
          </div>
          <div>
            <div class="label">الخطة</div>
            <div class="value">${planName}</div>
          </div>
          <div>
            <div class="label">المبلغ</div>
            <div class="value">${(receipt.amount || 0).toLocaleString('ar-DZ')} د.ج</div>
          </div>
          <div>
            <div class="label">التاريخ</div>
            <div class="value">${createdDate}</div>
          </div>
          <div>
            <div class="label">الحالة</div>
            <div class="value">${statusBadge}</div>
          </div>
        </div>
        ${receipt.image_url ? `
          <div class="receipt-image">
            <a href="${receipt.image_url}" target="_blank">
              <img src="${receipt.image_url}" alt="إيصال" loading="lazy">
            </a>
          </div>
        ` : ''}
        ${actionsHtml}
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error('خطأ:', err);
    document.getElementById('receipts-list').innerHTML = '<p style="text-align:center;color:#e74c3c;padding:20px;">⚠️ خطأ في التحميل</p>';
  }
}

// ========================================
// تفعيل إيصال
// ========================================
window.approveReceipt = async function(receiptId, shopId, plan, amount) {
  if (!confirm('هل تريد تفعيل هذا الاشتراك؟')) return;

  try {
    await apiRequest('/api/receipts', {
      method: 'POST',
      body: JSON.stringify({
        receipt_id: receiptId,
        status: 'approved',
        shop_id: shopId,
        plan: plan,
        amount: amount
      })
    });

    alert('✅ تم تفعيل الاشتراك بنجاح!');
    await loadReceipts();
    await loadGlobalStats();
  } catch (err) {
    console.error('خطأ:', err);
    alert('⚠️ خطأ: ' + err.message);
  }
};

// ========================================
// رفض إيصال
// ========================================
window.rejectReceipt = async function(receiptId) {
  const note = prompt('سبب الرفض (اختياري):');
  if (note === null) return;

  try {
    await apiRequest('/api/receipts', {
      method: 'POST',
      body: JSON.stringify({
        receipt_id: receiptId,
        status: 'rejected',
        admin_note: note || 'مرفوض'
      })
    });

    alert('✅ تم رفض الإيصال');
    await loadReceipts();
    await loadGlobalStats();
  } catch (err) {
    console.error('خطأ:', err);
    alert('⚠️ خطأ: ' + err.message);
  }
};

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
  if (!checkAdminSession()) return;

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

      if (target === 'shops') loadShops();
      if (target === 'orders') loadOrders();
      if (target === 'users') loadUsers();
      if (target === 'receipts') loadReceipts();
    });
  });

  // تحميل أولي
  await loadGlobalStats();
  await loadReceipts();
});
