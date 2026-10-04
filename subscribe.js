// ========================================
// subscribe.js - صفحة الاشتراك
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let selectedPlan = null;
let selectedAmount = null;
let selectedFile = null;

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
    const user = JSON.parse(userStr);
    if (user.expires_at && Date.now() > user.expires_at) {
      localStorage.removeItem('atmata_user');
      window.location.href = 'login.html';
      return null;
    }
    return user;
  } catch (e) {
    localStorage.removeItem('atmata_user');
    window.location.href = 'login.html';
    return null;
  }
}

// ========================================
// تحميل معلومات المتجر الحالية
// ========================================
async function loadShopInfo() {
  try {
    const { data, error } = await supabaseClient
      .from('shops')
      .select('id, name, emoji, plan, subscription_status, subscription_end, orders_this_month, orders_limit, ccp_number, baridimob_number')
      .eq('id', currentUser.shop_id)
      .single();

    if (error || !data) {
      console.error('خطأ:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('خطأ:', err);
    return null;
  }
}

// ========================================
// عرض الاشتراك الحالي
// ========================================
function displayCurrentPlan(shop) {
  const container = document.getElementById('current-plan');
  
  const plans = {
    free: { name: '🆓 مجاني', limit: 10, price: 0 },
    basic: { name: '⭐ أساسي', limit: 100, price: 2500 },
    pro: { name: '👑 احترافي', limit: 999999, price: 5000 }
  };

  const currentPlan = plans[shop.plan] || plans.free;
  const endDate = shop.subscription_end ? new Date(shop.subscription_end).toLocaleDateString('ar-DZ') : '—';
  const daysLeft = shop.subscription_end ? Math.max(0, Math.ceil((new Date(shop.subscription_end) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

  container.innerHTML = `
    <div class="current-plan-box">
      <h3>📊 اشتراكك الحالي</h3>
      <div class="current-plan-info">
        <div>
          <span>الباقة:</span>
          <strong>${currentPlan.name}</strong>
        </div>
        <div>
          <span>الطلبات:</span>
          <strong>${shop.orders_this_month || 0} / ${shop.orders_limit || 10}</strong>
        </div>
        <div>
          <span>ينتهي في:</span>
          <strong>${endDate}</strong>
        </div>
        <div>
          <span>المتبقي:</span>
          <strong>${daysLeft} يوم</strong>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// اختيار الباقة
// ========================================
function selectPlan(plan, amount) {
  selectedPlan = plan;
  selectedAmount = amount;

  const planNames = {
    basic: '⭐ أساسي',
    pro: '👑 احترافي'
  };

  document.getElementById('plan-display').textContent = planNames[plan] || plan;
  document.getElementById('amount-display').textContent = amount.toLocaleString('ar-DZ') + ' د.ج';

  document.getElementById('payment-modal').classList.remove('hidden');
}

// ========================================
// رفع صورة الإيصال
// ========================================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // التحقق من الحجم (أقل من 5 MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('⚠️ الصورة كبيرة جداً. الحد الأقصى 5 MB');
    return;
  }

  // التحقق من النوع
  if (!file.type.startsWith('image/')) {
    alert('⚠️ الملف يجب أن يكون صورة');
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview').classList.remove('hidden');
    document.getElementById('submit-receipt').disabled = false;
  };
  reader.readAsDataURL(file);
}

// ========================================
// إزالة الصورة
// ========================================
function removeImage() {
  selectedFile = null;
  document.getElementById('receipt-file').value = '';
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('submit-receipt').disabled = true;
}

// ========================================
// رفع الصورة إلى Supabase Storage
// ========================================
async function uploadImage(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `receipt_${currentUser.shop_id}_${Date.now()}.${fileExt}`;
  const filePath = `${currentUser.shop_id}/${fileName}`;

  const { data, error } = await supabaseClient.storage
    .from('receipts')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data: urlData } = supabaseClient.storage
    .from('receipts')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ========================================
// إرسال الإيصال
// ========================================
async function submitReceipt() {
  const errorMsg = document.getElementById('payment-error');
  const successMsg = document.getElementById('payment-success');
  const btn = document.getElementById('submit-receipt');

  errorMsg.classList.add('hidden');
  successMsg.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ الإرسال...';

  try {
    if (!selectedFile) throw new Error('ارفعي صورة الإيصال أولاً');

    // 1. رفع الصورة
    const imageUrl = await uploadImage(selectedFile);

    // 2. حفظ الإيصال في قاعدة البيانات
    const { data, error } = await supabaseClient
      .from('receipts')
      .insert([{
        shop_id: currentUser.shop_id,
        amount: selectedAmount,
        plan: selectedPlan,
        image_url: imageUrl,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // 3. إشعار المدير (عبر Supabase - يمكن إضافته لاحقاً)
    console.log('إيصال جديد:', data);

    successMsg.innerHTML = `✅ تم إرسال الإيصال بنجاح!<br><small>سيتم تفعيل اشتراكك خلال 24 ساعة.</small>`;
    successMsg.classList.remove('hidden');

    // 4. إغلاق النافذة بعد 3 ثوانٍ
    setTimeout(() => {
      document.getElementById('payment-modal').classList.add('hidden');
      successMsg.classList.add('hidden');
      btn.disabled = true;
      btn.textContent = '✅ إرسال الإيصال';
      removeImage();
      selectedPlan = null;
      selectedAmount = null;
      // إعادة تحميل الصفحة
      window.location.reload();
    }, 3000);

  } catch (err) {
    console.error('خطأ:', err);
    errorMsg.textContent = '⚠️ ' + err.message;
    errorMsg.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '✅ إرسال الإيصال';
  }
}

// ========================================
// التهيئة
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  currentUser = loadUser();
  if (!currentUser) return;

  // زر الرجوع
  document.getElementById('back-btn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // تحميل معلومات المتجر
  const shop = await loadShopInfo();
  if (!shop) {
    document.getElementById('loading').innerHTML = '⚠️ لم يتم العثور على متجرك';
    return;
  }

  // عرض معلومات الدفع
  if (shop.ccp_number) {
    document.getElementById('ccp-display').textContent = shop.ccp_number;
  } else {
    document.getElementById('ccp-display').textContent = 'غير متاح';
  }

  if (shop.baridimob_number) {
    document.getElementById('baridimob-display').textContent = shop.baridimob_number;
  } else {
    document.getElementById('baridimob-display').textContent = 'غير متاح';
  }

  // عرض الاشتراك الحالي
  displayCurrentPlan(shop);

  // إظهار المحتوى
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');

  // أزرار اختيار الباقة
  document.querySelectorAll('.btn-select').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.dataset.plan;
      const amount = parseInt(btn.dataset.amount);
      selectPlan(plan, amount);
    });
  });

  // إغلاق النافذة
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('payment-modal').classList.add('hidden');
  });

  // رفع الصورة
  document.getElementById('receipt-file').addEventListener('change', handleFileSelect);

  // إزالة الصورة
  document.getElementById('remove-image').addEventListener('click', removeImage);

  // إرسال الإيصال
  document.getElementById('submit-receipt').addEventListener('click', submitReceipt);
});
