// ===== Checkout Logic =====

document.addEventListener('DOMContentLoaded', async () => {
  const sb = getSupabase();

  // Auth guard
  if (!sb) { window.location.href = 'login.html'; return; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const userId = session.user.id;

  // Check if already premium
  const { data: profile } = await sb.from('profiles').select('role').eq('id', userId).single();
  if (profile && (profile.role === 'premium' || profile.role === 'admin')) {
    document.querySelector('.checkout-form h3').textContent = 'Zaten Premium\'sun! ✨';
    document.querySelector('.checkout-form > p').textContent = 'Hesabın zaten Premium seviyesinde. Ekstra işlem gerekmez.';
    document.getElementById('btn-pay').style.display = 'none';
    document.getElementById('btn-test-pay').style.display = 'none';
    return;
  }

  // Read plan from URL
  const params = new URLSearchParams(window.location.search);
  const plan = params.get('plan') || 'bireysel';

  const plans = {
    bireysel: { name: 'Bekofy Premium Bireysel', price: '₺39.99' },
    ogrenci: { name: 'Bekofy Premium Öğrenci', price: '₺19.99' }
  };

  const selected = plans[plan] || plans.bireysel;
  document.getElementById('checkout-plan-name').textContent = selected.name;
  document.getElementById('checkout-plan-price').innerHTML = `${selected.price}<span> / ay</span>`;

  // Card form live preview
  const cardName = document.getElementById('card-name');
  const cardNumber = document.getElementById('card-number');
  const cardExpiry = document.getElementById('card-expiry');
  const cardCvv = document.getElementById('card-cvv');
  const btnPay = document.getElementById('btn-pay');

  cardName.addEventListener('input', () => {
    document.getElementById('card-display-name').textContent = cardName.value.toUpperCase() || 'AD SOYAD';
    checkFormValid();
  });

  cardNumber.addEventListener('input', (e) => {
    // Format: 1234 5678 9012 3456
    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
    val = val.replace(/(.{4})/g, '$1 ').trim();
    e.target.value = val;
    document.getElementById('card-display-number').textContent = val || '•••• •••• •••• ••••';
    checkFormValid();
  });

  cardExpiry.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 2) val = val.substring(0, 2) + ' / ' + val.substring(2);
    e.target.value = val;
    document.getElementById('card-display-expiry').textContent = val || 'MM/YY';
    checkFormValid();
  });

  cardCvv.addEventListener('input', () => checkFormValid());

  function checkFormValid() {
    const nameOk = cardName.value.trim().length >= 3;
    const numOk = cardNumber.value.replace(/\s/g, '').length === 16;
    const expOk = cardExpiry.value.replace(/\s/g, '').length >= 4;
    const cvvOk = cardCvv.value.length >= 3;
    btnPay.disabled = !(nameOk && numOk && expOk && cvvOk);
  }

  // Pay button (placeholder - would connect to real POS)
  btnPay.addEventListener('click', async () => {
    btnPay.disabled = true;
    document.getElementById('btn-pay-text').textContent = 'İşleniyor...';

    // Simulate processing delay
    await new Promise(r => setTimeout(r, 2000));

    // For now, activate premium via test
    try {
      await sb.from('profiles').update({ role: 'premium' }).eq('id', userId);
      showSuccess();
    } catch (err) {
      showToast('Ödeme hatası: ' + err.message, 'error');
      btnPay.disabled = false;
      document.getElementById('btn-pay-text').textContent = 'Ödeme Yap';
    }
  });

  // Test payment
  document.getElementById('btn-test-pay').addEventListener('click', async () => {
    const btn = document.getElementById('btn-test-pay');
    btn.disabled = true;
    btn.textContent = 'İşleniyor...';

    try {
      const { error } = await sb.from('profiles').update({ role: 'premium' }).eq('id', userId);
      if (error) throw error;
      showSuccess();
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'TEST: Ödemeyi Simüle Et (Geliştirici)';
    }
  });
});

function showSuccess() {
  launchConfetti();
  document.getElementById('checkout-success').classList.add('active');
}

// Confetti animation
function launchConfetti() {
  const colors = ['#1DB954', '#1ed760', '#ff6b6b', '#ffd700', '#a855f7', '#3b82f6', '#f97316'];
  const container = document.body;

  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = '-10px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    confetti.style.width = (Math.random() * 8 + 6) + 'px';
    confetti.style.height = (Math.random() * 8 + 6) + 'px';
    confetti.style.opacity = Math.random() * 0.8 + 0.2;

    const duration = Math.random() * 2 + 2;
    const rotation = Math.random() * 720 - 360;
    const drift = Math.random() * 200 - 100;

    confetti.animate([
      { transform: `translateY(0) translateX(0) rotate(0deg)`, opacity: 1 },
      { transform: `translateY(100vh) translateX(${drift}px) rotate(${rotation}deg)`, opacity: 0 }
    ], { duration: duration * 1000, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' });

    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), duration * 1000);
  }
}

function showToast(message, type = 'error') {
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
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}
