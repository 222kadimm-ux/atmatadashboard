// ========================================
// auth.js - Supabase Auth with Email Linking
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// تسجيل الدخول
// ========================================
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');
  const btn = document.getElementById('login-btn');

  errorMsg.classList.add('hidden');
  if (successMsg) successMsg.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ التحقق...';

  try {
    // 1. تسجيل الدخول عبر Supabase Auth
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    // 2. البحث عن المتجر بالبريد
    const { data: shop, error: shopError } = await supabaseClient
      .from('shops')
      .select('id, name, emoji')
      .eq('email', email)
      .single();

    if (shopError || !shop) {
      throw new Error('لم يتم العثور على متجر مرتبط بهذا البريد. سجلي متجرك في البوت أولاً.');
    }

    // 3. حفظ الجلسة
    localStorage.setItem('atmata_user', JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      shop_id: shop.id,
      shop_name: shop.name,
      login_at: new Date().toISOString()
    }));

    window.location.href = 'index.html';

  } catch (err) {
    console.error('خطأ:', err);
    let errorMessage = err.message;
    
    if (err.message === 'Invalid login credentials') {
      errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    } else if (err.message === 'Email not confirmed') {
      errorMessage = 'البريد الإلكتروني لم يتم تأكيده';
    }

    errorMsg.textContent = '⚠️ ' + errorMessage;
    errorMsg.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = '🔐 تسجيل الدخول';
  }
}

// ========================================
// التسجيل (بدون Shop ID)
// ========================================
async function handleRegister(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');
  const btn = document.getElementById('register-btn');

  errorMsg.classList.add('hidden');
  successMsg.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ التسجيل...';

  try {
    if (password.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    // 1. التحقق من وجود المتجر بالبريد
    const { data: shop, error: shopError } = await supabaseClient
      .from('shops')
      .select('id, name, emoji')
      .eq('email', email)
      .single();

    if (shopError || !shop) {
      throw new Error('لم يتم العثور على متجر مرتبط بهذا البريد. سجلي متجرك في البوت أولاً عبر /register');
    }

    // 2. إنشاء الحساب في Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

    if (authError) throw authError;

    // 3. حفظ بيانات المستخدم في جدول users
    const { error: dbError } = await supabaseClient
      .from('users')
      .insert([{
        email: email,
        password_hash: 'supabase_auth',
        shop_id: shop.id
      }]);

    if (dbError && !dbError.message.includes('duplicate')) {
      throw dbError;
    }

    successMsg.innerHTML = `✅ تم إنشاء الحساب!<br><small>مرحباً ${shop.name}. سيتم تحويلك لتسجيل الدخول...</small>`;
    successMsg.classList.remove('hidden');

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2500);

  } catch (err) {
    console.error('خطأ:', err);
    errorMsg.textContent = '⚠️ ' + (err.message || 'حدث خطأ');
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

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
});
