// ===== Dashboard Logic =====

document.addEventListener('DOMContentLoaded', async () => {
  const sb = getSupabase();
  if (!sb) {
    window.location.href = 'login.html';
    return;
  }

  // Auth guard
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const user = session.user;
  const userId = user.id;

  // Load profile data
  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single();

    // Avatar
    const avatarEl = document.getElementById('dash-avatar');
    const initialsEl = document.getElementById('dash-avatar-initials');
    const username = profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Kullanıcı';
    
    if (profile?.avatar_url) {
      initialsEl.style.display = 'none';
      const img = document.createElement('img');
      img.src = profile.avatar_url;
      img.alt = 'Avatar';
      avatarEl.insertBefore(img, avatarEl.firstChild);
    } else {
      const initials = username.substring(0, 2).toUpperCase();
      initialsEl.textContent = initials;
    }

    // Profile Info
    document.getElementById('dash-username').textContent = username;
    document.getElementById('dash-email').textContent = user.email || '—';
    document.getElementById('edit-username').value = username;
    document.getElementById('dash-uid').textContent = userId;

    // Created date
    const created = new Date(user.created_at);
    document.getElementById('dash-created').textContent = created.toLocaleDateString('tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // Role badge
    const role = profile?.role || 'user';
    const badge = document.getElementById('dash-role-badge');
    const planEl = document.getElementById('dash-plan');

    const roleMap = {
      admin: { text: 'Admin', css: 'admin', plan: 'Admin' },
      artist: { text: 'Sanatçı', css: 'artist', plan: 'Sanatçı' },
      premium: { text: 'Premium ✨', css: 'premium', plan: 'Premium' },
      user: { text: 'Ücretsiz', css: 'user', plan: 'Ücretsiz Plan' }
    };

    const r = roleMap[role] || roleMap.user;
    badge.textContent = r.text;
    badge.className = 'dash-role-badge ' + r.css;

    if (role === 'premium' || role === 'admin') {
      planEl.innerHTML = `<span class="status-dot active"></span> ${r.plan}`;
    } else {
      planEl.innerHTML = `<span class="status-dot inactive"></span> ${r.plan}`;
    }

    // Avatar upload
    avatarEl.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showDashToast('Dosya 5MB\'dan küçük olmalı', 'error');
          return;
        }
        showDashToast('Yükleniyor...', 'success');
        try {
          const ext = file.name.split('.').pop();
          const filePath = `${userId}/avatar.${ext}`;
          const { error: uploadErr } = await sb.storage.from('avatars').upload(filePath, file, { upsert: true });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = sb.storage.from('avatars').getPublicUrl(filePath);
          const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
          await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
          
          // Update UI
          initialsEl.style.display = 'none';
          let existingImg = avatarEl.querySelector('img');
          if (existingImg) {
            existingImg.src = avatarUrl;
          } else {
            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = 'Avatar';
            avatarEl.insertBefore(img, avatarEl.firstChild);
          }
          showDashToast('Profil fotoğrafı güncellendi! 📸', 'success');
        } catch (err) {
          showDashToast('Yükleme hatası: ' + err.message, 'error');
        }
      };
      input.click();
    });

  } catch (err) {
    console.error('Dashboard load error:', err);
  }

  // Save Username
  document.getElementById('btn-save-username').addEventListener('click', async () => {
    const newUsername = document.getElementById('edit-username').value.trim();
    if (!newUsername) {
      showDashToast('Kullanıcı adı boş olamaz', 'error');
      return;
    }
    try {
      await sb.from('profiles').update({ username: newUsername }).eq('id', userId);
      document.getElementById('dash-username').textContent = newUsername;
      showDashToast('Kullanıcı adı güncellendi ✓', 'success');
    } catch (err) {
      showDashToast('Güncelleme hatası: ' + err.message, 'error');
    }
  });

  // Change Password
  document.getElementById('btn-change-password').addEventListener('click', async () => {
    const newPassword = document.getElementById('edit-password').value;
    if (!newPassword || newPassword.length < 6) {
      showDashToast('Şifre en az 6 karakter olmalıdır', 'error');
      return;
    }
    try {
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw error;
      document.getElementById('edit-password').value = '';
      showDashToast('Şifre başarıyla değiştirildi 🔒', 'success');
    } catch (err) {
      showDashToast('Şifre hatası: ' + err.message, 'error');
    }
  });

  // Logout
  const doLogout = async () => {
    await sb.auth.signOut();
    window.location.href = 'login.html';
  };
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-logout-bottom').addEventListener('click', doLogout);
});

// Toast helper
function showDashToast(message, type = 'error') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 4000);
}
