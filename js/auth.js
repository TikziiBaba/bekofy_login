// ===== Auth Page Logic =====

document.addEventListener('DOMContentLoaded', () => {
  // Titlebar controls (only exist in Electron version)
  const btnMin = document.getElementById('btn-minimize');
  const btnMax = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  if (btnMin && window.electronAPI) btnMin.addEventListener('click', () => window.electronAPI.minimize());
  if (btnMax && window.electronAPI) btnMax.addEventListener('click', () => window.electronAPI.maximize());
  if (btnClose && window.electronAPI) btnClose.addEventListener('click', () => window.electronAPI.close());

  // Form elements (only exist in Electron auth page, not in website login/register pages)
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegister = document.getElementById('show-register');
  const showLogin = document.getElementById('show-login');

  // Toggle between login and register
  if (showRegister) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      if (loginForm) loginForm.classList.add('hidden');
      if (registerForm) {
        registerForm.classList.remove('hidden');
        registerForm.style.animation = 'fadeSlideIn 0.4s ease-out';
      }
    });
  }

  if (showLogin) {
    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      if (registerForm) registerForm.classList.add('hidden');
      if (loginForm) {
        loginForm.classList.remove('hidden');
        loginForm.style.animation = 'fadeSlideIn 0.4s ease-out';
      }
    });
  }

  // Password toggle
  setupPasswordToggle('toggle-login-pw', 'login-password');
  setupPasswordToggle('toggle-register-pw', 'register-password');

  // Login handler (Electron auth page)
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = document.getElementById('btn-login');

      if (!email || !password) {
        showToast('Lütfen tüm alanları doldurun', 'error');
        return;
      }

      btn.classList.add('loading');
      btn.querySelector('span').textContent = 'Giriş yapılıyor...';

      try {
        const { data, error } = await signInWithEmail(email, password);
        if (error) {
          console.error('Giriş Hatası Detayı:', error);
          let errorMsg = error.message;
          if (!errorMsg || errorMsg === '{}' || errorMsg === '[object Object]') {
            errorMsg = 'Giriş başarısız: E-posta veya şifre hatalı.';
          }
          showToast(errorMsg, 'error');
        } else {
          // Check if user is banned or deleted
          const user = data?.user;
          if (user) {
            const sb = getSupabase();
            const { data: profile } = await sb.from('profiles').select('is_banned').eq('id', user.id).maybeSingle();
            
            if (!profile) {
              // Profil yoksa, trigger eksikliğinden dolayı oluşmamış olabilir. Manuel oluşturalım.
              try {
                const username = user.user_metadata?.username || user.user_metadata?.full_name || email.split('@')[0] || 'Kullanıcı';
                await sb.from('profiles').insert({ id: user.id, username: username });
              } catch (err) {
                console.log('Profil oluşturma hatası:', err);
              }
            }
            
            if (profile && profile.is_banned) {
              await sb.auth.signOut();
              showToast('Hesabınız engellenmiştir. Yönetici ile iletişime geçin.', 'error');
              btn.classList.remove('loading');
              btn.querySelector('span').textContent = 'Giriş Yap';
              return;
            }
          }
          
          showToast('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');
          setTimeout(() => {
            if (window.electronAPI && window.electronAPI.navigateToApp) {
              window.electronAPI.navigateToApp();
            } else {
              window.location.href = 'dashboard.html';
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Beklenmeyen Giriş Hatası:', err);
        showToast('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
      }

      btn.classList.remove('loading');
      btn.querySelector('span').textContent = 'Giriş Yap';
    });
  }

  // Register handler (Electron auth page)
  const btnRegister = document.getElementById('btn-register');
  if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
      const username = document.getElementById('register-username').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const btn = document.getElementById('btn-register');

      if (!username || !email || !password) {
        showToast('Lütfen tüm alanları doldurun', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Şifre en az 6 karakter olmalıdır', 'error');
        return;
      }

      btn.classList.add('loading');
      btn.querySelector('span').textContent = 'Kayıt olunuyor...';

      try {
        // Check reserved usernames
        const reserved = await isUsernameReserved(username);
        if (reserved) {
          showToast('Bu kullanıcı adı alınamaz', 'error');
          btn.classList.remove('loading');
          btn.querySelector('span').textContent = 'Kayıt Ol';
          return;
        }
        
        const { data, error } = await signUpWithEmail(email, password, username);
        if (error) {
          console.error('Kayıt Hatası Detayı:', error);
          let errorMsg = error.message;
          
          if (error.name === 'AuthRetryableFetchError' || error.status === 504 || error.status === 502 || error.status === 503) {
            errorMsg = 'Sunucu şu anda yanıt vermiyor. Lütfen birkaç dakika bekleyip tekrar deneyin.';
          } else if (error.status === 429) {
            errorMsg = 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.';
          } else if (error.status === 422 || (errorMsg && errorMsg.toLowerCase().includes('already registered'))) {
            errorMsg = 'Bu e-posta adresi zaten kullanımda.';
          } else if (!errorMsg || errorMsg === '{}' || errorMsg === '[object Object]') {
            errorMsg = 'Kayıt başarısız. Lütfen tekrar deneyin.';
          }
          showToast(errorMsg, 'error');
        } else {
          showToast('Kayıt başarılı! Giriş yapabilirsiniz.', 'success');
          setTimeout(() => {
            if (registerForm) registerForm.classList.add('hidden');
            if (loginForm) loginForm.classList.remove('hidden');
          }, 1500);
        }
      } catch (err) {
        console.error('Beklenmeyen Kayıt Hatası:', err);
        showToast('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
      }

      btn.classList.remove('loading');
      btn.querySelector('span').textContent = 'Kayıt Ol';
    });
  }

  // Enter key support for forms
  const loginPw = document.getElementById('login-password');
  const registerPw = document.getElementById('register-password');
  if (loginPw) {
    loginPw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
  }
  if (registerPw) {
    registerPw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-register').click();
    });
  }

  // Google login
  const btnGoogleLogin = document.getElementById('btn-google-login');
  const btnGoogleRegister = document.getElementById('btn-google-register');
  if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', handleGoogleLogin);
  if (btnGoogleRegister) btnGoogleRegister.addEventListener('click', handleGoogleLogin);

  // Apple login
  const btnAppleLogin = document.getElementById('btn-apple-login');
  const btnAppleRegister = document.getElementById('btn-apple-register');
  if (btnAppleLogin) btnAppleLogin.addEventListener('click', handleAppleLogin);
  if (btnAppleRegister) btnAppleRegister.addEventListener('click', handleAppleLogin);

  // Check existing session
  checkSession();

  // Add animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
});

// Password toggle helper
function setupPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  if (!toggle || !input) return;
  
  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.style.color = isPassword ? 'var(--green-primary)' : 'var(--text-muted)';
  });
}

// Google OAuth - Electron'da harici tarayıcıda açılır
async function handleGoogleLogin() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true
      }
    });
    
    if (error) {
      showToast('Google ile giriş başarısız: ' + error.message, 'error');
      return;
    }
    
    if (data?.url) {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(data.url);
        showToast('Tarayıcıda Google ile giriş yapın, ardından uygulamaya dönün.', 'success');
        startSessionPolling();
      } else {
        // Web versiyonunda direkt yönlendir
        window.location.href = data.url;
      }
    }
  } catch (err) {
    showToast('Google ile giriş sırasında hata: ' + err.message, 'error');
  }
}

// Apple OAuth
async function handleAppleLogin() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        skipBrowserRedirect: true
      }
    });
    
    if (error) {
      showToast('Apple ile giriş başarısız: ' + error.message, 'error');
      return;
    }
    
    if (data?.url) {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(data.url);
        showToast('Tarayıcıda Apple ile giriş yapın, ardından uygulamaya dönün.', 'success');
        startSessionPolling();
      } else {
        window.location.href = data.url;
      }
    }
  } catch (err) {
    showToast('Apple ile giriş sırasında hata: ' + err.message, 'error');
  }
}

// OAuth sonrası session'ı kontrol et
let pollInterval = null;
function startSessionPolling() {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const session = await getSession();
      if (session) {
        clearInterval(pollInterval);
        pollInterval = null;
        
        // Check ban status
        const sb = getSupabase();
        const { data: profile } = await sb.from('profiles').select('is_banned').eq('id', session.user.id).maybeSingle();
        if (!profile) {
          try {
            const username = session.user.user_metadata?.username || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Kullanıcı';
            await sb.from('profiles').insert({ id: session.user.id, username: username });
          } catch (err) {
            console.log('Profil oluşturma hatası:', err);
          }
        } else if (profile.is_banned) {
          await sb.auth.signOut();
          showToast('Hesabınız engellenmiştir.', 'error');
          return;
        }
        
        showToast('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');
        setTimeout(() => {
          if (window.electronAPI && window.electronAPI.navigateToApp) {
            window.electronAPI.navigateToApp();
          } else {
            window.location.href = 'dashboard.html';
          }
        }, 1000);
      }
    } catch (err) {
      // Henüz giriş yapılmamış
    }
  }, 2000);
  
  // 5 dakika sonra dur
  setTimeout(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }, 300000);
}

// Check existing session
async function checkSession() {
  try {
    const session = await getSession();
    if (session) {
      // Check ban status before auto-login
      const sb = getSupabase();
      const { data: profile } = await sb.from('profiles').select('is_banned').eq('id', session.user.id).maybeSingle();
      if (!profile) {
        try {
          const username = session.user.user_metadata?.username || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Kullanıcı';
          await sb.from('profiles').insert({ id: session.user.id, username: username });
        } catch (err) {
          console.log('Profil oluşturma hatası:', err);
        }
      } else if (profile.is_banned) {
        await sb.auth.signOut();
        return; // Stay on auth page
      }
      if (window.electronAPI && window.electronAPI.navigateToApp) {
        window.electronAPI.navigateToApp();
      } else {
        // Web: redirect based on current page
        const currentPage = window.location.pathname;
        if (currentPage.includes('login') || currentPage.includes('register')) {
          window.location.href = 'dashboard.html';
        }
      }
    }
  } catch (err) {
    // No session, stay on auth page
  }
}

// Toast notification helper
function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container') || (() => {
    // Web versiyonunda toast container yoksa oluştur
    let c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 4000);
}

// ===== Web Version Form Handlers =====

// Web form handlers are no longer used - login.html and register.html
// now use the same IDs as the Electron auth page (btn-login, login-email, etc.)
// so the DOMContentLoaded handlers above handle everything.


