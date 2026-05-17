// ===== Discord Rich Presence - Spotify Bypass =====
// Discord'da "Listening to Spotify" olarak görünmeni sağlar
// Main process'te çalışır (Node.js)
//
// KURULUM:
// 1. https://discord.com/developers/applications adresine git
// 2. "New Application" tıkla
// 3. Uygulama adını "Spotify" yap (Discord'da "Listening to Spotify" yazması için)
// 4. General Information sayfasından APPLICATION ID'yi kopyala
// 5. Aşağıdaki CLIENT_ID'yi kendi oluşturduğun Application ID ile değiştir
// 6. Rich Presence > Art Assets kısmına bir "spotify_logo" görseli yükle (yeşil Spotify logosu)

const RPC = require('discord-rpc');

// Discord Application Client ID
// ÖNEMLİ: Kendi "Spotify" adlı Discord uygulamanın ID'sini buraya yaz!
const CLIENT_ID = process.env.DISCORD_SPOTIFY_CLIENT_ID || '1496238375747715122';

let rpcClient = null;
let isConnected = false;
let reconnectTimer = null;
let isFirstConnectionAttempt = true;

async function initDiscordRPC() {
  if (rpcClient) {
    try {
      rpcClient.destroy();
    } catch (e) {
      // ignore
    }
    rpcClient = null;
  }

  try {
    rpcClient = new RPC.Client({ transport: 'ipc' });

    rpcClient.on('ready', () => {
      console.log('[Discord RPC] Spotify bypass connected as', rpcClient.user?.username);
      isConnected = true;
      isFirstConnectionAttempt = false;
      clearReconnectTimer();
    });

    rpcClient.on('disconnected', () => {
      if (isConnected) {
        console.log('[Discord RPC] Disconnected');
      }
      isConnected = false;
      scheduleReconnect();
    });

    await rpcClient.login({ clientId: CLIENT_ID });
  } catch (err) {
    if (isFirstConnectionAttempt) {
      console.log('[Discord RPC] Could not connect to Discord (is it running?). Retrying in background...');
      isFirstConnectionAttempt = false;
    }
    isConnected = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    if (!isConnected) {
      initDiscordRPC();
    }
  }, 15000); // 15 saniye sonra tekrar dene
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function updatePresence(songData) {
  if (!rpcClient || !isConnected) return;

  try {
    // Spotify tarzı activity objesi oluştur
    const activity = {
      type: 2, // 2 = LISTENING (Spotify gibi "Listening to..." gösterir)
      details: songData.title || 'Bilinmeyen Şarkı',
      state: songData.artist || 'Bilinmeyen Sanatçı',
      assets: {
        large_image: songData.cover_url || 'spotify_logo',
        large_text: songData.album || songData.title || 'Spotify',
        small_image: songData.isPlaying ? 'play_icon' : 'pause_icon',
        small_text: songData.isPlaying ? 'Çalıyor' : 'Duraklatıldı',
      },
      instance: false,
    };

    // Eğer şarkı çalıyorsa ve süre bilgisi varsa zaman göster
    if (songData.isPlaying && songData.duration > 0) {
      const now = Date.now();
      const elapsed = (songData.currentTime || 0) * 1000;
      const remaining = (songData.duration - (songData.currentTime || 0)) * 1000;

      activity.timestamps = {
        start: Math.floor(now - elapsed),
        end: Math.floor(now + remaining),
      };
    }

    // Buton ekle - Spotify tarzı
    activity.buttons = [
      {
        label: '🎧 Spotify\'da Dinle',
        url: 'https://bekofy.netlify.app'
      }
    ];

    // discord-rpc kütüphanesinin setActivity metodu "type" field'ını geçirmiyor
    // Bu yüzden doğrudan request() kullanarak raw payload gönderiyoruz
    // Bu sayede type: 2 (LISTENING) Discord tarafından işleniyor
    await rpcClient.request('SET_ACTIVITY', {
      pid: process.pid,
      activity: activity,
    });

  } catch (err) {
    console.log('[Discord RPC] Activity update error:', err.message);
    // Bağlantı kopmuş olabilir, tekrar bağlan
    if (err.message?.includes('connection') || err.message?.includes('close')) {
      isConnected = false;
      scheduleReconnect();
    }
  }
}

async function clearPresence() {
  if (!rpcClient || !isConnected) return;

  try {
    await rpcClient.request('SET_ACTIVITY', {
      pid: process.pid,
      activity: null,
    });
  } catch (err) {
    console.log('[Discord RPC] Clear activity error:', err.message);
  }
}

function destroyRPC() {
  clearReconnectTimer();
  if (rpcClient) {
    try {
      rpcClient.destroy();
    } catch (e) {
      // ignore
    }
    rpcClient = null;
    isConnected = false;
  }
}

module.exports = {
  initDiscordRPC,
  updatePresence,
  clearPresence,
  destroyRPC
};
