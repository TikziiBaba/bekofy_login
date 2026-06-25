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
    document.querySelector('.checkout-form h3').textContent = 'Zaten Premium\'sun! ✨ (Test Modu)';
    document.querySelector('.checkout-form > p').textContent = 'Hesabın zaten Premium. Ancak sistemi test etmek için sahte ödeme işlemini yapabilirsin.';
    // document.getElementById('btn-pay').style.display = 'none'; // Kapatmıyoruz ki test edebilsin
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
    // Sadece harf girilmesine izin ver
    cardName.value = cardName.value.replace(/[0-9]/g, '');
    document.getElementById('card-display-name').textContent = cardName.value.toUpperCase() || 'AD SOYAD';
    checkFormValid();
  });

  const preventNonDigits = (e) => {
    if (!/^[\d]$/.test(e.key) && !['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  };

  cardNumber.addEventListener('keydown', preventNonDigits);
  cardExpiry.addEventListener('keydown', preventNonDigits);
  cardCvv.addEventListener('keydown', preventNonDigits);

  cardNumber.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
    e.target.value = formatted;
    document.getElementById('card-display-number').textContent = formatted || '•••• •••• •••• ••••';
    checkFormValid();
  });

  cardExpiry.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 2) {
      val = val.substring(0, 2) + ' / ' + val.substring(2);
    }
    e.target.value = val;
    document.getElementById('card-display-expiry').textContent = val || 'MM/YY';
    checkFormValid();
  });

  cardCvv.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    checkFormValid();
  });

  function checkFormValid() {
    const nameOk = cardName.value.trim().length >= 3;
    const numOk = cardNumber.value.replace(/\s/g, '').length === 16;
    const expOk = cardExpiry.value.replace(/\s/g, '').length >= 4;
    const cvvOk = cardCvv.value.length >= 3;
    btnPay.disabled = !(nameOk && numOk && expOk && cvvOk);
  }

  // Pay button fake logic
  btnPay.addEventListener('click', async () => {
    btnPay.disabled = true;
    const originalText = document.getElementById('btn-pay-text').textContent;
    document.getElementById('btn-pay-text').textContent = 'Bankaya Bağlanılıyor...';

    // Simulate connection delay
    await new Promise(r => setTimeout(r, 1200));
    document.getElementById('btn-pay-text').textContent = 'Ödeme İşleniyor...';
    await new Promise(r => setTimeout(r, 1500));

    // Get the card details to determine success or failure
    const num = cardNumber.value.replace(/\D/g, '');
    const cvv = cardCvv.value;
    
    // Simulate payment failure if card ends with 0000 or CVV is 000
    if (num.endsWith('0000') || cvv === '000') {
      document.getElementById('checkout-error').classList.add('active');
      btnPay.disabled = false;
      document.getElementById('btn-pay-text').textContent = originalText;
      return;
    }

    try {
      await sb.from('profiles').update({ role: 'premium' }).eq('id', userId);
      showSuccess();
    } catch (err) {
      showToast('Kritik Hata: ' + err.message, 'error');
      btnPay.disabled = false;
      document.getElementById('btn-pay-text').textContent = originalText;
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
