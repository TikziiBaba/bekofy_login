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
  }

  saveState(song) {
    if (song) {
      localStorage.setItem('bekofy_last_song', JSON.stringify({
        song: song,
        queue: this.queue,
        currentIndex: this.currentIndex
      }));
    }
  }

  loadState() {
    const saved = localStorage.getItem('bekofy_last_song');
    if (saved) {
      try {
        const { song, queue, currentIndex } = JSON.parse(saved);
        if (song) {
          this.queue = queue || [song];
          this.currentIndex = currentIndex || 0;
          this.updateUI(song);
          // Just prepare UI, don't auto play
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
      const url = await getSongUrl(song.file_path);
      this.audio.src = url;
      this.audio.play();
      this.isPlaying = true;
      this.updateUI(song);
      this.updatePlayButton();
      this.highlightCurrentSong(song.id);
      this.saveState(song);
    } catch (err) {
      console.error('Error playing song:', err);
      showToast('Şarkı oynatılamadı', 'error');
    }
  }

  togglePlay() {
    if (!this.audio.src) return;
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();
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
  }

  // Event Handlers
  onTimeUpdate() {
    const { currentTime, duration } = this.audio;
    if (!duration) return;
    const percent = (currentTime / duration) * 100;
    document.getElementById('progress-bar-fill').style.width = percent + '%';
    document.getElementById('progress-bar-knob').style.left = percent + '%';
    document.getElementById('time-current').textContent = this.formatTime(currentTime);
  }

  onLoaded() {
    document.getElementById('time-total').textContent = this.formatTime(this.audio.duration);
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
    }
  }

  onError(e) {
    console.error('Audio error:', e);
    showToast('Şarkı yüklenirken hata oluştu', 'error');
  }

  // UI Updates
  updateUI(song) {
    document.getElementById('now-playing-title').textContent = song.title;
    document.getElementById('now-playing-artist').innerHTML = typeof formatArtistLinks === 'function' ? formatArtistLinks(song.artist) : (song.artist || '');
    
    const cover = document.getElementById('now-playing-cover');
    if (song.cover_url) {
      cover.innerHTML = `<img src="${song.cover_url}" alt="${song.title}">`;
    } else {
      cover.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3" width="40" height="40"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
    }
  }

  updatePlayButton() {
    const playIcon = document.getElementById('icon-play');
    const pauseIcon = document.getElementById('icon-pause');
    if (this.isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
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
}

// Global player instance
const player = new MusicPlayer();
