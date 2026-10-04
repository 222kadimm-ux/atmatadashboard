// ========================================
// admin.js - لوحة الإدارة مع تفعيل الإيصالات
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
    const { data: receipts } = await supabaseClient.from('receipts').select('id').eq('status', 'pending');

    document.getElementById('total-shops').textContent = shops?.length || 0;
    document.getElementById('total-orders').textContent = orders?.length || 0;
    document.getElementById('total-revenue').textContent = 
      (orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0).toLocaleString('ar-DZ');
    document.getElementById('total-users').textContent = users?.length || 0;
    
    // عدد الإيصالات المعلقة
    const pendingCount = receipts?.length || 0;
    const receiptsBadge = document.getElementById('receipts-count');
    if (receiptsBadge) {
      receiptsBadge.textContent = pendingCount;
      receiptsBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
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
  }
}

// ========================================
// تحميل الإيصالات المعلقة
// ========================================
async function loadReceipts() {
  try {
    const { data, error } = await supabaseClient
      .from('receipts')
      .select(`
        *,
        shops:shop_id (name, emoji, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = document.getElementById('receipts-list');
    list.innerHTML = '';

    if (!data || data.length === 0) {
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
            <div class="value">${receipt.amount.toLocaleString('ar-DZ')} د.ج</div>
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
    console.error('خطأ تحميل الإيصالات:', err);
  }
}

// ========================================
// تفعيل إيصال
// ========================================
window.approveReceipt = async function(receiptId, shopId, plan, amount) {
  if (!confirm('هل تريد تفعيل هذا الاشتراك؟')) return;

  try {
    // 1. تحديث حالة الإيصال
    const { error: receiptError } = await supabaseClient
      .from('receipts')
      .update({ 
        status: 'approved',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', receiptId);

    if (receiptError) throw receiptError;

    // 2. تفعيل اشتراك المتجر
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    const limits = {
      basic: 100,
      pro: 999999
    };

    const { error: shopError } = await supabaseClient
      .from('shops')
      .update({
        plan: plan,
        subscription_status: 'active',
        subscription_start: new Date().toISOString(),
        subscription_end: newEndDate.toISOString(),
        orders_limit: limits[plan] || 100,
        orders_this_month: 0
      })
      .eq('id', shopId);

    if (shopError) throw shopError;

    // 3. إضافة سجل الاشتراك
    await supabaseClient
      .from('subscriptions')
      .insert([{
        shop_id: shopId,
        plan: plan,
        amount: amount,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: newEndDate.toISOString(),
        payment_method: 'ccp_baridimob'
      }]);

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
    const { error } = await supabaseClient
      .from('receipts')
      .update({ 
        status: 'rejected',
        admin_note: note || 'مرفوض',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', receiptId);

    if (error) throw error;

    alert('✅ تم رفض الإيصال');
    await loadReceipts();
    await loadGlobalStats();

  } catch (err) {
    console.error('خطأ:', err);
    alert('⚠️ خطأ: ' + err.message);
  }
};

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
          <div class="value"><span class="badge badge-${order.status || 'pending'}">${statusText}</span></div>
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
