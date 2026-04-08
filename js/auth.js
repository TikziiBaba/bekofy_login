// Bekofy Web - Supabase Config and Auth Logic
// The same credentials as the desktop version so users are synced!
const SUPABASE_URL = 'https://dtdsawyynetqlbosrvqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHNhd3l5bmV0cWxib3NydnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0MDUsImV4cCI6MjA5MDEyMTQwNX0.6rKxp51OOj_b1iKtz_21ZkHcvbThNF4w5sPdP7RAua4';

// Initialize Supabase from the global window object loaded from CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility functions for UI
function showError(msg) {
  const el = document.getElementById('error-msg');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideError() {
  const el = document.getElementById('error-msg');
  if (el) el.style.display = 'none';
}

function showSuccess(msg) {
  const el = document.getElementById('success-msg');
  const errEl = document.getElementById('error-msg');
  const form = document.getElementById('auth-form');
  if (el) {
    el.innerHTML = msg;
    el.style.display = 'block';
  }
  if (errEl) errEl.style.display = 'none';
  if (form) form.style.display = 'none'; // Hide form on success
}

function toggleLoading(isLoading) {
  const btnText = document.getElementById('btn-text');
  const loader = document.getElementById('loader');
  const btn = document.getElementById('submit-btn');
  
  if (!btnText || !loader || !btn) return;
  
  if (isLoading) {
    btnText.style.display = 'none';
    loader.style.display = 'block';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  } else {
    btnText.style.display = 'inline';
    loader.style.display = 'none';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// Global functions for HTML access
window.handleRegister = async function(event) {
  event.preventDefault();
  hideError();
  
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!username || !email || !password) {
    return showError("Lütfen tüm alanları doldurun.");
  }
  if (password.length < 6) {
    return showError("Şifre en az 6 karakter olmalıdır.");
  }
  
  toggleLoading(true);
  
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error) {
      if (error.message.includes("User already registered")) {
        showError("Bu e-posta adresi ile zaten kayıt olunmuş.");
      } else {
        showError("Kayıt olurken bir hata oluştu: " + error.message);
      }
    } else {
      // Masaüstü uygulamasının ("Hesap silinmiş") hatası vermemesi için profili manuel oluştur
      if (data && data.user) {
        try {
          await supabaseClient.from('profiles').upsert({ 
            id: data.user.id, 
            username: username 
          });
        } catch (e) {
          console.error("Profil oluşturma hatası:", e);
        }
      }

      showSuccess(`
        <h3>Kayıt Başarılı! 🎉</h3>
        <p style="margin-top: 10px;">Hoş geldin, ${username}. Artık Bekofy masaüstü uygulamamıza aynı bilgilerle giriş yapabilirsin.</p>
        <a href="index.html" class="btn-primary" style="margin-top: 20px;">Ana Sayfaya Dön</a>
      `);
    }
  } catch (err) {
    showError("Beklenmeyen bir hata oluştu.");
    console.error(err);
  } finally {
    toggleLoading(false);
  }
};

window.handleLogin = async function(event) {
  event.preventDefault();
  hideError();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    return showError("E-posta ve şifrenizi girin.");
  }
  
  toggleLoading(true);
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        showError("Girdiğiniz e-posta veya şifre hatalı.");
      } else {
        showError(error.message);
      }
    } else {
      showSuccess(`
        <h3>Giriş Başarılı! 🔓</h3>
        <p style="margin-top: 10px;">Hesabınıza web üzerinden eriştiniz. Masaüstü uygulamasından müzik dinlemeye devam edebilirsiniz.</p>
        <a href="index.html" class="btn-primary" style="margin-top: 20px;">Ana Sayfaya Dön</a>
      `);
    }
  } catch (err) {
    showError("Beklenmeyen bir hata oluştu.");
  } finally {
    toggleLoading(false);
  }
};
