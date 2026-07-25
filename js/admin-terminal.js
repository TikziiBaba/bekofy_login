/* =====================================================
   Bekofy Admin Terminal / CLI Engine (Genişletilmiş Sürüm)
   ===================================================== */

(function () {
  class BekofyAdminTerminal {
    constructor() {
      this.history = [];
      this.historyIndex = -1;
      this.container = null;
      this.outputEl = null;
      this.inputEl = null;
      this.promptEl = null;
      this.initialized = false;
      this.availableCommands = [
        'help', 'ban', 'unban', 'banned', 'banlist', 'info', 'logs', 'ips', 'user-logs',
        'users', 'search', 'find', 'role', 'recent', 'latest', 'artists', 'songs',
        'top-ips', 'stats', 'whoami', 'history', 'matrix', 'clear', 'cls'
      ];
    }

    init(containerId = 'admin-terminal-mount') {
      this.container = document.getElementById(containerId);
      if (!this.container) return;

      this.renderTerminalUI();
      this.outputEl = this.container.querySelector('.admin-terminal-body');
      this.inputEl = this.container.querySelector('.admin-terminal-input');
      this.promptEl = this.container.querySelector('.admin-terminal-prompt');

      this.bindEvents();
      this.printWelcomeBanner();
      this.initialized = true;
    }

    renderTerminalUI() {
      this.container.innerHTML = `
        <div class="admin-terminal-container">
          <div class="admin-terminal-header">
            <div class="admin-terminal-dots">
              <span class="admin-terminal-dot dot-red"></span>
              <span class="admin-terminal-dot dot-yellow"></span>
              <span class="admin-terminal-dot dot-green"></span>
            </div>
            <div class="admin-terminal-title">
              💻 Bekofy Admin Management CLI v1.2 (Süper Konsol)
            </div>
            <div class="admin-terminal-actions">
              <span class="admin-terminal-status">
                <span class="admin-terminal-status-indicator"></span> CONNECTED
              </span>
              <button class="btn-terminal-action" id="btn-term-clear" title="Ekranı Temizle">Temizle</button>
            </div>
          </div>
          <div class="admin-terminal-body"></div>
          <div class="admin-terminal-input-wrapper">
            <span class="admin-terminal-prompt">admin@bekofy:~$</span>
            <input type="text" class="admin-terminal-input" placeholder="Komut yazın... (Örn: banned, help, logs, info <kullanıcı>)" autocomplete="off" spellcheck="false">
          </div>
        </div>
      `;
    }

    bindEvents() {
      if (!this.inputEl) return;

      this.container.addEventListener('click', () => {
        this.inputEl.focus();
      });

      const clearBtn = this.container.querySelector('#btn-term-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.clearScreen();
        });
      }

      this.inputEl.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const cmdStr = this.inputEl.value.trim();
          this.inputEl.value = '';
          if (cmdStr) {
            this.history.push(cmdStr);
            this.historyIndex = this.history.length;
            await this.executeCommand(cmdStr);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.historyIndex > 0) {
            this.historyIndex--;
            this.inputEl.value = this.history[this.historyIndex] || '';
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.inputEl.value = this.history[this.historyIndex] || '';
          } else {
            this.historyIndex = this.history.length;
            this.inputEl.value = '';
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          this.handleAutoComplete();
        }
      });
    }

    handleAutoComplete() {
      const current = this.inputEl.value.trim();
      if (!current) return;
      const matches = this.availableCommands.filter(c => c.startsWith(current.toLowerCase()));
      if (matches.length === 1) {
        this.inputEl.value = matches[0] + ' ';
      } else if (matches.length > 1) {
        this.printLine(`<span class="term-dim">Mevcut eşleşmeler: ${matches.join(', ')}</span>`);
      }
    }

    printWelcomeBanner() {
      const banner = `
<span class="term-green">====================================================================</span>
<span class="term-cyan">   ____  ______ _  ______  ______ __   ___  ____   __  ____   _ </span>
<span class="term-cyan">  / __ )/ ____// // / __ \\/ ____// /  /   |/ __ \\ / / / / /  / / </span>
<span class="term-cyan"> / __  / __/  / // / / / / /_   / /  / /| / /_/ // /_/ / /  / /  </span>
<span class="term-cyan">/ /_/ / /___ / // / /_/ / __/  / /__/ ___ / ____// __  / /__/ /___</span>
<span class="term-cyan">/_____/_____//_//_/\\____/_/    /____/_/  |_/_/   /_/ /_/_____/_____/</span>
<span class="term-green">====================================================================</span>
<span class="term-yellow">Bekofy Yönetim Konsoluna Hoş Geldiniz. (Sürüm 1.2.0 - Zengin Komut Seti)</span>
<span class="term-dim">Yasaklı kişileri görmek için <span class="term-red">banned</span>, tüm komutlar için <span class="term-cyan">help</span> yazın.</span>
--------------------------------------------------------------------`;
      this.outputEl.innerHTML = banner;
      this.scrollToBottom();
    }

    printLine(htmlContent) {
      const line = document.createElement('div');
      line.className = 'term-line';
      line.innerHTML = htmlContent;
      this.outputEl.appendChild(line);
      this.scrollToBottom();
    }

    clearScreen() {
      this.outputEl.innerHTML = '';
      this.printWelcomeBanner();
    }

    scrollToBottom() {
      this.outputEl.scrollTop = this.outputEl.scrollHeight;
    }

    async executeCommand(rawCmd) {
      const promptText = this.promptEl.textContent;
      this.printLine(`<span class="term-green">${promptText}</span> <span class="term-white">${this.escapeHtml(rawCmd)}</span>`);

      const parts = rawCmd.split(' ').filter(Boolean);
      const command = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      switch (command) {
        case 'help':
        case '?':
          this.cmdHelp();
          break;

        case 'clear':
        case 'cls':
          this.clearScreen();
          break;

        case 'whoami':
          this.cmdWhoAmI();
          break;

        case 'ban':
          await this.cmdBan(args);
          break;

        case 'unban':
          await this.cmdUnban(args);
          break;

        case 'banned':
        case 'banlist':
        case 'bans':
          await this.cmdBanned();
          break;

        case 'info':
          await this.cmdInfo(args);
          break;

        case 'logs':
        case 'ips':
          await this.cmdLogs(args);
          break;

        case 'user-logs':
          await this.cmdUserLogs(args);
          break;

        case 'users':
          await this.cmdUsers(args);
          break;

        case 'search':
        case 'find':
          await this.cmdSearch(args);
          break;

        case 'role':
          await this.cmdRole(args);
          break;

        case 'recent':
        case 'latest':
          await this.cmdRecent();
          break;

        case 'artists':
          await this.cmdArtists();
          break;

        case 'songs':
          await this.cmdSongs(args);
          break;

        case 'top-ips':
          await this.cmdTopIPs();
          break;

        case 'stats':
          await this.cmdStats();
          break;

        case 'history':
          this.cmdHistory();
          break;

        case 'matrix':
          this.cmdMatrix();
          break;

        default:
          this.printLine(`<span class="term-red">Bilinmeyen komut: '${this.escapeHtml(command)}'. Komut listesi için '<span class="term-cyan">help</span>' yazın.</span>`);
          break;
      }
    }

    cmdHelp() {
      const helpHtml = `
<span class="term-cyan term-bold">=== BEKOFY ADMIN TERMINAL TÜM KOMUTLAR ===</span>

<table class="term-table">
  <thead>
    <tr>
      <th>Komut</th>
      <th>Kullanım Syntax</th>
      <th>Açıklama</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="term-red term-bold">banned</span></td>
      <td>banned / banlist</td>
      <td>Yasaklanmış tüm kullanıcıların listesini görüntüler.</td>
    </tr>
    <tr>
      <td><span class="term-green">ban</span></td>
      <td>ban &lt;id|kullanıcı_adı&gt; [sebep]</td>
      <td>Kullanıcıyı sistemde yasaklar.</td>
    </tr>
    <tr>
      <td><span class="term-green">unban</span></td>
      <td>unban &lt;id|kullanıcı_adı&gt;</td>
      <td>Kullanıcının yasağını kaldırır.</td>
    </tr>
    <tr>
      <td><span class="term-green">info</span></td>
      <td>info &lt;id|kullanıcı_adı&gt;</td>
      <td>Kullanıcının detaylarını, son IP'sini, cihaz verilerini görüntüler.</td>
    </tr>
    <tr>
      <td><span class="term-green">search</span></td>
      <td>search &lt;kelime&gt;</td>
      <td>Kullanıcı adı veya e-postaya göre arama yapar.</td>
    </tr>
    <tr>
      <td><span class="term-green">logs / ips</span></td>
      <td>logs [limit]</td>
      <td>Giriş yapan tüm kullanıcıların IP ve cihaz günlüklerini listeler.</td>
    </tr>
    <tr>
      <td><span class="term-green">user-logs</span></td>
      <td>user-logs &lt;id|kullanıcı_adı&gt;</td>
      <td>Hedef kullanıcının geçmiş tüm IP/giriş hareketlerini gösterir.</td>
    </tr>
    <tr>
      <td><span class="term-green">top-ips</span></td>
      <td>top-ips</td>
      <td>Sistemde en çok bağlantı kuran IP adreslerini gruplayıp gösterir.</td>
    </tr>
    <tr>
      <td><span class="term-green">role</span></td>
      <td>role &lt;kullanıcı&gt; &lt;yeni_rol&gt;</td>
      <td>Kullanıcının yetki rolünü değiştirir (admin, yetkili, artist, premium, user).</td>
    </tr>
    <tr>
      <td><span class="term-green">users</span></td>
      <td>users</td>
      <td>Sistemdeki tüm kullanıcıları ve durumlarını listeler.</td>
    </tr>
    <tr>
      <td><span class="term-green">recent</span></td>
      <td>recent</td>
      <td>En son kayıt olan 10 kullanıcıyı gösterir.</td>
    </tr>
    <tr>
      <td><span class="term-green">artists</span></td>
      <td>artists</td>
      <td>Kayıtlı sanatçıların listesini gösterir.</td>
    </tr>
    <tr>
      <td><span class="term-green">songs</span></td>
      <td>songs [limit]</td>
      <td>Platformdaki şarkıları listeler.</td>
    </tr>
    <tr>
      <td><span class="term-green">stats</span></td>
      <td>stats</td>
      <td>Genel sistem, kullanıcı ve veritabanı istatistiklerini getirir.</td>
    </tr>
    <tr>
      <td><span class="term-green">whoami</span></td>
      <td>whoami</td>
      <td>Mevcut admin oturumu bilgilerinizi görüntüler.</td>
    </tr>
    <tr>
      <td><span class="term-green">history</span></td>
      <td>history</td>
      <td>Bu oturumda yazdığınız komut geçmişini sıralar.</td>
    </tr>
    <tr>
      <td><span class="term-green">matrix</span></td>
      <td>matrix</td>
      <td>Ekrana Matrix yeşil kod efekti basar.</td>
    </tr>
    <tr>
      <td><span class="term-green">clear</span></td>
      <td>clear / cls</td>
      <td>Terminal ekranını temizler.</td>
    </tr>
  </tbody>
</table>`;
      this.printLine(helpHtml);
    }

    cmdWhoAmI() {
      const profile = window.currentUserProfile || {};
      const username = profile.username || 'Admin';
      const role = profile.role || window.currentUserRole || 'admin';
      const id = profile.id || 'N/A';
      this.printLine(`
<span class="term-cyan">Mevcut Oturum Bilgisi:</span>
<span class="term-yellow">Yönetici:</span> ${username}
<span class="term-yellow">Rol:</span> 👑 ${role}
<span class="term-yellow">ID:</span> ${id}
      `);
    }

    async cmdBanned() {
      this.printLine(`<span class="term-yellow">[...] Yasaklanan kullanıcılar getiriliyor...</span>`);
      const sb = getSupabase();
      if (!sb) {
        this.printLine(`<span class="term-red">Veritabanı bağlantısı yok.</span>`);
        return;
      }

      const { data: bannedUsers, error } = await sb
        .from('profiles')
        .select('*')
        .eq('is_banned', true)
        .order('created_at', { ascending: false });

      if (error) {
        this.printLine(`<span class="term-red">[- Hata] Yasaklı kullanıcılar alınamadı: ${error.message}</span>`);
        return;
      }

      if (!bannedUsers || bannedUsers.length === 0) {
        this.printLine(`<span class="term-green term-bold">[✓ BİLGİ] Sistemde henüz yasaklanmış hiçbir kullanıcı bulunmuyor!</span>`);
        return;
      }

      let tableHtml = `
<span class="term-red term-bold">=== YASAKLANMIŞ KULLANICILAR LİSTESİ (${bannedUsers.length} Kişi) ===</span>
<table class="term-table">
  <thead>
    <tr>
      <th>Kullanıcı Adı</th>
      <th>Rol</th>
      <th>Son IP Adresi</th>
      <th>Kayıt Tarihi</th>
      <th>Kullanıcı ID</th>
    </tr>
  </thead>
  <tbody>`;

      bannedUsers.forEach(u => {
        const timeStr = u.created_at ? new Date(u.created_at).toLocaleDateString('tr-TR') : 'Bilinmiyor';
        tableHtml += `
    <tr>
      <td><span class="term-red term-bold">🚫 ${this.escapeHtml(u.username || 'İsimsiz')}</span></td>
      <td><span class="term-yellow">${u.role || 'user'}</span></td>
      <td><span class="term-cyan">${u.last_ip || 'Kayıt Yok'}</span></td>
      <td><span class="term-dim">${timeStr}</span></td>
      <td><span class="term-dim">${u.id}</span></td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdBan(args) {
      if (!args[0]) {
        this.printLine(`<span class="term-red">Hata: Kullanıcı ID veya kullanıcı adı belirtilmedi. Örn: ban bekir "Kuralları çiğnedi"</span>`);
        return;
      }
      const target = args[0];
      const reason = args.slice(1).join(' ') || 'Yönetici tarafından yasaklandı';

      this.printLine(`<span class="term-yellow">[...] '${target}' kullanıcısı aranıyor...</span>`);
      const { profile, error } = await findUserByIdOrUsername(target);

      if (error || !profile) {
        this.printLine(`<span class="term-red">[- Hata] '${target}' kullanıcı adında veya ID'sinde kullanıcı bulunamadı.</span>`);
        return;
      }

      const { error: banErr } = await adminBanUser(profile.id);
      if (banErr) {
        this.printLine(`<span class="term-red">[- Hata] Kullanıcı yasaklanırken sorun oluştu: ${banErr.message}</span>`);
      } else {
        this.printLine(`<span class="term-green term-bold">[✓ BAŞARILI]</span> Kullanıcı <span class="term-cyan">${profile.username}</span> (${profile.id}) sistemde YASAKLANDI.`);
        this.printLine(`<span class="term-dim">Sebep: ${this.escapeHtml(reason)}</span>`);
      }
    }

    async cmdUnban(args) {
      if (!args[0]) {
        this.printLine(`<span class="term-red">Hata: Kullanıcı ID veya kullanıcı adı belirtilmedi. Örn: unban bekir</span>`);
        return;
      }
      const target = args[0];
      this.printLine(`<span class="term-yellow">[...] '${target}' kullanıcısı aranıyor...</span>`);

      const { profile, error } = await findUserByIdOrUsername(target);
      if (error || !profile) {
        this.printLine(`<span class="term-red">[- Hata] '${target}' kullanıcısı bulunamadı.</span>`);
        return;
      }

      const { error: unbanErr } = await adminUnbanUser(profile.id);
      if (unbanErr) {
        this.printLine(`<span class="term-red">[- Hata] Yasağı kaldırırken hata oluştu: ${unbanErr.message}</span>`);
      } else {
        this.printLine(`<span class="term-green term-bold">[✓ BAŞARILI]</span> <span class="term-cyan">${profile.username}</span> kullanıcısının yasağı kaldırıldı.`);
      }
    }

    async cmdInfo(args) {
      if (!args[0]) {
        this.printLine(`<span class="term-red">Hata: Kullanıcı ID veya kullanıcı adı belirtilmedi. Örn: info bekir</span>`);
        return;
      }
      const target = args[0];
      this.printLine(`<span class="term-yellow">[...] '${target}' kullanıcısının detaylı bilgileri getiriliyor...</span>`);

      const { profile, error } = await findUserByIdOrUsername(target);
      if (error || !profile) {
        this.printLine(`<span class="term-red">[- Hata] '${target}' kullanıcısı bulunamadı.</span>`);
        return;
      }

      const { data: logs } = await getLogsForUser(profile.id, 5);
      const lastLog = logs && logs[0] ? logs[0] : {};

      const bannedTag = profile.is_banned 
        ? `<span class="term-red term-bold">🔴 YASAKLI (BANNED)</span>` 
        : `<span class="term-green">🟢 AKTİF (OK)</span>`;

      const infoBox = `
<span class="term-cyan term-bold">====================================================================</span>
<span class="term-cyan term-bold">              KULLANICI BİLGİ KARTI & TELEMETRİ                    </span>
<span class="term-cyan term-bold">====================================================================</span>
<span class="term-yellow">Kullanıcı ID   :</span> ${profile.id}
<span class="term-yellow">Kullanıcı Adı :</span> <span class="term-bold term-white">${profile.username}</span>
<span class="term-yellow">Rol           :</span> ${profile.role || 'user'}
<span class="term-yellow">Durum         :</span> ${bannedTag}
<span class="term-yellow">Kayıt Tarihi  :</span> ${profile.created_at ? new Date(profile.created_at).toLocaleString('tr-TR') : 'Bilinmiyor'}
<span class="term-yellow">Son IP Adresi :</span> <span class="term-cyan">${profile.last_ip || lastLog.ip_address || 'Kayıt Yok'}</span>
<span class="term-yellow">Son Giriş     :</span> ${profile.last_login_at ? new Date(profile.last_login_at).toLocaleString('tr-TR') : (lastLog.created_at ? new Date(lastLog.created_at).toLocaleString('tr-TR') : 'Kayıt Yok')}
<span class="term-yellow">Son Konum     :</span> ${lastLog.city || 'Bilinmiyor'}, ${lastLog.country || 'Bilinmiyor'}
<span class="term-yellow">Ekran Çöz.    :</span> ${lastLog.screen_res || 'Bilinmiyor'}
<span class="term-yellow">Zaman Dilimi  :</span> ${lastLog.timezone || 'Bilinmiyor'}
<span class="term-yellow">User-Agent    :</span> <span class="term-dim">${lastLog.user_agent || 'Kayıt Yok'}</span>
<span class="term-cyan term-bold">====================================================================</span>`;

      this.printLine(infoBox);
    }

    async cmdSearch(args) {
      if (!args[0]) {
        this.printLine(`<span class="term-red">Hata: Aranacak sözcük belirtilmedi. Örn: search bekir</span>`);
        return;
      }
      const q = args.join(' ');
      this.printLine(`<span class="term-yellow">[...] '${q}' için veritabanında arama yapılıyor...</span>`);
      const sb = getSupabase();
      if (!sb) return;

      const { data: results, error } = await sb
        .from('profiles')
        .select('*')
        .ilike('username', `%${q}%`)
        .limit(20);

      if (error) {
        this.printLine(`<span class="term-red">Arama hatası: ${error.message}</span>`);
        return;
      }

      if (!results || results.length === 0) {
        this.printLine(`<span class="term-dim">'${q}' ile eşleşen kullanıcı bulunamadı.</span>`);
        return;
      }

      let tableHtml = `
<span class="term-cyan">Arama Sonuçları (${results.length} Eşleşme):</span>
<table class="term-table">
  <thead>
    <tr>
      <th>Kullanıcı Adı</th>
      <th>Rol</th>
      <th>Durum</th>
      <th>Son IP</th>
      <th>ID</th>
    </tr>
  </thead>
  <tbody>`;

      results.forEach(u => {
        const st = u.is_banned ? `<span class="term-red">YASAKLI</span>` : `<span class="term-green">AKTİF</span>`;
        tableHtml += `
    <tr>
      <td><span class="term-bold term-white">${this.escapeHtml(u.username)}</span></td>
      <td><span class="term-yellow">${u.role || 'user'}</span></td>
      <td>${st}</td>
      <td><span class="term-cyan">${u.last_ip || 'N/A'}</span></td>
      <td><span class="term-dim">${u.id}</span></td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdRole(args) {
      if (args.length < 2) {
        this.printLine(`<span class="term-red">Hata: Kullanıcı adı/ID ve yeni rol belirtilmelidir. Syntax: role <kullanıcı> <admin|yetkili|artist|premium|user></span>`);
        return;
      }
      const target = args[0];
      const newRole = args[1].toLowerCase();
      const validRoles = ['admin', 'yetkili', 'artist', 'premium', 'user'];

      if (!validRoles.includes(newRole)) {
        this.printLine(`<span class="term-red">Geçersiz rol: '${newRole}'. Geçerli roller: ${validRoles.join(', ')}</span>`);
        return;
      }

      const { profile, error } = await findUserByIdOrUsername(target);
      if (error || !profile) {
        this.printLine(`<span class="term-red">[- Hata] Kullanıcı bulunamadı.</span>`);
        return;
      }

      const sb = getSupabase();
      const { error: updateErr } = await sb.from('profiles').update({ role: newRole }).eq('id', profile.id);
      if (updateErr) {
        this.printLine(`<span class="term-red">Rol güncellenirken hata: ${updateErr.message}</span>`);
      } else {
        this.printLine(`<span class="term-green term-bold">[✓ BAŞARILI]</span> <span class="term-cyan">${profile.username}</span> kullanıcısının rolü <span class="term-yellow">${newRole}</span> olarak değiştirildi.`);
      }
    }

    async cmdRecent() {
      this.printLine(`<span class="term-yellow">[...] En son kayıt olan kullanıcılar getiriliyor...</span>`);
      const sb = getSupabase();
      if (!sb) return;

      const { data: users, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(10);
      if (error) {
        this.printLine(`<span class="term-red">Hata: ${error.message}</span>`);
        return;
      }

      let tableHtml = `
<span class="term-cyan">Son Kaydolan 10 Kullanıcı:</span>
<table class="term-table">
  <thead>
    <tr>
      <th>Kullanıcı Adı</th>
      <th>Rol</th>
      <th>Kayıt Tarihi</th>
      <th>Son IP</th>
    </tr>
  </thead>
  <tbody>`;

      users.forEach(u => {
        const timeStr = u.created_at ? new Date(u.created_at).toLocaleString('tr-TR') : 'N/A';
        tableHtml += `
    <tr>
      <td><span class="term-bold term-white">${this.escapeHtml(u.username)}</span></td>
      <td><span class="term-yellow">${u.role || 'user'}</span></td>
      <td><span class="term-dim">${timeStr}</span></td>
      <td><span class="term-cyan">${u.last_ip || 'N/A'}</span></td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdArtists() {
      this.printLine(`<span class="term-yellow">[...] Sanatçılar getiriliyor...</span>`);
      const sb = getSupabase();
      if (!sb) return;

      const [artistsRes, profilesRes] = await Promise.all([
        sb.from('artists').select('*').order('name', { ascending: true }),
        sb.from('profiles').select('*').eq('role', 'artist').order('username', { ascending: true })
      ]);

      const fromArtists = (artistsRes.data || []).map(a => ({ name: a.name, type: 'Tablo Sanatçısı', id: a.id }));
      const fromProfiles = (profilesRes.data || []).map(p => ({ name: p.username, type: 'Profil Sanatçısı', id: p.id }));
      const all = [...fromArtists, ...fromProfiles];

      if (all.length === 0) {
        this.printLine(`<span class="term-dim">Kayıtlı sanatçı bulunamadı.</span>`);
        return;
      }

      let tableHtml = `
<span class="term-cyan">Sistem Sanatçıları (${all.length} Sanatçı):</span>
<table class="term-table">
  <thead>
    <tr>
      <th>Sanatçı Adı</th>
      <th>Tipi</th>
      <th>ID</th>
    </tr>
  </thead>
  <tbody>`;

      all.forEach(a => {
        tableHtml += `
    <tr>
      <td><span class="term-bold term-white">🎤 ${this.escapeHtml(a.name)}</span></td>
      <td><span class="term-yellow">${a.type}</span></td>
      <td><span class="term-dim">${a.id}</span></td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdSongs(args) {
      const limit = parseInt(args[0], 10) || 15;
      this.printLine(`<span class="term-yellow">[...] Şarkılar getiriliyor...</span>`);
      const sb = getSupabase();
      if (!sb) return;

      const { data: songs, error } = await sb.from('songs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) {
        this.printLine(`<span class="term-red">Hata: ${error.message}</span>`);
        return;
      }

      if (!songs || songs.length === 0) {
        this.printLine(`<span class="term-dim">Platformda henüz şarkı yok.</span>`);
        return;
      }

      let tableHtml = `
<span class="term-cyan">Platform Şarkıları (${songs.length} Adet):</span>
<table class="term-table">
  <thead>
    <tr>
      <th>Şarkı Adı</th>
      <th>Sanatçı</th>
      <th>Albüm</th>
      <th>Süre (sn)</th>
    </tr>
  </thead>
  <tbody>`;

      songs.forEach(s => {
        tableHtml += `
    <tr>
      <td><span class="term-bold term-white">🎵 ${this.escapeHtml(s.title)}</span></td>
      <td><span class="term-yellow">${this.escapeHtml(s.artist)}</span></td>
      <td><span class="term-dim">${this.escapeHtml(s.album || '-')}</span></td>
      <td>${s.duration || 0}s</td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdTopIPs() {
      this.printLine(`<span class="term-yellow">[...] En çok bağlantı kuran IP adresleri hesaplanıyor...</span>`);
      const { data: logs, error } = await getUserAccessLogs(200);
      if (error || !logs) {
        this.printLine(`<span class="term-red">Hata: Günlükler okunamadı.</span>`);
        return;
      }

      const ipCounts = {};
      const ipDetails = {};

      logs.forEach(l => {
        const ip = l.ip_address || 'Bilinmiyor';
        ipCounts[ip] = (ipCounts[ip] || 0) + 1;
        if (!ipDetails[ip]) {
          ipDetails[ip] = {
            user: l.username,
            location: l.city ? `${l.city}, ${l.country}` : 'Bilinmiyor'
          };
        }
      });

      const sortedIPs = Object.keys(ipCounts).sort((a, b) => ipCounts[b] - ipCounts[a]).slice(0, 10);

      let tableHtml = `
<span class="term-cyan">En Aktif IP Adresleri (Top 10):</span>
<table class="term-table">
  <thead>
    <tr>
      <th>IP Adresi</th>
      <th>Bağlantı Sayısı</th>
      <th>Son Kullanıcı</th>
      <th>Konum</th>
    </tr>
  </thead>
  <tbody>`;

      sortedIPs.forEach(ip => {
        const det = ipDetails[ip] || {};
        tableHtml += `
    <tr>
      <td><span class="term-cyan term-bold">${ip}</span></td>
      <td><span class="term-yellow">${ipCounts[ip]} kez</span></td>
      <td><span class="term-white">@${det.user || 'Misafir'}</span></td>
      <td><span class="term-dim">${det.location}</span></td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdLogs(args) {
      const limit = parseInt(args[0], 10) || 20;
      this.printLine(`<span class="term-yellow">[...] Son ${limit} IP & Cihaz erişim günlüğü getiriliyor...</span>`);

      const { data: logs, error } = await getUserAccessLogs(limit);
      if (error) {
        this.printLine(`<span class="term-red">[- Hata] Günlükler alınamadı: ${error.message || error}</span>`);
        return;
      }

      if (!logs || logs.length === 0) {
        this.printLine(`<span class="term-dim">Henüz kaydedilmiş erişim günlüğü bulunmuyor.</span>`);
        return;
      }

      let tableHtml = `
<table class="term-table">
  <thead>
    <tr>
      <th>Tarih / Saat</th>
      <th>Kullanıcı</th>
      <th>IP Adresi</th>
      <th>Konum</th>
      <th>OS / Cihaz</th>
      <th>Çözünürlük</th>
    </tr>
  </thead>
  <tbody>`;

      logs.forEach(log => {
        const timeStr = new Date(log.created_at).toLocaleString('tr-TR');
        const userStr = log.username ? `@${log.username}` : 'Misafir';
        const location = log.city && log.country ? `${log.city}, ${log.country}` : (log.country || 'Bilinmiyor');
        tableHtml += `
    <tr>
      <td><span class="term-dim">${timeStr}</span></td>
      <td><span class="term-yellow term-bold">${this.escapeHtml(userStr)}</span></td>
      <td><span class="term-cyan">${this.escapeHtml(log.ip_address || 'N/A')}</span></td>
      <td>${this.escapeHtml(location)}</td>
      <td><span class="term-dim">${this.escapeHtml((log.device_info || 'PC').substring(0, 25))}</span></td>
      <td>${this.escapeHtml(log.screen_res || 'N/A')}</td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdUserLogs(args) {
      if (!args[0]) {
        this.printLine(`<span class="term-red">Hata: Kullanıcı adı veya ID belirtilmedi. Örn: user-logs bekir</span>`);
        return;
      }
      const target = args[0];
      this.printLine(`<span class="term-yellow">[...] '${target}' için erişim geçmişi getiriliyor...</span>`);

      const { data: logs, error } = await getLogsForUser(target, 25);
      if (error) {
        this.printLine(`<span class="term-red">[- Hata] Loglar okunamadı: ${error.message || error}</span>`);
        return;
      }

      if (!logs || logs.length === 0) {
        this.printLine(`<span class="term-dim">'${target}' için kayıtlı erişim günlüğü bulunamadı.</span>`);
        return;
      }

      let tableHtml = `
<table class="term-table">
  <thead>
    <tr>
      <th>Tarih</th>
      <th>IP Adresi</th>
      <th>Konum</th>
      <th>Tarayıcı / User-Agent</th>
    </tr>
  </thead>
  <tbody>`;

      logs.forEach(l => {
        const timeStr = new Date(l.created_at).toLocaleString('tr-TR');
        const loc = l.city ? `${l.city}, ${l.country}` : 'Bilinmiyor';
        tableHtml += `
    <tr>
      <td><span class="term-dim">${timeStr}</span></td>
      <td><span class="term-cyan">${l.ip_address || 'N/A'}</span></td>
      <td>${loc}</td>
      <td><span class="term-dim">${this.escapeHtml((l.user_agent || '').substring(0, 45))}</span></td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdUsers(args) {
      this.printLine(`<span class="term-yellow">[...] Sistem kullanıcıları getiriliyor...</span>`);
      const sb = getSupabase();
      if (!sb) {
        this.printLine(`<span class="term-red">Veritabanı bağlantısı yok.</span>`);
        return;
      }

      const { data: users, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(30);
      if (error) {
        this.printLine(`<span class="term-red">Hata: ${error.message}</span>`);
        return;
      }

      let tableHtml = `
<table class="term-table">
  <thead>
    <tr>
      <th>Kullanıcı Adı</th>
      <th>Rol</th>
      <th>Durum</th>
      <th>Son IP</th>
      <th>ID</th>
    </tr>
  </thead>
  <tbody>`;

      users.forEach(u => {
        const status = u.is_banned ? `<span class="term-red">YASAKLI</span>` : `<span class="term-green">AKTİF</span>`;
        tableHtml += `
    <tr>
      <td><span class="term-bold term-white">${this.escapeHtml(u.username || 'İsimsiz')}</span></td>
      <td><span class="term-yellow">${u.role || 'user'}</span></td>
      <td>${status}</td>
      <td><span class="term-cyan">${u.last_ip || 'N/A'}</span></td>
      <td><span class="term-dim">${u.id.substring(0, 8)}...</span></td>
    </tr>`;
      });

      tableHtml += `</tbody></table>`;
      this.printLine(tableHtml);
    }

    async cmdStats() {
      this.printLine(`<span class="term-yellow">[...] Sistem istatistikleri hesaplanıyor...</span>`);
      const sb = getSupabase();
      if (!sb) return;

      const [{ count: totalUsers }, { count: bannedUsers }, { count: logCount }, { count: songCount }] = await Promise.all([
        sb.from('profiles').select('*', { count: 'exact', head: true }),
        sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
        sb.from('user_access_logs').select('*', { count: 'exact', head: true }),
        sb.from('songs').select('*', { count: 'exact', head: true })
      ]);

      this.printLine(`
<span class="term-cyan term-bold">=== BEKOFY SİSTEM İSTATİSTİKLERİ ===</span>
<span class="term-yellow">Toplam Kullanıcı :</span> ${totalUsers || 0}
<span class="term-red">Yasaklı Kullanıcı:</span> ${bannedUsers || 0}
<span class="term-green">Aktif Kullanıcı  :</span> ${(totalUsers || 0) - (bannedUsers || 0)}
<span class="term-purple">Kayıtlı Şarkı    :</span> ${songCount || 0}
<span class="term-cyan">Kayıtlı IP Logu  :</span> ${logCount || 0}
      `);
    }

    cmdHistory() {
      if (this.history.length === 0) {
        this.printLine(`<span class="term-dim">Oturumda henüz komut yazılmadı.</span>`);
        return;
      }
      let html = `<span class="term-cyan">Komut Geçmişi (${this.history.length} Komut):</span><br>`;
      this.history.forEach((h, idx) => {
        html += `<span class="term-dim">${idx + 1}.</span> <span class="term-yellow">${this.escapeHtml(h)}</span><br>`;
      });
      this.printLine(html);
    }

    cmdMatrix() {
      const chars = '0101010101ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*';
      let lines = [];
      for (let i = 0; i < 8; i++) {
        let l = '';
        for (let j = 0; j < 50; j++) {
          l += chars[Math.floor(Math.random() * chars.length)];
        }
        lines.push(l);
      }
      this.printLine(`<div style="color:#00ff66;font-family:monospace;letter-spacing:2px;">${lines.join('<br>')}</div>`);
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  window.BekofyAdminTerminal = new BekofyAdminTerminal();
})();
