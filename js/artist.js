const SUPABASE_URL = 'https://dtdsawyynetqlbosrvqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHNhd3l5bmV0cWxib3NydnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0MDUsImV4cCI6MjA5MDEyMTQwNX0.6rKxp51OOj_b1iKtz_21ZkHcvbThNF4w5sPdP7RAua4';

let sb = null;
let currentUser = null;
let currentUserProfile = null;
let currentArtistId = null;
let allSongs = [];
let pendingSongCoverFile = null;
let pendingSongAudioFile = null;

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  checkAuth();
});

async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    await loadUserProfile();
  } else {
    showLoginScreen();
  }
}

async function loadUserProfile() {
  try {
    const { data: profile, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error || !profile) {
      showLoginError('Profil bulunamadı.');
      await sb.auth.signOut();
      showLoginScreen();
      return;
    }

    if (profile.role !== 'artist' && profile.role !== 'admin' && profile.role !== 'yetkili') {
      showLoginError('Bu panele sadece Sanatçılar erişebilir.');
      await sb.auth.signOut();
      showLoginScreen();
      return;
    }

    currentUserProfile = profile;
    
    // Fetch artist id
    const { data: artistData, error: artistError } = await sb
      .from('artists')
      .select('id')
      .eq('name', profile.username)
      .maybeSingle();
      
    if (profile.role === 'artist' && !artistData) {
      showLoginError('Sanatçı profili bulunamadı.');
      return;
    }
    
    currentArtistId = artistData ? artistData.id : null;

    if (profile.theme === 'force_password_change') {
      showForcePasswordScreen();
      return;
    }

    setupUI();
    showAdminPanel();
    loadStats();
    loadSongs();
  } catch (err) {
    console.error('Auth error:', err);
    showLoginError('Sunucu hatası.');
  }
}

function setupUI() {
  document.getElementById('sidebar-username').textContent = currentUserProfile.username || 'Sanatçı';
  document.getElementById('sidebar-role').textContent = currentUserProfile.role || 'artist';
  
  const avatarImg = document.getElementById('sidebar-avatar-img');
  const avatarLetter = document.getElementById('sidebar-avatar-letter');
  
  if (currentUserProfile.avatar_url) {
    avatarImg.src = currentUserProfile.avatar_url;
    avatarImg.style.display = 'block';
    avatarLetter.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarLetter.style.display = 'block';
    avatarLetter.textContent = (currentUserProfile.username || 'A')[0].toUpperCase();
  }
}

// ===== LOGIN / LOGOUT =====

async function handleArtistLogin(e) {
  e.preventDefault();
  const email = document.getElementById('artist-email').value;
  const password = document.getElementById('artist-password').value;
  const btn = document.getElementById('login-btn');
  const errorDiv = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = 'Giriş Yapılıyor...';
  errorDiv.style.display = 'none';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    
    if (error) {
      throw error;
    }

    checkAuth();
  } catch (err) {
    console.error('Login error:', err);
    showLoginError('E-posta veya şifre hatalı.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Giriş Yap';
  }
}

async function artistLogout() {
  await sb.auth.signOut();
  window.location.reload();
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('artist-panel').style.display = 'none';
  document.getElementById('force-password-screen').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('artist-panel').style.display = 'flex';
  document.getElementById('force-password-screen').style.display = 'none';
}

function showForcePasswordScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('artist-panel').style.display = 'none';
  document.getElementById('force-password-screen').style.display = 'flex';
}

function showLoginError(msg) {
  const errorDiv = document.getElementById('login-error');
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const pass1 = document.getElementById('new-password').value;
  const pass2 = document.getElementById('new-password-confirm').value;
  const errorDiv = document.getElementById('password-error');
  const btn = document.getElementById('btn-change-password');
  
  if (pass1 !== pass2) {
    errorDiv.textContent = 'Şifreler eşleşmiyor.';
    errorDiv.style.display = 'block';
    return;
  }
  if (pass1.length < 6) {
    errorDiv.textContent = 'Şifre en az 6 karakter olmalıdır.';
    errorDiv.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor...';
  errorDiv.style.display = 'none';
  
  try {
    // 1. Şifreyi güncelle
    const { error: updateError } = await sb.auth.updateUser({ password: pass1 });
    if (updateError) throw updateError;
    
    // 2. Bayrağı kaldır
    const { error: profileError } = await sb
      .from('profiles')
      .update({ theme: null })
      .eq('id', currentUser.id);
      
    if (profileError) throw profileError;
    
    // 3. Devam et
    showToast('Şifreniz başarıyla oluşturuldu!', 'success');
    
    setupUI();
    showAdminPanel();
    loadStats();
    loadSongs();
    
  } catch (err) {
    console.error('Password change error:', err);
    errorDiv.textContent = 'Bir hata oluştu: ' + (err.message || 'Şifre güncellenemedi.');
    errorDiv.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Şifreyi Kaydet ve Devam Et';
  }
}

// ===== NAVIGATION =====

function switchSection(section) {
  document.querySelectorAll('.sidebar-nav-item').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.sidebar-nav-item[data-section="${section}"]`).classList.add('active');

  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');

  const titles = {
    'overview': { title: 'Genel Bakış', desc: 'Şarkılarınızı ve performansınızı takip edin' },
    'songs': { title: 'Şarkılarım', desc: 'Sisteme yüklediğiniz şarkıları yönetin' }
  };

  document.getElementById('page-title').textContent = titles[section].title;
  document.getElementById('page-desc').textContent = titles[section].desc;
}

// ===== DATA FETCHING =====

async function loadStats() {
  try {
    let query = sb.from('songs').select('id, verified', { count: 'exact' });
    if (currentArtistId) {
      query = query.eq('artist_id', currentArtistId);
    }
    const { data: songsRes, error } = await query;
      
    if (error) throw error;
    
    const totalSongs = songsRes.length;
    const pendingSongs = songsRes.filter(s => !s.verified).length;
    
    document.getElementById('stat-songs').textContent = totalSongs || 0;
    document.getElementById('stat-pending').textContent = pendingSongs || 0;

  } catch (err) {
    console.error('Stats error:', err);
  }
}

async function loadSongs() {
  const container = document.getElementById('songs-container');
  const recentContainer = document.getElementById('recent-songs-container');
  container.innerHTML = '<div class="admin-loader"><div class="spinner"></div></div>';
  recentContainer.innerHTML = '<div class="admin-loader"><div class="spinner"></div></div>';

  try {
    let query = sb.from('songs').select('*, artists ( name )').order('created_at', { ascending: false });
    if (currentArtistId) {
      query = query.eq('artist_id', currentArtistId);
    }
    const { data, error } = await query;

    if (error) throw error;
    
    allSongs = data || [];
    renderSongsTable(allSongs);
    renderRecentSongs(allSongs.slice(0, 5));
  } catch (err) {
    console.error('Load songs error:', err);
    container.innerHTML = '<div class="error-state">Şarkılar yüklenirken hata oluştu.</div>';
    recentContainer.innerHTML = '<div class="error-state">Şarkılar yüklenirken hata oluştu.</div>';
  }
}

function renderSongsTable(songs) {
  const container = document.getElementById('songs-container');
  
  if (songs.length === 0) {
    container.innerHTML = '<div class="empty-state">Henüz hiç şarkınız yok.</div>';
    return;
  }

  let html = `
    <div class="songs-table-wrapper">
      <table class="songs-table">
        <thead>
          <tr>
            <th>Şarkı</th>
            <th>Albüm</th>
            <th>Süre</th>
            <th>Durum</th>
            <th>Yüklenme Tarihi</th>
          </tr>
        </thead>
        <tbody>
  `;

  songs.forEach(song => {
    const coverHtml = song.cover_url 
      ? `<img src="${song.cover_url}" class="song-cover-thumb" alt="Kapak">`
      : `<div class="song-cover-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`;

    const statusHtml = song.verified 
      ? `<span class="song-status approved">Onaylandı</span>`
      : `<span class="song-status pending">Onay Bekliyor</span>`;

    const date = new Date(song.created_at).toLocaleDateString('tr-TR');

    html += `
      <tr>
        <td>
          <div class="song-title-cell">
            ${coverHtml}
            <div class="song-title-text">${escapeHtml(song.title)}</div>
          </div>
        </td>
        <td>${escapeHtml(song.album || '-')}</td>
        <td>${song.duration ? formatTime(song.duration) : '-'}</td>
        <td>${statusHtml}</td>
        <td>${date}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function renderRecentSongs(songs) {
  const container = document.getElementById('recent-songs-container');
  
  if (songs.length === 0) {
    container.innerHTML = '<div class="empty-state">Yüklenmiş şarkı bulunmuyor.</div>';
    return;
  }

  let html = `<div class="artist-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">`;

  songs.forEach(song => {
    const coverUrl = song.cover_url || 'img/default-cover.png';
    const statusText = song.verified ? 'Onaylandı' : 'Bekliyor';
    const statusColor = song.verified ? 'var(--green)' : 'var(--warning)';

    html += `
      <div class="artist-card" style="padding: 16px;">
        <img src="${coverUrl}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; margin-bottom: 12px;" onerror="this.src=''">
        <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(song.title)}</div>
        <div style="font-size: 12px; color: var(--ts); margin-bottom: 12px;">${escapeHtml(song.album || 'Tekli')}</div>
        <div style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px; border: 1px solid ${statusColor}; color: ${statusColor};">
          ${statusText}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function searchSongs(query) {
  if (!query) {
    renderSongsTable(allSongs);
    return;
  }
  
  const q = query.toLowerCase();
  const filtered = allSongs.filter(s => 
    (s.title && s.title.toLowerCase().includes(q)) || 
    (s.album && s.album.toLowerCase().includes(q))
  );
  
  renderSongsTable(filtered);
}

// ===== UPLOAD NEW SONG =====

function openAddSongModal() {
  document.getElementById('add-song-title').value = '';
  document.getElementById('add-song-album').value = '';
  
  document.getElementById('add-song-cover-file').value = '';
  document.getElementById('add-song-cover-file-name').textContent = '';
  document.getElementById('add-song-cover-preview').style.display = 'none';
  pendingSongCoverFile = null;

  document.getElementById('add-song-audio-file').value = '';
  document.getElementById('add-song-audio-file-name').textContent = '';
  pendingSongAudioFile = null;
  
  document.getElementById('add-song-modal').classList.add('show');
}

function closeAddSongModal() {
  document.getElementById('add-song-modal').classList.remove('show');
}

function triggerAddSongCoverUpload() {
  document.getElementById('add-song-cover-file').click();
}

function triggerAddSongAudioUpload() {
  document.getElementById('add-song-audio-file').click();
}

function handleAddSongCoverFileChange(input) {
  const file = input.files[0];
  if (file) {
    pendingSongCoverFile = file;
    document.getElementById('add-song-cover-file-name').textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('add-song-cover-preview');
      preview.src = e.target.result;
      preview.style.display = 'block';
    }
    reader.readAsDataURL(file);
  }
}

function handleAddSongAudioFileChange(input) {
  const file = input.files[0];
  if (file) {
    pendingSongAudioFile = file;
    document.getElementById('add-song-audio-file-name').textContent = file.name;
  }
}

async function saveNewSong() {
  const title = document.getElementById('add-song-title').value.trim();
  const album = document.getElementById('add-song-album').value.trim();
  const btn = document.getElementById('save-new-song-btn');

  if (!title) {
    showToast('Lütfen şarkı başlığını girin.', 'error');
    return;
  }

  if (!pendingSongAudioFile) {
    showToast('Lütfen ses dosyasını yükleyin.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Yükleniyor...';

  try {
    if (!currentArtistId) {
      showToast('Sanatçı profili atanmadığı için şarkı yükleyemezsiniz.', 'error');
      btn.disabled = false;
      btn.textContent = 'Şarkıyı Gönder';
      return;
    }

    // 1. Upload audio
    const audioExt = pendingSongAudioFile.name.split('.').pop();
    const audioFileName = `${currentArtistId}_${Date.now()}_audio.${audioExt}`;
    
    const { error: audioUploadError } = await sb.storage
      .from('songs')
      .upload(audioFileName, pendingSongAudioFile);
      
    if (audioUploadError) throw audioUploadError;
    
    const { data: audioUrlData } = sb.storage.from('songs').getPublicUrl(audioFileName);
    const audioUrl = audioUrlData.publicUrl;

    // 2. Upload cover if exists
    let coverUrl = null;
    if (pendingSongCoverFile) {
      const coverExt = pendingSongCoverFile.name.split('.').pop();
      const coverFileName = `${currentArtistId}_${Date.now()}_cover.${coverExt}`;
      
      const { error: coverUploadError } = await sb.storage
        .from('covers')
        .upload(coverFileName, pendingSongCoverFile);
        
      if (!coverUploadError) {
        const { data: coverUrlData } = sb.storage.from('covers').getPublicUrl(coverFileName);
        coverUrl = coverUrlData.publicUrl;
      }
    }

    // 3. Insert song record
    const { error: insertError } = await sb
      .from('songs')
      .insert({
        title: title,
        album: album || null,
        artist_id: currentArtistId,
        url: audioUrl,
        cover_url: coverUrl,
        duration: 0, // Mock duration or extract from file if needed
        verified: false
      });

    if (insertError) throw insertError;

    showToast('Şarkı başarıyla yüklendi! Onay bekleniyor.', 'success');
    closeAddSongModal();
    loadStats();
    loadSongs();

  } catch (err) {
    console.error('Save song error:', err);
    showToast('Şarkı yüklenirken hata oluştu.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Şarkıyı Gönder';
  }
}

// ===== UTILS =====

function formatTime(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">${escapeHtml(message)}</div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
