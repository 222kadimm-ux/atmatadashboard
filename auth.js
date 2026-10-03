// ========================================
// auth.js - Supabase Auth
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// تسجيل الدخول
// ========================================
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');
  const btn = document.getElementById('login-btn');

  errorMsg.classList.add('hidden');
  if (successMsg) successMsg.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ التحقق...';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    // البحث عن متجر المستخدم
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('shop_id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      // إذا لم يكن هناك صف في users، ننشئه
      const shopId = prompt('أدخل معرف متجرك (Shop ID):');
      if (shopId) {
        await supabaseClient.from('users').insert([{
          email: email,
          shop_id: parseInt(shopId),
          password_hash: 'supabase_auth'
        }]);
      }
    }

    // حفظ الجلسة
    localStorage.setItem('atmata_user', JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      shop_id: userData?.shop_id || null,
      login_at: new Date().toISOString()
    }));

    window.location.href = 'index.html';

  } catch (err) {
    console.error('خطأ:', err);
    errorMsg.textContent = '⚠️ ' + (err.message === 'Invalid login credentials' 
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      : err.message);
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

    // إنشاء الحساب في Supabase Auth
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

    if (authError) throw authError;

    // حفظ بيانات المستخدم في جدول users
    const { error: dbError } = await supabaseClient
      .from('users')
      .insert([{
        email: email,
        password_hash: 'supabase_auth',
        shop_id: shopId
      }]);

    if (dbError && !dbError.message.includes('duplicate')) {
      throw dbError;
    }

    successMsg.innerHTML = `✅ تم إنشاء الحساب!<br><small>مرحباً ${shop.name}. تحققي من بريدك لتأكيد الحساب.</small>`;
    successMsg.classList.remove('hidden');

    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);

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
