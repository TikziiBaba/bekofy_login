// ===== Auth Page Logic =====

// Platform-aware navigation helper
function navigateToApp() {
  if (window.electronAPI && window.electronAPI.navigateToApp) {
    window.electronAPI.navigateToApp();
  } else if (window.location.pathname.includes('auth.html')) {
    window.location.href = 'app.html';
  } else {
    window.location.href = 'dashboard.html';
  }
}

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

  // Tab switching for Login
  const tabEmail = document.getElementById('tab-email');
  const tabPhone = document.getElementById('tab-phone');
  const emailFields = document.getElementById('email-fields');
  const phoneFields = document.getElementById('phone-fields');
  const btnLogin = document.getElementById('btn-login');
  const btnSendOtp = document.getElementById('btn-send-otp');
  let loginMode = 'email'; // email or phone
  let otpSent = false;

  if (tabEmail && tabPhone) {
    tabEmail.addEventListener('click', () => {
      loginMode = 'email';
      tabEmail.style.borderColor = 'var(--green)';
      tabEmail.style.color = 'var(--green)';
      tabPhone.style.borderColor = 'rgba(255,255,255,0.2)';
      tabPhone.style.color = '#fff';
      emailFields.style.display = 'block';
      phoneFields.style.display = 'none';
      btnLogin.style.display = 'block';
      btnSendOtp.style.display = 'none';
    });
    tabPhone.addEventListener('click', () => {
      loginMode = 'phone';
      tabPhone.style.borderColor = 'var(--green)';
      tabPhone.style.color = 'var(--green)';
      tabEmail.style.borderColor = 'rgba(255,255,255,0.2)';
      tabEmail.style.color = '#fff';
      emailFields.style.display = 'none';
      phoneFields.style.display = 'block';
      
      if (otpSent) {
        btnLogin.style.display = 'block';
        btnSendOtp.style.display = 'none';
      } else {
        btnLogin.style.display = 'none';
        btnSendOtp.style.display = 'block';
      }
    });
  }

  if (btnSendOtp) {
    btnSendOtp.addEventListener('click', async () => {
      let phone = document.getElementById('login-phone').value.trim();
      if (!phone) {
        showToast('Lütfen telefon numaranızı girin', 'error');
        return;
      }
      if (!phone.startsWith('+')) {
        phone = '+90' + phone.replace(/^0+/, ''); // Auto-prepend +90 and remove leading zero if any
      }
      
      btnSendOtp.classList.add('loading');
      btnSendOtp.querySelector('span').textContent = 'Gönderiliyor...';
      
      try {
        const { error } = await signInWithPhone(phone);
        if (error) {
          console.error("Phone OTP Error:", error);
          if (error.status === 400 && error.message.includes("sms provider")) {
            throw new Error("Supabase SMS sağlayıcısı yapılandırılmamış (Twilio vb.).");
          }
          throw error;
        }
        
        showToast('Doğrulama kodu gönderildi', 'success');
        otpSent = true;
        document.getElementById('otp-input-group').style.display = 'block';
        document.getElementById('phone-input-group').style.display = 'none';
        btnSendOtp.style.display = 'none';
        btnLogin.style.display = 'block';
        btnLogin.querySelector('span').textContent = 'Doğrula ve Giriş Yap';
      } catch (err) {
        showToast('Hata: ' + (err.message || 'Bilinmeyen bir hata oluştu'), 'error');
      }
      
      btnSendOtp.classList.remove('loading');
      btnSendOtp.querySelector('span').textContent = 'Kod Gönder';
    });
  }

  // Login handler (Electron auth page)
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      const btn = document.getElementById('btn-login');
      btn.classList.add('loading');
      
      try {
        let authResult = null;
        
        if (loginMode === 'email') {
          const email = document.getElementById('login-email').value.trim();
          const password = document.getElementById('login-password').value;
          
          if (!email || !password) {
            showToast('Lütfen tüm alanları doldurun', 'error');
            btn.classList.remove('loading');
            return;
          }
          
          btn.querySelector('span').textContent = 'Giriş yapılıyor...';
          authResult = await signInWithEmail(email, password);
          
        } else if (loginMode === 'phone' && otpSent) {
          let phone = document.getElementById('login-phone').value.trim();
          if (!phone.startsWith('+')) {
            phone = '+90' + phone.replace(/^0+/, '');
          }
          const otp = document.getElementById('login-otp').value.trim();
          
          if (!phone || !otp) {
            showToast('Lütfen doğrulama kodunu girin', 'error');
            btn.classList.remove('loading');
            return;
          }
          
          btn.querySelector('span').textContent = 'Doğrulanıyor...';
          authResult = await verifyPhoneOtp(phone, otp);
        }
        
        if (!authResult) {
          btn.classList.remove('loading');
          return;
        }

        const { data, error } = authResult;
        
        if (error) {
          console.error('Giriş Hatası Detayı:', error);
          let errorMsg = error.message;
          if (!errorMsg || errorMsg === '{}' || errorMsg === '[object Object]') {
            errorMsg = 'Giriş başarısız: Bilgiler hatalı.';
          }
          showToast(errorMsg, 'error');
        } else {
          // Check if user is banned or deleted
          const user = data?.user;
          if (user) {
            const sb = getSupabase();
            const { data: profile } = await sb.from('profiles').select('is_banned').eq('id', user.id).maybeSingle();
            
            if (!profile) {
              try {
                const username = user.user_metadata?.username || user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Kullanıcı');
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
            navigateToApp();
          }, 1000);
        }
      } catch (err) {
        console.error('Beklenmeyen Giriş Hatası:', err);
        showToast('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
      }

      btn.classList.remove('loading');
      btn.querySelector('span').textContent = loginMode === 'phone' ? 'Doğrula ve Giriş Yap' : 'Giriş Yap';
    });
  }

  // Tab switching for Register
  const tabRegEmail = document.getElementById('tab-register-email');
  const tabRegPhone = document.getElementById('tab-register-phone');
  const regEmailFields = document.getElementById('register-email-fields');
  const regPhoneFields = document.getElementById('register-phone-fields');
  const btnRegister = document.getElementById('btn-register');
  const btnRegSendOtp = document.getElementById('btn-register-send-otp');
  let regMode = 'email';
  let regOtpSent = false;

  if (tabRegEmail && tabRegPhone) {
    tabRegEmail.addEventListener('click', () => {
      regMode = 'email';
      tabRegEmail.style.borderColor = 'var(--green)';
      tabRegEmail.style.color = 'var(--green)';
      tabRegPhone.style.borderColor = 'rgba(255,255,255,0.2)';
      tabRegPhone.style.color = '#fff';
      regEmailFields.style.display = 'block';
      regPhoneFields.style.display = 'none';
      btnRegister.style.display = 'block';
      btnRegSendOtp.style.display = 'none';
    });
    tabRegPhone.addEventListener('click', () => {
      regMode = 'phone';
      tabRegPhone.style.borderColor = 'var(--green)';
      tabRegPhone.style.color = 'var(--green)';
      tabRegEmail.style.borderColor = 'rgba(255,255,255,0.2)';
      tabRegEmail.style.color = '#fff';
      regEmailFields.style.display = 'none';
      regPhoneFields.style.display = 'block';
      
      if (regOtpSent) {
        btnRegister.style.display = 'block';
        btnRegSendOtp.style.display = 'none';
      } else {
        btnRegister.style.display = 'none';
        btnRegSendOtp.style.display = 'block';
      }
    });
  }

  if (btnRegSendOtp) {
    btnRegSendOtp.addEventListener('click', async () => {
      let phone = document.getElementById('register-phone').value.trim();
      const username = document.getElementById('register-phone-username').value.trim();
      
      if (!phone || !username) {
        showToast('Lütfen kullanıcı adı ve telefon numaranızı girin', 'error');
        return;
      }
      if (!phone.startsWith('+')) {
        phone = '+90' + phone.replace(/^0+/, '');
      }
      
      btnRegSendOtp.classList.add('loading');
      btnRegSendOtp.querySelector('span').textContent = 'Gönderiliyor...';
      
      try {
        const reserved = await isUsernameReserved(username);
        if (reserved) {
          showToast('Bu kullanıcı adı alınamaz', 'error');
          btnRegSendOtp.classList.remove('loading');
          btnRegSendOtp.querySelector('span').textContent = 'Kod Gönder';
          return;
        }

        const { error } = await signInWithPhone(phone); // phone auth creates user if not exists
        if (error) {
          console.error("Phone OTP Error:", error);
          if (error.status === 400 && error.message.includes("sms provider")) {
            throw new Error("Supabase SMS sağlayıcısı yapılandırılmamış (Twilio vb.).");
          }
          throw error;
        }
        
        showToast('Doğrulama kodu gönderildi', 'success');
        regOtpSent = true;
        document.getElementById('register-otp-input-group').style.display = 'block';
        document.getElementById('register-phone-input-group').style.display = 'none';
        btnRegSendOtp.style.display = 'none';
        btnRegister.style.display = 'block';
        btnRegister.querySelector('span').textContent = 'Kayıt Ol ve Doğrula';
      } catch (err) {
        showToast('Hata: ' + (err.message || 'Bilinmeyen bir hata'), 'error');
      }
      
      btnRegSendOtp.classList.remove('loading');
      btnRegSendOtp.querySelector('span').textContent = 'Kod Gönder';
    });
  }

  // Register handler (Electron auth page)
  if (btnRegister) {
    btnRegister.addEventListener('click', async () => {
      const btn = document.getElementById('btn-register');
      btn.classList.add('loading');
      
      try {
        let authResult = null;
        let registerUsername = '';
        
        if (regMode === 'email') {
          registerUsername = document.getElementById('register-username').value.trim();
          const email = document.getElementById('register-email').value.trim();
          const password = document.getElementById('register-password').value;
          
          if (!registerUsername || !email || !password) {
            showToast('Lütfen tüm alanları doldurun', 'error');
            btn.classList.remove('loading');
            return;
          }

          if (password.length < 6) {
            showToast('Şifre en az 6 karakter olmalıdır', 'error');
            btn.classList.remove('loading');
            return;
          }

          btn.querySelector('span').textContent = 'Kayıt olunuyor...';
          
          const reserved = await isUsernameReserved(registerUsername);
          if (reserved) {
            showToast('Bu kullanıcı adı alınamaz', 'error');
            btn.classList.remove('loading');
            btn.querySelector('span').textContent = 'Kayıt Ol';
            return;
          }
          
          authResult = await signUpWithEmail(email, password, registerUsername);
          
        } else if (regMode === 'phone' && regOtpSent) {
          registerUsername = document.getElementById('register-phone-username').value.trim();
          let phone = document.getElementById('register-phone').value.trim();
          if (!phone.startsWith('+')) {
            phone = '+90' + phone.replace(/^0+/, '');
          }
          const otp = document.getElementById('register-otp').value.trim();
          
          if (!phone || !otp || !registerUsername) {
            showToast('Lütfen bilgileri ve doğrulama kodunu girin', 'error');
            btn.classList.remove('loading');
            return;
          }
          
          btn.querySelector('span').textContent = 'Doğrulanıyor...';
          authResult = await verifyPhoneOtp(phone, otp);
          
          // Profil güncellemesi gerekebilir çünkü phone ile signup'ta username geçilmiyor
          if (authResult && authResult.data && authResult.data.user) {
             try {
                const sb = getSupabase();
                const user = authResult.data.user;
                const { data: existingProfile } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle();
                
                if (existingProfile) {
                   // existing profile means they logged in instead of registering
                   await sb.from('profiles').update({ username: registerUsername }).eq('id', user.id);
                } else {
                   await sb.from('profiles').insert({ id: user.id, username: registerUsername });
                }
             } catch(e) {
                console.log('Error updating profile username', e);
             }
          }
        }
        
        if (!authResult) {
          btn.classList.remove('loading');
          return;
        }

        const { data, error } = authResult;
        
        if (error) {
          console.error('Kayıt Hatası Detayı:', error);
          let errorMsg = error.message;
          
          if (error.name === 'AuthRetryableFetchError' || error.status === 504 || error.status === 502 || error.status === 503) {
            errorMsg = 'Sunucu şu anda yanıt vermiyor. Lütfen birkaç dakika bekleyip tekrar deneyin.';
          } else if (error.status === 429) {
            errorMsg = 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.';
          } else if (error.status === 422 || (errorMsg && errorMsg.toLowerCase().includes('already registered'))) {
            errorMsg = 'Bu e-posta adresi/telefon zaten kullanımda.';
          } else if (!errorMsg || errorMsg === '{}' || errorMsg === '[object Object]') {
            errorMsg = 'Kayıt başarısız. Lütfen tekrar deneyin.';
          }
          showToast(errorMsg, 'error');
        } else {
          showToast('Kayıt başarılı! Yönlendiriliyorsunuz...', 'success');
          setTimeout(() => {
            if (regMode === 'email') {
              if (registerForm) registerForm.classList.add('hidden');
              if (loginForm) loginForm.classList.remove('hidden');
            } else {
              navigateToApp(); // phone auth already logs you in
            }
          }, 1500);
        }
      } catch (err) {
        console.error('Beklenmeyen Kayıt Hatası:', err);
        showToast('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
      }

      btn.classList.remove('loading');
      btn.querySelector('span').textContent = regMode === 'phone' ? 'Kayıt Ol ve Doğrula' : 'Kayıt Ol';
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
          navigateToApp();
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
      navigateToApp();
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


