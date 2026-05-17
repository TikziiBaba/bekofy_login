// ===== Main App Logic =====

let allSongs = [];
let searchResultSongs = [];
let currentPage = 'home';
let currentUserId = null;
let currentUserRole = 'user';
let userLikedSongIds = new Set();
let userPlaylists = [];
let currentPlaylistId = null;
let currentPlaylistSongs = [];
let artistUsernames = new Set(); // For verified ticks

document.addEventListener('DOMContentLoaded', () => {
  initTitlebar();
  initNavigation();
  initSidebarCollapse();
  initPlayerControls();

  // Wait briefly for elements
  setTimeout(() => {
    initLyricsToggle();
    initLyricShare();
    initLyricsSyncControls();
  }, 500);
  initSearch();
  initPlaylistModal();
  initContextMenu();
  initPlaylistContextMenu();
  initPlaylistDetailActions();
  initAdminActions();
  initProfilePage();
  initArtistPage();
  initLogout();
  initVolumeToggle();
  initProfilePopupClick();
  loadUserInfo();
  loadArtistUsernames();
  loadSongs();
  loadPlaylists();
  setGreeting();
  
  // Load saved player state (last song & volume)
  setTimeout(() => player.loadState(), 500);
});

// ===== Titlebar =====
function initTitlebar() {
  document.getElementById('btn-minimize').addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btn-maximize').addEventListener('click', () => window.electronAPI.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.electronAPI.close());
}

// ===== Sidebar Collapse =====
function initSidebarCollapse() {
  const btn = document.getElementById('btn-collapse-sidebar');
  const sidebar = document.getElementById('sidebar');
  if(btn && sidebar) {
    // Restore state from localStorage
    const isCollapsed = localStorage.getItem('bekofy-sidebar-collapsed') === 'true';
    if(isCollapsed) sidebar.classList.add('collapsed');

    btn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('bekofy-sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
  }
}

// ===== Navigation =====
function initNavigation() {
  document.querySelectorAll('.nav-item, .top-nav-btn[data-page], .top-nav-home').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item, .top-nav-btn').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active');
    pageEl.style.animation = 'none';
    pageEl.offsetHeight; // reflow
    pageEl.style.animation = 'fadeIn 0.3s ease';
  }
  // Scroll to top
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
  // Focus search input when navigating to search
  if (page === 'search') {
    setTimeout(() => {
      const input = document.getElementById('top-search-input');
      if (input) input.focus();
    }, 100);
  }
  // Load library data when navigating to library
  if (page === 'library') {
    loadLibraryPage();
  }
  // Load admin data when navigating to admin
  if (page === 'admin') {
    if (currentUserRole !== 'admin' && currentUserRole !== 'yetkili') {
      showToast('Bu sayfaya erişim yetkiniz yok', 'error');
      navigateTo('home');
      return;
    }
    loadAdminPage();
  }
  // Profile page
  if (page === 'profile') {
    loadProfilePage();
  }
  // Artist upload page
  if (page === 'artist-upload') {
    if (currentUserRole !== 'artist' && currentUserRole !== 'admin') {
      showToast('Bu sayfa sadece sanatçılar için', 'error');
      navigateTo('home');
      return;
    }
    loadArtistPage();
  }
}

// ===== Profile Popup (Discord Style) =====
function initProfilePopupClick() {
  const topUserBtn = document.getElementById('top-user-btn');
  const popup = document.getElementById('discord-profile-popup');
  
  if (topUserBtn && popup) {
    topUserBtn.style.cursor = 'pointer';
    topUserBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // If already active, close it
      if (popup.classList.contains('active')) {
        popup.classList.remove('active');
        return;
      }
      
      try {
        // Populate data before opening
        await updateDiscordPopupData();
      } catch (err) {
        showToast('Kritik Hata: ' + err.message, 'error');
        return;
      }
      
      popup.classList.add('active');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && !topUserBtn.contains(e.target)) {
        popup.classList.remove('active');
        document.getElementById('discord-popup-submenu')?.classList.remove('open');
        const chev = document.getElementById('switch-account-chevron');
        if(chev) chev.style.transform = 'rotate(0deg)';
      }
    });
    
    // Bind buttons
    document.getElementById('btn-discord-edit-profile')?.addEventListener('click', () => {
      popup.classList.remove('active');
      navigateTo('profile');
    });
    
    document.getElementById('btn-discord-copy-id')?.addEventListener('click', () => {
      if (currentUserId) {
        navigator.clipboard.writeText(currentUserId).then(() => {
          showToast('Kullanıcı ID\'si kopyalandı', 'success');
        });
      }
    });

    // DND Toggle
    let isDnd = localStorage.getItem('bekofy_dnd') === 'true';
    const dndBtn = document.getElementById('btn-discord-dnd');
    dndBtn?.addEventListener('click', () => {
      isDnd = !isDnd;
      localStorage.setItem('bekofy_dnd', isDnd);
      updateDndUI();
    });
    
    function updateDndUI() {
      const statusIcon = document.querySelector('.discord-popup-status');
      if (statusIcon && dndBtn) {
        if (isDnd) {
          statusIcon.className = 'discord-popup-status dnd';
          dndBtn.querySelector('span').textContent = 'Rahatsız Etmeyin (Açık)';
          dndBtn.classList.add('discord-danger');
        } else {
          statusIcon.className = 'discord-popup-status online';
          dndBtn.querySelector('span').textContent = 'Rahatsız Etmeyin';
          dndBtn.classList.remove('discord-danger');
        }
      }
    }
    // Set initial DND state if opened
    updateDndUI();

    // Switch Account Toggle
    document.getElementById('btn-discord-switch-account')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const submenu = document.getElementById('discord-popup-submenu');
      const chevron = document.getElementById('switch-account-chevron');
      if (submenu) {
        const isOpen = submenu.classList.toggle('open');
        if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        if (isOpen) {
          saveCurrentAccountSession().then(() => renderAccountSubmenu());
        }
      }
    });
    
    document.getElementById('discord-popup-submenu')?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Logout
    document.getElementById('btn-discord-logout')?.addEventListener('click', () => {
      popup.classList.remove('active');
      const logoutEvent = new Event('click');
      document.getElementById('btn-logout')?.dispatchEvent(logoutEvent); 
      if (window.electronAPI && window.electronAPI.logout) {
        window.electronAPI.logout();
      }
    });
  }
}

// ===== Multi-Account System =====
async function saveCurrentAccountSession() {
  if (!currentUserId) return;
  const username = document.getElementById('user-name').textContent.replace('✓', '').trim();
  const avatarEl = document.getElementById('user-avatar').querySelector('img');
  let avatar = '';
  if (avatarEl) {
    avatar = avatarEl.src;
  } else {
    avatar = document.getElementById('user-avatar').innerHTML; 
  }

  try {
    const sb = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    let accounts = JSON.parse(localStorage.getItem('bekofy_saved_accounts') || '[]');
    accounts = accounts.filter(a => a.id !== currentUserId);
    accounts.push({
      id: currentUserId,
      username: username,
      avatar: avatar,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token
      },
      lastUsed: Date.now()
    });
    
    localStorage.setItem('bekofy_saved_accounts', JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save session for multi-account:', err);
  }
}

window.switchAccountTo = async function(accountId) {
  let accounts = JSON.parse(localStorage.getItem('bekofy_saved_accounts') || '[]');
  const account = accounts.find(a => a.id === accountId);
  if (!account) return;
  
  const sb = typeof getSupabase === 'function' ? getSupabase() : null;
  if (!sb) return;
  
  try {
    showToast('Hesap değiştiriliyor...', 'info');
    const { data, error } = await sb.auth.setSession({
      access_token: account.session.access_token,
      refresh_token: account.session.refresh_token
    });
    if (error) throw error;
    window.location.reload();
  } catch (err) {
    showToast('Hesaba geçiş yapılamadı, tekrar giriş yapın.', 'error');
    accounts = accounts.filter(a => a.id !== accountId);
    localStorage.setItem('bekofy_saved_accounts', JSON.stringify(accounts));
  }
};

window.addNewAccount = function() {
  if (typeof signOut === 'function') {
    signOut().then(() => {
       if (window.electronAPI && window.electronAPI.navigateToAuth) window.electronAPI.navigateToAuth();
    });
  }
};

function renderAccountSubmenu() {
  const submenu = document.getElementById('discord-popup-submenu');
  if (!submenu) return;
  let accounts = JSON.parse(localStorage.getItem('bekofy_saved_accounts') || '[]');
  accounts.sort((a,b) => b.lastUsed - a.lastUsed);
  
  let html = '';
  accounts.forEach(acc => {
    const isCurrent = acc.id === currentUserId;
    let avatarHtml = `<div class="account-item-avatar">${acc.avatar.startsWith('<svg') ? acc.avatar : `<img src="${acc.avatar}">`}</div>`;
    html += `
      <button class="account-item" ${isCurrent ? '' : `onclick="window.switchAccountTo('${acc.id}')"`}>
        ${avatarHtml}
        <div class="account-item-info">
          <span class="account-item-name">${escapeHtml(acc.username)}</span>
        </div>
        ${isCurrent ? `<div class="account-item-check"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>` : ''}
      </button>
    `;
  });
  
  html += `
    <button class="account-item" onclick="window.addNewAccount()">
      <div class="account-item-avatar" style="background: transparent;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#23a559"><path d="M12 5v14M5 12h14"/></svg>
      </div>
      <div class="account-item-info">
        <span class="account-item-name account-item-add">Yeni Hesap Ekle</span>
      </div>
    </button>
  `;
  submenu.innerHTML = html;
}

async function updateDiscordPopupData() {
  // Username & Badges
  const usernameEl = document.getElementById('discord-popup-username');
  if (currentUserRole === 'artist') {
    usernameEl.innerHTML = `${escapeHtml(document.getElementById('user-name').textContent.replace('✓', '').trim())} ${getVerifiedTick()}`;
  } else {
    usernameEl.textContent = document.getElementById('user-name').textContent.replace('✓', '').trim();
  }

  // Avatar
  const avatarEl = document.getElementById('discord-popup-avatar');
  avatarEl.innerHTML = document.getElementById('user-avatar').innerHTML;
  
  // Banner
  const bannerEl = document.getElementById('discord-popup-banner');
  if (window.currentUserBannerUrl) {
    bannerEl.style.backgroundImage = `url('${window.currentUserBannerUrl}')`;
  } else {
    bannerEl.style.backgroundImage = '';
  }

  // Currently Playing (Rich Presence)
  const actText = document.querySelector('.discord-popup-activity-text');
  const actSub = document.querySelector('.discord-popup-activity-subtext');
  const actIcon = document.querySelector('.discord-popup-activity-icon');

  // Check global music player state if available. We can check UI for current song.
  const nowPlayingTitle = document.getElementById('now-playing-title');
  const nowPlayingArtist = document.getElementById('now-playing-artist');
  const nowPlayingCover = document.getElementById('now-playing-cover');
  
  if (nowPlayingTitle && nowPlayingTitle.textContent !== 'Şarkı seçilmedi' && nowPlayingTitle.textContent !== 'Şarkı Seçilmedi') {
    actText.textContent = nowPlayingTitle.textContent;
    actSub.textContent = nowPlayingArtist ? nowPlayingArtist.textContent : 'Bekofy';
    
    // Check if the container has an image inside
    const imgEl = nowPlayingCover ? nowPlayingCover.querySelector('img') : null;
    
    if (imgEl && imgEl.src && !imgEl.src.endsWith('default-cover.svg')) {
      actIcon.innerHTML = `<img src="${imgEl.src}" alt="cover">`;
    } else {
      actIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    }
  } else {
    actText.textContent = 'Şu an bir şey çalmıyor';
    actSub.textContent = 'Bekofy';
    actIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
  }
}


// ===== Load Artist Usernames for Verified Ticks =====
async function loadArtistUsernames() {
  try {
    const { data } = await getArtistProfiles();
    if (data) {
      artistUsernames = new Set(data.map(p => (p.name || p.username || '').toLowerCase()));
    }
  } catch (e) {
    console.log('Artist profiles load error:', e);
  }
}

function getVerifiedTick(artistName) {
  if (!artistName) return '';
  if (artistUsernames.has(artistName.toLowerCase())) {
    return '<span class="verified-tick" title="Onaylı Sanatçı">✓</span>';
  }
  return '';
}

function formatArtistLinks(artistStr) {
  if (!artistStr) return '';
  const artists = artistStr.split(',').map(a => a.trim()).filter(Boolean);
  return artists.map(artist => {
    return `<span class="artist-link" data-artist-name="${escapeHtml(artist)}">${escapeHtml(artist)}${getVerifiedTick(artist)}</span>`;
  }).join(', ');
}

// ===== Greeting =====
function setGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 6) greeting = 'İyi Geceler';
  else if (hour < 12) greeting = 'Günaydın';
  else if (hour < 18) greeting = 'İyi Günler';
  else greeting = 'İyi Akşamlar';
  const h1 = document.querySelector('#page-home .page-header h1');
  if (h1) h1.textContent = greeting;
}

// ===== Load User Info & Ensure Profile =====
async function loadUserInfo() {
  try {
    const user = await getCurrentUser();
    if (user) {
      currentUserId = user.id;
      const displayName = user.user_metadata?.username || user.email?.split('@')[0] || 'Kullanıcı';
      
      const nameEl = document.getElementById('user-name');
      nameEl.childNodes[0].textContent = displayName + ' ';
      document.getElementById('user-email').textContent = user.email || '';
      
      // Profil yoksa oluştur
      await ensureProfile(user.id, displayName);
      // Beğenilen şarkıları yükle
      await loadLikedSongs();
      // Avatar yükle
      await loadUserAvatar(user.id, displayName);
      // Rol kontrolü
      await loadUserRole(user.id);
    }
  } catch (err) {
    console.log('User info load error:', err);
  }
}

async function loadUserRole(userId) {
  try {
    currentUserRole = await fetchUserRole(userId);
    const badge = document.getElementById('role-badge');
    const adminNav = document.getElementById('nav-admin');
    const artistNav = document.getElementById('nav-artist-upload');
    
    const roleConfig = {
      admin:   { text: 'Admin',    css: 'admin',   admin: true,  artist: true },
      yetkili: { text: 'Yetkili',  css: 'yetkili', admin: true,  artist: false },
      artist:  { text: 'Sanatçı',  css: 'artist',  admin: false, artist: true },
      premium: { text: 'Premium',  css: 'premium', admin: false, artist: false },
      user:    { text: null,       css: null,      admin: false, artist: false },
    };
    
    const cfg = roleConfig[currentUserRole] || roleConfig.user;
    
    if (cfg.text) {
      badge.textContent = cfg.text;
      badge.className = 'role-badge ' + cfg.css;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
    
    adminNav.style.display = cfg.admin ? 'flex' : 'none';
    artistNav.style.display = cfg.artist ? 'flex' : 'none';
    
    // Also toggle top-bar buttons
    const topAdmin = document.getElementById('btn-top-admin');
    const topArtist = document.getElementById('btn-top-artist-upload');
    if (topAdmin) topAdmin.style.display = cfg.admin ? 'flex' : 'none';
    if (topArtist) topArtist.style.display = cfg.artist ? 'flex' : 'none';
  } catch (err) {
    console.log('Role load error:', err);
  }
}

async function loadUserAvatar(userId, displayName) {
  try {
    const sb = getSupabase();
    const { data: profile } = await sb.from('profiles').select('avatar_url').eq('id', userId).single();
    const avatarEl = document.getElementById('user-avatar');
    const topAvatarEl = document.getElementById('top-user-avatar');
    
    if (profile && profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      if (topAvatarEl) topAvatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      // Varsayılan avatar (baş harfler ile)
      const initials = getInitials(displayName);
      const color = getAvatarColor(displayName);
      const avatarHtml = `<div class="avatar-initials" style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">${initials}</div>`;
      avatarEl.innerHTML = avatarHtml;
      if (topAvatarEl) topAvatarEl.innerHTML = avatarHtml;
    }
  } catch (err) {
    console.log('Avatar load error:', err);
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const colors = ['#1DB954','#E91E63','#9C27B0','#3F51B5','#009688','#FF5722','#795548','#607D8B','#F44336','#2196F3','#4CAF50','#FF9800'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

async function openAvatarUpload(userId, displayName) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Dosya 5MB\'dan küçük olmalı', 'error');
      return;
    }
    showToast('Yükleniyor...', 'success');
    try {
      const sb = getSupabase();
      const ext = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${ext}`;
      
      const { error: uploadError } = await sb.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) { 
        console.error('Upload Error Detailed:', uploadError);
        showToast('Yükleme hatası: ' + (uploadError.message || JSON.stringify(uploadError)), 'error'); 
        return; 
      }
      
      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
      
      await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
      
      await loadUserAvatar(userId, displayName);
      showToast('Profil fotoğrafı güncellendi! 📸', 'success');
    } catch (err) {
      showToast('Yükleme sırasında hata oluştu', 'error');
    }
  };
  input.click();
}

async function ensureProfile(userId, username) {
  try {
    const sb = getSupabase();
    // Önce profil var mı kontrol et
    const { data } = await sb.from('profiles').select('id').eq('id', userId).single();
    if (!data) {
      // Profil yoksa oluştur
      await sb.from('profiles').insert({ id: userId, username: username });
    }
  } catch (err) {
    // Profil zaten var veya hata - devam et
    try {
      const sb = getSupabase();
      await sb.from('profiles').upsert({ id: userId, username: username }, { onConflict: 'id' });
    } catch (e) {
      console.log('Profile ensure error:', e);
    }
  }
}

// ===== Load Songs =====
let _songsSubscribed = false;

async function loadSongs() {
  try {
    let { data, error } = await fetchApprovedSongs();
    if (error) {
      console.warn('Songs fetch error, falling back to fetchAllSongs:', error);
      const fallback = await fetchAllSongs();
      data = fallback.data;
      error = fallback.error;
    }
    
    if (error) {
      showEmptyState('recent-songs', 'Şarkılar yüklenemedi');
      showEmptyState('all-songs', 'Şarkılar yüklenemedi');
      return;
    }
    allSongs = data || [];
    renderRecentSongs(allSongs.slice(0, 8));
    renderAllSongs(allSongs);
    renderRecommendedSongs();
    renderQuickPicks(allSongs);
    renderHomePopularArtists(allSongs);
    renderTopLikedSongs(allSongs);
    initMoodCards();
    
    // Subscribe to realtime updates only once
    if (!_songsSubscribed) {
      subscribeToSongs((payload) => {
        console.log('Realtime update:', payload);
        loadSongs();
      });
      _songsSubscribed = true;
    }
  } catch (err) {
    console.error('Songs load error:', err);
    showEmptyState('recent-songs', 'Şarkılar yüklenemedi');
    showEmptyState('all-songs', 'Şarkılar yüklenemedi');
  }
}

// ===== Render Song Cards =====
function renderRecentSongs(songs) {
  const container = document.getElementById('recent-songs');
  if (!songs || songs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <p>Henüz şarkı eklenmemiş</p>
      <small style="color:var(--tm);font-size:13px">Supabase'den şarkı ekleyin</small>
    </div>`;
    return;
  }
  container.innerHTML = songs.map(song => createSongCard(song)).join('');
}

// ===== Discover Weekly Logic =====
let discoverWeeklyCache = null;
async function playDiscoverWeekly() {
  if (allSongs.length === 0) return;
  
  if (!discoverWeeklyCache) {
    if (currentUserId) {
      discoverWeeklyCache = await getRecommendedSongs(currentUserId, allSongs, userLikedSongIds);
      // Make it longer for discover weekly (up to 30)
      if (discoverWeeklyCache.length < 30) {
        const remaining = allSongs.filter(s => 
          !userLikedSongIds.has(s.id) && 
          !discoverWeeklyCache.find(r => r.id === s.id)
        ).sort(() => Math.random() - 0.5);
        discoverWeeklyCache.push(...remaining.slice(0, 30 - discoverWeeklyCache.length));
      }
    } else {
      discoverWeeklyCache = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 30);
    }
  }
  
  if (discoverWeeklyCache && discoverWeeklyCache.length > 0) {
    player.playSong(discoverWeeklyCache[0], discoverWeeklyCache);
    showToast('Haftalık Keşif listesi başlatıldı 🎵', 'success');
  }
}

// Add event listener to banner
document.addEventListener('DOMContentLoaded', () => {
  const btnDiscover = document.getElementById('btn-play-discover');
  if (btnDiscover) {
    btnDiscover.addEventListener('click', (e) => {
      e.stopPropagation();
      playDiscoverWeekly();
    });
  }
  
  const bannerDiscover = document.getElementById('discover-weekly-btn');
  if (bannerDiscover) {
    bannerDiscover.addEventListener('click', () => {
      playDiscoverWeekly();
    });
  }
});

async function renderRecommendedSongs() {
  const container = document.getElementById('recommended-songs');
  if (!container) return;
  
  if (!currentUserId || allSongs.length === 0) {
    // Kullanıcı giriş yapmamışsa veya şarkı yoksa son eklenenlerden rastgele göster
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
    if (shuffled.length > 0) {
      container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
    } else {
      container.innerHTML = `<div class="empty-state"><p>Henüz öneri yok</p></div>`;
    }
    return;
  }
  
  try {
    const recommended = await getRecommendedSongs(currentUserId, allSongs, userLikedSongIds);
    if (recommended.length > 0) {
      container.innerHTML = recommended.map(song => createSongCard(song)).join('');
    } else {
      // Fallback: rastgele şarkılar
      const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
      container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
    }
  } catch (err) {
    console.error('Recommendations error:', err);
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 8);
    container.innerHTML = shuffled.map(song => createSongCard(song)).join('');
  }
}

function createSongCard(song) {
  const coverHtml = song.cover_url 
    ? `<img src="${song.cover_url}" alt="${escapeHtml(song.title)}" onerror="this.style.display='none'">` 
    : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
  
  return `
    <div class="song-card" data-song-id="${song.id}">
      <div class="song-card-cover">
        ${coverHtml}
        <button class="song-card-play" data-play-id="${song.id}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
      <div class="song-card-title">${escapeHtml(song.title)}</div>
      <div class="song-card-artist">${formatArtistLinks(song.artist)}</div>
    </div>
  `;
}

function renderAllSongs(songs) {
  const container = document.getElementById('all-songs');
  if (!songs || songs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <p>Henüz şarkı eklenmemiş</p>
    </div>`;
    return;
  }
  container.innerHTML = `
    <div class="song-list-header">
      <span>#</span>
      <span>Başlık</span>
      <span>Albüm</span>
      <span>Süre</span>
    </div>
    ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
  `;
}

function renderSongListItem(song, num) {
  const coverHtml = song.cover_url 
    ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">` 
    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

  return `
    <div class="song-list-item" data-song-id="${song.id}">
      <div class="song-list-num">${num}</div>
      <div class="song-list-info">
        <div class="song-list-cover">${coverHtml}</div>
        <div class="song-list-details">
          <div class="song-list-title">${escapeHtml(song.title)}</div>
          <div class="song-list-subtitle">${formatArtistLinks(song.artist)}</div>
        </div>
      </div>
      <div class="song-list-album">${escapeHtml(song.album || '—')}</div>
      <div class="song-list-duration">${formatDuration(song.duration)}</div>
    </div>
  `;
}

// ===== Quick Picks (compact horizontal cards) =====
function renderQuickPicks(songs) {
  const container = document.getElementById('quick-picks');
  if (!container || !songs || songs.length === 0) {
    if (container) container.innerHTML = '';
    return;
  }
  const picks = [...songs].sort(() => Math.random() - 0.5).slice(0, 6);
  container.innerHTML = picks.map(song => {
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    return `
      <div class="quick-pick-card" data-song-id="${song.id}">
        <div class="quick-pick-cover">${coverHtml}</div>
        <div class="quick-pick-title">${escapeHtml(song.title)}</div>
      </div>`;
  }).join('');
}

// ===== Popular Artists on Home =====
function renderHomePopularArtists(songs) {
  const container = document.getElementById('home-popular-artists');
  if (!container || !songs || songs.length === 0) {
    if (container) container.innerHTML = '<div class="empty-state"><p>Henüz sanatçı yok</p></div>';
    return;
  }
  
  // Count songs per artist
  const artistMap = {};
  songs.forEach(s => {
    if (!s.artist) return;
    s.artist.split(',').map(a => a.trim()).filter(Boolean).forEach(name => {
      if (!artistMap[name]) artistMap[name] = { name, count: 0, cover: null };
      artistMap[name].count++;
      if (s.cover_url && !artistMap[name].cover) artistMap[name].cover = s.cover_url;
    });
  });

  const artists = Object.values(artistMap).sort((a, b) => b.count - a.count).slice(0, 12);
  
  container.innerHTML = artists.map(artist => {
    const avatarHtml = artist.cover
      ? `<img src="${artist.cover}" alt="${escapeHtml(artist.name)}">`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    return `
      <div class="home-artist-card" data-artist-name="${escapeHtml(artist.name)}">
        <div class="home-artist-avatar">${avatarHtml}</div>
        <div class="home-artist-name">${escapeHtml(artist.name)} ${getVerifiedTick(artist.name)}</div>
        <div class="home-artist-role">${artist.count} şarkı</div>
      </div>`;
  }).join('');

  // Click handler
  container.querySelectorAll('.home-artist-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.artistName;
      if (name) openArtistProfile(name);
    });
  });
}

// ===== Top Liked Songs =====
function renderTopLikedSongs(songs) {
  const container = document.getElementById('top-liked-songs');
  if (!container || !songs || songs.length === 0) {
    if (container) container.innerHTML = '<div class="empty-state"><p>Henüz beğenilen şarkı yok</p></div>';
    return;
  }
  // Show songs that the user liked, or fallback to random popular
  const liked = songs.filter(s => userLikedSongIds.has(s.id));
  const toShow = liked.length >= 4 ? liked.slice(0, 8) : [...songs].sort(() => Math.random() - 0.5).slice(0, 8);
  container.innerHTML = toShow.map(song => createSongCard(song)).join('');
}

// ===== Mood Cards Click =====
function initMoodCards() {
  document.querySelectorAll('.mood-card[data-mood]').forEach(card => {
    card.addEventListener('click', () => {
      const mood = card.dataset.mood;
      // Navigate to search and filter
      navigateTo('search');
      const input = document.getElementById('top-search-input');
      if (input) {
        input.value = mood;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
}

// ===== Event Delegation for Song Clicks =====
document.addEventListener('click', (e) => {
  // Artist name click - open artist profile
  const artistLink = e.target.closest('.artist-link[data-artist-name]');
  if (artistLink) {
    e.stopPropagation();
    e.preventDefault();
    const artistName = artistLink.dataset.artistName;
    if (artistName) openArtistProfile(artistName);
    return;
  }
  
  // Song card play button
  const playBtn = e.target.closest('[data-play-id]');
  if (playBtn) {
    e.stopPropagation();
    const id = playBtn.dataset.playId;
    playSongFromAny(id);
    return;
  }
  
  // Song card click
  const songCard = e.target.closest('.song-card[data-song-id]');
  if (songCard) {
    playSongFromAny(songCard.dataset.songId);
    return;
  }

  // Quick pick card click
  const quickPick = e.target.closest('.quick-pick-card[data-song-id]');
  if (quickPick) {
    playSongFromAny(quickPick.dataset.songId);
    return;
  }
  
  // Song list item click
  const songItem = e.target.closest('.song-list-item[data-song-id]');
  if (songItem) {
    playSongFromAny(songItem.dataset.songId);
    return;
  }
  
  // Playlist item click (sidebar)
  const playlistItem = e.target.closest('.playlist-item[data-playlist-id]');
  if (playlistItem) {
    openPlaylistDetail(playlistItem.dataset.playlistId);
    return;
  }
  
  // Playlist card click (library page)
  const playlistCard = e.target.closest('.playlist-card[data-playlist-id]');
  if (playlistCard) {
    openPlaylistDetail(playlistCard.dataset.playlistId);
    return;
  }
});

// ===== Play Song From Any List =====
function playSongFromAny(id) {
  // Önce playlist şarkılarında ara
  if (currentPlaylistSongs.length > 0) {
    const song = currentPlaylistSongs.find(s => s.id === id);
    if (song) {
      player.playSong(song, currentPlaylistSongs);
      return;
    }
  }
  
  // allSongs'da ara
  let song = allSongs.find(s => s.id === id);
  let songList = allSongs;
  
  // Bulamazsa search sonuçlarında ara
  if (!song && searchResultSongs.length > 0) {
    song = searchResultSongs.find(s => s.id === id);
    songList = searchResultSongs;
  }
  
  if (song) {
    player.playSong(song, songList);
  }
}

function findSongById(id) {
  // Playlist şarkılarında ara
  if (currentPlaylistSongs.length > 0) {
    const song = currentPlaylistSongs.find(s => s.id === id);
    if (song) return song;
  }
  // allSongs'da ara
  let song = allSongs.find(s => s.id === id);
  if (song) return song;
  // Search sonuçlarında ara
  if (searchResultSongs.length > 0) {
    song = searchResultSongs.find(s => s.id === id);
    if (song) return song;
  }
  return null;
}

// ===== Player Controls =====
function initPlayerControls() {
  document.getElementById('btn-play').addEventListener('click', () => player.togglePlay());
  document.getElementById('btn-next').addEventListener('click', () => player.next());
  document.getElementById('btn-prev').addEventListener('click', () => player.previous());
  document.getElementById('btn-shuffle').addEventListener('click', () => player.toggleShuffle());
  document.getElementById('btn-repeat').addEventListener('click', () => player.toggleRepeat());

  // Fullscreen controls
  const fsBtnPlay = document.getElementById('fs-btn-play-pause');
  const fsBtnNext = document.getElementById('fs-btn-next');
  const fsBtnPrev = document.getElementById('fs-btn-prev');
  if (fsBtnPlay) fsBtnPlay.addEventListener('click', () => player.togglePlay());
  if (fsBtnNext) fsBtnNext.addEventListener('click', () => player.next());
  if (fsBtnPrev) fsBtnPrev.addEventListener('click', () => player.previous());

  // Fullscreen open/close
  const npCover = document.getElementById('now-playing-cover');
  const fsClose = document.getElementById('fs-close');
  if (npCover) npCover.addEventListener('click', () => player.toggleFullscreen());
  if (fsClose) fsClose.addEventListener('click', () => player.toggleFullscreen());
  npCover.style.cursor = 'pointer';

  // Progress bar - click & drag
  const progressBar = document.getElementById('progress-bar');
  const fsProgressBar = document.getElementById('fs-progress-bar');
  let isDraggingProgress = false;
  
  const seekFromEvent = (e, bar) => {
    const rect = bar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    player.seek(percent);
  };
  
  progressBar.addEventListener('mousedown', (e) => {
    isDraggingProgress = true;
    seekFromEvent(e, progressBar);
  });
  
  if (fsProgressBar) {
    fsProgressBar.addEventListener('mousedown', (e) => {
      isDraggingProgress = true;
      seekFromEvent(e, fsProgressBar);
    });
  }
  
  document.addEventListener('mousemove', (e) => {
    if (isDraggingProgress) {
      if (player.isFullscreen) {
        seekFromEvent(e, fsProgressBar);
      } else {
        seekFromEvent(e, progressBar);
      }
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDraggingProgress = false;
  });

  // Volume slider - click & drag
  const volumeSlider = document.getElementById('volume-slider');
  let isDraggingVolume = false;
  
  const setVolumeFromEvent = (e) => {
    const rect = volumeSlider.getBoundingClientRect();
    const vol = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    player.setVolume(vol);
  };
  
  volumeSlider.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    setVolumeFromEvent(e);
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) setVolumeFromEvent(e);
  });
  
  document.addEventListener('mouseup', () => {
    isDraggingVolume = false;
  });

  // Like button (player bar)
  document.getElementById('btn-like').addEventListener('click', async function() {
    const currentSong = player.getCurrentSong();
    if (!currentSong || !currentUserId) return;
    await toggleLikeSong(currentSong.id);
  });
}

// ===== Volume Toggle (Mute/Unmute) =====
function initVolumeToggle() {
  let previousVolume = 0.7;
  document.getElementById('btn-volume-icon').addEventListener('click', () => {
    if (player.volume > 0) {
      previousVolume = player.volume;
      player.setVolume(0);
    } else {
      player.setVolume(previousVolume);
    }
  });
}

// ===== Search =====
let searchHistoryItems = [];
const SEARCH_HISTORY_KEY = 'bekofy_search_history';
const MAX_SEARCH_HISTORY = 8;

function loadSearchHistory() {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    searchHistoryItems = stored ? JSON.parse(stored) : [];
  } catch { searchHistoryItems = []; }
}

function saveSearchHistory() {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistoryItems.slice(0, MAX_SEARCH_HISTORY)));
  } catch {}
}

function addToSearchHistory(query) {
  if (!query || query.length < 2) return;
  // Remove duplicate
  searchHistoryItems = searchHistoryItems.filter(h => h.toLowerCase() !== query.toLowerCase());
  // Add to front
  searchHistoryItems.unshift(query);
  searchHistoryItems = searchHistoryItems.slice(0, MAX_SEARCH_HISTORY);
  saveSearchHistory();
}

function removeFromSearchHistory(query) {
  searchHistoryItems = searchHistoryItems.filter(h => h.toLowerCase() !== query.toLowerCase());
  saveSearchHistory();
  showSearchDiscovery();
}

async function showSearchDiscovery() {
  const container = document.getElementById('search-results');
  let html = '';
  
  // 1. Recent searches
  if (searchHistoryItems.length > 0) {
    html += `
      <div class="search-discovery-section">
        <div class="search-discovery-header">
          <h2 class="section-title">🕐 Son Aramalar</h2>
          <button class="btn-clear-history" onclick="clearSearchHistory()">Tümünü Temizle</button>
        </div>
        <div class="search-history-list">
          ${searchHistoryItems.map(item => `
            <div class="search-history-item" data-query="${escapeHtml(item)}">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" opacity="0.4"><path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
              <span class="search-history-text">${escapeHtml(item)}</span>
              <button class="search-history-remove" data-remove="${escapeHtml(item)}" title="Kaldır">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // 2. Popular Artists
  try {
    const sb = getSupabase();
    const [artistsRes, profilesRes] = await Promise.all([
      sb.from('artists').select('id, name, avatar_url').order('name').limit(20),
      sb.from('profiles').select('id, username, avatar_url, role').eq('role', 'artist').order('username').limit(10)
    ]);
    
    const seen = new Set();
    const allArtistsDiscovery = [];
    
    for (const p of (profilesRes.data || [])) {
      const key = (p.username || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        allArtistsDiscovery.push({ name: p.username, avatar_url: p.avatar_url, source: 'profile' });
      }
    }
    for (const a of (artistsRes.data || [])) {
      const key = (a.name || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        allArtistsDiscovery.push({ name: a.name, avatar_url: a.avatar_url, source: 'artist' });
      }
    }
    
    if (allArtistsDiscovery.length > 0) {
      html += `
        <div class="search-discovery-section">
          <h2 class="section-title">🎤 Sanatçılar</h2>
          <div class="discovery-artists-grid">
            ${allArtistsDiscovery.slice(0, 12).map(a => {
              const initials = getInitials(a.name);
              const color = getAvatarColor(a.name);
              const avatarHtml = a.avatar_url 
                ? `<img src="${a.avatar_url}" alt="${escapeHtml(a.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
              return `
                <div class="discovery-artist-card" data-artist-name="${escapeHtml(a.name)}">
                  <div class="discovery-artist-avatar">
                    ${avatarHtml}
                    <div class="discovery-artist-avatar-fallback" ${a.avatar_url ? 'style="display:none"' : ''} style="background:${color}">${initials}</div>
                  </div>
                  <div class="discovery-artist-name">${escapeHtml(a.name)}${getVerifiedTick(a.name)}</div>
                  <div class="discovery-artist-role">Sanatçı</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.log('Discovery artists error:', err);
  }
  
  // 3. Trending / Popular songs (based on likes or recent)
  if (allSongs.length > 0) {
    // Show recently added songs
    const recentSongs = [...allSongs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
    
    if (recentSongs.length > 0) {
      html += `
        <div class="search-discovery-section">
          <h2 class="section-title">🔥 Popüler</h2>
          <div class="discovery-songs-list">
            ${recentSongs.map((song, i) => {
              const coverHtml = song.cover_url 
                ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">` 
                : `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
              return `
                <div class="discovery-song-item" data-song-id="${song.id}">
                  <div class="discovery-song-rank">${i + 1}</div>
                  <div class="discovery-song-cover">${coverHtml}</div>
                  <div class="discovery-song-info">
                    <div class="discovery-song-title">${escapeHtml(song.title)}</div>
                    <div class="discovery-song-artist">${formatArtistLinks(song.artist)}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    // Browse by genre/mood categories
    const categories = [
      { emoji: '🎵', label: 'Tüm Şarkılar', color: '#1DB954' },
      { emoji: '❤️', label: 'Beğenilenler', color: '#e74c3c' },
      { emoji: '🆕', label: 'Yeni Eklenenler', color: '#9b59b6' },
      { emoji: '🎲', label: 'Rastgele Keşfet', color: '#e67e22' },
    ];
    
    html += `
      <div class="search-discovery-section">
        <h2 class="section-title">📂 Göz At</h2>
        <div class="discovery-categories-grid">
          ${categories.map(cat => `
            <div class="discovery-category-card" data-category="${cat.label}" style="background:linear-gradient(135deg, ${cat.color}22, ${cat.color}08);border-color:${cat.color}33">
              <span class="discovery-category-emoji">${cat.emoji}</span>
              <span class="discovery-category-label">${cat.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  if (!html) {
    html = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64" opacity="0.2"><path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 101.414-1.414l-4.344-4.344a9.157 9.157 0 002.077-5.816c0-5.14-4.226-9.28-9.407-9.28zm-7.407 9.279c0-4.006 3.302-7.28 7.407-7.28s7.407 3.274 7.407 7.28-3.302 7.279-7.407 7.279-7.407-3.273-7.407-7.28z"/></svg>
        <p>Dinlemek istediğin şarkıyı ara</p>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Bind discovery events
  bindDiscoveryEvents();
}

function bindDiscoveryEvents() {
  const container = document.getElementById('search-results');
  
  // Search history items - click to search
  container.querySelectorAll('.search-history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.search-history-remove')) return;
      const query = item.dataset.query;
      document.getElementById('top-search-input').value = query;
      document.getElementById('top-search-input').dispatchEvent(new Event('input'));
    });
  });
  
  // Search history remove buttons
  container.querySelectorAll('.search-history-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromSearchHistory(btn.dataset.remove);
    });
  });
  
  // Artist cards - click to view profile
  container.querySelectorAll('.discovery-artist-card').forEach(card => {
    card.addEventListener('click', () => {
      const artistName = card.dataset.artistName;
      if (artistName) openArtistProfile(artistName);
    });
  });
  
  // Song items - click to play
  container.querySelectorAll('.discovery-song-item').forEach(item => {
    item.addEventListener('click', () => {
      const songId = item.dataset.songId;
      if (songId) playSongFromAny(songId);
    });
  });
  
  // Category cards
  container.querySelectorAll('.discovery-category-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.category;
      if (cat === 'Tüm Şarkılar') {
        searchResultSongs = [...allSongs];
        renderSearchResults(allSongs, 'Tüm Şarkılar');
      } else if (cat === 'Beğenilenler') {
        const liked = allSongs.filter(s => userLikedSongIds.has(s.id));
        searchResultSongs = liked;
        renderSearchResults(liked, 'Beğenilen Şarkılar');
      } else if (cat === 'Yeni Eklenenler') {
        const recent = [...allSongs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
        searchResultSongs = recent;
        renderSearchResults(recent, 'Yeni Eklenenler');
      } else if (cat === 'Rastgele Keşfet') {
        const shuffled = [...allSongs].sort(() => Math.random() - 0.5).slice(0, 20);
        searchResultSongs = shuffled;
        renderSearchResults(shuffled, 'Rastgele Keşfet');
      }
    });
  });
}

window.clearSearchHistory = function() {
  searchHistoryItems = [];
  saveSearchHistory();
  showSearchDiscovery();
};

function initSearch() {
  const searchInput = document.getElementById('top-search-input');
  if (!searchInput) return;
  let debounceTimer;
  
  // Navigate to search page when input is focused
  searchInput.addEventListener('focus', () => {
    if (currentPage !== 'search') {
      navigateTo('search');
    }
  });
  
  // Load search history
  loadSearchHistory();
  
  // Show discovery content initially
  showSearchDiscovery();

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = searchInput.value.trim();
      if (query.length < 1) {
        searchResultSongs = [];
        showSearchDiscovery();
        return;
      }

      // Önce lokal ara (anında sonuç)
      const localResults = allSongs.filter(s => 
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase()) ||
        (s.album && s.album.toLowerCase().includes(query.toLowerCase()))
      );
      
      if (localResults.length > 0) {
        searchResultSongs = localResults;
        renderSearchResults(localResults, query);
      }

      // Sonra Supabase'den ara (daha kapsamlı)
      if (query.length >= 2) {
        // Save to search history
        addToSearchHistory(query);
        
        try {
          const [songsResult, playlistsResult, usersResult] = await Promise.all([
            searchSongs(query),
            searchPublicPlaylists(query),
            searchUsers(query)
          ]);
          
          const songData = (!songsResult.error && songsResult.data) ? songsResult.data : localResults;
          const playlistData = (!playlistsResult.error && playlistsResult.data) ? playlistsResult.data : [];
          const userData = (!usersResult.error && usersResult.data) ? usersResult.data : [];
          
          if (songData.length > 0 || playlistData.length > 0 || userData.length > 0) {
            searchResultSongs = songData;
            renderSearchResults(songData, query, playlistData, userData);
          } else if (localResults.length === 0) {
            searchResultSongs = [];
            document.getElementById('search-results').innerHTML = `
              <div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
          }
        } catch (err) {
          console.error('Search error:', err);
        }
      } else if (localResults.length === 0) {
        searchResultSongs = [];
        document.getElementById('search-results').innerHTML = `
          <div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
      }
    }, 200);
  });
  
  // Enter tuşu ile de arama yap
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
  });

  // Global click delegate for "Add Friend" buttons and "User Cards"
  document.getElementById('search-results').addEventListener('click', async (e) => {
    // 1. Check for Add Friend button
    const btn = e.target.closest('.btn-add-friend');
    if (btn) {
      e.stopPropagation(); // Prevent card click
      const friendId = btn.dataset.userId;
      btn.classList.add('loading');
      btn.disabled = true;
      try {
        const { error } = await addFriend(friendId);
        if (error) throw error;
        showToast('Arkadaş eklendi! 🎉', 'success');
        btn.textContent = 'Eklendi';
        btn.classList.add('btn-success');
      } catch (err) {
        showToast('Eklenemedi (zaten ekli olabilir)', 'error');
        btn.textContent = 'Ekle';
        btn.disabled = false;
        btn.classList.remove('loading');
      }
      return;
    }
    
    // 2. Check for User Card click
    const card = e.target.closest('.user-search-card');
    if (card) {
      // Prevent click if we clicked the add friend or view artist button directly
      if (e.target.closest('.btn-add-friend') || e.target.closest('.btn-view-artist')) return;
      
      const role = card.dataset.userRole;
      if (role === 'artist') {
        const artistName = card.dataset.userName;
        if (artistName) openArtistProfile(artistName);
      } else {
        const userId = card.dataset.userId;
        if (userId) loadPublicUserProfile(userId);
      }
    }
    
    // 3. View Artist Button Focus
    const viewArtistBtn = e.target.closest('.btn-view-artist');
    if (viewArtistBtn) {
      e.stopPropagation();
      const artistName = viewArtistBtn.dataset.artistName;
      if (artistName) openArtistProfile(artistName);
    }
  });
}

function renderSearchResults(songs, query, playlists = [], users = []) {
  const container = document.getElementById('search-results');
  let html = '';
  
  // Users section
  if (users.length > 0) {
    html += `
      <h2 class="section-title">👤 Kullanıcılar</h2>
      <div class="users-grid" style="display:flex;gap:12px;margin-bottom:24px;overflow-x:auto;padding-bottom:8px">
        ${users.map(u => {
          const avatarHtml = u.avatar_url 
            ? `<img src="${u.avatar_url}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">` 
            : `<span style="width:50px;height:50px;border-radius:50%;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--ts)">${getInitials(u.username)}</span>`;
          return `
          <div class="user-search-card" data-user-id="${u.id}" data-user-role="${u.role}" data-user-name="${escapeHtml(u.username)}" style="background:var(--bg-card);padding:12px;border-radius:12px;display:flex;flex-direction:column;align-items:center;min-width:140px;border:1px solid var(--border)">
            ${avatarHtml}
            <div style="font-weight:600;margin-top:8px">${escapeHtml(u.username)}${u.role === 'artist' ? getVerifiedTick(u.username) : ''}</div>
            ${u.role === 'artist' 
              ? `<button class="btn-primary-small btn-view-artist" data-artist-name="${escapeHtml(u.username)}" style="margin-top:12px;width:100%;padding:6px;background:var(--bg-card-hover);border:1px solid var(--border);color:var(--tp)">Profili Gör</button>`
              : `<button class="btn-primary-small btn-add-friend" data-user-id="${u.id}" style="margin-top:12px;width:100%;padding:6px">Arkadaş Ekle</button>`
            }
          </div>`;
        }).join('')}
      </div>
    `;
  }
  
  // Public playlists section
  if (playlists.length > 0) {
    html += `
      <h2 class="section-title">🌐 Çalma Listeleri</h2>
      <div class="songs-grid">
        ${playlists.map(pl => {
          const coverHtml = pl.cover_url 
            ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">` 
            : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
          const ownerName = pl.profiles?.username || 'Kullanıcı';
          return `
          <div class="song-card playlist-card" data-playlist-id="${pl.id}">
            <div class="song-card-cover">
              ${coverHtml}
            </div>
            <div class="song-card-title">${escapeHtml(pl.name)}</div>
            <div class="song-card-artist">${escapeHtml(ownerName)} <span class="playlist-card-public">🌐</span></div>
          </div>`;
        }).join('')}
      </div>
    `;
  }
  
  // Songs section
  if (songs.length > 0) {
    html += `
      <h2 class="section-title">"${escapeHtml(query)}" için ${songs.length} şarkı</h2>
      <div class="songs-grid">
        ${songs.map(song => createSongCard(song)).join('')}
      </div>
    `;
  }
  
  if (!html) {
    html = `<div class="empty-state"><p>"${escapeHtml(query)}" için sonuç bulunamadı</p></div>`;
  }
  
  container.innerHTML = html;
}

// ===== Playlist Modal =====
function initPlaylistModal() {
  const overlay = document.getElementById('modal-overlay');
  const input = document.getElementById('playlist-name-input');
  
  const openModal = () => {
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  };
  const closeModal = () => {
    overlay.style.display = 'none';
    input.value = '';
    const descInput = document.getElementById('playlist-desc-input');
    if (descInput) descInput.value = '';
    const publicToggle = document.getElementById('playlist-public-toggle');
    if (publicToggle) publicToggle.checked = false;
  };

  document.getElementById('btn-create-playlist').addEventListener('click', openModal);
  const btnLib = document.getElementById('btn-create-playlist-library');
  if (btnLib) btnLib.addEventListener('click', openModal);
  
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // Enter tuşu ile oluştur
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-modal-create').click();
    }
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  document.getElementById('btn-modal-create').addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) { showToast('Lütfen bir ad girin', 'error'); return; }
    
    const btn = document.getElementById('btn-modal-create');
    btn.textContent = 'Oluşturuluyor...';
    btn.disabled = true;
    
    try {
      const user = await getCurrentUser();
      if (!user) { showToast('Giriş yapmanız gerekiyor', 'error'); return; }
      
      // Profili garantile
      await ensureProfile(user.id, user.user_metadata?.username || user.email?.split('@')[0]);
      
      const description = (document.getElementById('playlist-desc-input')?.value || '').trim();
      const is_public = document.getElementById('playlist-public-toggle')?.checked || false;
      
      const { data, error } = await createPlaylist(name, user.id);
      if (error) {
        console.error('Playlist create error:', error);
        showToast('Çalma listesi oluşturulamadı: ' + (error.message || ''), 'error');
        return;
      }
      
      // Update with description and public status
      if (data && data.id && (description || is_public)) {
        const updates = {};
        if (description) updates.description = description;
        if (is_public) updates.is_public = is_public;
        try {
          await updatePlaylist(data.id, updates);
        } catch (e) {
          console.log('Playlist update extras error:', e);
        }
      }
      
      // If there's a pending song from right-click, add it to the new playlist
      const pendingSongId = input.dataset.pendingSongId;
      if (pendingSongId && data && data.id) {
        try {
          await addSongToPlaylist(data.id, pendingSongId, 0);
          showToast(`"${name}" oluşturuldu ve şarkı eklendi! 🎵`, 'success');
        } catch (addErr) {
          console.error('Pending song add error:', addErr);
          showToast(`"${name}" oluşturuldu! 🎵`, 'success');
        }
        delete input.dataset.pendingSongId;
      } else {
        showToast(`"${name}" çalma listesi oluşturuldu! 🎵`, 'success');
      }
      
      closeModal();
      loadPlaylists();
    } catch (err) {
      console.error('Playlist error:', err);
      showToast('Bir hata oluştu', 'error');
    } finally {
      btn.textContent = 'Oluştur';
      btn.disabled = false;
    }
  });
}

// ===== Load Playlists =====
async function loadPlaylists() {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const { data, error } = await fetchUserPlaylists(user.id);
    userPlaylists = data || [];
    
    const list = document.getElementById('playlist-list');
    
    const likedSongsHtml = `
      <div class="playlist-item" data-playlist-id="liked">
        <div class="playlist-item-cover" style="background: linear-gradient(135deg, #450af5, #c4efd9);">
          <svg viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </div>
        <div class="playlist-item-info">
          <div class="playlist-item-name">Beğenilen Şarkılar</div>
          <div class="playlist-item-meta">Otomatik Çalma Listesi</div>
        </div>
      </div>
    `;

    if (error || !data || data.length === 0) {
      list.innerHTML = likedSongsHtml;
      return;
    }
    
    list.innerHTML = likedSongsHtml + data.map(pl => {
      const coverHtml = pl.cover_url 
        ? `<img src="${pl.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px">` 
        : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      const publicIcon = pl.is_public ? '<span class="pl-public-icon" title="Herkese Açık">🌐</span>' : '';
      return `
      <div class="playlist-item" data-playlist-id="${pl.id}">
        <div class="playlist-item-cover">
          ${coverHtml}
        </div>
        <div class="playlist-item-info">
          <div class="playlist-item-name">${escapeHtml(pl.name)} ${publicIcon}</div>
          <div class="playlist-item-meta">Çalma Listesi</div>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    console.error('Playlists load error:', err);
  }
}

// ===== Load Library Page =====
async function loadLibraryPage() {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    const { data, error } = await fetchUserPlaylists(user.id);
    
    const container = document.getElementById('library-playlists');
    
    if (error || !data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          <p>Henüz çalma listen yok</p>
          <button class="btn-primary-small" id="btn-create-playlist-library">Çalma Listesi Oluştur</button>
        </div>`;
      // Re-bind the button
      const btn = document.getElementById('btn-create-playlist-library');
      if (btn) btn.addEventListener('click', () => {
        document.getElementById('modal-overlay').style.display = 'flex';
        setTimeout(() => document.getElementById('playlist-name-input').focus(), 100);
      });
      return;
    }
    
    container.innerHTML = data.map(pl => {
      const coverHtml = pl.cover_url 
        ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">` 
        : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      const publicBadge = pl.is_public ? '<span class="playlist-card-public">🌐 Public</span>' : '';
      return `
      <div class="song-card playlist-card" data-playlist-id="${pl.id}">
        <div class="song-card-cover">
          ${coverHtml}
        </div>
        <div class="song-card-title">${escapeHtml(pl.name)}</div>
        <div class="song-card-artist">Çalma Listesi ${publicBadge}</div>
      </div>
    `;
    }).join('');
  } catch (err) {
    console.error('Library load error:', err);
  }
  
  // Beğenilen şarkıları yükle
  await loadLibraryLikedSongs();
}

async function loadLibraryLikedSongs() {
  if (!currentUserId) return;
  try {
    const { data, error } = await fetchLikedSongs(currentUserId);
    const container = document.getElementById('liked-songs');
    
    if (error || !data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <p>Henüz beğendiğin şarkı yok</p>
        </div>`;
      return;
    }
    
    const songs = data.map(d => d.songs).filter(Boolean);
    if (songs.length > 0) {
      container.innerHTML = `
        <div class="song-list-header">
          <span>#</span>
          <span>Başlık</span>
          <span>Albüm</span>
          <span>Süre</span>
        </div>
        ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
      `;
    }
  } catch (err) {
    console.error('Liked songs load error:', err);
  }
}

// ===== Playlist Detail Page =====
async function openPlaylistDetail(playlistId) {
  currentPlaylistId = playlistId;
  navigateTo('playlist');
  
  if (playlistId === 'liked') {
    document.getElementById('playlist-detail-title').textContent = 'Beğenilen Şarkılar';
    const descEl = document.getElementById('playlist-detail-description');
    descEl.textContent = 'Otomatik Çalma Listesi';
    descEl.style.display = 'block';
    
    document.getElementById('playlist-public-badge').style.display = 'none';
    
    const editBtn = document.getElementById('btn-playlist-edit');
    const deleteBtn = document.getElementById('btn-playlist-delete');
    if (editBtn) editBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    
    document.getElementById('playlist-detail-user').textContent = document.getElementById('user-name').textContent;
    const avatarEl = document.getElementById('playlist-detail-avatar');
    const sidebarAvatar = document.getElementById('user-avatar');
    if (sidebarAvatar) avatarEl.innerHTML = sidebarAvatar.innerHTML;
    
    const coverEl = document.getElementById('playlist-detail-cover');
    coverEl.innerHTML = `<div style="width:100%;height:100%;background:linear-gradient(135deg, #450af5, #c4efd9);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="white" width="48" height="48"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>`;
    
    const songsContainer = document.getElementById('playlist-detail-songs');
    songsContainer.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Şarkılar yükleniyor...</p></div>`;
    
    try {
      const { data } = await fetchLikedSongs(currentUserId);
      const songs = (data || []).map(d => d.songs).filter(Boolean);
      currentPlaylistSongs = songs;
      
      document.getElementById('playlist-detail-count').textContent = `${songs.length} şarkı`;
      const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
      const mins = Math.floor(totalDuration / 60);
      document.getElementById('playlist-detail-duration').textContent = mins > 60 ? `${Math.floor(mins/60)} sa ${mins%60} dk` : `${mins} dk`;
      
      if (songs.length > 0) {
        songsContainer.innerHTML = `
          <div class="song-list-header">
            <span>#</span>
            <span>Başlık</span>
            <span>Albüm</span>
            <span>Süre</span>
          </div>
          ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
        `;
      } else {
        songsContainer.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <p>Henüz beğendiğin şarkı yok</p>
          </div>`;
      }
    } catch(err) {
      songsContainer.innerHTML = `<div class="empty-state"><p>Hata oluştu</p></div>`;
    }
    return;
  }
  
  // Fetch fresh playlist data from Supabase
  let playlist = userPlaylists.find(p => p.id === playlistId);
  try {
    const { data: freshPlaylist } = await fetchPlaylistById(playlistId);
    if (freshPlaylist) playlist = freshPlaylist;
  } catch (e) {
    console.log('Fetch playlist error, using cached:', e);
  }
  
  const playlistName = playlist ? playlist.name : 'Çalma Listesi';
  const isOwner = playlist && playlist.user_id === currentUserId;
  
  // Set banner info
  document.getElementById('playlist-detail-title').textContent = playlistName;
  
  // Description
  const descEl = document.getElementById('playlist-detail-description');
  if (playlist && playlist.description) {
    descEl.textContent = playlist.description;
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }
  
  // Public badge
  const publicBadge = document.getElementById('playlist-public-badge');
  if (playlist && playlist.is_public) {
    publicBadge.style.display = 'inline-block';
  } else {
    publicBadge.style.display = 'none';
  }
  
  // Show/hide edit and delete buttons based on ownership
  const actionsContainer = document.getElementById('playlist-detail-actions');
  const editBtn = document.getElementById('btn-playlist-edit');
  const deleteBtn = document.getElementById('btn-playlist-delete');
  if (editBtn) editBtn.style.display = isOwner ? 'flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = isOwner ? 'flex' : 'none';
  
  // User info
  if (isOwner) {
    const userName = document.getElementById('user-name').textContent;
    document.getElementById('playlist-detail-user').textContent = userName;
    const avatarEl = document.getElementById('playlist-detail-avatar');
    const sidebarAvatar = document.getElementById('user-avatar');
    if (sidebarAvatar) {
      avatarEl.innerHTML = sidebarAvatar.innerHTML;
    }
  } else if (playlist && playlist.profiles) {
    document.getElementById('playlist-detail-user').textContent = playlist.profiles.username || 'Kullanıcı';
    const avatarEl = document.getElementById('playlist-detail-avatar');
    if (playlist.profiles.avatar_url) {
      avatarEl.innerHTML = `<img src="${playlist.profiles.avatar_url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">${getInitials(playlist.profiles.username || '?')}</div>`;
    }
  } else {
    const userName = document.getElementById('user-name').textContent;
    document.getElementById('playlist-detail-user').textContent = userName;
    const avatarEl = document.getElementById('playlist-detail-avatar');
    const sidebarAvatar = document.getElementById('user-avatar');
    if (sidebarAvatar) avatarEl.innerHTML = sidebarAvatar.innerHTML;
  }

  // Set cover from playlist cover_url first, then fallback to first song
  const coverEl = document.getElementById('playlist-detail-cover');
  if (playlist && playlist.cover_url) {
    coverEl.innerHTML = `<img src="${playlist.cover_url}" alt="">`;
  }
  
  // Load songs
  const songsContainer = document.getElementById('playlist-detail-songs');
  songsContainer.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Şarkılar yükleniyor...</p></div>`;
  
  try {
    const { data, error } = await getPlaylistSongs(playlistId);
    if (error || !data || data.length === 0) {
      currentPlaylistSongs = [];
      document.getElementById('playlist-detail-count').textContent = '0 şarkı';
      document.getElementById('playlist-detail-duration').textContent = '0 dk';
      songsContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          <p>Bu çalma listesinde henüz şarkı yok</p>
          ${isOwner ? '<small style="color:var(--tm);font-size:13px">Şarkılara sağ tıklayarak bu listeye ekleyebilirsin</small>' : ''}
        </div>`;
      return;
    }
    
    const songs = data.map(d => d.songs).filter(Boolean);
    currentPlaylistSongs = songs;
    
    // Update meta
    document.getElementById('playlist-detail-count').textContent = `${songs.length} şarkı`;
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
    const mins = Math.floor(totalDuration / 60);
    document.getElementById('playlist-detail-duration').textContent = mins > 60 ? `${Math.floor(mins/60)} sa ${mins%60} dk` : `${mins} dk`;
    
    // Update cover (only if no playlist cover_url)
    if (!playlist || !playlist.cover_url) {
      if (songs[0] && songs[0].cover_url) {
        coverEl.innerHTML = `<img src="${songs[0].cover_url}" alt="">`;
      } else {
        coverEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.5"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      }
    }
    
    // Render song list
    if (songs.length > 0) {
      songsContainer.innerHTML = `
        <div class="song-list-header">
          <span>#</span>
          <span>Başlık</span>
          <span>Albüm</span>
          <span>Süre</span>
        </div>
        ${songs.map((song, i) => renderSongListItem(song, i + 1)).join('')}
      `;
    }
  } catch (err) {
    console.error('Playlist detail error:', err);
    songsContainer.innerHTML = `<div class="empty-state"><p>Şarkılar yüklenemedi</p></div>`;
  }
}

// ===== Playlist Detail Actions =====
function initPlaylistDetailActions() {
  // Play all
  document.getElementById('btn-playlist-play').addEventListener('click', () => {
    if (currentPlaylistSongs.length > 0) {
      player.playSong(currentPlaylistSongs[0], currentPlaylistSongs);
    } else {
      showToast('Çalma listesinde şarkı yok', 'error');
    }
  });
  
  // Shuffle play
  document.getElementById('btn-playlist-shuffle').addEventListener('click', () => {
    if (currentPlaylistSongs.length > 0) {
      player.playShuffled(currentPlaylistSongs);
      showToast('Rastgele çalma başladı 🔀', 'success');
    } else {
      showToast('Çalma listesinde şarkı yok', 'error');
    }
  });
  
  // Edit playlist
  document.getElementById('btn-playlist-edit').addEventListener('click', () => {
    if (currentPlaylistId) {
      openEditPlaylistModal(currentPlaylistId);
    }
  });
  
  // Delete playlist
  document.getElementById('btn-playlist-delete').addEventListener('click', () => {
    if (currentPlaylistId) {
      confirmDeletePlaylist(currentPlaylistId);
    }
  });
  
  // Collab playlist
  document.getElementById('btn-playlist-collab').addEventListener('click', () => {
    if (currentPlaylistId) {
      openCollabModal(currentPlaylistId);
    }
  });
  
  // Edit playlist modal events
  initEditPlaylistModal();
  initCollabModal();
}

// ===== Edit Playlist Modal =====
let editPlaylistCoverFile = null;

function initEditPlaylistModal() {
  const overlay = document.getElementById('edit-playlist-overlay');
  const cancelBtn = document.getElementById('btn-edit-playlist-cancel');
  const saveBtn = document.getElementById('btn-edit-playlist-save');
  const coverFileInput = document.getElementById('edit-playlist-cover-file');
  const coverLabel = document.getElementById('edit-playlist-cover-label');
  const coverPreview = document.getElementById('edit-playlist-cover-preview');
  const coverRemove = document.getElementById('edit-playlist-cover-remove');
  
  cancelBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    editPlaylistCoverFile = null;
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      editPlaylistCoverFile = null;
    }
  });
  
  // Cover file selection
  coverLabel.addEventListener('click', (e) => {
    e.preventDefault();
    coverFileInput.value = '';
    coverFileInput.click();
  });
  
  // Make cover preview image clickable to change cover
  const coverImg = document.getElementById('edit-playlist-cover-img');
  if (coverImg) {
    coverImg.style.cursor = 'pointer';
    coverImg.title = 'Kapak fotoğrafını değiştirmek için tıkla';
    coverImg.addEventListener('click', (e) => {
      e.stopPropagation();
      coverFileInput.value = '';
      coverFileInput.click();
    });
  }
  
  coverFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Dosya 5MB\'dan küçük olmalı', 'error');
      return;
    }
    editPlaylistCoverFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('edit-playlist-cover-img').src = ev.target.result;
      coverPreview.style.display = 'flex';
      coverLabel.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
  
  coverRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    editPlaylistCoverFile = null;
    coverPreview.style.display = 'none';
    coverLabel.style.display = 'flex';
    coverFileInput.value = '';
  });
  
  // Save
  saveBtn.addEventListener('click', async () => {
    const name = document.getElementById('edit-playlist-name').value.trim();
    const description = document.getElementById('edit-playlist-desc').value.trim();
    const is_public = document.getElementById('edit-playlist-public-toggle').checked;
    
    if (!name) { showToast('Ad boş olamaz', 'error'); return; }
    
    saveBtn.textContent = 'Kaydediliyor...';
    saveBtn.disabled = true;
    
    try {
      const updates = { name, description: description || null, is_public };
      
      // Upload cover if selected
      if (editPlaylistCoverFile && currentPlaylistId) {
        const { data: coverUrl, error: coverErr } = await uploadPlaylistCover(currentPlaylistId, editPlaylistCoverFile);
        if (coverErr) {
          showToast('Kapak yüklenemedi: ' + (coverErr.message || ''), 'error');
        } else {
          updates.cover_url = coverUrl;
        }
      }
      
      const { error } = await updatePlaylist(currentPlaylistId, updates);
      if (error) throw error;
      
      showToast('Çalma listesi güncellendi ✅', 'success');
      overlay.style.display = 'none';
      editPlaylistCoverFile = null;
      
      // Refresh
      await loadPlaylists();
      openPlaylistDetail(currentPlaylistId);
    } catch (err) {
      showToast('Güncellenemedi: ' + (err.message || ''), 'error');
    } finally {
      saveBtn.textContent = 'Kaydet';
      saveBtn.disabled = false;
    }
  });
}

// ===== Collaborative Playlists Modal =====
function initCollabModal() {
  const overlay = document.getElementById('overlay-collab');
  const closeBtn = document.getElementById('btn-close-collab');
  const addBtn = document.getElementById('btn-add-collab');
  
  if (!overlay) return;

  closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  addBtn.addEventListener('click', async () => {
    const usernameInput = document.getElementById('collab-username');
    const username = usernameInput.value.trim();
    if (!username) {
      showToast('Lütfen bir kullanıcı adı girin', 'error');
      return;
    }

    addBtn.textContent = 'Ekleniyor...';
    addBtn.disabled = true;

    try {
      const result = await addPlaylistCollaborator(currentPlaylistId, username);
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast('Ortak başarıyla eklendi!', 'success');
        usernameInput.value = '';
        renderCollabList(currentPlaylistId);
      }
    } catch (e) {
      console.error(e);
      showToast('Bir hata oluştu.', 'error');
    } finally {
      addBtn.textContent = 'Ekle';
      addBtn.disabled = false;
    }
  });
}

async function openCollabModal(playlistId) {
  const overlay = document.getElementById('overlay-collab');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.getElementById('collab-username').value = '';
  
  await renderCollabList(playlistId);
}

async function renderCollabList(playlistId) {
  const listEl = document.getElementById('collab-list');
  listEl.innerHTML = '<div class="empty-state" style="padding:20px 0; font-size:13px; color:var(--tm)">Yükleniyor...</div>';
  
  const collabs = await getPlaylistCollaborators(playlistId);
  
  if (!collabs || collabs.length === 0) {
    listEl.innerHTML = '<div class="empty-state" style="padding:20px 0; font-size:13px; color:var(--tm)">Henüz kimse eklenmemiş.</div>';
    return;
  }
  
  listEl.innerHTML = collabs.map(collab => {
    const avatar = collab.profiles?.avatar_url 
      ? `<img src="${collab.profiles.avatar_url}" style="width:32px; height:32px; border-radius:50%; object-fit:cover">`
      : `<div style="width:32px; height:32px; border-radius:50%; background:var(--bg-highlight); display:flex; align-items:center; justify-content:center; color:var(--ts); font-size:14px; font-weight:bold">${collab.profiles?.username?.[0]?.toUpperCase() || '?'}</div>`;
      
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.05); padding:10px 14px; border-radius:8px">
        <div style="display:flex; align-items:center; gap:12px">
          ${avatar}
          <span style="font-size:14px; color:#fff; font-weight:500">${escapeHtml(collab.profiles?.username || 'Bilinmeyen Kullanıcı')}</span>
        </div>
        <button class="btn-remove-collab" data-user-id="${collab.user_id}" style="background:none; border:none; color:#f44; cursor:pointer; padding:6px; border-radius:4px" title="Kaldır">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
  }).join('');
  
  // Attach remove listeners
  listEl.querySelectorAll('.btn-remove-collab').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.currentTarget.dataset.userId;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      const result = await removePlaylistCollaborator(playlistId, userId);
      if (result.error) {
        showToast(result.error, 'error');
        btn.disabled = false;
        btn.style.opacity = '1';
      } else {
        showToast('Ortak listeden çıkarıldı.', 'success');
        renderCollabList(playlistId);
      }
    });
  });
}
async function openEditPlaylistModal(playlistId) {
  const overlay = document.getElementById('edit-playlist-overlay');
  
  // Fetch current data
  let playlist = userPlaylists.find(p => p.id === playlistId);
  try {
    const { data } = await fetchPlaylistById(playlistId);
    if (data) playlist = data;
  } catch (e) {}
  
  if (!playlist) return;
  
  document.getElementById('edit-playlist-name').value = playlist.name || '';
  document.getElementById('edit-playlist-desc').value = playlist.description || '';
  document.getElementById('edit-playlist-public-toggle').checked = playlist.is_public || false;
  
  // Show current cover
  const coverLabel = document.getElementById('edit-playlist-cover-label');
  const coverPreview = document.getElementById('edit-playlist-cover-preview');
  if (playlist.cover_url) {
    document.getElementById('edit-playlist-cover-img').src = playlist.cover_url;
    coverPreview.style.display = 'flex';
    coverLabel.style.display = 'none';
  } else {
    coverPreview.style.display = 'none';
    coverLabel.style.display = 'flex';
  }
  
  editPlaylistCoverFile = null;
  overlay.style.display = 'flex';
}

// ===== Confirm Delete Playlist =====
function confirmDeletePlaylist(playlistId) {
  const playlist = userPlaylists.find(p => p.id === playlistId);
  const name = playlist ? playlist.name : 'Bu çalma listesi';
  
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <h3>Çalma Listesini Sil</h3>
      <p>"${escapeHtml(name)}" çalma listesini silmek istediğine emin misin? Bu işlem geri alınamaz.</p>
      <div class="modal-actions">
        <button class="btn-cancel" id="btn-confirm-cancel">İptal</button>
        <button class="btn-danger-solid" id="btn-confirm-delete">Sil</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector('#btn-confirm-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  
  overlay.querySelector('#btn-confirm-delete').addEventListener('click', async () => {
    try {
      await deletePlaylist(playlistId);
      showToast(`"${name}" silindi 🗑️`, 'success');
      overlay.remove();
      currentPlaylistId = null;
      currentPlaylistSongs = [];
      await loadPlaylists();
      navigateTo('library');
    } catch (err) {
      showToast('Silinemedi', 'error');
    }
  });
}

// ===== Remove Song from Playlist =====
async function removeSongFromCurrentPlaylist(songId) {
  if (!currentPlaylistId || !songId) return;
  try {
    await removeSongFromPlaylist(currentPlaylistId, songId);
    showToast('Şarkı listeden çıkarıldı', 'success');
    // Reload playlist detail
    openPlaylistDetail(currentPlaylistId);
  } catch (err) {
    showToast('Çıkarılamadı', 'error');
  }
}

// ===== Logout =====
function initLogout() {
  const logoutBtn = document.getElementById('btn-logout') || document.getElementById('btn-discord-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut();
        if (window.electronAPI && window.electronAPI.navigateToAuth) {
          window.electronAPI.navigateToAuth();
        }
      } catch (err) {
        showToast('Çıkış yapılırken hata oluştu', 'error');
      }
    });
  }
}

// ===== Helpers =====
function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

function showEmptyState(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
  }
}

// ===== Like System =====
async function loadLikedSongs() {
  if (!currentUserId) return;
  try {
    const { data } = await fetchLikedSongs(currentUserId);
    userLikedSongIds = new Set((data || []).map(d => d.song_id));
    updateLikeButtonState();
  } catch (err) {
    console.log('Liked songs load error:', err);
  }
}

async function toggleLikeSong(songId) {
  if (!currentUserId) return;
  try {
    if (userLikedSongIds.has(songId)) {
      await unlikeSong(currentUserId, songId);
      userLikedSongIds.delete(songId);
      showToast('Beğenilenlerden çıkarıldı', 'success');
    } else {
      await likeSong(currentUserId, songId);
      userLikedSongIds.add(songId);
      showToast('Beğenilenlere eklendi ❤️', 'success');
    }
    updateLikeButtonState();
  } catch (err) {
    showToast('Beğeni işlemi başarısız', 'error');
  }
}

function updateLikeButtonState() {
  const btn = document.getElementById('btn-like');
  const currentSong = player.getCurrentSong();
  if (currentSong && userLikedSongIds.has(currentSong.id)) {
    btn.classList.add('liked');
  } else {
    btn.classList.remove('liked');
  }
}

// Update like button when song changes
const origUpdateUI = player.updateUI.bind(player);
player.updateUI = function(song) {
  origUpdateUI(song);
  updateLikeButtonState();
};

// ===== Context Menu =====
let contextMenuSongId = null;
let contextMenuPlaylistId = null;

function initContextMenu() {
  const menu = document.getElementById('context-menu');
  const submenu = document.getElementById('ctx-playlist-submenu');

  // Right-click on songs
  document.addEventListener('contextmenu', (e) => {
    // Check for playlist right-click first
    const playlistEl = e.target.closest('[data-playlist-id]');
    if (playlistEl && !e.target.closest('[data-song-id]')) {
      e.preventDefault();
      contextMenuPlaylistId = playlistEl.dataset.playlistId;
      showPlaylistContextMenu(e.clientX, e.clientY);
      return;
    }
    
    const songEl = e.target.closest('[data-song-id]');
    if (songEl) {
      e.preventDefault();
      contextMenuSongId = songEl.dataset.songId;
      
      // Show/hide "remove from playlist" based on context
      const removeItem = document.getElementById('ctx-remove-from-playlist');
      const removeDivider = document.getElementById('ctx-remove-divider');
      if (currentPage === 'playlist' && currentPlaylistId) {
        removeItem.style.display = 'flex';
        removeDivider.style.display = 'block';
      } else {
        removeItem.style.display = 'none';
        removeDivider.style.display = 'none';
      }
      
      showContextMenu(e.clientX, e.clientY);
    }
  });

  // Close menu on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('.context-submenu')) {
      hideContextMenu();
    }
  });

  // Play
  document.getElementById('ctx-play').addEventListener('click', () => {
    if (contextMenuSongId) playSongFromAny(contextMenuSongId);
    hideContextMenu();
  });

  // Add to queue
  document.getElementById('ctx-queue').addEventListener('click', () => {
    if (contextMenuSongId) {
      const song = findSongById(contextMenuSongId);
      if (song) {
        const result = player.addToQueue(song);
        if (result === 'duplicate') {
          showToast('Bu şarkı zaten sırada', 'error');
        } else if (result === 'added') {
          showToast(`"${song.title}" sıraya eklendi 🎵`, 'success');
        } else {
          showToast(`"${song.title}" çalınıyor 🎵`, 'success');
        }
      } else {
        showToast('Şarkı bulunamadı', 'error');
      }
    }
    hideContextMenu();
  });

  // Like/Unlike
  document.getElementById('ctx-like').addEventListener('click', async () => {
    if (contextMenuSongId) {
      await toggleLikeSong(contextMenuSongId);
    }
    hideContextMenu();
  });
  
  // Remove from playlist
  document.getElementById('ctx-remove-from-playlist').addEventListener('click', async () => {
    if (contextMenuSongId) {
      await removeSongFromCurrentPlaylist(contextMenuSongId);
    }
    hideContextMenu();
  });

  // Show playlist submenu
  let submenuHideTimer = null;

  const showSubmenu = () => {
    clearTimeout(submenuHideTimer);
    loadPlaylistSubmenu();
    submenu.style.display = 'block';
  };

  const hideSubmenuDelayed = () => {
    submenuHideTimer = setTimeout(() => {
      submenu.style.display = 'none';
    }, 150);
  };

  document.getElementById('ctx-add-to-playlist').addEventListener('mouseenter', showSubmenu);
  document.getElementById('ctx-add-to-playlist').addEventListener('mouseleave', hideSubmenuDelayed);
  submenu.addEventListener('mouseenter', () => clearTimeout(submenuHideTimer));
  submenu.addEventListener('mouseleave', hideSubmenuDelayed);

  // New playlist from song
  document.getElementById('ctx-new-playlist-from-song').addEventListener('click', async () => {
    hideContextMenu();
    const overlay = document.getElementById('modal-overlay');
    overlay.style.display = 'flex';
    const input = document.getElementById('playlist-name-input');
    input.focus();
    // Store song to add after creation
    input.dataset.pendingSongId = contextMenuSongId;
  });
}

// ===== Playlist Context Menu =====
function initPlaylistContextMenu() {
  const menu = document.getElementById('playlist-context-menu');
  
  // Play all
  document.getElementById('pctx-play').addEventListener('click', async () => {
    if (contextMenuPlaylistId) {
      const { data } = await getPlaylistSongs(contextMenuPlaylistId);
      const songs = (data || []).map(d => d.songs).filter(Boolean);
      if (songs.length > 0) {
        player.playSong(songs[0], songs);
      } else {
        showToast('Çalma listesinde şarkı yok', 'error');
      }
    }
    hideContextMenu();
  });
  
  // Shuffle play
  document.getElementById('pctx-shuffle').addEventListener('click', async () => {
    if (contextMenuPlaylistId) {
      const { data } = await getPlaylistSongs(contextMenuPlaylistId);
      const songs = (data || []).map(d => d.songs).filter(Boolean);
      if (songs.length > 0) {
        player.playShuffled(songs);
        showToast('Rastgele çalma başladı 🔀', 'success');
      } else {
        showToast('Çalma listesinde şarkı yok', 'error');
      }
    }
    hideContextMenu();
  });
  
  // Delete
  document.getElementById('pctx-delete').addEventListener('click', () => {
    if (contextMenuPlaylistId) {
      confirmDeletePlaylist(contextMenuPlaylistId);
    }
    hideContextMenu();
  });
}

function showContextMenu(x, y) {
  // Hide playlist context menu if open
  document.getElementById('playlist-context-menu').style.display = 'none';
  
  const menu = document.getElementById('context-menu');
  menu.style.display = 'block';
  
  // Update like text
  const likeItem = document.getElementById('ctx-like');
  const likeSpan = likeItem.querySelector('span');
  if (userLikedSongIds.has(contextMenuSongId)) {
    likeSpan.textContent = 'Beğenmekten Vazgeç';
  } else {
    likeSpan.textContent = 'Beğen';
  }
  
  // Position check - don't overflow screen
  const menuW = 220;
  const menuH = 300;
  if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.getElementById('ctx-playlist-submenu').style.display = 'none';
}

function showPlaylistContextMenu(x, y) {
  // Hide song context menu if open
  document.getElementById('context-menu').style.display = 'none';
  document.getElementById('ctx-playlist-submenu').style.display = 'none';
  
  const menu = document.getElementById('playlist-context-menu');
  menu.style.display = 'block';
  
  const menuW = 220;
  const menuH = 150;
  if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
  if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;
  
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function hideContextMenu() {
  document.getElementById('context-menu').style.display = 'none';
  document.getElementById('ctx-playlist-submenu').style.display = 'none';
  document.getElementById('playlist-context-menu').style.display = 'none';
  contextMenuSongId = null;
  contextMenuPlaylistId = null;
}

function loadPlaylistSubmenu() {
  const list = document.getElementById('ctx-playlist-list');
  if (userPlaylists.length === 0) {
    list.innerHTML = '<div class="context-menu-item" style="color:var(--tm);cursor:default"><span>Çalma listesi yok</span></div>';
    return;
  }
  list.innerHTML = userPlaylists.map(pl => `
    <div class="context-menu-item" data-add-to-playlist="${pl.id}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      <span>${escapeHtml(pl.name)}</span>
    </div>
  `).join('');

  // Bind click events
  list.querySelectorAll('[data-add-to-playlist]').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const plId = item.dataset.addToPlaylist;
      const songId = contextMenuSongId; // Store before hideContextMenu nullifies it
      if (songId && plId) {
        hideContextMenu();
        try {
          // Get current song count for position
          const { data: existing } = await getPlaylistSongs(plId);
          const position = existing ? existing.length : 0;
          const { error } = await addSongToPlaylist(plId, songId, position);
          if (error) {
            console.error('Add to playlist error:', error);
            if (error.code === '23505') {
              showToast('Bu şarkı zaten listede', 'error');
            } else {
              showToast('Eklenemedi: ' + (error.message || ''), 'error');
            }
          } else {
            showToast('Çalma listesine eklendi! 🎵', 'success');
          }
        } catch (err) {
          console.error('Add to playlist catch:', err);
          showToast('Eklenemedi', 'error');
        }
      } else {
        hideContextMenu();
      }
    });
  });
}

function findSongById(id) {
  return allSongs.find(s => s.id === id) || searchResultSongs.find(s => s.id === id) || currentPlaylistSongs.find(s => s.id === id);
}

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    player.togglePlay();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    navigateTo('search');
  }
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

// ===== Admin Panel =====

function initAdminActions() {
  // Add song button
  document.getElementById('btn-admin-add-song').addEventListener('click', handleAddSong);
  
  // User search
  const searchInput = document.getElementById('admin-user-search');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchInput.value.trim().toLowerCase();
      filterAdminUsers(query);
    }, 200);
  });
}

async function loadAdminPage() {
  // Load stats
  loadDashboardStats();
  // Load users
  loadAdminUsers();
  // Load songs
  loadAdminSongs();
}

async function loadDashboardStats() {
  try {
    const stats = await getDashboardStats();
    document.getElementById('stat-users').textContent = stats.users;
    document.getElementById('stat-songs').textContent = stats.songs;
    document.getElementById('stat-playlists').textContent = stats.playlists;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

let allProfiles = [];

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-table');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>';
  
  try {
    const { data, error } = await fetchAllProfiles();
    if (error) {
      container.innerHTML = '<div class="empty-state"><p>Kullan\u0131c\u0131lar y\u00fcklenemedi</p></div>';
      return;
    }
    allProfiles = data || [];
    renderAdminUsers(allProfiles);
    populateArtistDatalist(allProfiles);
  } catch (err) {
    console.error('Admin users error:', err);
  }
}

function populateArtistDatalist(profiles) {
  const datalist = document.getElementById('admin-artists-list');
  if (datalist) {
    const artists = profiles.filter(p => p.role === 'artist');
    datalist.innerHTML = artists.map(p => `<option value="${escapeHtml(p.username || 'Adsız')}"></option>`).join('');
  }
}

function renderAdminUsers(profiles) {
  const container = document.getElementById('admin-users-table');
  if (!profiles || profiles.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Kullan\u0131c\u0131 bulunamad\u0131</p></div>';
    return;
  }
  
  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Kullan\u0131c\u0131</th>
          <th>Rol</th>
          <th>Kay\u0131t Tarihi</th>
        </tr>
      </thead>
      <tbody>
        ${profiles.map(p => {
          const avatar = p.avatar_url 
            ? `<span class="user-row-avatar"><img src="${p.avatar_url}" alt=""></span>` 
            : `<span class="user-row-avatar">${getInitials(p.username || '?')}</span>`;
          const date = p.created_at ? new Date(p.created_at).toLocaleDateString('tr-TR') : '-';
          const isCurrentUser = p.id === currentUserId;
          return `
            <tr>
              <td>
                ${avatar}
                <span class="user-row-name">${escapeHtml(p.username || 'Adsız')}</span>
                ${isCurrentUser ? '<span style="color:var(--green);font-size:11px;margin-left:6px">(Sen)</span>' : ''}
              </td>
              <td>
                <select class="role-select" data-user-id="${p.id}" ${isCurrentUser ? 'disabled title="Kendi rol\u00fcn\u00fc de\u011fi\u015ftiremezsin"' : ''}>
                  <option value="user" ${(p.role || 'user') === 'user' ? 'selected' : ''}>\ud83d\udc64 Kullan\u0131c\u0131</option>
                  <option value="premium" ${p.role === 'premium' ? 'selected' : ''}>\u2b50 Premium</option>
                  <option value="artist" ${p.role === 'artist' ? 'selected' : ''}>\ud83c\udfa4 Sanat\u00e7\u0131</option>
                  <option value="yetkili" ${p.role === 'yetkili' ? 'selected' : ''}>\ud83d\udee1\ufe0f Yetkili</option>
                  <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>\ud83d\udc51 Admin</option>
                </select>
              </td>
              <td class="user-row-date">${date}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  // Bind role change events
  container.querySelectorAll('.role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const userId = select.dataset.userId;
      const newRole = e.target.value;
      try {
        const { error } = await updateUserRole(userId, newRole);
        if (error) {
          showToast('Rol g\u00fcncellenemedi: ' + (error.message || ''), 'error');
          loadAdminUsers(); // Revert
        } else {
          showToast('Rol güncellendi ✅', 'success');
        }
      } catch (err) {
        showToast('Hata oluştu', 'error');
      }
    });
  });
}

function filterAdminUsers(query) {
  if (!query) {
    renderAdminUsers(allProfiles);
    return;
  }
  const filtered = allProfiles.filter(p => 
    (p.username || '').toLowerCase().includes(query) ||
    (p.id || '').toLowerCase().includes(query)
  );
  renderAdminUsers(filtered);
}

async function loadAdminSongs() {
  const container = document.getElementById('admin-songs-list');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>';
  
  try {
    const { data, error } = await fetchAllSongs();
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Şarkı bulunamadı</p></div>';
      return;
    }
    
    container.innerHTML = data.map((song, i) => `
      <div class="admin-song-row" data-song-id="${song.id}">
        <span class="song-num">${i + 1}</span>
        <span class="song-title-col">${escapeHtml(song.title)}</span>
        <span class="song-artist-col">${formatArtistLinks(song.artist)}</span>
        <span class="song-duration-col">${formatDuration(song.duration)}</span>
        <button class="btn-delete-song" data-delete-song="${song.id}" title="Şarkıyı Sil">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `).join('');
    
    // Bind delete events
    container.querySelectorAll('[data-delete-song]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const songId = btn.dataset.deleteSong;
        const song = data.find(s => s.id === songId);
        if (confirm(`"${song?.title || 'Bu şarkı'}" silinecek. Emin misin?`)) {
          try {
            const { error } = await deleteSong(songId);
            if (error) {
              showToast('Silinemedi: ' + (error.message || ''), 'error');
            } else {
              showToast('Şarkı silindi 🗑️', 'success');
              loadAdminSongs();
              loadDashboardStats();
              loadSongs(); // Refresh main song list
            }
          } catch (err) {
            showToast('Hata oluştu', 'error');
          }
        }
      });
    });
  } catch (err) {
    console.error('Admin songs error:', err);
  }
}

async function handleAddSong() {
  const title = document.getElementById('admin-song-title').value.trim();
  const artist = document.getElementById('admin-song-artist').value.trim();
  const album = document.getElementById('admin-song-album').value.trim();
  const duration = parseInt(document.getElementById('admin-song-duration').value) || null;
  const file_path = document.getElementById('admin-song-url').value.trim();
  const cover_url = document.getElementById('admin-song-cover').value.trim();
  
  if (!title || !artist || !file_path) {
    showToast('Şarkı adı, sanatçı ve dosya URL gerekli', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-admin-add-song');
  btn.disabled = true;
  btn.textContent = 'Ekleniyor...';
  
  try {
    const songData = { title, artist, file_path };
    if (album) songData.album = album;
    if (duration) songData.duration = duration;
    if (cover_url) songData.cover_url = cover_url;
    
    const { data, error } = await addSong(songData);
    if (error) {
      showToast('Eklenemedi: ' + (error.message || ''), 'error');
    } else {
      showToast(`"${title}" eklendi! 🎵`, 'success');
      // Clear form
      document.getElementById('admin-song-title').value = '';
      document.getElementById('admin-song-artist').value = '';
      document.getElementById('admin-song-album').value = '';
      document.getElementById('admin-song-duration').value = '';
      document.getElementById('admin-song-url').value = '';
      document.getElementById('admin-song-cover').value = '';
      // Refresh
      loadAdminSongs();
      loadDashboardStats();
      loadSongs(); // Refresh main song list
    }
  } catch (err) {
    showToast('Hata oluştu', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right:6px"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>Şarkı Ekle';
  }
}

// ===== Profile Page =====

function initProfilePage() {
  const saveBtn = document.getElementById('btn-save-profile');
  const changeAvatarBtn = document.getElementById('btn-change-avatar');
  if (saveBtn) saveBtn.addEventListener('click', handleSaveProfile);
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg, image/jpg, image/webp';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          showToast('Dosya boyutu 5MB\'dan küçük olmalıdır', 'error');
          return;
        }
        
        try {
          const sb = getSupabase();
          const ext = file.name.split('.').pop();
          const fileName = `${currentUserId}/avatar-${Date.now()}.${ext}`;
          
          const { error: uploadError } = await sb.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });
            
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = sb.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
          const { error: updateError } = await updateProfile(currentUserId, { avatar_url: publicUrl });
          if (updateError) throw updateError;
          
          showToast('Profil fotoğrafı güncellendi! 📸', 'success');
          loadProfilePage();
          loadUserInfo();
        } catch (err) {
          showToast('Yükleme sırasında hata oluştu', 'error');
        }
      };
      input.click();
    });
  }
  
  // Remove avatar button
  const removeAvatarBtn = document.getElementById('btn-remove-avatar');
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', async () => {
      if (!confirm('Profil fotoğrafını kaldırmak istediğine emin misin?')) return;
      try {
        const { error } = await updateProfile(currentUserId, { avatar_url: null });
        if (error) throw error;
        showToast('Fotoğraf kaldırıldı', 'success');
        loadProfilePage();
        loadUserInfo();
      } catch (err) {
        showToast('Fotoğraf kaldırılamadı', 'error');
      }
    });
  }
}

async function loadProfilePage() {
  const user = await getCurrentUser();
  if (!user) return;
  
  try {
    const { data: profile } = await fetchProfile(user.id);
    document.getElementById('profile-email').value = user.email || '';
    if (profile) {
      document.getElementById('profile-username').value = profile.username || '';
      document.getElementById('profile-bio').value = profile.bio || '';
      document.getElementById('profile-date').textContent = new Date(profile.created_at || user.created_at).toLocaleDateString('tr-TR');
      
      const roleText = {
        admin: 'Admin',
        yetkili: 'Yetkili',
        artist: 'Sanatçı',
        premium: 'Premium'
      }[profile.role] || 'Kullanıcı';
      
      document.getElementById('profile-role-display').textContent = roleText;
      
      const avatarEl = document.getElementById('profile-avatar-large');
      const removeBtn = document.getElementById('btn-remove-avatar');
      if (profile.avatar_url) {
        avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
        if (removeBtn) removeBtn.style.display = 'block';
      } else {
        avatarEl.innerHTML = `<span style="font-size:40px;font-weight:700;color:var(--ts)">${getInitials(profile.username)}</span>`;
        if (removeBtn) removeBtn.style.display = 'none';
      }
      
      // Show banner if loaded
      if (profile.banner_url) {
        currentUserBannerUrl = profile.banner_url;
        showBannerPreview(profile.banner_url);
      }
    }
    
    const sb = getSupabase();
    const playlists = await sb.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const liked = await sb.from('liked_songs').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    
    // Follower count (people who added this user as a friend)
    const followers = await sb.from('friendships').select('*', { count: 'exact', head: true })
      .eq('friend_id', user.id)
      .eq('status', 'accepted'); // or ignore status, up to standard: .eq('status', 'accepted')
    
    document.getElementById('profile-stat-playlists').textContent = playlists.count || 0;
    document.getElementById('profile-stat-liked').textContent = liked.count || 0;
    
    const countEl = document.getElementById('profile-stat-followers');
    if (countEl) countEl.textContent = followers.count || 0;
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

async function handleSaveProfile() {
  const username = document.getElementById('profile-username').value.trim();
  const bio = document.getElementById('profile-bio').value.trim();
  const btn = document.getElementById('btn-save-profile');
  
  if (!username) {
    showToast('Kullanıcı adı boş olamaz', 'error');
    return;
  }
  
  btn.classList.add('loading');
  btn.disabled = true;
  
  try {
    let { error } = await updateProfile(currentUserId, { username, bio });
    if (error && error.message && error.message.includes('bio')) {
      // Fallback if bio column doesn't exist
      const retry = await updateProfile(currentUserId, { username });
      error = retry.error;
    }
    if (error) throw error;
    showToast('Profil kaydedildi ✅', 'success');
    loadUserInfo(); // Update sidebar name
  } catch (err) {
    showToast('Profil kaydedilemedi', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ===== Public User Profile =====
let currentPublicUserId = null;

async function loadPublicUserProfile(userId) {
  if (userId === currentUserId) {
    navigateTo('profile');
    return;
  }
  
  try {
    const { data: profile, error } = await fetchUserPublicProfile(userId);
    if (error || !profile) {
      showToast(error?.message || 'Profil bulunamadı', 'error');
      navigateTo('home');
      return;
    }
    
    currentPublicUserId = userId;
    
    // Update Banner
    const usernameEl = document.getElementById('public-profile-username');
    usernameEl.innerHTML = `${escapeHtml(profile.username)}${profile.role === 'artist' ? getVerifiedTick() : ''}`;
    
    document.getElementById('public-profile-followers').textContent = `${profile.followers_count} Takipçi`;
    document.getElementById('public-profile-playlists').textContent = `${profile.playlists_count} Herkese Açık Liste`;
    
    const avatarEl = document.getElementById('public-profile-avatar');
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
    } else {
      avatarEl.innerHTML = `<span style="font-size:60px;font-weight:700;color:var(--ts)">${getInitials(profile.username)}</span>`;
    }
    
    // Show banner if exists
    const bannerImg = document.getElementById('public-profile-banner-img');
    if (bannerImg) {
      if (profile.banner_url) {
        bannerImg.src = profile.banner_url;
        bannerImg.style.display = 'block';
      } else {
        bannerImg.style.display = 'none';
      }
    }
    
    // Setup Buttons
    const followBtn = document.getElementById('btn-public-follow');
    if (profile.is_following) {
      followBtn.textContent = 'Takipten Çık';
      followBtn.classList.remove('btn-primary');
      followBtn.style.border = '1px solid var(--border)';
      followBtn.style.background = 'transparent';
      followBtn.onclick = async () => {
        followBtn.textContent = '...';
        await removeFriend(userId);
        loadPublicUserProfile(userId); // reload
      };
    } else {
      followBtn.textContent = 'Takip Et';
      followBtn.classList.add('btn-primary');
      followBtn.style.border = '';
      followBtn.style.background = '';
      followBtn.onclick = async () => {
        followBtn.textContent = '...';
        await addFriend(userId);
        loadPublicUserProfile(userId); // reload
      };
    }
    
    const blockBtn = document.getElementById('btn-public-block');
    blockBtn.onclick = async () => {
      if (!confirm(`${profile.username} isimli kullanıcıyı engellemek istediğinize emin misiniz?`)) return;
      await blockUser(userId);
      showToast('Kullanıcı engellendi', 'success');
      navigateTo('home');
    };
    
    // Fetch and render public playlists
    const sb = getSupabase();
    const { data: playlists } = await sb.from('playlists').select('*').eq('user_id', userId).eq('is_public', true).order('created_at', { ascending: false });
    
    const playlistsGrid = document.getElementById('public-profile-playlists-grid');
    if (playlists && playlists.length > 0) {
      playlistsGrid.innerHTML = playlists.map(pl => {
        const coverHtml = pl.cover_url 
          ? `<img src="${pl.cover_url}" alt="${escapeHtml(pl.name)}" onerror="this.style.display='none'">` 
          : `<svg class="default-cover" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        return `
        <div class="song-card playlist-card" data-playlist-id="${pl.id}">
          <div class="song-card-cover">
            ${coverHtml}
          </div>
          <div class="song-card-title">${escapeHtml(pl.name)}</div>
        </div>`;
      }).join('');
    } else {
      playlistsGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1"><p>Bu kullanıcının herkese açık listesi yok</p></div>`;
    }
    
    // Show page
    navigateTo('user-profile');
    
  } catch (err) {
    showToast('Profil yüklenemedi', 'error');
  }
}

// ===== Artist Upload Page =====

function initArtistPage() {
  const btn = document.getElementById('btn-artist-submit-song');
  if (btn) btn.addEventListener('click', handleArtistSubmitSong);
}

async function loadArtistPage() {
  const container = document.getElementById('artist-submitted-songs');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>';
  
  try {
    const sb = getSupabase();
    const { data: profile } = await fetchProfile(currentUserId);
    if (!profile) return;
    
    // Sadece sanatçının adına göre arama yapıyoruz (kendi yüklediklerini görebilsin diye)
    const { data, error } = await sb.from('songs')
      .select('*')
      .ilike('artist', `%${profile.username}%`)
      .order('created_at', { ascending: false });
      
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Henüz şarkı göndermedin</p></div>';
      return;
    }
    
    container.innerHTML = data.map(song => `
      <div class="pending-song-card" style="margin-bottom:8px">
        <div class="pending-song-info">
          <div class="pending-song-title">${escapeHtml(song.title)}</div>
          <div class="pending-song-artist">${escapeHtml(song.artist)}</div>
          <div class="pending-song-meta">
            ${song.album ? `${escapeHtml(song.album)} • ` : ''} 
            Durum: <span class="status-badge ${song.status === 'pending' ? 'pending' : (song.status === 'approved' ? 'approved' : 'rejected')}">${song.status === 'pending' ? 'Bekliyor' : 'Yayınlandı'}</span>
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Artist songs load error:', err);
    container.innerHTML = '<div class="empty-state"><p>Hata oluştu</p></div>';
  }
}

async function handleArtistSubmitSong() {
  const title = document.getElementById('artist-song-title').value.trim();
  const album = document.getElementById('artist-song-album').value.trim();
  const duration = parseInt(document.getElementById('artist-song-duration').value) || null;
  const file_path = document.getElementById('artist-song-url').value.trim();
  const cover_url = document.getElementById('artist-song-cover').value.trim();
  
  if (!title || !file_path) {
    showToast('Şarkı adı ve dosya URL gerekli', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-artist-submit-song');
  btn.disabled = true;
  btn.textContent = 'Gönderiliyor...';
  
  try {
    const { data: profile } = await fetchProfile(currentUserId);
    const artistName = profile.username || 'Bilinmeyen Sanatçı';
    
    const songData = { title, artist: artistName, file_path };
    if (album) songData.album = album;
    if (duration) songData.duration = duration;
    if (cover_url) songData.cover_url = cover_url;
    
    const { error } = await submitSongForApproval(songData);
    if (error) throw error;
    
    showToast(`"${title}" onaya gönderildi! 🕒`, 'success');
    
    document.getElementById('artist-song-title').value = '';
    document.getElementById('artist-song-album').value = '';
    document.getElementById('artist-song-duration').value = '';
    document.getElementById('artist-song-url').value = '';
    document.getElementById('artist-song-cover').value = '';
    
    loadArtistPage();
  } catch (err) {
    showToast('Hata oluştu: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="margin-right:6px"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>Şarkı Gönder';
  }
}

// ===== Admin Pending Songs =====
const originalLoadAdminPage = loadAdminPage;
loadAdminPage = async function() {
  await originalLoadAdminPage();
  loadAdminPendingSongs();
}

async function loadAdminPendingSongs() {
  let pendingSection = document.getElementById('admin-pending-songs-section');
  if (!pendingSection) {
    const adminPage = document.getElementById('page-admin');
    pendingSection = document.createElement('section');
    pendingSection.className = 'section';
    pendingSection.id = 'admin-pending-songs-section';
    pendingSection.innerHTML = `
      <h2 class="section-title">🕒 Onay Bekleyen Şarkılar</h2>
      <div id="admin-pending-songs-list">
        <div class="loading-state"><div class="spinner"></div><p>Y\u00fckleniyor...</p></div>
      </div>
    `;
    const sections = adminPage.querySelectorAll('.section');
    // Sanatçı listesinden önce 3. sıraya koyalım
    if (sections.length > 2) {
      adminPage.insertBefore(pendingSection, sections[2]);
    } else {
      adminPage.appendChild(pendingSection);
    }
  }
  
  const container = document.getElementById('admin-pending-songs-list');
  try {
    const { data, error } = await fetchPendingSongs();
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state" style="margin-top:0;padding:24px"><p>Onay bekleyen şarkı yok</p></div>';
      return;
    }
    
    container.innerHTML = data.map(song => {
      const coverHtml = song.cover_url 
        ? `<img src="${song.cover_url}" alt="" class="pending-song-cover">` 
        : `<div class="pending-song-cover pending-song-cover-default"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`;
      return `
      <div class="pending-song-card" style="margin-bottom:8px">
        ${coverHtml}
        <div class="pending-song-info">
          <div class="pending-song-title">${escapeHtml(song.title)}</div>
          <div class="pending-song-artist">${escapeHtml(song.artist)}</div>
          <div class="pending-song-meta">
            ${song.album ? `${escapeHtml(song.album)} • ` : ''} 
            ${new Date(song.created_at).toLocaleDateString()}
          </div>
        </div>
        <div class="pending-actions">
          <button class="btn-preview-song" data-preview-id="${song.id}" data-preview-url="${song.file_path}" data-preview-title="${escapeHtml(song.title)}" data-preview-artist="${escapeHtml(song.artist)}" data-preview-cover="${song.cover_url || ''}" title="Dinle">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="btn-approve" data-approve="${song.id}">Onayla</button>
          <button class="btn-reject" data-reject="${song.id}">Reddet</button>
        </div>
      </div>
    `;
    }).join('');
    
    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.approve;
        try {
          await approveSong(id);
          showToast('Şarkı onaylandı ✅', 'success');
          loadAdminPendingSongs();
          loadAdminSongs();
          loadSongs();
        } catch (err) {
          showToast('Hata', 'error');
        }
      });
    });
    
    container.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Şarkıyı reddedip silmek istediğinize emin misiniz?')) return;
        const id = btn.dataset.reject;
        try {
          await rejectSong(id);
          showToast('Şarkı reddedildi ❌', 'success');
          loadAdminPendingSongs();
        } catch (err) {
          showToast('Hata', 'error');
        }
      });
    });
    
    // Preview play button
    container.querySelectorAll('.btn-preview-song').forEach(btn => {
      btn.addEventListener('click', () => {
        const songObj = {
          id: btn.dataset.previewId,
          title: btn.dataset.previewTitle,
          artist: btn.dataset.previewArtist,
          file_path: btn.dataset.previewUrl,
          cover_url: btn.dataset.previewCover || null
        };
        player.playSong(songObj, [songObj]);
        showToast('Önizleme: ' + songObj.title + ' 🎧', 'success');
      });
    });
    
  } catch (err) {
    console.error('Pending songs error', err);
    container.innerHTML = '<div class="empty-state"><p>Hata oluştu</p></div>';
  }
}

// ===== Admin: Reserved Usernames =====
async function loadAdminReservedNames() {
  let section = document.getElementById('admin-reserved-section');
  if (!section) {
    const adminPage = document.getElementById('page-admin');
    section = document.createElement('section');
    section.className = 'section';
    section.id = 'admin-reserved-section';
    section.innerHTML = `
      <h2 class="section-title">🚫 Alınamayacak İsimler</h2>
      <div class="admin-add-song" style="margin-bottom:16px">
        <div class="admin-form-row">
          <input type="text" id="reserved-name-input" placeholder="İsim ekle..." maxlength="30">
          <button class="btn-primary-small" id="btn-add-reserved">Ekle</button>
        </div>
      </div>
      <div id="reserved-names-list"></div>
    `;
    adminPage.appendChild(section);
    
    // Add button handler
    document.getElementById('btn-add-reserved').addEventListener('click', async () => {
      const input = document.getElementById('reserved-name-input');
      const name = input.value.trim();
      if (!name) { showToast('İsim boş olamaz', 'error'); return; }
      
      const { error } = await addReservedUsername(name, currentUserId);
      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') {
          showToast('Bu isim zaten ekli', 'error');
        } else {
          showToast('Hata: ' + (error.message || ''), 'error');
        }
        return;
      }
      showToast(`"${name}" eklendi 🚫`, 'success');
      input.value = '';
      loadAdminReservedNames();
    });
    
    document.getElementById('reserved-name-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-add-reserved').click();
    });
  }
  
  const container = document.getElementById('reserved-names-list');
  try {
    const { data, error } = await fetchReservedUsernames();
    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:16px"><p>Henüz alınamayacak isim eklenmemiş</p></div>';
      return;
    }
    
    container.innerHTML = `<div class="reserved-names-grid">${data.map(item => `
      <div class="reserved-name-tag">
        <span>${escapeHtml(item.username)}</span>
        <button class="reserved-name-remove" data-remove-id="${item.id}" title="Kaldır">✕</button>
      </div>
    `).join('')}</div>`;
    
    container.querySelectorAll('.reserved-name-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await removeReservedUsername(btn.dataset.removeId);
        if (error) { showToast('Silinemedi', 'error'); return; }
        showToast('İsim kaldırıldı', 'success');
        loadAdminReservedNames();
      });
    });
  } catch (err) {
    console.error('Reserved names error:', err);
  }
}

// ===== Admin: Add Ban/Delete to User Table =====
async function addAdminUserActions() {
  const rows = document.querySelectorAll('.admin-table tbody tr');
  
  for (const row of rows) {
    if (row.querySelector('.admin-user-actions')) continue;
    
    const roleSelect = row.querySelector('.role-select');
    if (!roleSelect) continue;
    const userId = roleSelect.dataset.userId;
    if (!userId || userId === currentUserId) continue;
    
    // Fetch ban status
    const sb = getSupabase();
    const { data: userProfile } = await sb.from('profiles').select('is_banned').eq('id', userId).maybeSingle();
    const isBanned = userProfile?.is_banned || false;
    
    const actionsCell = document.createElement('td');
    actionsCell.className = 'admin-user-actions';
    actionsCell.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center">
        ${isBanned 
          ? `<button class="btn-admin-unban" data-unban-user="${userId}" title="Engeli Kaldır" style="padding:3px 10px;border:1px solid #4caf50;background:rgba(76,175,80,.1);color:#4caf50;border-radius:500px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font)">Engeli Kaldır</button>`
          : `<button class="btn-admin-ban" data-ban-user="${userId}" title="Engelle">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>
            </button>`
        }
        <button class="btn-admin-delete" data-delete-user="${userId}" title="Hesabı Sil">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    row.appendChild(actionsCell);
    
    // Ban/Unban handler
    const banBtn = actionsCell.querySelector('.btn-admin-ban');
    const unbanBtn = actionsCell.querySelector('.btn-admin-unban');
    
    if (banBtn) {
      banBtn.addEventListener('click', async () => {
        if (!confirm('Bu kullanıcıyı engellemek istediğinize emin misiniz?')) return;
        const { error } = await adminBanUser(userId);
        if (error) { showToast('Engellenemedi: ' + (error.message || ''), 'error'); return; }
        showToast('Kullanıcı engellendi 🚫', 'success');
        // Remove old actions and re-add
        row.querySelectorAll('.admin-user-actions').forEach(el => el.remove());
        addAdminUserActions();
      });
    }
    
    if (unbanBtn) {
      unbanBtn.addEventListener('click', async () => {
        if (!confirm('Bu kullanıcının engelini kaldırmak istediğinize emin misiniz?')) return;
        const { error } = await adminUnbanUser(userId);
        if (error) { showToast('Engel kaldırılamadı: ' + (error.message || ''), 'error'); return; }
        showToast('Engel kaldırıldı ✅', 'success');
        row.querySelectorAll('.admin-user-actions').forEach(el => el.remove());
        addAdminUserActions();
      });
    }
    
    // Delete handler
    actionsCell.querySelector('.btn-admin-delete').addEventListener('click', async () => {
      if (!confirm('Bu kullanıcının hesabını SİLMEK istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
      if (!confirm('GERÇEKTEN EMİN MİSİNİZ? Tüm verileri silinecek!')) return;
      const { error } = await adminDeleteUser(userId);
      if (error) { showToast('Silinemedi: ' + (error.message || ''), 'error'); return; }
      showToast('Hesap silindi', 'success');
      loadAdminPage();
    });
  }
}

// Override loadAdminPage again to include new sections
const _prevLoadAdminPage = loadAdminPage;
loadAdminPage = async function() {
  await _prevLoadAdminPage();
  loadAdminReservedNames();
  // Delay to let user table render first
  setTimeout(() => addAdminUserActions(), 500);
}

// ===== Sidebar: Show verified tick for current user =====
const _origLoadUserInfo = loadUserInfo;
loadUserInfo = async function() {
  await _origLoadUserInfo();
  // Add verified tick if current user is artist
  if (currentUserRole === 'artist') {
    const nameEl = document.getElementById('user-name');
    if (nameEl && !nameEl.querySelector('.verified-tick')) {
      const badge = nameEl.querySelector('.role-badge');
      const tickSpan = document.createElement('span');
      tickSpan.className = 'verified-tick';
      tickSpan.title = 'Onaylı Sanatçı';
      tickSpan.textContent = '✓';
      if (badge) {
        badge.parentNode.insertBefore(tickSpan, badge);
      } else {
        nameEl.appendChild(tickSpan);
      }
    }
  }
}

// ===== Now Playing Detail Overlay =====
let npOverlayOpen = false;

function initNowPlayingOverlay() {
  const overlay = document.getElementById('now-playing-overlay');
  const closeBtn = document.getElementById('np-close-btn');
  const npCover = document.getElementById('now-playing-cover');
  const npInfo = document.querySelector('.now-playing-info');

  // Open overlay when clicking cover or song info in player bar
  if (npCover) {
    npCover.addEventListener('click', (e) => {
      e.stopPropagation();
      if (player.getCurrentSong()) openNowPlayingOverlay();
    });
  }
  if (npInfo) {
    npInfo.addEventListener('click', (e) => {
      e.stopPropagation();
      if (player.getCurrentSong()) openNowPlayingOverlay();
    });
  }

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeNowPlayingOverlay());
  }

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && npOverlayOpen) {
      closeNowPlayingOverlay();
    }
  });

  // Overlay player controls
  document.getElementById('np-play')?.addEventListener('click', () => player.togglePlay());
  document.getElementById('np-next')?.addEventListener('click', () => {
    player.next();
    setTimeout(() => updateNowPlayingOverlay(), 300);
  });
  document.getElementById('np-prev')?.addEventListener('click', () => {
    player.previous();
    setTimeout(() => updateNowPlayingOverlay(), 300);
  });
  document.getElementById('np-shuffle')?.addEventListener('click', () => {
    player.toggleShuffle();
    document.getElementById('np-shuffle')?.classList.toggle('active', player.isShuffle);
  });
  document.getElementById('np-repeat')?.addEventListener('click', () => {
    player.toggleRepeat();
    document.getElementById('np-repeat')?.classList.toggle('active', player.repeatMode !== 'none');
  });

  // Overlay progress bar click & drag
  const npProgressBar = document.getElementById('np-progress-bar');
  let npDragging = false;

  const npSeek = (e) => {
    const rect = npProgressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    player.seek(percent);
  };

  npProgressBar?.addEventListener('mousedown', (e) => {
    npDragging = true;
    npSeek(e);
  });
  document.addEventListener('mousemove', (e) => {
    if (npDragging) npSeek(e);
  });
  document.addEventListener('mouseup', () => { npDragging = false; });

  // Like button in overlay
  document.getElementById('np-like-btn')?.addEventListener('click', async () => {
    const currentSong = player.getCurrentSong();
    if (!currentSong || !currentUserId) return;
    await toggleLikeSong(currentSong.id);
    syncNowPlayingLikeState();
  });

  // Song clicks in overlay's "more songs" list
  document.getElementById('np-songs-list')?.addEventListener('click', (e) => {
    const songItem = e.target.closest('.np-song-item[data-song-id]');
    if (songItem) {
      playSongFromAny(songItem.dataset.songId);
      setTimeout(() => updateNowPlayingOverlay(), 300);
    }
  });

  // Sync overlay progress bar with audio timeupdate
  setupOverlaySync();
}

function openNowPlayingOverlay() {
  const overlay = document.getElementById('now-playing-overlay');
  if (!overlay) return;
  npOverlayOpen = true;
  overlay.classList.add('open');
  updateNowPlayingOverlay();

  // Scroll to top
  const scroll = document.getElementById('np-scroll');
  if (scroll) scroll.scrollTop = 0;
}

function closeNowPlayingOverlay() {
  const overlay = document.getElementById('now-playing-overlay');
  if (!overlay) return;
  npOverlayOpen = false;
  overlay.classList.remove('open');
}

function updateNowPlayingOverlay() {
  const song = player.getCurrentSong();
  if (!song) return;

  // Cover art
  const coverEl = document.getElementById('np-cover-art');
  if (song.cover_url) {
    coverEl.innerHTML = `<img src="${song.cover_url}" alt="${escapeHtml(song.title)}">`;
    // Dynamic background gradient based on cover
    coverEl.style.background = 'none';
  } else {
    coverEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.2" width="80" height="80"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    coverEl.style.background = 'linear-gradient(135deg,#1a1a2e,#16213e)';
  }

  // Song info
  document.getElementById('np-song-title').textContent = song.title;
  document.getElementById('np-song-artist').innerHTML = formatArtistLinks(song.artist);

  // Sync play/pause state
  syncNowPlayingPlayState();

  // Sync shuffle/repeat state
  document.getElementById('np-shuffle')?.classList.toggle('active', player.isShuffle);
  document.getElementById('np-repeat')?.classList.toggle('active', player.repeatMode !== 'none');

  // Sync like state
  syncNowPlayingLikeState();

  // Load artist info
  loadNowPlayingArtistInfo(song.artist);

  // Load more songs by artist
  loadNowPlayingMoreSongs(song);

  // Load credits
  loadNowPlayingCredits(song);

  // Load lyrics
  loadNowPlayingLyrics(song);

  // Spotify Canvas: extract colors from cover art
  updateCanvasBackground(song.cover_url);
}

// ===== Spotify Canvas Background Color Extraction =====
let _lastCanvasCoverUrl = null;

function updateCanvasBackground(coverUrl) {
  const bgEl = document.getElementById('np-canvas-bg');
  if (!bgEl) return;

  // Don't re-extract for same image
  if (coverUrl === _lastCanvasCoverUrl) return;
  _lastCanvasCoverUrl = coverUrl;

  if (!coverUrl) {
    // Reset to defaults
    bgEl.style.setProperty('--canvas-color-1', 'rgba(29, 185, 84, 0.4)');
    bgEl.style.setProperty('--canvas-color-2', 'rgba(30, 60, 120, 0.4)');
    bgEl.style.setProperty('--canvas-color-3', 'rgba(120, 40, 140, 0.35)');
    bgEl.style.setProperty('--canvas-color-4', 'rgba(200, 100, 50, 0.3)');
    return;
  }

  // Load image and extract colors
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.getElementById('np-color-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Draw small version for performance
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);
      
      const imageData = ctx.getImageData(0, 0, size, size).data;
      const colors = extractDominantColors(imageData, size, size, 4);
      
      // Apply colors with nice opacity
      if (colors.length >= 4) {
        bgEl.style.setProperty('--canvas-color-1', `rgba(${colors[0].r}, ${colors[0].g}, ${colors[0].b}, 0.45)`);
        bgEl.style.setProperty('--canvas-color-2', `rgba(${colors[1].r}, ${colors[1].g}, ${colors[1].b}, 0.4)`);
        bgEl.style.setProperty('--canvas-color-3', `rgba(${colors[2].r}, ${colors[2].g}, ${colors[2].b}, 0.35)`);
        bgEl.style.setProperty('--canvas-color-4', `rgba(${colors[3].r}, ${colors[3].g}, ${colors[3].b}, 0.3)`);
      }
    } catch (e) {
      console.log('Canvas color extraction error:', e);
    }
  };
  img.onerror = () => {
    // Fallback colors on error
    _lastCanvasCoverUrl = null;
  };
  img.src = coverUrl;
}

function extractDominantColors(imageData, width, height, numColors) {
  // Simple color quantization: sample pixels and cluster
  const pixels = [];
  const step = 4; // sample every 4th pixel for performance
  
  for (let i = 0; i < imageData.length; i += 4 * step) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const a = imageData[i + 3];
    
    // Skip transparent and very dark/very light pixels
    if (a < 128) continue;
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 240) continue;
    
    pixels.push({ r, g, b });
  }
  
  if (pixels.length < numColors) {
    // Not enough pixels, return defaults
    return [
      { r: 29, g: 185, b: 84 },
      { r: 30, g: 60, b: 120 },
      { r: 120, g: 40, b: 140 },
      { r: 200, g: 100, b: 50 }
    ];
  }
  
  // K-means clustering (simplified)
  let centroids = [];
  const pixelStep = Math.floor(pixels.length / numColors);
  for (let i = 0; i < numColors; i++) {
    centroids.push({ ...pixels[i * pixelStep] });
  }
  
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array.from({ length: numColors }, () => []);
    
    for (const pixel of pixels) {
      let minDist = Infinity;
      let closest = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dr = pixel.r - centroids[c].r;
        const dg = pixel.g - centroids[c].g;
        const db = pixel.b - centroids[c].b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          closest = c;
        }
      }
      clusters[closest].push(pixel);
    }
    
    for (let c = 0; c < numColors; c++) {
      if (clusters[c].length === 0) continue;
      const sum = clusters[c].reduce((acc, p) => ({
        r: acc.r + p.r,
        g: acc.g + p.g,
        b: acc.b + p.b
      }), { r: 0, g: 0, b: 0 });
      centroids[c] = {
        r: Math.round(sum.r / clusters[c].length),
        g: Math.round(sum.g / clusters[c].length),
        b: Math.round(sum.b / clusters[c].length)
      };
    }
  }
  
  // Boost saturation slightly for more vivid blobs
  return centroids.map(c => {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    const boost = 1.3;
    const avg = (c.r + c.g + c.b) / 3;
    return {
      r: Math.min(255, Math.round(avg + (c.r - avg) * boost)),
      g: Math.min(255, Math.round(avg + (c.g - avg) * boost)),
      b: Math.min(255, Math.round(avg + (c.b - avg) * boost))
    };
  });
}

// ===== Lyrics System =====
let currentLyricsData = null;
let parsedSyncedLyrics = [];
let currentActiveLyricIndex = -1;
let lyricsCollapsed = false;
let isLyricShareMode = false;
let selectedLyricIndexes = [];
let lastLyricsSongId = null;
let currentLyricOffset = 0; // seconds

function parseLRC(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const parsed = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const line of lines) {
    const times = [];
    let match;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3]);
      times.push(minutes * 60 + seconds + ms / 1000);
    }

    const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();

    for (const time of times) {
      parsed.push({ time, text });
    }
  }

  // Sort by time
  parsed.sort((a, b) => a.time - b.time);
  return parsed;
}

async function loadNowPlayingLyrics(song) {
  if (!song) return;

  // Don't reload if same song
  if (lastLyricsSongId === song.id && currentLyricsData !== undefined) return;
  lastLyricsSongId = song.id;

  const loadingEl = document.getElementById('np-lyrics-loading');
  const contentEl = document.getElementById('np-lyrics-content');
  const notFoundEl = document.getElementById('np-lyrics-not-found');

  if (!loadingEl || !contentEl || !notFoundEl) return;

  // Show loading
  loadingEl.style.display = 'flex';
  contentEl.style.display = 'none';
  notFoundEl.style.display = 'none';
  currentLyricsData = null;
  parsedSyncedLyrics = [];
  currentActiveLyricIndex = -1;
  currentLyricOffset = 0;

  const syncDisp = document.getElementById('sync-offset-display');
  if(syncDisp) { syncDisp.textContent = '0.0s'; syncDisp.style.color = 'var(--ts)'; }
  const syncCtrl = document.getElementById('lyric-sync-controls');
  if(syncCtrl) syncCtrl.style.display = 'none';

  try {
    const result = await getLyrics(song);

    loadingEl.style.display = 'none';

    if (!result || (!result.plainLyrics && !result.syncedLyrics)) {
      // No lyrics found
      notFoundEl.style.display = 'flex';
      currentLyricsData = null;
      return;
    }

    currentLyricsData = result;

    // Render lyrics
    if (result.syncedLyrics) {
      if(syncCtrl) syncCtrl.style.display = 'flex';
      // Parse and render synced lyrics
      parsedSyncedLyrics = parseLRC(result.syncedLyrics);
      renderSyncedLyrics(parsedSyncedLyrics);
    } else if (result.plainLyrics) {
      // Render plain text with fake timings
      renderPlainLyrics(result.plainLyrics, song.duration);
    }

    contentEl.style.display = 'block';
  } catch (err) {
    console.error('Lyrics load error:', err);
    loadingEl.style.display = 'none';
    notFoundEl.style.display = 'flex';
  }
}

function renderSyncedLyrics(lines) {
  const contentEl = document.getElementById('np-lyrics-content');
  if (!contentEl) return;

  let html = '<div class="np-lyrics-synced">';

  lines.forEach((line, i) => {
    const text = line.text || '';
    const isInstrumental = text === '' || text === '♪' || text === '♫';

    if (isInstrumental) {
      html += `<div class="np-lyric-line instrumental" data-lyric-index="${i}" data-lyric-time="${line.time}">♪ ♪ ♪</div>`;
    } else {
      const words = text.split(/\s+/);
      const lineStart = line.time;
      const lineEnd = (i < lines.length - 1) ? lines[i + 1].time : lineStart + 4;
      const duration = lineEnd - lineStart;

      html += `<div class="np-lyric-line" data-lyric-index="${i}" data-lyric-time="${line.time}">`;
      words.forEach((word, wi) => {
        const wordTime = lineStart + (duration * wi / Math.max(words.length, 1));
        html += `<span class="np-lyric-word" data-word-time="${wordTime.toFixed(3)}">${escapeHtml(word)}</span>`;
      });
      html += '</div>';
    }
  });

  html += '</div>';
  contentEl.innerHTML = html;

  // Click to seek
  contentEl.querySelectorAll('.np-lyric-line').forEach(el => {
    el.addEventListener('click', () => {


      const time = parseFloat(el.dataset.lyricTime);
      if (!isNaN(time) && player.audio.duration) {
        player.audio.currentTime = time;
        if (!player.isPlaying) {
          player.audio.play();
          player.isPlaying = true;
          player.updatePlayButton();
        }
      }
    });
  });
}

function renderPlainLyrics(text, duration) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const totalDuration = duration || 180; // Varsayılan 3 dakika, eğer şarkı süresi yoksa
  const timePerLine = totalDuration / lines.length;

  const fakeSynced = lines.map((lineText, i) => {
    return {
      time: i * timePerLine,
      text: lineText
    };
  });

  parsedSyncedLyrics = fakeSynced;
  renderSyncedLyrics(fakeSynced);
}

function updateSyncedLyricsHighlight(currentTime) {
  if (!parsedSyncedLyrics || parsedSyncedLyrics.length === 0) return;

  let adjustedTime = currentTime + currentLyricOffset;

  // Find active line
  let activeIdx = -1;
  for (let i = parsedSyncedLyrics.length - 1; i >= 0; i--) {
    if (adjustedTime >= parsedSyncedLyrics[i].time) {
      activeIdx = i;
      break;
    }
  }

  const container = document.getElementById('np-lyrics-container');
  const lines = document.querySelectorAll('.np-lyric-line');
  if (!lines.length) return;

  // Update line states & scroll only when active line changes
  if (activeIdx !== currentActiveLyricIndex) {
    currentActiveLyricIndex = activeIdx;

    lines.forEach((el, i) => {
      el.classList.remove('active', 'past');
      if (i === activeIdx) {
        el.classList.add('active');
      } else if (i < activeIdx) {
        el.classList.add('past');
      }
    });

    // Auto-scroll active line to center
    if (activeIdx >= 0 && lines[activeIdx] && container) {
      const lineEl = lines[activeIdx];
      const containerRect = container.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();
      const offset = lineRect.top - containerRect.top - containerRect.height / 2 + lineRect.height / 2;
      container.scrollTop += offset;
    }
  }

  // Word-level highlighting (runs every frame for smooth transitions)
  const allWords = document.querySelectorAll('.np-lyric-word');
  allWords.forEach(wordEl => {
    const wordTime = parseFloat(wordEl.dataset.wordTime);
    if (adjustedTime >= wordTime) {
      wordEl.classList.add('sung');
    } else {
      wordEl.classList.remove('sung');
    }
  });
}

function initLyricsToggle() {
  const toggleBtn = document.getElementById('np-lyrics-toggle');
  const container = document.getElementById('np-lyrics-container');
  if (!toggleBtn || !container) return;

  // Prevent multiple bindings
  if(toggleBtn.dataset.bound) return;
  toggleBtn.dataset.bound = 'true';

  toggleBtn.addEventListener('click', () => {
    lyricsCollapsed = !lyricsCollapsed;
    container.classList.toggle('collapsed', lyricsCollapsed);
    toggleBtn.classList.toggle('collapsed', lyricsCollapsed);
  });
}

function initLyricsSyncControls() {
  const btnMinus = document.getElementById('btn-sync-minus');
  const btnPlus = document.getElementById('btn-sync-plus');
  if(!btnMinus || !btnPlus) return;

  if(btnMinus.dataset.bound) return;
  btnMinus.dataset.bound = 'true';
  btnPlus.dataset.bound = 'true';
  
  btnMinus.addEventListener('click', () => adjustLyricSync(-0.5));
  btnPlus.addEventListener('click', () => adjustLyricSync(0.5));
}

function adjustLyricSync(delta) {
  currentLyricOffset += delta;
  const disp = document.getElementById('sync-offset-display');
  if(disp) {
    disp.textContent = (currentLyricOffset > 0 ? '+' : '') + currentLyricOffset.toFixed(1) + 's';
    disp.style.color = currentLyricOffset === 0 ? 'var(--ts)' : 'var(--green)';
  }
  if(parsedSyncedLyrics && parsedSyncedLyrics.length > 0) {
    updateSyncedLyricsHighlight(player.audio.currentTime);
  }
}

function syncNowPlayingPlayState() {
  const playIcon = document.getElementById('np-icon-play');
  const pauseIcon = document.getElementById('np-icon-pause');
  if (player.isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

function syncNowPlayingLikeState() {
  const song = player.getCurrentSong();
  const npLikeBtn = document.getElementById('np-like-btn');
  if (!npLikeBtn || !song) return;
  npLikeBtn.classList.toggle('liked', userLikedSongIds.has(song.id));
}

function setupOverlaySync() {
  // Override the player's onTimeUpdate to also update overlay
  const originalOnTimeUpdate = player.onTimeUpdate.bind(player);
  player.onTimeUpdate = function() {
    originalOnTimeUpdate();

    const { currentTime, duration } = this.audio;
    if (!duration) return;

    // Always update synced lyrics highlight so it's ready when opened
    if (parsedSyncedLyrics && parsedSyncedLyrics.length > 0) {
      updateSyncedLyricsHighlight(currentTime);
    }

    if (!npOverlayOpen) return;

    const percent = (currentTime / duration) * 100;

    const fill = document.getElementById('np-progress-fill');
    const knob = document.getElementById('np-progress-knob');
    const timeCurrent = document.getElementById('np-time-current');

    if (fill) fill.style.width = percent + '%';
    if (knob) knob.style.left = percent + '%';
    if (timeCurrent) timeCurrent.textContent = this.formatTime(currentTime);
  };


  // Override onLoaded to sync total time
  const originalOnLoaded = player.onLoaded.bind(player);
  player.onLoaded = function() {
    originalOnLoaded();
    const timeTotal = document.getElementById('np-time-total');
    if (timeTotal) timeTotal.textContent = this.formatTime(this.audio.duration);
  };

  // Override updatePlayButton to sync overlay
  const originalUpdatePlayButton = player.updatePlayButton.bind(player);
  player.updatePlayButton = function() {
    originalUpdatePlayButton();
    if (npOverlayOpen) syncNowPlayingPlayState();
  };

  // Override updateUI to refresh overlay when song changes
  const originalUpdateUI = player.updateUI.bind(player);
  player.updateUI = function(song) {
    originalUpdateUI(song);
    // Reset lyrics for new song
    lastLyricsSongId = null;
    currentLyricsData = undefined;
    parsedSyncedLyrics = [];
    currentActiveLyricIndex = -1;
    if (npOverlayOpen) {
      setTimeout(() => updateNowPlayingOverlay(), 100);
    }
  };
}

async function loadNowPlayingArtistInfo(artistName) {
  const section = document.getElementById('np-artist-section');
  const nameEl = document.getElementById('np-artist-name');
  const bioEl = document.getElementById('np-artist-bio');
  const avatarEl = document.getElementById('np-artist-avatar');
  const statsEl = document.getElementById('np-artist-stats');
  const songCountEl = document.getElementById('np-artist-song-count');

  if (!section || !artistName) return;

  // For multi-artist, use the first artist name for the main display
  const primaryArtist = artistName.includes(',') ? artistName.split(',')[0].trim() : artistName;

  // Set artist name
  nameEl.innerHTML = escapeHtml(primaryArtist) + getVerifiedTick(primaryArtist);

  // Count songs by this artist
  const artistSongs = allSongs.filter(s => s.artist?.toLowerCase().includes(primaryArtist.toLowerCase()));
  songCountEl.textContent = `${artistSongs.length} şarkı platformda`;

  // Try to find artist profile - check BOTH profiles AND artists table
  try {
    const sb = getSupabase();
    
    // 1. Check profiles table first
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, username, avatar_url, bio, role')
      .ilike('username', primaryArtist)
      .limit(1);

    // 2. Also check artists table
    let artistTableData = null;
    try {
      const { data: artistRes } = await sb
        .from('artists')
        .select('id, name, avatar_url')
        .ilike('name', primaryArtist)
        .maybeSingle();
      artistTableData = artistRes;
    } catch (e) {
      console.log('Artist table lookup error:', e);
    }

    if (profiles && profiles.length > 0) {
      const profile = profiles[0];

      // Avatar: prefer profile avatar, fallback to artists table avatar
      const avatarUrl = profile.avatar_url || (artistTableData && artistTableData.avatar_url);
      if (avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(primaryArtist)}">`;
      } else {
        const initials = getInitials(primaryArtist);
        const color = getAvatarColor(primaryArtist);
        avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
      }

      // Bio
      if (profile.bio) {
        bioEl.textContent = profile.bio;
        bioEl.style.display = 'block';
      } else {
        bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
        bioEl.style.display = 'block';
      }

      // Followers count
      const { count: followersCount } = await sb
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', profile.id)
        .eq('status', 'accepted');

      if (followersCount > 0) {
        songCountEl.textContent = `${artistSongs.length} şarkı · ${followersCount} takipçi`;
      }
    } else if (artistTableData) {
      // Found in artists table but not in profiles
      if (artistTableData.avatar_url) {
        avatarEl.innerHTML = `<img src="${artistTableData.avatar_url}" alt="${escapeHtml(primaryArtist)}">`;
      } else {
        const initials = getInitials(primaryArtist);
        const color = getAvatarColor(primaryArtist);
        avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
      }
      bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
      bioEl.style.display = 'block';
    } else {
      // No profile found - show defaults
      const initials = getInitials(primaryArtist);
      const color = getAvatarColor(primaryArtist);
      avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
      bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
      bioEl.style.display = 'block';
    }
  } catch (err) {
    console.log('Artist info load error:', err);
    const initials = getInitials(primaryArtist);
    const color = getAvatarColor(primaryArtist);
    avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff">${initials}</div>`;
    bioEl.textContent = `${primaryArtist} Bekofy'da müzik paylaşıyor.`;
    bioEl.style.display = 'block';
  }
}

function loadNowPlayingMoreSongs(currentSong) {
  const container = document.getElementById('np-songs-list');
  const titleEl = document.getElementById('np-more-songs-title');
  const section = document.getElementById('np-more-songs');
  if (!container || !currentSong) return;

  const moreSongs = allSongs.filter(s =>
    s.artist?.toLowerCase() === currentSong.artist?.toLowerCase() &&
    s.id !== currentSong.id
  );

  if (moreSongs.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  titleEl.textContent = `${escapeHtml(currentSong.artist)} - Diğer Şarkılar`;

  container.innerHTML = moreSongs.slice(0, 10).map(song => {
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="">`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

    return `
      <div class="np-song-item" data-song-id="${song.id}">
        <div class="np-song-item-cover">${coverHtml}</div>
        <div class="np-song-item-info">
          <div class="np-song-item-title">${escapeHtml(song.title)}</div>
          <div class="np-song-item-album">${escapeHtml(song.album || currentSong.artist)}</div>
        </div>
        <span class="np-song-item-duration">${formatDuration(song.duration)}</span>
      </div>
    `;
  }).join('');
}

async function loadNowPlayingCredits(song) {
  const container = document.getElementById('np-credits-list');
  const section = document.getElementById('np-credits');
  if (!container || !song) return;

  // Build credits from available data
  const credits = [];

  // Parse multi-artist (comma-separated)
  const artistNames = song.artist ? song.artist.split(',').map(a => a.trim()).filter(Boolean) : [];
  
  for (let idx = 0; idx < artistNames.length; idx++) {
    const name = artistNames[idx];
    
    let avatarUrl = null;
    try {
      if (typeof getArtistByName === 'function') {
        const artistProfile = await getArtistByName(name);
        if (artistProfile && artistProfile.avatar_url) {
          avatarUrl = artistProfile.avatar_url;
        }
      }
    } catch (e) {
      console.log('Credits artist fetch error:', e);
    }
    
    credits.push({
      name: name,
      role: idx === 0 ? 'Ana Sanatçı' : 'İşbirliği',
      isArtist: true,
      avatarUrl: avatarUrl
    });
  }

  // If album exists, show album info
  if (song.album) {
    credits.push({
      name: song.album,
      role: 'Albüm',
      isAlbum: true
    });
  }

  section.style.display = credits.length > 0 ? 'block' : 'none';

  container.innerHTML = credits.map(credit => {
    let avatarHtml;
    if (credit.isArtist) {
      if (credit.avatarUrl) {
        avatarHtml = `<img src="${credit.avatarUrl}" alt="${escapeHtml(credit.name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        const initials = getInitials(credit.name);
        const color = getAvatarColor(credit.name);
        avatarHtml = `<div style="width:100%;height:100%;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff">${initials}</div>`;
      }
    } else if (credit.isAlbum) {
      avatarHtml = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style="color:var(--tm)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>`;
    } else {
      avatarHtml = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style="color:var(--tm)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    }

    return `
      <div class="np-credit-item">
        <div class="np-credit-avatar">${avatarHtml}</div>
        <div class="np-credit-info">
          <div class="np-credit-name">${escapeHtml(credit.name)}${credit.isArtist ? getVerifiedTick(credit.name) : ''}</div>
          <div class="np-credit-role">${credit.role}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Initialize on DOMContentLoaded (append to existing init)
document.addEventListener('DOMContentLoaded', () => {
  // Delay slightly so player is ready
  setTimeout(() => {
    initNowPlayingOverlay();
    initLyricsToggle();
    initLyricShare();
  }, 200);
});

// ===== Artist Profile Page =====
let currentArtistProfileSongs = [];

async function openArtistProfile(artistName) {
  if (!artistName) return;
  
  // Navigate to artist profile page
  currentPage = 'artist-profile';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById('page-artist-profile');
  if (pageEl) {
    pageEl.classList.add('active');
    pageEl.style.animation = 'none';
    pageEl.offsetHeight;
    pageEl.style.animation = 'fadeIn 0.3s ease';
  }
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
  
  // Show loading
  document.getElementById('artist-profile-name').textContent = artistName;
  document.getElementById('artist-profile-song-count').textContent = 'Yükleniyor...';
  document.getElementById('artist-profile-songs').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Yükleniyor...</p></div>';
  
  try {
    // Get artist info
    const artist = await getArtistByName(artistName);
    
    // Set avatar
    const avatarEl = document.getElementById('artist-profile-avatar');
    if (artist && artist.avatar_url) {
      avatarEl.innerHTML = `<img src="${artist.avatar_url}" alt="${escapeHtml(artistName)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      const initials = getInitials(artistName);
      const color = getAvatarColor(artistName);
      avatarEl.innerHTML = `<span style="font-size:60px;font-weight:700;color:#fff;background:${color};width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center">${initials}</span>`;
    }
    
    // Set name with verified tick
    document.getElementById('artist-profile-name').innerHTML = `${escapeHtml(artistName)}${getVerifiedTick(artistName)}`;
    
    // Get songs
    const { data: songs } = await getSongsByArtist(artistName);
    currentArtistProfileSongs = songs || [];
    
    document.getElementById('artist-profile-song-count').textContent = `${currentArtistProfileSongs.length} Şarkı`;
    
    // Render songs
    const songsContainer = document.getElementById('artist-profile-songs');
    if (currentArtistProfileSongs.length === 0) {
      songsContainer.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity="0.2"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        <p>Bu sanatçıya ait şarkı bulunamadı</p>
      </div>`;
    } else {
      songsContainer.innerHTML = `
        <div class="song-list-header">
          <span>#</span>
          <span>Başlık</span>
          <span>Albüm</span>
          <span>Süre</span>
        </div>
        ${currentArtistProfileSongs.map((song, i) => {
          const coverHtml = song.cover_url 
            ? `<img src="${song.cover_url}" alt="" onerror="this.style.display='none'">` 
            : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
          return `
            <div class="song-list-item" data-song-id="${song.id}">
              <div class="song-list-num">${i + 1}</div>
              <div class="song-list-info">
                <div class="song-list-cover">${coverHtml}</div>
                <div class="song-list-details">
                  <div class="song-list-title">${escapeHtml(song.title)}</div>
                  <div class="song-list-subtitle">${formatArtistLinks(song.artist)}</div>
                </div>
              </div>
              <div class="song-list-album">${escapeHtml(song.album || '—')}</div>
              <div class="song-list-duration">${formatDuration(song.duration)}</div>
            </div>
          `;
        }).join('')}
      `;
    }
    
    // Play all button
    document.getElementById('btn-artist-play-all').onclick = () => {
      if (currentArtistProfileSongs.length > 0) {
        player.playSong(currentArtistProfileSongs[0], currentArtistProfileSongs);
      }
    };
    
  } catch (err) {
    console.error('Artist profile error:', err);
    document.getElementById('artist-profile-songs').innerHTML = `<div class="empty-state"><p>Yüklenirken hata oluştu</p></div>`;
  }
}

// ===== SLEEP TIMER =====
let sleepTimerId = null;
let sleepTimeRemaining = 0;
let sleepTimerInterval = null;

function initSleepTimer() {
  const btn = document.getElementById('btn-sleep-timer');
  const popup = document.getElementById('sleep-timer-popup');
  const badge = document.getElementById('sleep-timer-badge');
  const cancelBtn = document.getElementById('sleep-cancel');
  if (!btn || !popup) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sleep-timer-wrapper')) {
      popup.style.display = 'none';
    }
  });

  popup.querySelectorAll('.sleep-option[data-minutes]').forEach(opt => {
    opt.addEventListener('click', () => {
      const minutes = parseInt(opt.dataset.minutes);
      startSleepTimer(minutes);
      popup.style.display = 'none';
    });
  });

  cancelBtn.addEventListener('click', () => {
    cancelSleepTimer();
    popup.style.display = 'none';
  });
}

function startSleepTimer(minutes) {
  cancelSleepTimer();
  sleepTimeRemaining = minutes * 60;
  const badge = document.getElementById('sleep-timer-badge');
  const cancelBtn = document.getElementById('sleep-cancel');
  const btn = document.getElementById('btn-sleep-timer');

  badge.style.display = 'block';
  cancelBtn.style.display = 'block';
  btn.classList.add('active');
  updateSleepBadge();

  sleepTimerInterval = setInterval(() => {
    sleepTimeRemaining--;
    updateSleepBadge();

    if (sleepTimeRemaining <= 0) {
      // Fade out and pause
      fadeOutAndPause();
      cancelSleepTimer();
    }
  }, 1000);
}

function updateSleepBadge() {
  const badge = document.getElementById('sleep-timer-badge');
  if (!badge) return;
  const m = Math.floor(sleepTimeRemaining / 60);
  const s = sleepTimeRemaining % 60;
  badge.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function fadeOutAndPause() {
  const originalVol = player.audio.volume;
  let vol = originalVol;
  const fadeInterval = setInterval(() => {
    vol -= 0.05;
    if (vol <= 0) {
      clearInterval(fadeInterval);
      player.audio.pause();
      player.isPlaying = false;
      player.updatePlayButton();
      player.audio.volume = originalVol;
      showToast('Uyku zamanlayıcı: Müzik durduruldu 💤', 'success');
    } else {
      player.audio.volume = vol;
    }
  }, 100);
}

function cancelSleepTimer() {
  if (sleepTimerInterval) clearInterval(sleepTimerInterval);
  sleepTimerInterval = null;
  sleepTimeRemaining = 0;
  const badge = document.getElementById('sleep-timer-badge');
  const cancelBtn = document.getElementById('sleep-cancel');
  const btn = document.getElementById('btn-sleep-timer');
  if (badge) badge.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (btn) btn.classList.remove('active');
}

// ===== QUEUE PANEL =====
let queuePanelOpen = false;

function initQueuePanel() {
  const btn = document.getElementById('btn-queue');
  const closeBtn = document.getElementById('queue-panel-close');
  if (btn) btn.addEventListener('click', toggleQueuePanel);
  if (closeBtn) closeBtn.addEventListener('click', toggleQueuePanel);
}

function toggleQueuePanel() {
  const panel = document.getElementById('queue-panel');
  if (!panel) return;
  queuePanelOpen = !queuePanelOpen;
  panel.classList.toggle('open', queuePanelOpen);
  if (queuePanelOpen) renderQueuePanel();
}

function renderQueuePanel() {
  const nowEl = document.getElementById('queue-now-playing');
  const listEl = document.getElementById('queue-list');
  if (!nowEl || !listEl) return;

  const currentSong = player.getCurrentSong();
  if (currentSong) {
    const coverHtml = currentSong.cover_url
      ? `<img src="${currentSong.cover_url}" alt="">`
      : `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" opacity=".3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    nowEl.innerHTML = `
      <div class="queue-now-label">Şimdi Çalıyor</div>
      <div class="queue-item playing queue-animated" style="animation-delay: 0s">
        <div class="queue-item-cover">${coverHtml}</div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(currentSong.title)}</div>
          <div class="queue-item-artist">${formatArtistLinks(currentSong.artist)}</div>
        </div>
      </div>`;
  } else {
    nowEl.innerHTML = '<div class="queue-empty">Şarkı çalmıyor</div>';
  }

  const upcoming = player.queue.filter((_, i) => i > player.currentIndex);
  if (upcoming.length === 0) {
    listEl.innerHTML = '<div class="queue-empty">Sırada şarkı yok</div>';
    return;
  }

  listEl.innerHTML = upcoming.map((song, i) => {
    const idx = player.currentIndex + 1 + i;
    const coverHtml = song.cover_url
      ? `<img src="${song.cover_url}" alt="">`
      : `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" opacity=".3"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    return `
      <div class="queue-item queue-animated" data-queue-idx="${idx}" style="animation-delay: ${i * 0.05}s">
        <div class="queue-item-cover">${coverHtml}</div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(song.title)}</div>
          <div class="queue-item-artist">${escapeHtml(song.artist)}</div>
        </div>
        <button class="queue-item-remove" data-remove-idx="${idx}" title="Kaldır">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        </button>
      </div>`;
  }).join('');

  // Click to play
  listEl.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.queue-item-remove')) return;
      const idx = parseInt(el.dataset.queueIdx);
      player.currentIndex = idx;
      player.playSong(player.queue[idx]);
      setTimeout(() => renderQueuePanel(), 300);
    });
  });

  // Remove from queue
  listEl.querySelectorAll('.queue-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.removeIdx);
      player.queue.splice(idx, 1);
      if (player.currentIndex > idx) player.currentIndex--;
      renderQueuePanel();
    });
  });
}

// Keep queue panel in sync
const _origOnTimeUpdate2 = player.onTimeUpdate.bind(player);
player.onTimeUpdate = function() {
  _origOnTimeUpdate2();
  if (queuePanelOpen) {
    // Only re-render when song changes (not every frame)
  }
};

// ===== PREMIUM BADGE =====
let currentUserIsPremium = false;
let currentUserAvatarFrame = 'none';
let currentUserTheme = 'default';
let currentUserBannerUrl = null;

function hasPremiumAccess() {
  return currentUserIsPremium || currentUserRole === 'admin' || currentUserRole === 'yetkili' || currentUserRole === 'premium';
}

function getPremiumBadge() {
  if (!currentUserIsPremium) return '';
  return '<span class="premium-badge">💎 PREMIUM</span>';
}

function getAvatarFrameClass(frame) {
  if (!frame || frame === 'none') return '';
  return `avatar-frame avatar-frame-${frame}`;
}

// ===== THEME SYSTEM =====
function initThemeSelector() {
  const selector = document.getElementById('theme-selector');
  if (!selector) return;

  selector.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      if (theme !== 'default' && !hasPremiumAccess()) {
        showToast('Özel temalar Premium üyelere özel 💎', 'error');
        return;
      }
      applyTheme(theme);
      selector.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      currentUserTheme = theme;
      localStorage.setItem('bekofy_theme', theme);
    });
  });

  // Mark non-default themes as locked for non-premium
  updateThemeLocks();
}

function updateThemeLocks() {
  const selector = document.getElementById('theme-selector');
  if (!selector) return;
  selector.querySelectorAll('.theme-option').forEach(opt => {
    if (opt.dataset.theme !== 'default') {
      opt.classList.toggle('locked', !hasPremiumAccess());
    }
  });
  const note = document.getElementById('theme-premium-note');
  if (note) note.textContent = hasPremiumAccess() ? '' : 'Özel temalar Premium üyelere özel';
}

function applyTheme(theme) {
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function loadSavedTheme() {
  const saved = localStorage.getItem('bekofy_theme') || 'default';
  if (saved !== 'default' && hasPremiumAccess()) {
    applyTheme(saved);
    currentUserTheme = saved;
    const opt = document.querySelector(`.theme-option[data-theme="${saved}"]`);
    if (opt) {
      document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    }
  }
}

// ===== AVATAR FRAME SELECTOR =====
function initFrameSelector() {
  const selector = document.getElementById('frame-selector');
  if (!selector) return;

  selector.querySelectorAll('.frame-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const frame = opt.dataset.frame;
      if (frame !== 'none' && !hasPremiumAccess()) {
        showToast('Avatar çerçevesi Premium üyelere özel 💎', 'error');
        return;
      }
      selector.querySelectorAll('.frame-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      currentUserAvatarFrame = frame;
    });
  });
}

// ===== PROFILE BANNER =====
function initBannerUpload() {
  const changeBtn = document.getElementById('btn-change-banner');
  const removeBtn = document.getElementById('btn-remove-banner');
  if (!changeBtn) return;

  changeBtn.addEventListener('click', () => {
    if (!hasPremiumAccess()) {
      showToast('Profil banneri Premium üyelere özel 💎', 'error');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const sb = getSupabase();
        const ext = file.name.split('.').pop();
        const fileName = `${currentUserId}/banner-${Date.now()}.${ext}`;
        const { error: uploadError } = await sb.storage.from('avatars').upload(fileName, file, { upsert: true, contentType: file.type });
        if (uploadError) { showToast('Yükleme hatası', 'error'); return; }
        const { data: urlData } = sb.storage.from('avatars').getPublicUrl(fileName);
        const bannerUrl = urlData.publicUrl + '?t=' + Date.now();
        await updateProfile(currentUserId, { banner_url: bannerUrl });
        currentUserBannerUrl = bannerUrl;
        showBannerPreview(bannerUrl);
        showToast('Banner güncellendi ✨', 'success');
      } catch (err) {
        showToast('Banner yüklenemedi', 'error');
      }
    };
    input.click();
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      await updateProfile(currentUserId, { banner_url: null });
      currentUserBannerUrl = null;
      document.getElementById('banner-preview').style.display = 'none';
      removeBtn.style.display = 'none';
      showToast('Banner kaldırıldı', 'success');
    });
  }
}

function showBannerPreview(url) {
  const preview = document.getElementById('banner-preview');
  const img = document.getElementById('banner-preview-img');
  const removeBtn = document.getElementById('btn-remove-banner');
  if (preview && img && url) {
    img.src = url;
    preview.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'inline-block';
  }
}

// ===== OFFLINE DOWNLOAD =====
function initOfflineDownload() {
  const ctxDownload = document.getElementById('ctx-download');
  if (!ctxDownload) return;

  ctxDownload.addEventListener('click', async () => {
    if (!hasPremiumAccess()) {
      showToast('Çevrimdışı indirme Premium üyelere özel 💎', 'error');
      return;
    }
    if (!window.electronAPI?.downloadSong) {
      showToast('İndirme sadece masaüstü uygulamada çalışır', 'error');
      return;
    }
    const songId = ctxDownload.closest('.context-menu')?.dataset?.songId;
    // Use lastContextMenuSong if available
    if (typeof lastContextMenuSong !== 'undefined' && lastContextMenuSong) {
      try {
        const url = await getSongUrl(lastContextMenuSong.file_path);
        await window.electronAPI.downloadSong({ ...lastContextMenuSong, downloadUrl: url });
        showToast(`"${lastContextMenuSong.title}" indiriliyor... 📥`, 'success');
      } catch (err) {
        showToast('İndirme hatası', 'error');
      }
    }
  });
}

// ===== WRAPPED (YEARLY SUMMARY) =====
async function loadWrappedPage() {
  const container = document.getElementById('wrapped-cards');
  if (!container) return;

  try {
    // Gather data from liked songs and playlists
    const likedSongs = allSongs.filter(s => userLikedSongIds.has(s.id));
    const totalLiked = likedSongs.length;

    // Top artist
    const artistCount = {};
    likedSongs.forEach(s => {
      const a = s.artist || 'Bilinmeyen';
      artistCount[a] = (artistCount[a] || 0) + 1;
    });
    const topArtist = Object.entries(artistCount).sort((a, b) => b[1] - a[1])[0];

    // Top genre/album
    const albumCount = {};
    likedSongs.forEach(s => {
      if (s.album) albumCount[s.album] = (albumCount[s.album] || 0) + 1;
    });
    const topAlbum = Object.entries(albumCount).sort((a, b) => b[1] - a[1])[0];

    // First liked song
    const firstLiked = likedSongs.length > 0 ? likedSongs[likedSongs.length - 1] : null;

    // Total duration of liked songs
    const totalDuration = likedSongs.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalHours = Math.floor(totalDuration / 3600);
    const totalMins = Math.floor((totalDuration % 3600) / 60);

    // Different artists count
    const uniqueArtists = new Set(likedSongs.map(s => s.artist)).size;

    // Build cards
    let html = '';

    html += `
      <div class="wrapped-card card-green" style="animation:fadeIn .3s ease .1s both">
        <span class="wrapped-emoji">❤️</span>
        <div class="wrapped-stat">${totalLiked}</div>
        <div class="wrapped-label">Beğenilen Şarkı</div>
        <div class="wrapped-detail">Toplam ${totalHours > 0 ? totalHours + ' saat ' : ''}${totalMins} dakika müzik</div>
      </div>`;

    if (topArtist) {
      html += `
        <div class="wrapped-card card-purple" style="animation:fadeIn .3s ease .2s both">
          <span class="wrapped-emoji">🎤</span>
          <div class="wrapped-stat">${escapeHtml(topArtist[0])}</div>
          <div class="wrapped-label">En Sevdiğin Sanatçı</div>
          <div class="wrapped-detail">${topArtist[1]} beğenilen şarkıyla</div>
        </div>`;
    }

    html += `
      <div class="wrapped-card card-blue" style="animation:fadeIn .3s ease .3s both">
        <span class="wrapped-emoji">🎧</span>
        <div class="wrapped-stat">${uniqueArtists}</div>
        <div class="wrapped-label">Farklı Sanatçı</div>
        <div class="wrapped-detail">Müzik zevkin çok geniş!</div>
      </div>`;

    if (topAlbum) {
      html += `
        <div class="wrapped-card card-orange" style="animation:fadeIn .3s ease .4s both">
          <span class="wrapped-emoji">💿</span>
          <div class="wrapped-stat">${escapeHtml(topAlbum[0])}</div>
          <div class="wrapped-label">En Sevdiğin Albüm</div>
          <div class="wrapped-detail">${topAlbum[1]} beğeniyle</div>
        </div>`;
    }

    html += `
      <div class="wrapped-card card-pink" style="animation:fadeIn .3s ease .5s both">
        <span class="wrapped-emoji">📋</span>
        <div class="wrapped-stat">${userPlaylists.length}</div>
        <div class="wrapped-label">Çalma Listesi</div>
        <div class="wrapped-detail">Kendi koleksiyonunu oluşturdun</div>
      </div>`;

    if (firstLiked) {
      html += `
        <div class="wrapped-card card-green" style="animation:fadeIn .3s ease .6s both">
          <span class="wrapped-emoji">⭐</span>
          <div class="wrapped-stat">${escapeHtml(firstLiked.title)}</div>
          <div class="wrapped-label">İlk Beğendiğin Şarkı</div>
          <div class="wrapped-detail">${escapeHtml(firstLiked.artist || '')}</div>
        </div>`;
    }

    container.innerHTML = html || '<div class="empty-state"><p>Henüz yeterli veri yok. Şarkı beğenmeye başla!</p></div>';
  } catch (err) {
    console.error('Wrapped error:', err);
    container.innerHTML = '<div class="empty-state"><p>Özet yüklenirken hata oluştu</p></div>';
  }
}

// ===== LOAD PREMIUM DATA ON USER INFO =====
const _origLoadUserInfoFinal = loadUserInfo;
loadUserInfo = async function() {
  await _origLoadUserInfoFinal();

  // Load premium data
  try {
    const sb = getSupabase();
    const { data } = await sb.from('profiles')
      .select('is_premium, banner_url, theme, avatar_frame')
      .eq('id', currentUserId)
      .maybeSingle();

    if (data) {
      currentUserIsPremium = data.is_premium || false;
      currentUserBannerUrl = data.banner_url || null;
      currentUserTheme = data.theme || 'default';
      currentUserAvatarFrame = data.avatar_frame || 'none';

      // Apply premium badge in sidebar
      const nameEl = document.getElementById('user-name');
      if (nameEl && currentUserIsPremium && !nameEl.querySelector('.premium-badge')) {
        const badge = document.createElement('span');
        badge.className = 'premium-badge';
        badge.textContent = '💎';
        nameEl.appendChild(badge);
      }

      // Apply avatar frame in sidebar
      const avatarEl = document.getElementById('user-avatar');
      if (avatarEl && currentUserAvatarFrame !== 'none') {
        const frameClass = getAvatarFrameClass(currentUserAvatarFrame);
        if (frameClass) avatarEl.className = 'user-avatar ' + frameClass;
      }

      // Apply saved theme
      loadSavedTheme();
      updateThemeLocks();

      // Show banner preview if exists
      if (currentUserBannerUrl) showBannerPreview(currentUserBannerUrl);

      // Set frame selector active
      const frameOpt = document.querySelector(`.frame-option[data-frame="${currentUserAvatarFrame}"]`);
      if (frameOpt) {
        document.querySelectorAll('.frame-option').forEach(o => o.classList.remove('active'));
        frameOpt.classList.add('active');
      }
    }
  } catch (err) {
    console.log('Premium data load error:', err);
  }
};

// ===== SAVE PROFILE WITH NEW FIELDS =====
const _origSaveProfile = document.getElementById('btn-save-profile');
// Override is handled in initProfilePage, we hook into it differently
const _origInitProfilePage = initProfilePage;
initProfilePage = function() {
  _origInitProfilePage();

  // Override save button to include theme + frame
  const saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) {
    const originalClick = saveBtn.onclick;
    saveBtn.addEventListener('click', async () => {
      // Save theme and frame to DB
      if (currentUserId) {
        try {
          await updateProfile(currentUserId, {
            theme: currentUserTheme,
            avatar_frame: currentUserAvatarFrame
          });
        } catch (e) {
          console.log('Theme/frame save error:', e);
        }
      }
    });
  }
};

// ===== NAVIGATION HOOK FOR WRAPPED =====
const _origNavigateTo = navigateTo;
navigateTo = function(page) {
  _origNavigateTo(page);
  if (page === 'wrapped') {
    loadWrappedPage();
  }
};

// ===== INIT ALL NEW FEATURES =====
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initSleepTimer();
    initQueuePanel();
    initThemeSelector();
    initFrameSelector();
    initBannerUpload();
    initOfflineDownload();
    initNowPlayingOverlay();
    initMiniPlayerButton();
  }, 300);
});


// ===== Lyric Sharing =====
function initLyricShare() {
  const btnShare = document.getElementById('btn-share-lyrics');
  const overlaySelection = document.getElementById('overlay-lyrics-selection');
  const selectionList = document.getElementById('lyrics-selection-list');
  const btnCancelSelection = document.getElementById('btn-share-cancel');
  const btnContinueSelection = document.getElementById('btn-share-continue');
  const countSpan = document.getElementById('lyrics-share-count');
  
  if (!btnShare || !overlaySelection) return;

  function resetSelectionMode() {
    selectedLyricIndexes = [];
    if(overlaySelection) overlaySelection.style.display = 'none';
    selectionList.innerHTML = '';
    btnContinueSelection.disabled = true;
    countSpan.textContent = '0/2 Seçildi';
  }

  btnShare.addEventListener('click', () => {
    if(!parsedSyncedLyrics || parsedSyncedLyrics.length === 0) {
      showToast('Paylaşılacak şarkı sözü bulunamadı', 'error');
      return;
    }

    // Pause the song
    if (player.isPlaying) {
      player.audio.pause();
      player.isPlaying = false;
      player.updatePlayButton();
    }

    selectedLyricIndexes = [];
    btnContinueSelection.disabled = true;
    countSpan.textContent = '0/2 Seçildi';

    // Populate selection list
    selectionList.innerHTML = '';
    parsedSyncedLyrics.forEach((line, i) => {
      const text = line.text || '';
      const isInstrumental = text === '' || text === '♪' || text === '♫';
      if (isInstrumental) return;

      const div = document.createElement('div');
      div.className = 'share-lyric-line';
      div.textContent = text;
      div.dataset.index = i;
      
      div.addEventListener('click', () => {
        const idx = parseInt(div.dataset.index);
        if (selectedLyricIndexes.includes(idx)) {
          selectedLyricIndexes = selectedLyricIndexes.filter(x => x !== idx);
          div.classList.remove('selected-for-share');
        } else {
          if (selectedLyricIndexes.length < 2) {
            selectedLyricIndexes.push(idx);
            div.classList.add('selected-for-share');
          } else {
             showToast('En fazla 2 satır seçebilirsiniz', 'warning');
          }
        }
        countSpan.textContent = `${selectedLyricIndexes.length}/2 Seçildi`;
        btnContinueSelection.disabled = selectedLyricIndexes.length === 0;
      });
      
      selectionList.appendChild(div);
    });

    if(overlaySelection) overlaySelection.style.display = 'flex';
  });

  btnCancelSelection.addEventListener('click', resetSelectionMode);
  document.getElementById('btn-close-lyrics-selection')?.addEventListener('click', resetSelectionMode);

  // Generate Card Button
  btnContinueSelection.addEventListener('click', () => {
    if (selectedLyricIndexes.length === 0) return;
    const song = player.getCurrentSong();
    if (!song) return;

    // Collect texts
    selectedLyricIndexes.sort((a,b) => a - b);
    const texts = selectedLyricIndexes.map(idx => parsedSyncedLyrics[idx].text);
    
    // Populate card
    document.getElementById('card-lyrics-text').innerHTML = '"' + texts.map(escapeHtml).join('<br>') + '"';
    document.getElementById('card-song-title').textContent = escapeHtml(song.title || 'Bilinmiyor');
    document.getElementById('card-song-artist').textContent = escapeHtml(song.artist || 'Sanatçı');
    
    const coverUrl = song.cover_url || '';
    document.getElementById('card-cover-img').src = coverUrl;

    const overlayShare = document.getElementById('overlay-share-lyrics');
    const preview = document.getElementById('share-lyrics-preview-container');
    const downloadBtn = document.getElementById('btn-download-lyric-card');
    
    preview.innerHTML = '<div class="spinner"></div>';
    resetSelectionMode(); // Close selection modal
    if(overlayShare) overlayShare.style.display = 'flex'; // Open preview modal

    setTimeout(() => {
      if(typeof html2canvas === 'undefined') {
        preview.innerHTML = '<p style="color:white;padding:20px">html2canvas yüklenemedi.</p>';
        return;
      }
      
      const template = document.getElementById('lyric-card-template');
      const bgEl = document.getElementById('np-canvas-bg');
      if (bgEl) {
        const c1Raw = bgEl.style.getPropertyValue('--canvas-color-1');
        const c2Raw = bgEl.style.getPropertyValue('--canvas-color-2');
        const toRgb = (rgbaStr) => {
          if (!rgbaStr) return null;
          const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (match) return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
          return null;
        };
        const c1 = toRgb(c1Raw) || '#1DB954';
        const c2 = toRgb(c2Raw) || '#450af5';
        template.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
      }

      html2canvas(template, { scale: 1, useCORS: true, backgroundColor: null }).then(canvas => {
        const dataUrl = canvas.toDataURL('image/png');
        preview.innerHTML = `<img src="${dataUrl}" style="width:100%; height:auto; display:block">`;
        
        downloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `bekofy-sozler-${song.title}.png`;
          a.click();
        };
      }).catch(err => {
        preview.innerHTML = '<p style="color:white;padding:20px">Resim oluşturulamadı.</p>';
      });
    }, 100);
  });

  // Modal close
  document.getElementById('btn-close-share-lyrics')?.addEventListener('click', () => {
    const overlayShare = document.getElementById('overlay-share-lyrics');
    if(overlayShare) overlayShare.style.display = 'none';
  });
}

// ===== Mini Player Button =====
function initMiniPlayerButton() {
  const btn = document.getElementById('btn-mini-player');
  if (!btn) return;

  // Only show in Electron
  if (!window.electronAPI || !window.electronAPI.toggleMiniPlayer) {
    btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', () => {
    const song = player.getCurrentSong();
    if (song) {
      // Send current song data before toggling
      window.electronAPI.updateMiniPlayer({
        title: song.title,
        artist: song.artist,
        cover_url: song.cover_url || '',
        isPlaying: player.isPlaying
      });
    }
    window.electronAPI.toggleMiniPlayer();
  });
}
