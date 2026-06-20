// ===== Music Player Engine =====

class MusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'none'; // none, all, one
    
    // Load saved volume or default to 0.7
    const savedVol = localStorage.getItem('bekofy_volume');
    this.volume = savedVol !== null ? parseFloat(savedVol) : 0.7;
    this.audio.volume = this.volume;

    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('loadedmetadata', () => this.onLoaded());
    this.audio.addEventListener('error', (e) => this.onError(e));
    
    // Visualizer variables
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.canvas = null;
    this.canvasCtx = null;
    this.animationId = null;
    this.isFullscreen = false;

    this.animationId = null;
    this.isFullscreen = false;
  }

  getStorageKey() {
    const userId = window.currentUserId || localStorage.getItem('bekofy_current_user_id') || 'guest';
    return `bekofy_last_song_${userId}`;
  }

  saveState(song) {
    if (song) {
      localStorage.setItem(this.getStorageKey(), JSON.stringify({
        song: song,
        queue: this.queue,
        currentIndex: this.currentIndex,
        currentTime: this.audio ? this.audio.currentTime : 0
      }));
    }
  }

  saveCurrentTime() {
    const saved = localStorage.getItem(this.getStorageKey());
    if (saved && this.audio && !isNaN(this.audio.currentTime) && this.audio.currentTime > 0) {
      try {
        const state = JSON.parse(saved);
        state.currentTime = this.audio.currentTime;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
      } catch (e) {}
    }
  }

  loadState() {
    this.updateVolumeUI(); // Ensure volume bar matches saved volume on load
    const saved = localStorage.getItem(this.getStorageKey());
    if (saved) {
      try {
        const { song, queue, currentIndex, currentTime } = JSON.parse(saved);
        if (song) {
          this.queue = queue || [song];
          this.currentIndex = currentIndex || 0;
          this.updateUI(song);
          
          // Preload audio so the duration is visible on the UI
          if (typeof getSongUrl === 'function') {
            getSongUrl(song.file_path).then(url => {
              this.audio.src = url;
              this.audio.addEventListener('loadedmetadata', () => {
                if (currentTime) {
                  this.audio.currentTime = currentTime;
                  this.onTimeUpdate(); // Update progress bar
                }
              }, { once: true });
            }).catch(e => console.warn('Preload error:', e));
          }
        }
      } catch (e) {
        console.error('State load error:', e);
      }
    }
  }

  async playSong(song, songList) {
    if (songList) {
      this.queue = [...songList];
      this.currentIndex = this.queue.findIndex(s => s.id === song.id);
    }

    try {
      this.initVisualizer();
      const url = await getSongUrl(song.file_path);
      this.audio.src = url;
      this.audio.volume = this.volume;
      // Because audio context needs user interaction to resume
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.audio.play();

      this.isPlaying = true;
      this.updateUI(song);
      this.updatePlayButton();
      this.highlightCurrentSong(song.id);
      this.saveState(song);

      // Discord Rich Presence
      this.updateDiscordRPC(song, true);

      // Mini Player sync
      this.syncMiniPlayer(song);

      // Jam broadcast
      this.broadcastJamAction('play_song');

      // Friend Activity broadcast
      if (typeof updateUserActivity === 'function') {
        updateUserActivity(song.id, true).catch(err => console.warn('Activity update error:', err));
      }
    } catch (err) {
      console.error('Error playing song:', err);
      showToast('Şarkı oynatılamadı', 'error');
    }
  }

  togglePlay() {
    if (!this.audio.src) {
      const song = this.getCurrentSong();
      if (song) {
        this.playSong(song);
      }
      return;
    }
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();

    const song = this.getCurrentSong();
    if (song) {
      if (this.isPlaying) {
        this.updateDiscordRPC(song, true);
      } else {
        // Save current time when paused
        this.saveCurrentTime();
        
        // Duraklatıldığında Discord RPC'yi tamamen kaldır (sayaç başlamasın)
        if (window.electronAPI && window.electronAPI.clearDiscordRPC) {
          window.electronAPI.clearDiscordRPC();
        }
      }
      this.syncMiniPlayer(song);
    }

    // Jam broadcast
    this.broadcastJamAction(this.isPlaying ? 'resume' : 'pause');

    // Friend Activity broadcast
    if (typeof updateUserActivity === 'function') {
      const currentSong = this.getCurrentSong();
      if (currentSong) {
        updateUserActivity(currentSong.id, this.isPlaying).catch(err => console.warn('Activity update error:', err));
      }
    }
  }

  next() {
    if (this.queue.length === 0) return;
    if (this.isShuffle) {
      this.currentIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.queue.length;
    }
    this.playSong(this.queue[this.currentIndex]);
  }

  previous() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.isShuffle) {
      this.currentIndex = Math.floor(Math.random() * this.queue.length);
    } else {
      this.currentIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    }
    this.playSong(this.queue[this.currentIndex]);
  }

  seek(percent) {
    if (!this.audio.duration) return;
    this.audio.currentTime = (percent / 100) * this.audio.duration;
    
    // Discord RPC zamanı güncelle (kullanıcı ileri/geri sardığında)
    const song = this.getCurrentSong();
    if (song && this.isPlaying) {
      this.updateDiscordRPC(song, true);
    }

    // Jam broadcast
    this.broadcastJamAction('seek');
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audio.volume = this.volume;
    localStorage.setItem('bekofy_volume', this.volume.toString());
    this.updateVolumeUI();
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const btn = document.getElementById('btn-shuffle');
    btn.classList.toggle('active', this.isShuffle);
  }

  toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    const idx = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(idx + 1) % 3];
    const btn = document.getElementById('btn-repeat');
    btn.classList.toggle('active', this.repeatMode !== 'none');
    btn.classList.toggle('active-one', this.repeatMode === 'one');
  }

  // Event Handlers
  onTimeUpdate() {
    const { currentTime, duration } = this.audio;
    if (!duration) return;
    const percent = (currentTime / duration) * 100;
    document.getElementById('progress-bar-fill').style.width = percent + '%';
    document.getElementById('progress-bar-knob').style.left = percent + '%';
    document.getElementById('time-current').textContent = this.formatTime(currentTime);

    // Fullscreen progress sync
    const fsFill = document.getElementById('fs-progress-bar-fill');
    const fsKnob = document.getElementById('fs-progress-bar-knob');
    const fsTime = document.getElementById('fs-time-current');
    if (fsFill) fsFill.style.width = percent + '%';
    if (fsKnob) fsKnob.style.left = percent + '%';
    if (fsTime) fsTime.textContent = this.formatTime(currentTime);

    if (window.electronAPI && window.electronAPI.updateMiniPlayerProgress) {
      window.electronAPI.updateMiniPlayerProgress({ percent });
    }
  }

  onLoaded() {
    document.getElementById('time-total').textContent = this.formatTime(this.audio.duration);
    
    // Fullscreen total time sync
    const fsTimeTotal = document.getElementById('fs-time-total');
    if (fsTimeTotal) fsTimeTotal.textContent = this.formatTime(this.audio.duration);
    
    // Şarkının tam süresi yüklendiğinde Discord RPC'ye gönder
    const song = this.getCurrentSong();
    if (song && this.isPlaying) {
      this.updateDiscordRPC(song, true);
    }
  }

  onEnded() {
    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else if (this.repeatMode === 'all' || this.currentIndex < this.queue.length - 1) {
      this.next();
    } else {
      this.isPlaying = false;
      this.updatePlayButton();
      // Clear Discord RPC when playback ends
      if (window.electronAPI && window.electronAPI.clearDiscordRPC) {
        window.electronAPI.clearDiscordRPC();
      }
      
      // Friend Activity broadcast
      if (typeof updateUserActivity === 'function') {
        const currentSong = this.getCurrentSong();
        if (currentSong) {
          updateUserActivity(currentSong.id, false).catch(err => console.warn('Activity update error:', err));
        }
      }
    }
  }

  onError(e) {
    console.error('Audio error:', e);
    showToast('Şarkı yüklenirken hata oluştu', 'error');
  }

  initVisualizer() {
    if (this.audioCtx) return; // Zaten yüklüyse tekrar oluşturma
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      
      // Çapraz köken koruması için
      this.audio.crossOrigin = "anonymous";
      
      this.source = this.audioCtx.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      
      this.analyser.fftSize = 256;
      
      this.canvas = document.getElementById('fs-visualizer');
      if (this.canvas) {
        this.canvasCtx = this.canvas.getContext('2d');
      }
    } catch (e) {
      console.warn('Web Audio API desteklenmiyor veya engellendi:', e);
    }
  }



  drawVisualizer() {
    if (!this.isFullscreen || !this.analyser || !this.canvas || !this.canvasCtx) return;
    
    this.animationId = requestAnimationFrame(() => this.drawVisualizer());
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.canvasCtx.clearRect(0, 0, width, height);
    
    const barWidth = (width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];
      
      // Yeşil ve beyaz geçişli frekans çubukları
      const r = 29;
      const g = 185;
      const b = 84;
      const alpha = barHeight / 255;
      
      this.canvasCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      this.canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      x += barWidth + 2;
    }
  }

  toggleFullscreen() {
    const fsPlayer = document.getElementById('fs-player');
    if (!fsPlayer) return;
    
    this.isFullscreen = !this.isFullscreen;
    
    if (this.isFullscreen) {
      fsPlayer.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Set canvas size
      if (this.canvas) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight * 0.4;
      }
      
      // Ensure audio context is running
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      
      this.drawVisualizer();
    } else {
      fsPlayer.classList.remove('active');
      document.body.style.overflow = '';
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }
  }

  // UI Updates
  updateUI(song) {
    document.getElementById('now-playing-title').textContent = song.title;
    document.getElementById('now-playing-artist').innerHTML = typeof formatArtistLinks === 'function' ? formatArtistLinks(song.artist) : (song.artist || '');
    
    const cover = document.getElementById('now-playing-cover');
    if (song.cover_url) {
      cover.innerHTML = `<img src="${song.cover_url}" alt="${song.title}" id="now-playing-img" crossorigin="anonymous">`;
      
      // Update fullscreen UI
      const fsImg = document.getElementById('fs-vinyl-img');
      if (fsImg) fsImg.src = song.cover_url;
    } else {
      cover.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3" width="40" height="40"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
      
      const fsImg = document.getElementById('fs-vinyl-img');
      if (fsImg) fsImg.src = '';
    }
    
    // Update fullscreen text
    const fsTitle = document.getElementById('fs-title');
    const fsArtist = document.getElementById('fs-artist');
    if (fsTitle) fsTitle.textContent = song.title;
    if (fsArtist) fsArtist.textContent = song.artist || '';
    
    // Update queue panel if function exists
    if (typeof renderQueuePanel === 'function') {
      renderQueuePanel();
    }
  }



  updatePlayButton() {
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    const fsPlayIcon = document.getElementById('fs-icon-play');
    const fsPauseIcon = document.getElementById('fs-icon-pause');
    const npPlayIcon = document.getElementById('np-icon-play');
    const npPauseIcon = document.getElementById('np-icon-pause');
    const fsVinyl = document.getElementById('fs-vinyl');
    
    if (this.isPlaying) {
      if (playIcon) playIcon.style.display = 'none';
      if (pauseIcon) pauseIcon.style.display = 'block';
      if (fsPlayIcon) fsPlayIcon.style.display = 'none';
      if (fsPauseIcon) fsPauseIcon.style.display = 'block';
      if (npPlayIcon) npPlayIcon.style.display = 'none';
      if (npPauseIcon) npPauseIcon.style.display = 'block';
      if (fsVinyl) fsVinyl.classList.add('playing');
    } else {
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      if (fsPlayIcon) fsPlayIcon.style.display = 'block';
      if (fsPauseIcon) fsPauseIcon.style.display = 'none';
      if (npPlayIcon) npPlayIcon.style.display = 'block';
      if (npPauseIcon) npPauseIcon.style.display = 'none';
      if (fsVinyl) fsVinyl.classList.remove('playing');
    }
  }

  updateVolumeUI() {
    const percent = this.volume * 100;
    document.getElementById('volume-slider-fill').style.width = percent + '%';
    document.getElementById('volume-slider-knob').style.left = percent + '%';
  }

  highlightCurrentSong(songId) {
    document.querySelectorAll('.song-list-item').forEach(el => {
      el.classList.toggle('playing', el.dataset.songId === songId);
    });
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  addToQueue(song) {
    if (!song) return;
    
    // Eğer hiç şarkı çalmıyorsa direkt başlat
    if (this.queue.length === 0 || this.currentIndex === -1) {
      this.playSong(song, [song]);
      return;
    }
    
    // Zaten sırada mı kontrol et
    const alreadyInQueue = this.queue.find(s => s.id === song.id);
    if (alreadyInQueue) {
      return 'duplicate';
    }
    
    // Mevcut şarkıdan sonraya ekle
    const insertIndex = this.currentIndex + 1;
    this.queue.splice(insertIndex, 0, song);
    return 'added';
  }

  playShuffled(songs) {
    if (!songs || songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    this.isShuffle = true;
    const btn = document.getElementById('btn-shuffle');
    if (btn) btn.classList.add('active');
    this.playSong(shuffled[0], shuffled);
  }

  getCurrentSong() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  // ===== Discord Rich Presence =====
  updateDiscordRPC(song, isPlaying) {
    if (!window.electronAPI || !window.electronAPI.updateDiscordRPC) return;
    try {
      window.electronAPI.updateDiscordRPC({
        title: song.title,
        artist: song.artist,
        album: song.album || '',
        cover_url: song.cover_url || '',
        duration: this.audio.duration || song.duration || 0,
        currentTime: this.audio.currentTime || 0,
        isPlaying: isPlaying
      });
    } catch (e) {
      // Silent fail
    }
  }

  // ===== Mini Player Sync =====
  syncMiniPlayer(song) {
    if (!window.electronAPI || !window.electronAPI.updateMiniPlayer) return;
    try {
      window.electronAPI.updateMiniPlayer({
        title: song.title,
        artist: song.artist,
        cover_url: song.cover_url || '',
        isPlaying: this.isPlaying
      });
    } catch (e) {
      // Silent fail
    }
  }

  // ===== Jam (Birlikte Dinleme) =====
  jamSessionId = null;
  isJamHost = false;
  _jamSyncInterval = null;

  setJamSession(sessionId, isHost) {
    this.jamSessionId = sessionId;
    this.isJamHost = isHost;
    // Host broadcasts position every 5 seconds for drift correction
    if (isHost) {
      this._jamSyncInterval = setInterval(() => {
        if (this.jamSessionId && this.isJamHost && this.isPlaying) {
          const song = this.getCurrentSong();
          if (song) {
            broadcastJamEvent({
              type: 'position_sync',
              songId: song.id,
              position: this.audio.currentTime,
              isPlaying: this.isPlaying,
              timestamp: Date.now()
            });
          }
        }
      }, 5000);
    }
  }

  clearJamSession() {
    this.jamSessionId = null;
    this.isJamHost = false;
    if (this._jamSyncInterval) {
      clearInterval(this._jamSyncInterval);
      this._jamSyncInterval = null;
    }
  }

  // Called when host changes song/plays/pauses/seeks
  broadcastJamAction(action, extra = {}) {
    if (!this.jamSessionId || !this.isJamHost) return;
    const song = this.getCurrentSong();
    const eventData = {
      type: action,
      songId: song?.id || null,
      position: this.audio.currentTime || 0,
      isPlaying: this.isPlaying,
      timestamp: Date.now(),
      ...extra
    };
    broadcastJamEvent(eventData);

    // Persist state to database so late-joining guests can fetch it
    if (typeof updateJamState === 'function') {
      updateJamState(this.jamSessionId, song?.id || null, this.isPlaying, this.audio.currentTime || 0)
        .catch(err => console.warn('[Jam] DB state update error:', err));
    }
  }

  // Called when a Jam event comes in from the host (for guests)
  async handleJamEvent(event) {
    if (this.isJamHost) return; // Host doesn't listen to own events
    if (!event || !event.type) return;

    switch (event.type) {
      case 'play_song': {
        // Find the song in allSongs (global) and play it
        const song = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.id === event.songId);
        if (song) {
          await this.playSong(song, typeof allSongs !== 'undefined' ? allSongs : [song]);
          if (event.position > 0) {
            this.audio.currentTime = event.position;
          }
        }
        break;
      }
      case 'pause': {
        if (this.isPlaying) {
          this.audio.pause();
          this.isPlaying = false;
          this.updatePlayButton();
        }
        break;
      }
      case 'resume': {
        if (!this.isPlaying && this.audio.src) {
          this.audio.play();
          this.isPlaying = true;
          this.updatePlayButton();
        }
        break;
      }
      case 'seek': {
        if (this.audio.src && event.position !== undefined) {
          this.audio.currentTime = event.position;
        }
        break;
      }
      case 'position_sync': {
        // Drift correction: if off by more than 3 seconds, resync
        if (this.audio.src && event.songId === this.getCurrentSong()?.id) {
          const drift = Math.abs(this.audio.currentTime - event.position);
          if (drift > 3) {
            this.audio.currentTime = event.position;
          }
          // Sync play/pause state
          if (event.isPlaying && !this.isPlaying) {
            this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton();
          } else if (!event.isPlaying && this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
          }
        } else if (event.songId && event.songId !== this.getCurrentSong()?.id) {
          // Different song, switch
          const song = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.id === event.songId);
          if (song) {
            await this.playSong(song, typeof allSongs !== 'undefined' ? allSongs : [song]);
            if (event.position > 0) this.audio.currentTime = event.position;
          }
        }
        break;
      }
      case 'end_session': {
        this.clearJamSession();
        if (typeof showToast === 'function') showToast('Jam oturumu sona erdi', 'info');
        if (typeof onJamEnded === 'function') onJamEnded();
        break;
      }
    }
  }
}

// Global player instance
const player = new MusicPlayer();

// Listen for mini player commands
if (window.electronAPI && window.electronAPI.onMiniCommand) {
  window.electronAPI.onMiniCommand((command, data) => {
    switch (command) {
      case 'toggle-play':
        player.togglePlay();
        break;
      case 'next':
        player.next();
        break;
      case 'prev':
        player.previous();
        break;
      case 'seek':
        if (data !== undefined) player.seek(data);
        break;
      case 'request-current-song':
        // Mini player just loaded, send current song data
        const currentSong = player.getCurrentSong();
        if (currentSong) {
          player.syncMiniPlayer(currentSong);
        }
        break;
    }
  });
}
