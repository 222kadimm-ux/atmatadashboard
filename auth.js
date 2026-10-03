// ========================================
// auth.js - تسجيل الدخول والتسجيل
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// تشفير كلمة المرور (بسيط - للمشروع الصغير)
// ========================================
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'atmata_salt_2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ========================================
// تسجيل الدخول
// ========================================
async function handleLogin(e) {
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
      .from('users')
      .select('id, email, shop_id, password_hash')
      .eq('email', email)
      .single();

    if (error || !data) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    if (data.password_hash !== passwordHash) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    // حفظ الجلسة
    localStorage.setItem('atmata_user', JSON.stringify({
      id: data.id,
      email: data.email,
      shop_id: data.shop_id,
      login_at: new Date().toISOString()
    }));

    // تحديث آخر تسجيل دخول
    await supabaseClient
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.id);

    // التحويل إلى لوحة التحكم
    window.location.href = 'index.html';

  } catch (err) {
    console.error('خطأ:', err);
    errorMsg.textContent = '⚠️ ' + err.message;
    errorMsg.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🔐 تسجيل الدخول';
  }
}

// ========================================
// التسجيل
// ========================================
async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const shopId = parseInt(document.getElementById('shop_id').value);
  const errorMsg = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');
  const btn = document.getElementById('register-btn');

  errorMsg.classList.add('hidden');
  successMsg.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ التسجيل...';

  try {
    // التحقق من صحة المدخلات
    if (password.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    if (isNaN(shopId) || shopId < 1) {
      throw new Error('معرف المتجر غير صحيح');
    }

    // التحقق من وجود المتجر
    const { data: shop, error: shopError } = await supabaseClient
      .from('shops')
      .select('id, name')
      .eq('id', shopId)
      .single();

    if (shopError || !shop) {
      throw new Error('لم يتم العثور على المتجر. تحقق من Shop ID');
    }

    // التحقق من عدم وجود البريد
    const { data: existing } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      throw new Error('البريد الإلكتروني مسجل بالفعل');
    }

    // إنشاء الحساب
    const passwordHash = await hashPassword(password);

    const { data, error } = await supabaseClient
      .from('users')
      .insert([{
        email,
        password_hash: passwordHash,
        shop_id: shopId
      }])
      .select()
      .single();

    if (error) throw error;

    successMsg.textContent = `✅ تم إنشاء الحساب! مرحباً ${shop.name}. سيتم تحويلك...`;
    successMsg.classList.remove('hidden');

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);

  } catch (err) {
    console.error('خطأ:', err);
    errorMsg.textContent = '⚠️ ' + err.message;
    errorMsg.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '✨ إنشاء الحساب';
  }
}

// ========================================
// التهيئة
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
});
