// Bekofy Admin Panel - JavaScript Logic
// Uses the same Supabase credentials as the desktop app

const SUPABASE_URL = 'https://dtdsawyynetqlbosrvqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZHNhd3l5bmV0cWxib3NydnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDU0MDUsImV4cCI6MjA5MDEyMTQwNX0.6rKxp51OOj_b1iKtz_21ZkHcvbThNF4w5sPdP7RAua4';

let sb = null;
let currentUser = null;
let currentUserProfile = null;
let allArtists = [];
let allSongs = [];
let editingSongId = null;
let pendingCoverFile = null;
let pendingSongCoverFile = null;

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  checkAuth();
});

async function checkAuth() {
  const { data: { session } } = await sb.auth.getSession();
  
  if (session && session.user) {
    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profile && (profile.role === 'admin' || profile.role === 'yetkili')) {
      currentUser = session.user;
      currentUserProfile = profile;
      showAdminPanel();
    } else {
      showLogin('Bu hesap admin yetkisine sahip değil.');
    }
  } else {
    showLogin();
  }
}

// ===== LOGIN =====

function showLogin(errorMsg = '') {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-panel').style.display = 'none';
  if (errorMsg) {
    const el = document.getElementById('login-error');
    el.textContent = errorMsg;
    el.style.display = 'block';
  }
}

window.handleAdminLogin = async function(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span>';
  
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    
    if (error) {
      errorEl.textContent = 'E-posta veya şifre hatalı.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Giriş Yap';
      return;
    }
    
    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (!profile || (profile.role !== 'admin' && profile.role !== 'yetkili')) {
      errorEl.textContent = 'Bu hesap admin paneline erişim yetkisine sahip değil.';
      errorEl.style.display = 'block';
      await sb.auth.signOut();
      btn.disabled = false;
      btn.innerHTML = 'Giriş Yap';
      return;
    }
    
    currentUser = data.user;
    currentUserProfile = profile;
    showAdminPanel();
  } catch (err) {
    errorEl.textContent = 'Beklenmeyen bir hata oluştu.';
    errorEl.style.display = 'block';
  }
  
  btn.disabled = false;
  btn.innerHTML = 'Giriş Yap';
};

// ===== ADMIN PANEL =====

async function showAdminPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'flex';
  
  document.getElementById('sidebar-username').textContent = currentUserProfile.username || 'Admin';
  document.getElementById('sidebar-role').textContent = currentUserProfile.role;
  document.getElementById('sidebar-avatar-letter').textContent = 
    (currentUserProfile.username || 'A')[0].toUpperCase();
  
  await loadAllArtists();
  loadStats();
  switchSection('artists');
}

// Load artists from BOTH 'artists' table and 'profiles' (role=artist)
async function loadAllArtists() {
  try {
    const [artistsRes, profilesRes] = await Promise.all([
      sb.from('artists').select('*').order('name', { ascending: true }),
      sb.from('profiles').select('*').eq('role', 'artist').order('username', { ascending: true })
    ]);
    
    const fromArtists = (artistsRes.data || []).map(a => ({
      id: a.id, name: a.name, avatar_url: a.avatar_url, source: 'artists', created_at: a.created_at
    }));
    
    const fromProfiles = (profilesRes.data || []).map(p => ({
      id: p.id, name: p.username, avatar_url: p.avatar_url, source: 'profiles', created_at: p.created_at
    }));
    
    // Merge avoiding duplicates by name
    const seen = new Set();
    allArtists = [];
    for (const a of [...fromProfiles, ...fromArtists]) {
      const key = (a.name || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        allArtists.push(a);
      }
    }
    allArtists.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (err) {
    console.error('Artists load error:', err);
  }
}

async function loadStats() {
  try {
    const [artistsRes, songsRes, profilesRes, premiumRes] = await Promise.all([
      sb.from('artists').select('id', { count: 'exact', head: true }),
      sb.from('songs').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['premium', 'admin', 'yetkili', 'artist'])
    ]);
    
    document.getElementById('stat-artists').textContent = artistsRes.count || 0;
    document.getElementById('stat-songs').textContent = songsRes.count || 0;
    document.getElementById('stat-users').textContent = profilesRes.count || 0;
    document.getElementById('stat-premium').textContent = premiumRes.count || 0;

    initCharts(profilesRes.count || 0, premiumRes.count || 0);
  } catch (err) {
    console.error('Stats error:', err);
  }
}

function initCharts(totalUsers, premiumUsers) {
  const chartsContainer = document.getElementById('admin-charts');
  if (chartsContainer) {
    chartsContainer.style.display = 'grid';
  }

  const freeUsers = totalUsers - premiumUsers;

  // Pie Chart for Roles
  const roleCtx = document.getElementById('roleChart');
  if (roleCtx && !window.roleChartInstance) {
    window.roleChartInstance = new Chart(roleCtx, {
      type: 'doughnut',
      data: {
        labels: ['Ücretsiz', 'Premium/Diğer'],
        datasets: [{
          data: [freeUsers, premiumUsers],
          backgroundColor: ['#3b82f6', '#1DB954'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#b3b3b3' } }
        }
      }
    });
  } else if (window.roleChartInstance) {
    window.roleChartInstance.data.datasets[0].data = [freeUsers, premiumUsers];
    window.roleChartInstance.update();
  }

  // Line Chart for Growth (Mocked data since we don't have historical data easily without complex queries)
  const growthCtx = document.getElementById('growthChart');
  if (growthCtx && !window.growthChartInstance) {
    window.growthChartInstance = new Chart(growthCtx, {
      type: 'line',
      data: {
        labels: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz'],
        datasets: [{
          label: 'Kayıtlı Kullanıcı',
          data: [Math.floor(totalUsers*0.4), Math.floor(totalUsers*0.5), Math.floor(totalUsers*0.7), Math.floor(totalUsers*0.8), Math.floor(totalUsers*0.9), totalUsers],
          borderColor: '#1DB954',
          backgroundColor: 'rgba(29, 185, 84, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#b3b3b3' } },
          x: { grid: { display: false }, ticks: { color: '#b3b3b3' } }
        }
      }
    });
  }
}

// ===== SECTION NAVIGATION =====

function switchSection(section) {
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeNav = document.querySelector(`[data-section="${section}"]`);
  if (activeNav) activeNav.classList.add('active');
  
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const activeSection = document.getElementById(`section-${section}`);
  if (activeSection) activeSection.classList.add('active');
  
  const headers = {
    artists: { title: 'Sanatçı Yönetimi', desc: 'Sanatçı hesaplarını yönetin, yeni sanatçı ekleyin' },
    songs: { title: 'Şarkı Yönetimi', desc: 'Şarkıları düzenleyin ve yeni şarkı ekleyin' },
    'artist-detail': { title: '', desc: '' },
  };
  
  const h = headers[section];
  if (h) {
    document.getElementById('page-title').textContent = h.title;
    document.getElementById('page-desc').textContent = h.desc;
  }
  
  if (section === 'artists') loadArtists();
  if (section === 'songs') loadSongs();
}

window.switchSection = switchSection;

// ===== TAG INPUT WIDGET =====

class TagInput {
  constructor(containerId, inputId, tagsId, dropdownId) {
    this.container = document.getElementById(containerId);
    this.input = document.getElementById(inputId);
    this.tagsWrapper = document.getElementById(tagsId);
    this.dropdown = document.getElementById(dropdownId);
    this.selectedArtists = [];
    this.highlightIndex = -1;
    this._bound = false;
  }
  
  init(artists) {
    this.artists = artists || [];
    if (!this._bound) {
      this._bound = true;
      this.input.addEventListener('input', () => this.onInput());
      this.input.addEventListener('focus', () => this.onInput());
      this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
      
      // Click wrapper to focus input
      this.tagsWrapper.addEventListener('click', () => this.input.focus());
      
      // Close dropdown on outside click
      document.addEventListener('click', (e) => {
        if (!this.container.contains(e.target)) {
          this.dropdown.classList.remove('show');
        }
      });
    }
  }
  
  setArtists(artists) {
    this.artists = artists || [];
  }
  
  clear() {
    this.selectedArtists = [];
    this.input.value = '';
    this.renderTags();
    this.dropdown.classList.remove('show');
  }
  
  setSelected(artistNames) {
    this.selectedArtists = artistNames.filter(Boolean);
    this.renderTags();
  }
  
  getSelected() {
    return [...this.selectedArtists];
  }
  
  getSelectedString() {
    return this.selectedArtists.join(', ');
  }
  
  addArtist(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (this.selectedArtists.some(a => a.toLowerCase() === trimmed.toLowerCase())) return;
    this.selectedArtists.push(trimmed);
    this.input.value = '';
    this.renderTags();
    this.dropdown.classList.remove('show');
    this.input.focus();
  }
  
  removeArtist(name) {
    this.selectedArtists = this.selectedArtists.filter(a => a.toLowerCase() !== name.toLowerCase());
    this.renderTags();
    this.input.focus();
  }
  
  renderTags() {
    // Remove all tag elements (keep only the input)
    const tags = this.tagsWrapper.querySelectorAll('.tag-item');
    tags.forEach(t => t.remove());
    
    // Add tags before input
    this.selectedArtists.forEach(name => {
      const tag = document.createElement('span');
      tag.className = 'tag-item';
      tag.innerHTML = `${escapeHtml(name)} <button class="tag-remove" type="button">×</button>`;
      tag.querySelector('.tag-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeArtist(name);
      });
      this.tagsWrapper.insertBefore(tag, this.input);
    });
    
    // Update placeholder
    this.input.placeholder = this.selectedArtists.length > 0 ? 'Başka sanatçı ekle...' : 'Sanatçı adı yazın...';
  }
  
  onInput() {
    const query = this.input.value.toLowerCase().trim();
    this.highlightIndex = -1;
    
    // Filter artists not already selected
    let filtered = this.artists.filter(a => 
      !this.selectedArtists.some(s => s.toLowerCase() === (a.name || '').toLowerCase())
    );
    
    if (query) {
      filtered = filtered.filter(a => (a.name || '').toLowerCase().includes(query));
    }
    
    if (filtered.length === 0 && !query) {
      this.dropdown.classList.remove('show');
      return;
    }
    
    if (filtered.length === 0) {
      this.dropdown.innerHTML = '<div class="tag-dropdown-empty">Sanatçı bulunamadı</div>';
    } else {
      this.dropdown.innerHTML = filtered.slice(0, 15).map((a, i) => {
        const initial = (a.name || '?')[0].toUpperCase();
        const avatarHTML = a.avatar_url 
          ? `<div class="tag-dropdown-avatar"><img src="${a.avatar_url}" onerror="this.outerHTML='${initial}'"></div>`
          : `<div class="tag-dropdown-avatar">${initial}</div>`;
        return `<div class="tag-dropdown-item" data-artist-name="${escapeHtml(a.name)}" data-index="${i}">
          ${avatarHTML}
          <span>${escapeHtml(a.name)}</span>
        </div>`;
      }).join('');
      
      // Bind click events
      this.dropdown.querySelectorAll('.tag-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          this.addArtist(item.dataset.artistName);
        });
      });
    }
    
    this.dropdown.classList.add('show');
  }
  
  onKeyDown(e) {
    const items = this.dropdown.querySelectorAll('.tag-dropdown-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.highlightIndex = Math.min(this.highlightIndex + 1, items.length - 1);
      this.updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.highlightIndex = Math.max(this.highlightIndex - 1, 0);
      this.updateHighlight(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.highlightIndex >= 0 && items[this.highlightIndex]) {
        this.addArtist(items[this.highlightIndex].dataset.artistName);
      } else if (this.input.value.trim()) {
        // Allow adding custom artist name
        this.addArtist(this.input.value.trim());
      }
    } else if (e.key === 'Backspace' && !this.input.value && this.selectedArtists.length > 0) {
      this.removeArtist(this.selectedArtists[this.selectedArtists.length - 1]);
    } else if (e.key === 'Escape') {
      this.dropdown.classList.remove('show');
    }
  }
  
  updateHighlight(items) {
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === this.highlightIndex);
    });
    if (items[this.highlightIndex]) {
      items[this.highlightIndex].scrollIntoView({ block: 'nearest' });
    }
  }
}

// Create tag input instances
let addSongTagInput = null;
let editSongTagInput = null;

// ===== ARTISTS (from 'artists' table) =====

async function loadArtists() {
  const container = document.getElementById('artists-container');
  container.innerHTML = '<div class="admin-loader"><div class="spinner"></div></div>';
  
  try {
    await loadAllArtists();
    
    // Also load songs so we can show count per artist
    if (allSongs.length === 0) {
      const { data } = await sb.from('songs').select('*').order('created_at', { ascending: false });
      allSongs = data || [];
    }
    
    renderArtists(allArtists);
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><h3>Yüklenirken hata oluştu</h3><p>' + err.message + '</p></div>';
  }
}

function renderArtists(artists) {
  const container = document.getElementById('artists-container');
  
  if (!artists || artists.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg>
        <h3>Sanatçı bulunamadı</h3>
        <p>Henüz sanatçı yok. "Sanatçı Ekle" butonuna tıklayarak ekleyin.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '<div class="artist-grid">' + artists.map(artist => {
    const initial = (artist.name || '?')[0].toUpperCase();
    const avatarHTML = artist.avatar_url 
      ? `<img src="${artist.avatar_url}" alt="${escapeHtml(artist.name)}" class="artist-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="artist-avatar-placeholder" style="display:none">${initial}</div>`
      : `<div class="artist-avatar-placeholder">${initial}</div>`;
    
    const songCount = allSongs.filter(s => s.artist && s.artist.toLowerCase() === (artist.name || '').toLowerCase()).length;
    
    return `
      <div class="artist-card" id="artist-card-${artist.id}">
        <div class="artist-avatar-wrapper" onclick="event.stopPropagation(); uploadArtistPhoto('${artist.id}')">
          ${avatarHTML}
          <div class="artist-avatar-overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        </div>
        <div class="artist-name">${escapeHtml(artist.name || 'İsimsiz')}</div>
        <div class="artist-role-badge">Sanatçı</div>
        <div class="artist-song-count">${songCount} şarkı</div>
        <button class="btn-view-artist" onclick="event.stopPropagation(); openArtistDetail('${artist.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Profili Görüntüle
        </button>
        <div class="artist-upload-status" id="upload-status-${artist.id}"></div>
        <input type="file" id="file-artist-${artist.id}" accept="image/*" style="display:none" onchange="handleArtistPhotoChange('${artist.id}', this)">
      </div>
    `;
  }).join('') + '</div>';
}

// ===== ADD ARTIST (to 'artists' table) =====

window.openAddArtistModal = function() {
  document.getElementById('new-artist-name').value = '';
  document.getElementById('add-artist-error').style.display = 'none';
  document.getElementById('add-artist-modal').classList.add('show');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('new-artist-name').focus(), 100);
};

window.closeAddArtistModal = function() {
  document.getElementById('add-artist-modal').classList.remove('show');
  document.body.style.overflow = '';
};

window.saveNewArtist = async function() {
  const name = document.getElementById('new-artist-name').value.trim();
  const errorEl = document.getElementById('add-artist-error');
  const btn = document.getElementById('save-artist-btn');
  
  if (!name) {
    errorEl.textContent = 'Sanatçı adı boş olamaz.';
    errorEl.style.display = 'block';
    return;
  }
  
  const exists = allArtists.find(a => a.name && a.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    errorEl.textContent = 'Bu isimde bir sanatçı zaten var.';
    errorEl.style.display = 'block';
    return;
  }
  
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;border-color:#000;border-top-color:transparent;"></span> Ekleniyor...';
  
  try {
    const { error } = await sb
      .from('artists')
      .insert({ name });
    
    if (error) throw error;
    
    showToast(`"${name}" sanatçı olarak eklendi!`, 'success');
    closeAddArtistModal();
    
    await loadAllArtists();
    loadStats();
    renderArtists(allArtists);
    
  } catch (err) {
    console.error('Add artist error:', err);
    errorEl.textContent = 'Hata: ' + (err.message || 'Sanatçı eklenemedi');
    errorEl.style.display = 'block';
  }
  
  btn.disabled = false;
  btn.innerHTML = 'Sanatçı Ekle';
};

// ===== ARTIST DETAIL =====

window.openArtistDetail = async function(artistId) {
  const artist = allArtists.find(a => a.id === artistId);
  if (!artist) return;
  
  if (allSongs.length === 0) {
    const { data } = await sb.from('songs').select('*').order('created_at', { ascending: false });
    allSongs = data || [];
  }
  
  const artistSongs = allSongs.filter(s => 
    s.artist && s.artist.toLowerCase() === (artist.name || '').toLowerCase()
  );
  
  document.getElementById('page-title').textContent = artist.name || 'Sanatçı';
  document.getElementById('page-desc').textContent = `${artistSongs.length} şarkı · Sanatçı Profili`;
  
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById('section-artist-detail').classList.add('active');
  
  document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
  document.querySelector('[data-section="artists"]').classList.add('active');
  
  const detailContainer = document.getElementById('artist-detail-content');
  const initial = (artist.name || '?')[0].toUpperCase();
  
  const avatarHTML = artist.avatar_url
    ? `<img src="${artist.avatar_url}" alt="${escapeHtml(artist.name)}" class="detail-artist-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="detail-artist-avatar-placeholder" style="display:none">${initial}</div>`
    : `<div class="detail-artist-avatar-placeholder">${initial}</div>`;
  
  let songsHTML = '';
  if (artistSongs.length === 0) {
    songsHTML = `
      <div class="empty-state" style="padding:40px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px"><path d="M9 18V5l12-2v13M9 18c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3 3 1.3 3 3zm12-2c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3 3 1.3 3 3z"/></svg>
        <h3>Henüz şarkı yok</h3>
        <p>Bu sanatçıya ait şarkı bulunmuyor.</p>
      </div>
    `;
  } else {
    songsHTML = `
      <div class="songs-table-wrapper">
        <table class="songs-table">
          <thead>
            <tr>
              <th>Şarkı</th>
              <th>Albüm</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${artistSongs.map(song => {
              const coverHTML = song.cover_url 
                ? `<img src="${song.cover_url}" class="song-cover-thumb" onerror="this.outerHTML='<div class=\\'song-cover-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><path d=\\'M9 18V5l12-2v13\\'/></svg></div>'">`
                : `<div class="song-cover-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/></svg></div>`;
              
              const status = song.status || 'approved';
              const statusLabel = status === 'approved' ? 'Onaylı' : status === 'pending' ? 'Beklemede' : status;
              
              return `
                <tr>
                  <td>
                    <div class="song-title-cell">
                      ${coverHTML}
                      <span class="song-title-text">${escapeHtml(song.title || 'İsimsiz')}</span>
                    </div>
                  </td>
                  <td>${escapeHtml(song.album || '-')}</td>
                  <td><span class="song-status ${status}">${statusLabel}</span></td>
                  <td>
                    <button class="btn-edit" onclick="openEditSong('${song.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Düzenle
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  detailContainer.innerHTML = `
    <button class="btn-back" onclick="switchSection('artists')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Sanatçılara Dön
    </button>
    
    <div class="artist-detail-header">
      <div class="detail-avatar-wrapper" onclick="uploadArtistPhoto('${artist.id}')">
        ${avatarHTML}
        <div class="detail-avatar-overlay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
      </div>
      <div class="detail-info">
        <h2>${escapeHtml(artist.name || 'İsimsiz')}</h2>
        <div class="detail-meta">
          <span class="artist-role-badge">Sanatçı</span>
          <span class="detail-song-count">${artistSongs.length} şarkı</span>
        </div>
      </div>
      <div style="margin-left:auto; display:flex; gap:12px;">
        <button class="btn-edit" onclick="openCreateAccountModal('${artist.id}')" style="background:var(--bg-elevated); border:1px solid var(--border); color:var(--ts); border-radius:8px; padding:8px 16px; display:flex; align-items:center; gap:8px; cursor:pointer;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          Sanatçı Hesabı Oluştur
        </button>
      </div>
      <input type="file" id="file-artist-${artist.id}" accept="image/*" style="display:none" onchange="handleArtistPhotoChange('${artist.id}', this)">
      <div class="artist-upload-status" id="upload-status-${artist.id}"></div>
    </div>
    
    <h3 class="detail-section-title">Şarkılar</h3>
    ${songsHTML}
  `;
};

// ===== UPLOAD ARTIST PHOTO (to 'artists' table) =====

window.uploadArtistPhoto = function(artistId) {
  document.getElementById(`file-artist-${artistId}`).click();
};

window.handleArtistPhotoChange = async function(artistId, input) {
  const file = input.files[0];
  if (!file) return;
  
  const statusEl = document.getElementById(`upload-status-${artistId}`);
  if (statusEl) {
    statusEl.className = 'artist-upload-status';
    statusEl.textContent = 'Yükleniyor...';
    statusEl.style.display = 'block';
    statusEl.style.background = 'var(--info-bg)';
    statusEl.style.color = 'var(--info)';
  }
  
  try {
    const ext = file.name.split('.').pop();
    const fileName = `artist-${artistId}-${Date.now()}.${ext}`;
    
    const { error: uploadError } = await sb.storage
      .from('avatars')
      .upload(fileName, file, { 
        upsert: true,
        contentType: file.type 
      });
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = sb.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
    
    // Update the 'artists' table
    const { error: updateError } = await sb
      .from('artists')
      .update({ avatar_url: avatarUrl })
      .eq('id', artistId);
    
    if (updateError) throw updateError;
    
    if (statusEl) {
      statusEl.className = 'artist-upload-status success';
      statusEl.textContent = '✓ Fotoğraf güncellendi!';
    }
    
    showToast('Profil fotoğrafı başarıyla güncellendi!', 'success');
    
    await loadAllArtists();
    
    if (document.getElementById('section-artist-detail').classList.contains('active')) {
      openArtistDetail(artistId);
    } else {
      renderArtists(allArtists);
    }
    
  } catch (err) {
    console.error('Upload error:', err);
    if (statusEl) {
      statusEl.className = 'artist-upload-status error';
      statusEl.textContent = '✗ Hata: ' + (err.message || 'Yükleme başarısız');
    }
    showToast('Fotoğraf yüklenirken hata oluştu: ' + err.message, 'error');
  }
  
  input.value = '';
};

// ===== SONGS =====

async function loadSongs() {
  const container = document.getElementById('songs-container');
  container.innerHTML = '<div class="admin-loader"><div class="spinner"></div></div>';
  
  try {
    const { data, error } = await sb
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allSongs = data || [];
    renderSongs(allSongs);
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><h3>Yüklenirken hata oluştu</h3><p>' + err.message + '</p></div>';
  }
}

function renderSongs(songs) {
  const container = document.getElementById('songs-container');
  
  if (!songs || songs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13M9 18c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3 3 1.3 3 3zm12-2c0 1.7-1.3 3-3 3s-3-1.3-3-3 1.3-3 3-3 3 1.3 3 3z"/></svg>
        <h3>Şarkı bulunamadı</h3>
        <p>Henüz hiç şarkı eklenmemiş.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="songs-table-wrapper">
      <table class="songs-table">
        <thead>
          <tr>
            <th>Şarkı</th>
            <th>Sanatçı</th>
            <th>Albüm</th>
            <th>Durum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          ${songs.map(song => {
            const coverHTML = song.cover_url 
              ? `<img src="${song.cover_url}" class="song-cover-thumb" onerror="this.outerHTML='<div class=\\'song-cover-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><path d=\\'M9 18V5l12-2v13\\'/></svg></div>'">`
              : `<div class="song-cover-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/></svg></div>`;
            
            const status = song.status || 'approved';
            const statusLabel = status === 'approved' ? 'Onaylı' : status === 'pending' ? 'Beklemede' : status;
            
            return `
              <tr>
                <td>
                  <div class="song-title-cell">
                    ${coverHTML}
                    <span class="song-title-text">${escapeHtml(song.title || 'İsimsiz')}</span>
                  </div>
                </td>
                <td>${escapeHtml(song.artist || '-')}</td>
                <td>${escapeHtml(song.album || '-')}</td>
                <td><span class="song-status ${status}">${statusLabel}</span></td>
                <td>
                  <button class="btn-edit" onclick="openEditSong('${song.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Düzenle
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ===== ADD SONG =====

window.openAddSongModal = function() {
  pendingSongCoverFile = null;
  document.getElementById('add-song-title').value = '';
  document.getElementById('add-song-album').value = '';
  document.getElementById('add-song-cover-url').value = '';
  document.getElementById('add-song-audio-url').value = '';
  document.getElementById('add-song-cover-preview').style.display = 'none';
  document.getElementById('add-song-cover-file').value = '';
  document.getElementById('add-song-cover-file-name').textContent = '';
  
  // Initialize tag input for artist selection
  if (!addSongTagInput) {
    addSongTagInput = new TagInput('add-song-artist-container', 'add-song-artist-input', 'add-song-artist-tags', 'add-song-artist-dropdown');
  }
  addSongTagInput.init(allArtists);
  addSongTagInput.setArtists(allArtists);
  addSongTagInput.clear();
  
  document.getElementById('add-song-modal').classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.closeAddSongModal = function() {
  document.getElementById('add-song-modal').classList.remove('show');
  document.body.style.overflow = '';
  pendingSongCoverFile = null;
};

window.triggerAddSongCoverUpload = function() {
  document.getElementById('add-song-cover-file').click();
};

window.handleAddSongCoverFileChange = function(input) {
  const file = input.files[0];
  if (!file) return;
  pendingSongCoverFile = file;
  document.getElementById('add-song-cover-file-name').textContent = file.name;
  const preview = document.getElementById('add-song-cover-preview');
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.saveNewSong = async function() {
  const title = document.getElementById('add-song-title').value.trim();
  const artist = addSongTagInput ? addSongTagInput.getSelectedString() : '';
  const album = document.getElementById('add-song-album').value.trim();
  const audioUrl = document.getElementById('add-song-audio-url').value.trim();
  let coverUrl = document.getElementById('add-song-cover-url').value.trim();
  
  if (!title || !artist) {
    showToast('Şarkı adı ve en az bir sanatçı zorunludur.', 'error');
    return;
  }
  
  const btn = document.getElementById('save-new-song-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;border-color:#000;border-top-color:transparent;"></span> Ekleniyor...';
  
  try {
    if (pendingSongCoverFile) {
      const ext = pendingSongCoverFile.name.split('.').pop();
      const fileName = `song-cover-new-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await sb.storage
        .from('avatars')
        .upload(fileName, pendingSongCoverFile, { upsert: true, contentType: pendingSongCoverFile.type });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(fileName);
      coverUrl = urlData.publicUrl + '?t=' + Date.now();
    }
    
    const songData = {
      title,
      artist,
      album: album || null,
      cover_url: coverUrl || null,
      file_path: audioUrl || null,
      status: 'approved',
    };
    
    const { error } = await sb.from('songs').insert(songData).select().single();
    if (error) throw error;
    
    showToast(`"${title}" şarkısı başarıyla eklendi!`, 'success');
    closeAddSongModal();
    loadStats();
    await loadSongs();
    
  } catch (err) {
    console.error('Add song error:', err);
    showToast('Şarkı eklenemedi: ' + (err.message || 'Bilinmeyen hata'), 'error');
  }
  
  btn.disabled = false;
  btn.innerHTML = 'Şarkıyı Ekle';
};

// ===== EDIT SONG MODAL =====

window.openEditSong = function(songId) {
  const song = allSongs.find(s => s.id === songId);
  if (!song) return;
  
  editingSongId = songId;
  pendingCoverFile = null;
  
  // Initialize tag input for artist selection
  if (!editSongTagInput) {
    editSongTagInput = new TagInput('edit-song-artist-container', 'edit-song-artist-input', 'edit-song-artist-tags', 'edit-song-artist-dropdown');
  }
  editSongTagInput.init(allArtists);
  editSongTagInput.setArtists(allArtists);
  
  // Parse existing artists (comma-separated) and set as selected
  const existingArtists = song.artist ? song.artist.split(',').map(a => a.trim()).filter(Boolean) : [];
  editSongTagInput.setSelected(existingArtists);
  
  document.getElementById('edit-song-title').value = song.title || '';
  document.getElementById('edit-song-album').value = song.album || '';
  document.getElementById('edit-song-cover-url').value = song.cover_url || '';
  document.getElementById('edit-song-audio-url').value = song.file_path || '';
  
  const preview = document.getElementById('edit-cover-preview');
  if (song.cover_url) {
    preview.src = song.cover_url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
  
  document.getElementById('edit-cover-file').value = '';
  document.getElementById('cover-file-name').textContent = '';
  
  document.getElementById('edit-song-modal').classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.closeEditModal = function() {
  document.getElementById('edit-song-modal').classList.remove('show');
  document.body.style.overflow = '';
  editingSongId = null;
  pendingCoverFile = null;
};

window.triggerCoverUpload = function() {
  document.getElementById('edit-cover-file').click();
};

window.handleCoverFileChange = function(input) {
  const file = input.files[0];
  if (!file) return;
  
  pendingCoverFile = file;
  document.getElementById('cover-file-name').textContent = file.name;
  
  const preview = document.getElementById('edit-cover-preview');
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.saveSongEdits = async function() {
  if (!editingSongId) return;
  
  const btn = document.getElementById('save-song-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;border-color:#000;border-top-color:transparent;"></span> Kaydediliyor...';
  
  try {
    let coverUrl = document.getElementById('edit-song-cover-url').value;
    
    if (pendingCoverFile) {
      const ext = pendingCoverFile.name.split('.').pop();
      const fileName = `song-cover-${editingSongId}-${Date.now()}.${ext}`;
      
      const { error: uploadError } = await sb.storage
        .from('avatars')
        .upload(fileName, pendingCoverFile, {
          upsert: true,
          contentType: pendingCoverFile.type
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = sb.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      coverUrl = urlData.publicUrl + '?t=' + Date.now();
    }
    
    const updates = {
      title: document.getElementById('edit-song-title').value.trim(),
      artist: editSongTagInput ? editSongTagInput.getSelectedString() : '',
      album: document.getElementById('edit-song-album').value.trim() || null,
      cover_url: coverUrl || null,
    };
    
    const audioUrl = document.getElementById('edit-song-audio-url').value.trim();
    const song = allSongs.find(s => s.id === editingSongId);
    if (song) {
      updates.file_path = audioUrl || null;
    }
    
    const { error } = await sb
      .from('songs')
      .update(updates)
      .eq('id', editingSongId);
    
    if (error) throw error;
    
    showToast('Şarkı başarıyla güncellendi!', 'success');
    closeEditModal();
    await loadSongs();
    
  } catch (err) {
    console.error('Save error:', err);
    showToast('Kaydetme hatası: ' + (err.message || 'Bilinmeyen hata'), 'error');
  }
  
  btn.disabled = false;
  btn.innerHTML = 'Değişiklikleri Kaydet';
};

// ===== CLOSE MODALS =====

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    if (e.target.id === 'edit-song-modal') closeEditModal();
    if (e.target.id === 'add-artist-modal') closeAddArtistModal();
    if (e.target.id === 'add-song-modal') closeAddSongModal();
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeEditModal();
    closeAddArtistModal();
    closeAddSongModal();
  }
});

// ===== SEARCH =====

window.searchArtists = function(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderArtists(allArtists);
    return;
  }
  const filtered = allArtists.filter(a => 
    (a.name || '').toLowerCase().includes(q)
  );
  renderArtists(filtered);
};

// ===== CREATE ARTIST ACCOUNT =====
let currentCreateAccountArtistId = null;

window.openCreateAccountModal = function(artistId) {
  currentCreateAccountArtistId = artistId;
  
  document.getElementById('create-account-email').value = '';
  document.getElementById('create-account-error').style.display = 'none';
  document.getElementById('created-account-result').style.display = 'none';
  
  document.getElementById('btn-create-account-confirm').style.display = 'block';
  document.getElementById('btn-create-account-confirm').disabled = false;
  
  document.getElementById('create-artist-account-modal').classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.closeCreateAccountModal = function() {
  document.getElementById('create-artist-account-modal').classList.remove('show');
  document.body.style.overflow = '';
};

window.confirmCreateAccount = async function() {
  if (!currentCreateAccountArtistId) return;
  
  const emailInput = document.getElementById('create-account-email');
  const email = emailInput.value.trim();
  const errorEl = document.getElementById('create-account-error');
  const btn = document.getElementById('btn-create-account-confirm');
  
  if (!email || !email.includes('@')) {
    errorEl.textContent = 'Geçerli bir e-posta adresi girin.';
    errorEl.style.display = 'block';
    return;
  }
  
  const artist = allArtists.find(a => a.id === currentCreateAccountArtistId);
  if (!artist || !artist.name) {
    errorEl.textContent = 'Sanatçı profili hatalı.';
    errorEl.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-color:#000;border-top-color:transparent;"></span> Oluşturuluyor...';
  errorEl.style.display = 'none';
  
  try {
    // Rastgele tek kullanımlık şifre oluştur (örn: X7k9M2pQ)
    const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
    
    // Geçici supabase client oluştur (admin'in kendi session'u bozulmasın diye persistSession: false)
    const sbTemp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    // Auth'ta yeni kullanıcı oluştur
    const { data: authData, error: signUpError } = await sbTemp.auth.signUp({
      email: email,
      password: tempPassword,
    });
    
    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        throw new Error('Bu e-posta adresi sistemde zaten kayıtlı!');
      }
      throw signUpError;
    }
    
    if (!authData.user) {
      throw new Error('Kullanıcı oluşturulamadı.');
    }
    
    // Yeni oluşturulan kullanıcının profiles tablosundaki verisini güncelle
    // username: sanatçının adı (bağlantı için)
    // role: 'artist'
    // theme: 'force_password_change' (Sanatçı giriş yapınca şifre sormak için bayrak)
    const { error: profileUpdateError } = await sb
      .from('profiles')
      .update({
        username: artist.name,
        role: 'artist',
        theme: 'force_password_change'
      })
      .eq('id', authData.user.id);
      
    if (profileUpdateError) {
      // Profil eğer trigger tarafından oluşturulmadıysa biz oluşturalım
      const { error: profileInsertError } = await sb.from('profiles').insert({
        id: authData.user.id,
        username: artist.name,
        role: 'artist',
        theme: 'force_password_change'
      });
      if (profileInsertError) throw profileInsertError;
    }
    
    // Başarılı!
    document.getElementById('res-email').textContent = email;
    document.getElementById('res-password').textContent = tempPassword;
    document.getElementById('created-account-result').style.display = 'block';
    
    btn.style.display = 'none'; // Kaydet butonunu gizle
    
  } catch (err) {
    console.error('Create artist account error:', err);
    errorEl.textContent = 'Bir hata oluştu: ' + (err.message || 'Hesap oluşturulamadı.');
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = 'Hesap Oluştur';
  }
};

window.searchSongs = function(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderSongs(allSongs);
    return;
  }
  const filtered = allSongs.filter(s => 
    (s.title || '').toLowerCase().includes(q) ||
    (s.artist || '').toLowerCase().includes(q) ||
    (s.album || '').toLowerCase().includes(q)
  );
  renderSongs(filtered);
};

// ===== LOGOUT =====

window.adminLogout = async function() {
  await sb.auth.signOut();
  currentUser = null;
  currentUserProfile = null;
  window.location.reload();
};

// ===== UTILITIES =====

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>';
  } else {
    iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
  }
  
  toast.innerHTML = iconSvg + '<span>' + escapeHtml(message) + '</span>';
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
