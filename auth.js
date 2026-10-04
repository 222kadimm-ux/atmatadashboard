// ========================================
// auth.js - Supabase Auth with Rate Limiting
// ========================================

const SUPABASE_URL = 'https://ymzvhsrbmmmxxzqrmguz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ggRH0XJFrm4FmkUAst7pvg_JX2vH4Vv';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// Rate Limiting - منع brute force
// ========================================
const RATE_LIMIT = {
  MAX_ATTEMPTS: 5,        // 5 محاولات
  WINDOW_MS: 15 * 60 * 1000, // في 15 دقيقة
  LOCKOUT_MS: 30 * 60 * 1000 // قفل 30 دقيقة
};

function getRateLimitKey(email) {
  return `rate_limit_${email.toLowerCase()}`;
}

function checkRateLimit(email) {
  const key = getRateLimitKey(email);
  const now = Date.now();
  
  try {
    const stored = localStorage.getItem(key);
    const data = stored ? JSON.parse(stored) : { attempts: [], lockedUntil: 0 };
    
    // إذا كان مقفلاً
    if (data.lockedUntil > now) {
      const remaining = Math.ceil((data.lockedUntil - now) / 60000);
      throw new Error(`تم قفل الحساب مؤقتاً. حاولي بعد ${remaining} دقيقة.`);
    }
    
    // إزالة المحاولات القديمة
    data.attempts = data.attempts.filter(t => now - t < RATE_LIMIT.WINDOW_MS);
    
    // إذا تجاوز الحد
    if (data.attempts.length >= RATE_LIMIT.MAX_ATTEMPTS) {
      data.lockedUntil = now + RATE_LIMIT.LOCKOUT_MS;
      localStorage.setItem(key, JSON.stringify(data));
      throw new Error('محاولات كثيرة. تم قفل الحساب 30 دقيقة.');
    }
    
    return data;
  } catch (err) {
    if (err.message.includes('قفل') || err.message.includes('محاولات')) {
      throw err;
    }
    return { attempts: [], lockedUntil: 0 };
  }
}

function recordFailedAttempt(email) {
  const key = getRateLimitKey(email);
  const now = Date.now();
  
  try {
    const stored = localStorage.getItem(key);
    const data = stored ? JSON.parse(stored) : { attempts: [], lockedUntil: 0 };
    
    data.attempts.push(now);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

function clearRateLimit(email) {
  try {
    localStorage.removeItem(getRateLimitKey(email));
  } catch (e) {}
}

// ========================================
// Input Validation
// ========================================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

function isValidPassword(password) {
  return password.length >= 6 && password.length <= 100;
}

// ========================================
// تسجيل الدخول
// ========================================
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');
  const btn = document.getElementById('login-btn');

  errorMsg.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ التحقق...';

  try {
    // 1. التحقق من المدخلات
    if (!isValidEmail(email)) {
      throw new Error('البريد الإلكتروني غير صحيح');
    }

    if (!isValidPassword(password)) {
      throw new Error('كلمة المرور غير صحيحة');
    }

    // 2. Rate Limiting
    checkRateLimit(email);

    // 3. تسجيل الدخول
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      recordFailedAttempt(email);
      throw error;
    }

    // 4. البحث عن المتجر بالبريد
    const { data: shop, error: shopError } = await supabaseClient
      .from('shops')
      .select('id, name, emoji')
      .eq('email', email)
      .single();

    if (shopError || !shop) {
      throw new Error('لم يتم العثور على متجر مرتبط بهذا البريد.');
    }

    // 5. نجح - امسحي محاولات الفشل
    clearRateLimit(email);

    // 6. حفظ الجلسة (مع وقت انتهاء)
    const sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 ساعة
    localStorage.setItem('atmata_user', JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      shop_id: shop.id,
      shop_name: shop.name,
      login_at: new Date().toISOString(),
      expires_at: sessionExpiry
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
// التسجيل
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
    // التحقق من المدخلات
    if (!isValidEmail(email)) {
      throw new Error('البريد الإلكتروني غير صحيح');
    }

    if (!isValidPassword(password)) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    // التحقق من وجود المتجر بالبريد
    const { data: shop, error: shopError } = await supabaseClient
      .from('shops')
      .select('id, name, emoji')
      .eq('email', email)
      .single();

    if (shopError || !shop) {
      throw new Error('لم يتم العثور على متجر مرتبط بهذا البريد. سجلي متجرك في البوت أولاً عبر /register');
    }

    // إنشاء الحساب
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

    if (authError) throw authError;

    // حفظ بيانات المستخدم
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

    successMsg.innerHTML = `✅ تم إنشاء الحساب!<br><small>مرحباً ${shop.name}.</small>`;
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
// التحقق من انتهاء الجلسة
// ========================================
function checkSession() {
  const stored = localStorage.getItem('atmata_user');
  if (!stored) return false;
  
  try {
    const user = JSON.parse(stored);
    if (user.expires_at && Date.now() > user.expires_at) {
      localStorage.removeItem('atmata_user');
      return false;
    }
    return true;
  } catch (e) {
    localStorage.removeItem('atmata_user');
    return false;
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
