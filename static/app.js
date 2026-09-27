// ==========================================
// KULLANICI YÖNETİMİ & GÜVENLİK (AUTH) SİSTEMİ
// ==========================================
let currentUser = null;
let currentAuthTab = 'login';

function getAuthToken() {
  return localStorage.getItem('asistan_auth_token') || sessionStorage.getItem('asistan_auth_token') || '';
}

function setAuthToken(token, rememberMe) {
  if (rememberMe) {
    localStorage.setItem('asistan_auth_token', token);
    sessionStorage.removeItem('asistan_auth_token');
  } else {
    sessionStorage.setItem('asistan_auth_token', token);
    localStorage.removeItem('asistan_auth_token');
  }
}

function clearAuthToken() {
  localStorage.removeItem('asistan_auth_token');
  sessionStorage.removeItem('asistan_auth_token');
  currentUser = null;
  updateUserProfileUI(null);
}

// Global fetch interceptor: Bearer Token ekler ve 401 yakalar
const _nativeFetch = window.fetch;
window.fetch = async function(resource, config = {}) {
  config = config || {};
  config.headers = config.headers || {};
  const token = getAuthToken();
  if (token) {
    if (config.headers instanceof Headers) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else if (Array.isArray(config.headers)) {
      config.headers.push(['Authorization', `Bearer ${token}`]);
    } else {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await _nativeFetch(resource, config);
  
  const urlStr = resource.toString();
  if (response.status === 401 && !urlStr.includes('/api/auth/')) {
    clearAuthToken();
    showAuthModal('login', '⚠️ Oturum süreniz doldu veya giriş yapmanız gerekiyor.');
  }
  return response;
};

function showAuthModal(tab = 'login', alertMsg = null) {
  const overlay = document.getElementById('auth-modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  switchAuthTab(tab);
  
  const alertEl = document.getElementById('auth-alert');
  if (alertEl) {
    if (alertMsg) {
      alertEl.style.display = 'block';
      alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
      alertEl.style.border = '1px solid rgba(239, 68, 68, 0.35)';
      alertEl.style.color = '#f87171';
      alertEl.innerHTML = alertMsg;
    } else {
      alertEl.style.display = 'none';
    }
  }
  
  setTimeout(() => {
    const emailInput = document.getElementById('auth-email');
    if (emailInput) emailInput.focus();
  }, 100);
}

function hideAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function switchAuthTab(tab) {
  currentAuthTab = tab;
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-register');
  const groupFullName = document.getElementById('auth-group-fullname');
  const submitText = document.getElementById('auth-submit-text');
  const alertEl = document.getElementById('auth-alert');
  if (alertEl) alertEl.style.display = 'none';

  if (tab === 'login') {
    if (tabLogin) tabLogin.className = 'auth-tab-btn active';
    if (tabReg) tabReg.className = 'auth-tab-btn';
    if (groupFullName) groupFullName.style.display = 'none';
    if (submitText) submitText.textContent = 'Giriş Yap';
    const tEl = document.getElementById('auth-modal-title');
    const sEl = document.getElementById('auth-modal-subtitle');
    if (tEl) tEl.textContent = 'Ödeme Asistanı';
    if (sEl) sEl.textContent = 'Kişisel ve güvenli finans takibi';
  } else {
    if (tabLogin) tabLogin.className = 'auth-tab-btn';
    if (tabReg) tabReg.className = 'auth-tab-btn active';
    if (groupFullName) groupFullName.style.display = 'block';
    if (submitText) submitText.textContent = 'Hesap Oluştur ve Başla';
    const tEl = document.getElementById('auth-modal-title');
    const sEl = document.getElementById('auth-modal-subtitle');
    if (tEl) tEl.textContent = 'Yeni Kullanıcı Kaydı';
    if (sEl) sEl.textContent = 'Kişisel finans alanınızı oluşturun';
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>`;
  } else {
    input.type = 'password';
    btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
  }
}

async function handleAuthSubmit() {
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  const nameInput = document.getElementById('auth-fullname');
  const remCheckbox = document.getElementById('auth-remember-me');
  const alertEl = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('auth-submit-btn');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value : '';
  const fullName = nameInput ? nameInput.value.trim() : '';
  const rememberMe = remCheckbox ? remCheckbox.checked : true;

  if (!email || !password) {
    if (alertEl) {
      alertEl.style.display = 'block';
      alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
      alertEl.style.border = '1px solid rgba(239, 68, 68, 0.35)';
      alertEl.style.color = '#f87171';
      alertEl.textContent = 'Lütfen tüm alanları doldurun.';
    }
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    const endpoint = currentAuthTab === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = currentAuthTab === 'register' 
      ? { email, password, full_name: fullName, remember_me: rememberMe }
      : { email, password, remember_me: rememberMe };

    const res = await _nativeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok && data.success) {
      setAuthToken(data.token, rememberMe);
      currentUser = data.user;
      hideAuthModal();
      updateUserProfileUI(currentUser);
      showToast(`👋 Hoş geldiniz, ${currentUser.full_name || currentUser.email}!`);
      
      // Kullanıcının kendi verilerini yükle
      loadAllUserData();
    } else {
      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
        alertEl.style.border = '1px solid rgba(239, 68, 68, 0.35)';
        alertEl.style.color = '#f87171';
        alertEl.textContent = data.detail || data.message || 'İşlem başarısız.';
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.style.display = 'block';
      alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
      alertEl.style.border = '1px solid rgba(239, 68, 68, 0.35)';
      alertEl.style.color = '#f87171';
      alertEl.textContent = 'Sunucuya bağlanırken bir hata oluştu.';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
}

async function handleLogout() {
  if (!confirm('Oturumu kapatmak istediğinize emin misiniz?')) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch(e) {}
  clearAuthToken();
  showToast('🔒 Oturum kapatıldı.');
  
  // Arayüzü temizle
  paymentsData = [];
  garageVehiclesList = [];
  renderStats();
  renderPayments();
  
  showAuthModal('login');
}

function updateUserProfileUI(user) {
  const badge = document.getElementById('user-profile-badge');
  if (!badge) return;
  if (!user) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'flex';
  const nameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-display-email');
  const avatarEl = document.getElementById('user-avatar-initial');

  if (nameEl) nameEl.textContent = user.full_name || user.email.split('@')[0];
  if (emailEl) emailEl.textContent = user.email;
  const mobEmailEl = document.getElementById('mobile-menu-user');
  if (mobEmailEl) mobEmailEl.textContent = user.email;
  if (avatarEl) {
    const initial = (user.full_name || user.email || 'U').charAt(0).toUpperCase();
    avatarEl.textContent = initial;
  }
}

function loadAllUserData() {
  loadData();
  if (typeof loadVehicleData === 'function') loadVehicleData();
  if (typeof loadEvCharges === 'function') loadEvCharges();
  if (typeof loadContracts === 'function') loadContracts();
  if (typeof loadTasks === 'function') loadTasks();
}

async function checkAuthStatus() {
  try {
    const token = getAuthToken();
    const res = await _nativeFetch('/api/auth/status', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) return;
    const statusData = await res.json();

    if (!statusData.has_users) {
      // Henüz hiç kullanıcı yok: İlk kullanıcı kayıt ekranını aç (legacy veriler otomatik ID=1'e bağlanacak)
      showAuthModal('register', '🎉 <strong>İlk Kurulum:</strong> Kişisel asistanınızı kullanmaya başlamak için ilk hesabınızı oluşturun.');
    } else if (statusData.is_authenticated && statusData.user) {
      currentUser = statusData.user;
      hideAuthModal();
      updateUserProfileUI(currentUser);
      loadAllUserData();
    } else {
      // Kullanıcılar var ama bu tarayıcıda oturum açılmamış
      showAuthModal('login');
    }
  } catch (e) {
    console.error('Auth status check error:', e);
  }
}



// ==========================================
// KIA EV6 Elektrikli Araç Şarj Yönetimi
// ==========================================
async function loadEvCharges() {
  try {
    const res = await fetch('/api/ev/charges');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('ev-total-cost').textContent = formatCurrency(data.total_cost);
    document.getElementById('ev-total-kwh').textContent = `${data.total_kwh.toLocaleString('tr-TR')} kWh`;
    document.getElementById('ev-avg-kwh-price').textContent = `${data.avg_kwh_cost.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₺/kWh`;
    document.getElementById('ev-savings').textContent = `${formatCurrency(data.savings_vs_gas)}`;

    const tbody = document.getElementById('ev-charges-list');
    if (!tbody) return;

    if (!data.charges || data.charges.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 16px;">Henüz kaydedilmiş şarj işlemi yok.</td></tr>';
      return;
    }

    const typeIcons = {
      'ac_home': '🏠 Ev (AC)',
      'dc_fast': '⚡ DC Hızlı',
      'work': '🏢 İş/Diğer'
    };

    tbody.innerHTML = data.charges.map(item => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 10px 6px;">${formatDateTr(item.charge_date)}</td>
        <td style="padding: 10px 6px;">
          <span style="font-weight: 600; color: #f8fafc;">${escapeHtml(item.station_name || 'İstasyon')}</span>
          <span style="font-size: 0.72rem; color: #94a3b8; display: block;">${typeIcons[item.charge_type] || item.charge_type}</span>
        </td>
        <td style="padding: 10px 6px; color: #38bdf8; font-weight: 600;">${item.kwh_amount} kWh</td>
        <td style="padding: 10px 6px; font-weight: 700; color: #34d399;">${formatCurrency(item.cost)}</td>
        <td style="padding: 10px 6px; color: #cbd5e1;">${item.odometer_km ? item.odometer_km.toLocaleString('tr-TR') + ' km' : '-'}</td>
        <td style="padding: 10px 6px; text-align: right;">
          <button onclick="deleteEvCharge(${item.id})" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 1rem;" title="Sil">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('EV şarjları yüklenemedi:', err);
  }
}

function openEvChargeModal() {
  document.getElementById('ev-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ev-type').value = 'dc_fast';
  autoFillEvStation();
  openModal('modal-ev-charge');
}

function autoFillEvStation() {
  const type = document.getElementById('ev-type').value;
  const stationInput = document.getElementById('ev-station');
  if (type === 'ac_home') {
    stationInput.value = 'Ev (AC)';
  } else if (type === 'dc_fast') {
    stationInput.value = stationInput.value.includes('Ev') ? 'Trugo / ZES' : (stationInput.value || 'ZES');
  } else {
    stationInput.value = 'İş Yeri';
  }
}

function calculateKwhCost() {
  const kwh = parseFloat(document.getElementById('ev-kwh').value) || 0;
  const cost = parseFloat(document.getElementById('ev-cost').value) || 0;
  const hint = document.getElementById('ev-calc-hint');
  if (kwh > 0 && cost > 0) {
    const unitPrice = cost / kwh;
    hint.textContent = `💡 Birim Fiyat: ${unitPrice.toFixed(2)} ₺ / kWh (EV6 ile km başı ~${(unitPrice * 0.18).toFixed(2)} ₺)`;
  } else {
    hint.textContent = '';
  }
}

async function handleEvChargeSubmit(e) {
  e.preventDefault();
  const payload = {
    charge_date: document.getElementById('ev-date').value,
    charge_type: document.getElementById('ev-type').value,
    station_name: document.getElementById('ev-station').value,
    kwh_amount: parseFloat(document.getElementById('ev-kwh').value),
    cost: parseFloat(document.getElementById('ev-cost').value),
    odometer_km: parseInt(document.getElementById('ev-odometer').value) || null
  };

  try {
    const res = await fetch('/api/ev/charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('modal-ev-charge');
      showToast('⚡ Şarj işlemi başarıyla kaydedildi!');
      await loadEvCharges();
      await loadVehicleData(); // KM güncellenmiş olabilir
    } else {
      showToast('❌ Şarj kaydedilemedi.');
    }
  } catch (e) {
    showToast('❌ Bağlantı hatası.');
  }
}

async function deleteEvCharge(id) {
  if (!confirm('Bu şarj kaydını silmek istediğinize emin misiniz?')) return;
  try {
    const res = await fetch(`/api/ev/charges/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('🗑️ Şarj kaydı silindi.');
      loadEvCharges();
    }
  } catch (e) {
    showToast('❌ Silme hatası.');
  }
}

// PWA Installation & Service Worker Integration
let deferredPwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaInstallPrompt = e;
  console.log('PWA kurulum bildirimi hazir');
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBtn) installBtn.style.display = 'inline-flex';
});

async function triggerPwaInstall() {
  if (deferredPwaInstallPrompt) {
    deferredPwaInstallPrompt.prompt();
    const { outcome } = await deferredPwaInstallPrompt.userChoice;
    console.log('PWA kurulum secimi:', outcome);
    deferredPwaInstallPrompt = null;
    const installBtn = document.getElementById('btn-pwa-install');
    if (installBtn) installBtn.style.display = 'none';
  } else {
    showToast('💡 Tarayıcı menüsünden (üç nokta) "Ana Ekrana Ekle"yi seçebilirsiniz.');
  }
}


// ========================================================
// 20 FARKLI UYARI ZİLİ & SES MOTORU (Web Audio API)
// ========================================================
let selectedAlarmTone = localStorage.getItem('app_alarm_tone') || '1';
let isWindowsPopupEnabled = localStorage.getItem('app_windows_popup_enabled') !== 'false'; // varsayılan açık

function playToneSound(toneType) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const tone = String(toneType);
    
    // 1. Klasik Dijital Çan (Ding-Dong)
    if (tone === '1' || tone === 'chime') {
      const freqs = [1046.50, 1567.98];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.22, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.65);
      });
    }
    // 2. Radar / Sonar Uyarısı (Derin Bip)
    else if (tone === '2' || tone === 'radar') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.4);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.7);
    }
    // 3. Kristal Melodi (Yüksek Işıltı)
    else if (tone === '3' || tone === 'crystal') {
      const freqs = [1318.51, 1567.98, 2093.00];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.5);
      });
    }
    // 4. Acil Durum Sireni (Kesik Çift Ton)
    else if (tone === '4' || tone === 'emergency') {
      const freqs = [880, 1174.66, 880];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.12, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.1 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.2);
      });
    }
    // 5. Yumuşak Zen Tonu (Hafif Marimba)
    else if (tone === '5' || tone === 'soft') {
      const freqs = [523.25, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.25, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.8);
      });
    }
    // 6. Nakit Kasa Şıngırtısı (Cash Ring)
    else if (tone === '6') {
      const freqs = [987.77, 1318.51, 1975.53];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.2, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.4);
      });
    }
    // 7. Uzay Işını (Sci-Fi Laser)
    else if (tone === '7') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.25);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }
    // 8. Ahşap Tokmak (Kalimba Vuruşu)
    else if (tone === '8') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
    // 9. Akıllı Telefon Melodisi (Trill Chime)
    else if (tone === '9') {
      const notes = [784, 880, 1046, 1318];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.18, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.35);
      });
    }
    // 10. Derin Gecikme Uyarısı (Sub Bass Drop)
    else if (tone === '10') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.45);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    }
    // 11. Bilim Kurgu Bilgisayarı (Retro Blip)
    else if (tone === '11') {
      const freqs = [1200, 2400];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.08, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.08);
      });
    }
    // 12. Oyun Jeton Sesi (Arcade Coin)
    else if (tone === '12') {
      const freqs = [987.77, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.1, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    }
    // 13. Yüksek İkaz Düdüğü (Hi-Frequency Ping)
    else if (tone === '13') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
    // 14. Metalik Gong (Ambient Gong)
    else if (tone === '14') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    }
    // 15. Çift Tıklama Uyarısı (Double Click Clack)
    else if (tone === '15') {
      [1500, 1800].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.2, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.05);
      });
    }
    // 16. Hızlı Nabız Kalp Atışı (Heartbeat Pulse)
    else if (tone === '16') {
      [90, 85].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.5, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.12);
      });
    }
    // 17. Yükselen Melodi (Rising Triad Arp)
    else if (tone === '17') {
      [523, 659, 784, 1046].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.18, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.4);
      });
    }
    // 18. Su Damlası (Water Drop Echo)
    else if (tone === '18') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(1900, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
    // 19. Uçak Kokpit Zili (Flight Ding)
    else if (tone === '19') {
      const freqs = [700, 550];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.25);
        gain.gain.setValueAtTime(0.3, now + idx * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.25 + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.25);
        osc.stop(now + idx * 0.25 + 0.7);
      });
    }
    // 20. Siber Matrix Titreşimi (Cyber Vibrato)
    else if (tone === '20') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    console.log('Ton çalınamadı:', e);
  }
}

function saveSelectedTone() {
  const sel = document.getElementById('select-alarm-tone');
  if (sel) {
    selectedAlarmTone = sel.value;
    localStorage.setItem('app_alarm_tone', selectedAlarmTone);
    showToast('💾 Uyarı tonu kaydedildi: ' + sel.options[sel.selectedIndex].text);
  }
}

function previewSelectedTone() {
  const sel = document.getElementById('select-alarm-tone');
  const tone = sel ? sel.value : selectedAlarmTone;
  playToneSound(tone);
}

function toggleWindowsPopupSetting() {
  const cb = document.getElementById('toggle-windows-popup');
  if (cb) {
    isWindowsPopupEnabled = cb.checked;
    localStorage.setItem('app_windows_popup_enabled', isWindowsPopupEnabled);
    showToast(isWindowsPopupEnabled ? '🔔 Windows sağ alt popupları AÇILDI.' : '🔕 Windows sağ alt popupları KAPATILDI.');
  }
}

function playRhythmicPulseChime() {
  playToneSound(selectedAlarmTone);
}

function startRhythmicAlarmIfCritical() {
  // Eğer kullanıcı alarmı açtıysa ve kırmızı neonlu (günü geçmiş veya < 4 gün kalmış) ödeme varsa
  const hasCritical = paymentsData.some(p => p.status !== 'paid' && p.days_remaining < 4);
  
  if (rhythmicAlarmInterval) {
    clearInterval(rhythmicAlarmInterval);
    rhythmicAlarmInterval = null;
  }

  if (isRhythmicAlarmActive && hasCritical) {
    // Kırmızı neonun animasyon döngüsü tam 2 saniyedir (2000 ms)
    playRhythmicPulseChime();
    rhythmicAlarmInterval = setInterval(() => {
      // Sekme açıksa ve kritik ödeme devam ediyorsa
      const stillCritical = paymentsData.some(p => p.status !== 'paid' && p.days_remaining < 4);
      if (stillCritical && isRhythmicAlarmActive) {
        playRhythmicPulseChime();
      } else {
        stopRhythmicAlarm();
      }
    }, 2000);
  }
}

function stopRhythmicAlarm() {
  if (rhythmicAlarmInterval) {
    clearInterval(rhythmicAlarmInterval);
    rhythmicAlarmInterval = null;
  }
}

// ==========================================
// Ritimli Zil Alarm Aç/Kapat Fonksiyonu (Global)
// ==========================================
window.toggleRhythmicAlarm = function(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  isRhythmicAlarmActive = !isRhythmicAlarmActive;
  const btn = document.getElementById('btn-toggle-alarm');

  // Ses motorunu canlandır
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch(err) {
    console.warn(err);
  }

  const bellActiveSvg = '<svg class="top-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke-width="2" stroke-linecap="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke-width="2" stroke-linecap="round"/></svg>';
  const bellMuteSvg = '<svg class="top-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke-width="2" stroke-linecap="round"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8" stroke-width="2" stroke-linecap="round"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" stroke-width="2" stroke-linecap="round"/><path d="M18 8a6 6 0 0 0-9.33-5" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke-width="2" stroke-linecap="round"/></svg>';

  if (isRhythmicAlarmActive) {
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = bellActiveSvg;
      btn.title = 'Sesli Alarm: AÇIK (Kapatmak için tıkla)';
    }
    showToast('🚨 Kırmızı neon ritimli zil alarmı AÇILDI!');
    
    // Anında seçili sesi çal
    playToneSound(selectedAlarmTone);
    startRhythmicAlarmIfCritical();
  } else {
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = bellMuteSvg;
      btn.title = 'Sesli Alarm: KAPALI (Açmak için tıkla)';
    }
    stopRhythmicAlarm();
    showToast('🔕 Sesli alarm kapatıldı.');
  }
};
var toggleRhythmicAlarm = window.toggleRhythmicAlarm;

// Gerçekçi zil / çan ses efekti (Son 3 güne giren kritik ödemeler için)
function playAlertChimeSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Klasik dijital çan / zil efekti (Harmonik zil tonları)
    const freqs = [880, 1174.66, 1760]; // A5, D6, A6
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0.25 / (idx + 1), now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.85);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.85);
    });
  } catch (e) {
    console.log('Zil sesi çalınamadı:', e);
  }
}

// ==========================================
// Web Audio API Ses Efektleri (Harici dosya gerektirmez)
// ==========================================
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Ödeme tamamlandığında çalan zafer / başarı sesi
function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // 2 tonlu ding-dong başarı melodisi (C5 -> G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // İkinci ışıltı tonu
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.50, now + 0.12); // C6
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.55);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.log('Ses çalınamadı:', e);
  }
}

// Yaklaşan kritik ödemeler için uyarı sesi (Bip-bip)
function playAlertSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    osc.frequency.setValueAtTime(440, now + 0.16);
    osc.frequency.setValueAtTime(880, now + 0.24);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.log('Ses çalınamadı:', e);
  }
}

// Frontend Application Logic for Akıllı Ödeme & Hatırlatıcı Asistanı

let currentCategory = 'all';
let currentTab = 'dashboard';
let paymentsData = [];
let analyticsData = null;
let ws = null;
let chart12Months = null;
let chartCategories = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initWebSocket();
  checkAuthStatus();
  setupEventListeners();
  setupNotificationPermission();
});

// Register Service Worker for PWA
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('PWA Service Worker Aktif'))
      .catch((err) => console.log('SW error:', err));
  }
}

// Real-Time WebSocket for Background Sync
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Canlı senkronizasyon servisi aktif.');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Canlı güncelleme alındı:', data);
        
        if (data.type === 'PAYMENT_PAID') {
          showToast(`🎉 "${data.title}" ödendi olarak güncellendi! (${data.amount} TL)`);
        } else if (data.type === 'PAYMENT_CREATED') {
          showToast(`✨ Yeni ödeme kalemi eklendi!`);
        } else if (data.type === 'PAYMENT_UPDATED') {
          showToast(`✏️ Ödeme güncellendi.`);
        } else if (data.type === 'PAYMENT_DELETED') {
          showToast(`🗑️ Ödeme kaydı silindi.`);
        }
        
        // Auto-reload data across all open devices
        loadData(false);
      } catch (e) {
        console.log('WS message parsing:', e);
      }
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
  } catch (err) {
    console.log('WebSocket bağlantı hatası:', err);
  }
}

// Fetch all payments and analytics
async function loadData(showLoading = true) {
  try {
    const [paymentsRes, analyticsRes] = await Promise.all([
      fetch('/api/payments'),
      fetch('/api/analytics')
    ]);

    if (!paymentsRes.ok || !analyticsRes.ok) {
      console.warn('API geçici olarak yanıt vermedi.');
      return;
    }

    paymentsData = await paymentsRes.json();
    analyticsData = await analyticsRes.json();

    renderStats();
    renderPayments();
    startRhythmicAlarmIfCritical();
    if (currentTab === 'analytics') {
      renderAnalyticsCharts();
    } else if (currentTab === 'history') {
      loadHistory();
    }
    checkExpiringNotifications();
  } catch (err) {
    console.error('Veri yükleme hatası:', err);
  }
}

// Render Top Stats Bar
function renderStats() {
  if (!analyticsData) return;
  const tm = analyticsData.this_month;

  const statPending = document.getElementById('stat-month-pending');
  if (statPending) statPending.textContent = formatCurrency(tm.pending);
  const statPaid = document.getElementById('stat-month-paid');
  if (statPaid) statPaid.textContent = formatCurrency(tm.paid);
  const statTotal = document.getElementById('stat-month-total');
  if (statTotal) statTotal.textContent = formatCurrency(tm.total_due);
  const statAnnual = document.getElementById('stat-annual-proj');
  if (statAnnual) statAnnual.textContent = formatCurrency(analyticsData.annual_projected_total);

  // Mobil ekranlar için ultra kompakt stat bar güncellemesi
  const mobPending = document.getElementById('mob-stat-pending');
  if (mobPending) mobPending.textContent = formatCurrency(tm.pending);
  const mobPaid = document.getElementById('mob-stat-paid');
  if (mobPaid) mobPaid.textContent = formatCurrency(tm.paid);
  const mobTotal = document.getElementById('mob-stat-total');
  if (mobTotal) mobTotal.textContent = formatCurrency(tm.total_due);

  if (analyticsData.weekly_cashflow) {
    renderWeeklyCashflow(analyticsData.weekly_cashflow);
  }
  renderHomeEvSavings();
}

// Filter and render payment cards
function renderPayments() {
  const container = document.getElementById('payments-container');
  if (!container) return;

  let filtered = paymentsData;

  // Eğer 'Tümü' (Ana Ekran) seçiliyse:
  // 1. Ödenmişler ASLA görünmez.
  // 2. Sadece süresi geçenler (days_remaining < 0) ve son 7 günü kalanlar (days_remaining <= 7) görünür.
  if (currentCategory === 'all') {
    filtered = filtered.filter(p => p.status !== 'paid' && p.days_remaining <= 7);
  } else {
    // Özel bir kategoriye (Faturalar, Abonelikler vb.) tıklandığında hem ödenenler hem tüm bekleyenler listelenir.
    filtered = filtered.filter(p => p.category === currentCategory);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎉</div>
        <h3>Acil veya yaklaşan ödeme bulunmuyor!</h3>
        <p style="margin-top: 8px;">Önümüzdeki 7 gün içinde vadesi gelen veya gecikmiş borcunuz yok. Harika gidiyorsunuz! 🎉</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => createPaymentCardHtml(item)).join('');
}



function getLogoUrlForTitle(title, category) {
  const t = (title || '').toLowerCase();
  const logos = {
    'kia': 'kia.png', 'xbox': 'xbox.png', 'tüvtürk': 'tuvturk.png', 'tuvturk': 'tuvturk.png',
    'izgaz': 'izgaz.png', 'isu': 'isu.png', 'iski': 'isu.png', 'iski': 'isu.png', 'su faturası': 'isu.png',
    'sedaş': 'sedas.png', 'sedas': 'sedas.png', 'elektrik': 'sedas.png',
    'netflix': 'netflix.png', 'şekerbank': 'sekerbank.png', 'sekerbank': 'sekerbank.png',
    'opet': 'opet.png', 'world': 'worldcard.png', 'hepsiburada': 'hepsiburada.png',
    'yapı kredi': 'yapikredi.png', 'yapıkredi': 'yapikredi.png', 'akbank': 'akbank.png'
  };
  
  for (const key in logos) {
    if (t.includes(key)) {
      return `/logos/${logos[key]}`;
    }
  }
  return '/logos/isu.png';
}

function getLogoForTitle(title, category, fallbackIcon) {
  const url = getLogoUrlForTitle(title, category);
  return `<img src="${url}" style="width:28px; height:28px; border-radius:6px; object-fit:contain; vertical-align:middle; background: white; padding: 2px;" onerror="this.outerHTML='${fallbackIcon}'">`;
}

function createPaymentCardHtml(item) {

  const categoryIcons = {
    fatura: '⚡',
    abonelik: '📺',
    kredi_karti: '💳',
    arac: '🚗',
    vergi: '🏛️',
    diger: '📁'
  };

  const categoryNames = {
    fatura: 'Fatura',
    abonelik: 'Abonelik',
    kredi_karti: 'Kredi Kartı',
    arac: 'Araç & Garaj',
    vergi: 'Vergi / Harç',
    diger: 'Diğer'
  };

  // Urgency badge calculation
  let badgeHtml = '';
  let cardClass = item.urgency;
  // 3 Kademeli Neon Işık Mantığı:
  if (item.status === 'paid') {
    cardClass += ' card-completed';
  } else {
    // 4 günün altına düşenler (<= 3 gün veya günü geçmişler): KIRMIZI NEON
    if (item.days_remaining < 4) {
      cardClass += ' neon-red';
    } 
    // Son 4 ile 7 gün arasında olanlar: SARI NEON
    else if (item.days_remaining <= 7) {
      cardClass += ' neon-yellow';
    } 
    // Zamanı olanlar (> 7 gün): MAVİ NEON
    else {
      cardClass += ' neon-blue';
    }
  }

  if (item.status === 'paid') {
    badgeHtml = `<span class="urgency-badge badge-paid">✓ Ödendi</span>`;
  } else if (item.days_remaining < 0) {
    badgeHtml = `<span class="urgency-badge badge-overdue">⚠️ ${Math.abs(item.days_remaining)} gün gecikti!</span>`;
  } else if (item.days_remaining === 0) {
    badgeHtml = `<span class="urgency-badge badge-critical">🚨 Bugün son gün!</span>`;
  } else if (item.days_remaining <= 3) {
    badgeHtml = `<span class="urgency-badge badge-critical">⏳ ${item.days_remaining} gün kaldı</span>`;
  } else if (item.days_remaining <= 7) {
    badgeHtml = `<span class="urgency-badge badge-soon">📅 ${item.days_remaining} gün kaldı</span>`;
  } else {
    badgeHtml = `<span class="urgency-badge badge-normal">${item.days_remaining} gün var</span>`;
  }

  // Recurrence label
  const repeatLabels = {
    none: 'Tek Seferlik',
    monthly: 'Aylık Yinelenen',
    yearly: 'Yıllık Yinelenen',
    '2_yearly': '2 Yılda Bir (Muayene)',
    '6_monthly': '6 Aylık Döngü'
  };

  // Vehicle specific metadata display
  let vehicleMetaHtml = '';
  if (item.category === 'arac') {
    const plate = item.vehicle_plate ? `🚗 Plaka: <strong>${item.vehicle_plate}</strong>` : '';
    const km = item.vehicle_km ? `📍 Km: <strong>${item.vehicle_km.toLocaleString('tr-TR')} km</strong>` : '';
    if (plate || km) {
      vehicleMetaHtml = `<div class="vehicle-meta">${plate} ${km}</div>`;
    }
  }

  // Format date display (e.g., 29 Eylül 2026)
  const dateFormatted = formatDateTr(item.due_date);

  return `
    <div class="payment-card ${cardClass}" id="payment-card-${item.id}">
      <div class="card-top">
        <div class="card-info">
          <div class="card-category-icon">${getLogoForTitle(item.title, item.category, categoryIcons[item.category] || '💰')}</div>
          <div>
            <div class="card-title">${escapeHtml(item.title)}</div>
            <div class="card-subtitle">${categoryNames[item.category] || 'Ödeme'} ${item.notes ? '• ' + escapeHtml(item.notes) : ''}</div>
          </div>
        </div>
        ${badgeHtml}
      </div>

      ${vehicleMetaHtml}

      <div class="card-mid">
        <div class="card-amount-box">
          <span class="amount-label">Ödenecek Tutar</span>
          <span class="card-amount">${formatCurrency(item.amount)}</span>
        </div>
        <div class="card-dates">
          <span class="amount-label">Son Ödeme</span>
          <div class="due-date">${dateFormatted}</div>
          <span class="repeat-badge">${repeatLabels[item.repeat_type] || ''}</span>
        </div>
      </div>

      <div class="card-bottom">
        <button class="btn-pay" onclick="markPaid(${item.id}, '${escapeHtml(item.title)}', ${item.amount})">
          <span>✓</span>
          <span>Ödendi</span>
        </button>
        <button class="btn-action-icon" onclick="openEditModal(${item.id})" title="Düzenle">
          ✏️
        </button>
        <button class="btn-action-icon" onclick="deletePayment(${item.id}, '${escapeHtml(item.title)}')" title="Sil">
          🗑️
        </button>
      </div>
    </div>
  `;
}

// Mark payment as Paid
async function markPaid(id, title, amount) {
  try {
    const cardEl = document.getElementById(`payment-card-${id}`);
    if (cardEl) {
      // Anında mavi neon ışığı yak
      cardEl.classList.remove('neon-critical', 'neon-warning');
      cardEl.classList.add('neon-paid');
    }
    
    playSuccessSound();

    const res = await fetch(`/api/payments/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid_amount: amount, receipt_note: 'Kullanıcı onayı ile ödendi' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`🎉 ${data.message}`);
      
      // Eğer ana ekrandaysak (all), mavi neon yandıktan 600ms sonra yumuşakça kaybolsun
      if (currentCategory === 'all' && cardEl) {
        setTimeout(() => {
          cardEl.style.transition = 'all 0.5s ease';
          cardEl.style.opacity = '0';
          cardEl.style.transform = 'scale(0.95)';
          setTimeout(() => loadData(false), 500);
        }, 600);
      } else {
        loadData(false);
      }
    }
  } catch (err) {
    showToast('⚠️ Ödeme kaydedilemedi.');
  }
}

// Delete payment
async function deletePayment(id, title) {
  if (!confirm(`"${title}" kaydını silmek istediğinize emin misiniz?`)) return;
  try {
    const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`🗑️ "${title}" silindi.`);
      loadData(false);
    }
  } catch (err) {
    showToast('⚠️ Silme işleminde hata oluştu.');
  }
}

// Save or Update Payment (Modal submit)
async function handlePaymentFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('form-item-id').value;
  const payload = {
    title: document.getElementById('form-title').value.trim(),
    category: document.getElementById('form-category').value,
    sub_type: document.getElementById('form-subtype').value.trim() || null,
    amount: parseFloat(document.getElementById('form-amount').value),
    due_date: document.getElementById('form-due-date').value,
    repeat_type: document.getElementById('form-repeat').value,
    vehicle_plate: document.getElementById('form-plate').value.trim() || null,
    vehicle_km: parseInt(document.getElementById('form-km').value) || null,
    notes: document.getElementById('form-notes').value.trim() || null
  };

  if (!payload.title || isNaN(payload.amount) || !payload.due_date) {
    alert('Lütfen başlık, tutar ve son ödeme tarihini eksiksiz doldurunuz.');
    return;
  }

  try {
    let url = '/api/payments';
    let method = 'POST';
    if (id) {
      url = `/api/payments/${id}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closeModal('modal-add-payment');
      showToast(id ? '✏️ Ödeme güncellendi.' : '✨ Yeni ödeme başarıyla eklendi!');
      loadData(false);
    }
  } catch (err) {
    showToast('⚠️ Kayıt kaydedilirken hata oluştu.');
  }
}

// Open modal for new payment
function openAddModal() {
  document.getElementById('payment-form').reset();
  document.getElementById('form-item-id').value = '';
  document.getElementById('modal-payment-title').textContent = '➕ Yeni Ödeme & Hatırlatıcı Ekle';
  
  // Default due date: today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('form-due-date').value = today;
  
  toggleVehicleFields();
  openModal('modal-add-payment');
}

// Open modal for editing
function openEditModal(id) {
  const item = paymentsData.find(p => p.id === id);
  if (!item) return;

  document.getElementById('form-item-id').value = item.id;
  document.getElementById('modal-payment-title').textContent = '✏️ Ödemeyi Düzenle';
  document.getElementById('form-title').value = item.title;
  document.getElementById('form-category').value = item.category;
  document.getElementById('form-subtype').value = item.sub_type || '';
  document.getElementById('form-amount').value = item.amount;
  document.getElementById('form-due-date').value = item.due_date;
  document.getElementById('form-repeat').value = item.repeat_type || 'none';
  document.getElementById('form-plate').value = item.vehicle_plate || '';
  document.getElementById('form-km').value = item.vehicle_km || '';
  document.getElementById('form-notes').value = item.notes || '';

  toggleVehicleFields();
  openModal('modal-add-payment');
}

// Toggle vehicle fields based on category
function toggleVehicleFields() {
  const cat = document.getElementById('form-category').value;
  const vBox = document.getElementById('vehicle-extra-fields');
  if (cat === 'arac') {
    vBox.style.display = 'grid';
  } else {
    vBox.style.display = 'none';
  }
}

// Render Analytics Tab & Charts
function renderAnalyticsCharts() {
  if (!analyticsData) return;

  document.getElementById('proj-monthly-subs').textContent = formatCurrency(analyticsData.monthly_subscriptions_total);
  document.getElementById('proj-annual-subs').textContent = formatCurrency(analyticsData.annual_subscriptions_total);
  document.getElementById('proj-annual-vehicle').textContent = formatCurrency(analyticsData.annual_vehicle_total);
  document.getElementById('proj-annual-all').textContent = formatCurrency(analyticsData.annual_projected_total);

  // 1. Chart: 12-Month Projection Forecast
  const ctx12 = document.getElementById('chart-12-months');
  if (ctx12) {
    const labels = analyticsData.forecast_12_months.map(m => m.month);
    const dataVals = analyticsData.forecast_12_months.map(m => m.amount);

    if (chart12Months) chart12Months.destroy();

    chart12Months = new Chart(ctx12, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tahmini Harcama (TL)',
          data: dataVals,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  // 2. Chart: Category Distribution
  const ctxCat = document.getElementById('chart-categories');
  if (ctxCat) {
    const cats = analyticsData.category_totals;
    const catLabels = ['Faturalar', 'Abonelikler', 'Kredi Kartı', 'Araç & Garaj', 'Vergiler'];
    const catVals = [cats.fatura || 0, cats.abonelik || 0, cats.kredi_karti || 0, cats.arac || 0, cats.vergi || 0];

    if (chartCategories) chartCategories.destroy();

    chartCategories = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catVals,
          backgroundColor: [
            '#3b82f6', // blue
            '#8b5cf6', // purple
            '#ec4899', // pink
            '#f59e0b', // amber
            '#10b981'  // emerald
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', boxWidth: 12, padding: 12 }
          }
        }
      }
    });
  }
}

// Load and Render Payment History
async function loadHistory() {
  const container = document.getElementById('history-tbody');
  if (!container) return;

  try {
    const res = await fetch('/api/history');
    const history = await res.json();

    if (history.length === 0) {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px;">Henüz ödenmiş bir kayıt geçmişi bulunmuyor.</td></tr>`;
      return;
    }

    container.innerHTML = history.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.title)}</strong></td>
        <td><span class="urgency-badge badge-normal">${item.category}</span></td>
        <td><strong style="color:#34d399;">${formatCurrency(item.paid_amount)}</strong></td>
        <td>${formatDateTr(item.paid_date)}</td>
        <td style="color:#94a3b8;font-size:0.78rem;">${escapeHtml(item.receipt_note || 'Ödendi')}</td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;">Geçmiş yüklenemedi.</td></tr>`;
  }
}

// Request & trigger browser notifications
function setupNotificationPermission() {
  const btn = document.getElementById('btn-enable-notifications');
  if (!('Notification' in window)) {
    if (btn) btn.style.display = 'none';
    return;
  }
  if (Notification.permission === 'granted') {
    if (btn) btn.style.display = 'none';
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Tarayıcınız bildirim özelliğini desteklemiyor.');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('🔔 Bildirimler başarıyla açıldı!');
    document.getElementById('btn-enable-notifications').style.display = 'none';
    checkExpiringNotifications(true);
  }
}

// 10 Dakikada bir periyodik kontrol ve sağ alttan masaüstü popup uyarısı
let lastNotificationTime = 0;

function checkExpiringNotifications(forceAlert = false) {
  const urgentItems = paymentsData.filter(p => p.status !== 'paid' && p.days_remaining < 4);
  
  if (urgentItems.length === 0) return;

  const now = Date.now();
  // 10 dakika (600.000 ms) kontrolü veya ilk tetikleme
  const shouldNotify = forceAlert || (now - lastNotificationTime >= 10 * 60 * 1000);

  if (shouldNotify) {
    lastNotificationTime = now;
    
    // Sesli zil uyarısını çal
    playToneSound(selectedAlarmTone);

    // Tarayıcı içi toast bildirimi göster
    const first = urgentItems[0];
    const remText = first.days_remaining <= 0 ? 'Süresi Doldu / Bugün Son Gün!' : `${first.days_remaining} Gün Kaldı!`;
    showToast(`🔔 DİKKAT: ${first.title} (${first.amount} TL) için ${remText}`);

    // Bilgisayarın sağ alt köşesinden işletim sistemi popup bildirimi
    if (isWindowsPopupEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notifIcon = getLogoUrlForTitle(first.title, first.category);
        const notif = new Notification('🚨 Acil Ödeme Hatırlatması!', {
          body: `${first.title}: ${first.amount} TL (${remText})\nToplam ${urgentItems.length} ödeme kritik eşikte!`,
          icon: notifIcon,
          requireInteraction: false
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.log('Bildirim gösterilemedi:', err);
      }
    }

    // 1 Ay Kala Garanti Bitiş Uyarısı Kontrolü (<= 30 gün)
    try {
      fetch('/api/contracts').then(r => r.json()).then(contracts => {
        const urgentWarranties = contracts.filter(c => c.days_remaining >= 0 && c.days_remaining <= 30);
        if (urgentWarranties.length > 0) {
          const w = urgentWarranties[0];
          const wText = w.days_remaining === 0 ? 'Bugün Son Gün!' : `${w.days_remaining} Gün Kaldı!`;
          showToast(`🛡️ GARANTİ BİTİYOR: "${w.title}" için ${wText}`);
          if (isWindowsPopupEnabled && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('🛡️ Garanti Bitiş Uyarısı (Son 1 Ay)!', {
                body: `${w.title} garantisinin bitmesine ${wText}\nArıza veya bakım için yetkili servise hemen başvurun.`,
                icon: '/static/favicon.ico'
              });
            } catch(e) {}
          }
        }
      }).catch(() => {});
    } catch(err) {}
  }
}

// 10 dakikada bir otomatik periyodik kontrol döngüsü
setInterval(() => {
  checkExpiringNotifications(false);
}, 60 * 1000); // Her dakika kontrol eder, 10 dakika dolunca uyarır


// Android Haptic Vibration Helper
function playHaptic(duration = 14) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(duration); } catch(e) {}
  }
}

// Navigation Tab Switcher
function switchTab(tabName) {
  playHaptic(12);
  currentTab = tabName;

  document.querySelectorAll('.bnav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });

  // Üst istatistik kartları ve mobil stat bar sadece Ana Ekranda (Dashboard) görünsün
  const secStats = document.querySelector('.stats-grid');
  if (secStats) {
    secStats.classList.toggle('hidden-tab', tabName !== 'dashboard');
    secStats.style.display = (tabName === 'dashboard') ? '' : 'none';
  }
  const mobStats = document.querySelector('.mobile-stat-bar');
  if (mobStats) {
    mobStats.classList.toggle('hidden-tab', tabName !== 'dashboard');
  }

  document.getElementById('section-dashboard').style.display = (tabName === 'dashboard') ? 'block' : 'none';
  
  const secGarage = document.getElementById('section-garage');
  if (secGarage) secGarage.style.display = (tabName === 'garage') ? 'block' : 'none';

  const secContracts = document.getElementById('section-contracts');
  if (secContracts) secContracts.style.display = (tabName === 'contracts') ? 'block' : 'none';

  const secTasks = document.getElementById('section-tasks');
  if (secTasks) secTasks.style.display = (tabName === 'tasks') ? 'block' : 'none';
  
  document.getElementById('section-analytics').classList.toggle('active', tabName === 'analytics');
  document.getElementById('section-history').classList.toggle('active', tabName === 'history');
  
  const secSettings = document.getElementById('section-settings');
  if (secSettings) secSettings.style.display = (tabName === 'settings') ? 'block' : 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabName === 'garage') {
    loadVehicleData();
    loadEvCharges();
  } else if (tabName === 'contracts') {
    loadContracts();
  } else if (tabName === 'tasks') {
    loadTasks();
  } else if (tabName === 'dashboard') {
    filterCategory('all');
  } else if (tabName === 'analytics') {
    renderAnalyticsCharts();
  } else if (tabName === 'history') {
    loadHistory();
  } else if (tabName === 'settings') {
    loadBackupSettings();
    loadBackupList();
    setTimeout(() => {
      const pInput = document.getElementById('admin-pass');
      const authBox = document.getElementById('settings-auth-box');
      if (pInput && (!authBox || authBox.style.display !== 'none')) {
        pInput.focus();
      }
    }, 150);
  }
}

// Category filter
function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === cat);
  });
  renderPayments();
    startRhythmicAlarmIfCritical();
}

// Modal Helpers
function openModal(id) {
  playHaptic(16);
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  playHaptic(10);
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// Toast Alert
function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>🔔</span> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById('payment-form').addEventListener('submit', handlePaymentFormSubmit);
  const alarmBtn = document.getElementById('btn-toggle-alarm');
  if (alarmBtn) {
    alarmBtn.onclick = toggleRhythmicAlarm;
  }
  if (document.getElementById('vehicleForm')) {
    document.getElementById('vehicleForm').addEventListener('submit', handleVehicleFormSubmit);
  }
  document.getElementById('form-category').addEventListener('change', toggleVehicleFields);

  // Close modals on background click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

// Formatters
function formatCurrency(val) {
  if (val === undefined || val === null) return '0 ₺';
  return Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

function formatDateTr(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}



// ==========================================
// Araç Profili Yönetimi & İkili Bakım Kuralı (Tarih / KM)
let currentVehicleId = null;
let garageVehiclesList = [];

function openAddVehicleModal() {
  const modal = document.getElementById('modal-vehicle');
  if (!modal) return;
  const titleEl = document.getElementById('modal-vehicle-title');
  if (titleEl) titleEl.textContent = '➕ Yeni Araç Ekle';
  const idInput = document.getElementById('v-id');
  if (idInput) idInput.value = '';
  const form = document.getElementById('vehicleForm');
  if (form) form.reset();
  modal.classList.add('active');
}

function openEditCurrentVehicleModal() {
  const modal = document.getElementById('modal-vehicle');
  if (!modal) return;
  const titleEl = document.getElementById('modal-vehicle-title');
  if (titleEl) titleEl.textContent = '✏️ Araç Bilgilerini Düzenle';
  const idInput = document.getElementById('v-id');
  if (idInput) idInput.value = currentVehicleId || '';
  modal.classList.add('active');
}

function openVehicleModal() {
  openEditCurrentVehicleModal();
}

async function switchActiveVehicle(vId) {
  currentVehicleId = vId;
  await loadVehicleData();
}

async function deleteCurrentVehicle() {
  if (!currentVehicleId) return;
  if (!confirm('Bu aracı garajdan silmek istediğinize emin misiniz?')) return;
  try {
    const res = await fetch(`/api/vehicle/${currentVehicleId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('🗑️ Araç garajdan kaldırıldı.');
      currentVehicleId = null;
      await loadVehicleData();
    } else {
      showToast('❌ Araç silinemedi.');
    }
  } catch(e) {
    showToast('❌ Bağlantı hatası.');
  }
}

async function loadVehicleData() {
  try {
    // 1. Çoklu araç listesini çek
    const listRes = await fetch('/api/vehicles');
    if (listRes.ok) {
      garageVehiclesList = await listRes.json();
    }

    // 2. Aktif aracı belirle
    let targetVehicle = null;
    if (currentVehicleId) {
      targetVehicle = garageVehiclesList.find(v => v.id === currentVehicleId);
    }
    if (!targetVehicle && garageVehiclesList.length > 0) {
      targetVehicle = garageVehiclesList[0];
      currentVehicleId = targetVehicle.id;
    }

    // 3. Garaj Araç Sekmelerini Render Et
    const tabsContainer = document.getElementById('garage-vehicle-tabs');
    if (tabsContainer && garageVehiclesList.length > 0) {
      tabsContainer.innerHTML = garageVehiclesList.map(v => {
        const isActive = v.id === currentVehicleId;
        return `
          <button onclick="switchActiveVehicle(${v.id})" class="tab-btn ${isActive ? 'active' : ''}">
            <svg class="tab-btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="7" cy="17" r="2" stroke-width="2"/>
              <path d="M9 17h6" stroke-width="2"/>
              <circle cx="17" cy="17" r="2" stroke-width="2"/>
            </svg>
            <span>${escapeHtml(v.brand_model || 'Araç')}</span>
            <small style="opacity: 0.85; font-size: 0.72rem; letter-spacing: 0.5px;">(${escapeHtml(v.plate || '--')})</small>
          </button>
        `;
      }).join('');
    }

    // Silme butonunun görünürlüğü
    const delBtn = document.getElementById('btn-delete-veh');
    if (delBtn) {
      delBtn.style.display = (garageVehiclesList.length > 1) ? 'inline-block' : 'none';
    }

    const data = targetVehicle;
    if (data && data.id) {
      const vehTitle = document.getElementById('veh-title');
      const vehPlate = document.getElementById('veh-plate');
      if (vehTitle) vehTitle.textContent = (data.brand_model || 'Araç') + (data.year ? ` (${data.year})` : '');
      if (vehPlate) vehPlate.textContent = data.plate || '--';
      
      let minRemainingDays = 9999;

      const formatD = (d) => {
        if (!d) return 'Belirtilmedi';
        const parts = d.split('-');
        const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const today = new Date();
        today.setHours(0,0,0,0);
        targetDate.setHours(0,0,0,0);
        const diff = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
        
        if (diff < minRemainingDays) {
          minRemainingDays = diff;
        }

        let color = '#34d399';
        let text = `${diff} Gün Kaldı`;
        if (diff < 0) {
          color = '#ef4444';
          text = `${Math.abs(diff)} Gün Geçti!`;
        } else if (diff === 0) {
          color = '#ef4444';
          text = 'Bugün Son Gün!';
        } else if (diff <= 7) {
          color = '#ef4444';
        } else if (diff <= 30) {
          color = '#f59e0b';
        }
        return `<span style="color:${color}; font-weight:600;">${formatDateTr(d)}<br><small style="font-size:0.75rem; opacity:0.9;">${text}</small></span>`;
      };
      
      const elTrafik = document.getElementById('veh-trafik');
      const elKasko = document.getElementById('veh-kasko');
      const elTuv = document.getElementById('veh-tuv');
      const elBakim = document.getElementById('veh-bakim');
      
      if (elTrafik) elTrafik.innerHTML = formatD(data.insurance_date);
      if (elKasko) elKasko.innerHTML = formatD(data.kasko_date);
      if (elTuv) elTuv.innerHTML = formatD(data.tuvturk_date);

      // --- Araba Resmi Neon Işığı: Son 7 Güne Girdiyse KIRMIZI, Değilse YAVAŞ MAVİ NEON ---
      const carImg = document.getElementById('veh-img');
      if (carImg) {
        if (minRemainingDays <= 7) {
          carImg.className = 'neon-car-red';
          carImg.title = '🚨 DİKKAT: Muayene, Kasko veya Trafik Sigortası son 7 gün içine girdi!';
        } else {
          carImg.className = 'neon-car-blue';
          carImg.title = '✨ Tüm evraklar ve vadeler güvende.';
        }
      }

      // --- İkili Bakım Kuralı Hesaplama (Yıl vs KM: Hangisi önce gelirse) ---
      const curKm = data.current_km || 0;
      const lastKm = data.last_maintenance_km || 0;
      const intervalKm = data.interval_km || 30000;
      const intervalYear = data.interval_year || 2;
      const lastDateStr = data.last_maintenance_date;

      const elCurKmBadge = document.getElementById('veh-current-km-badge');
      if (elCurKmBadge) elCurKmBadge.textContent = curKm ? `${Number(curKm).toLocaleString('tr-TR')} km` : 'Belirtilmedi';

      let nextKmTarget = 0;
      if (lastKm > 0) {
        nextKmTarget = lastKm + intervalKm;
      } else if (curKm > 0) {
        // Katlarına yuvarla
        nextKmTarget = Math.ceil((curKm + 1) / intervalKm) * intervalKm;
      }

      let kmDiff = nextKmTarget ? (nextKmTarget - curKm) : null;

      // Tarih hesaplama
      let nextMaintenanceDateStr = null;
      let dateDiff = null;
      if (lastDateStr) {
        const p = lastDateStr.split('-');
        const lastD = new Date(p[0], p[1] - 1, p[2]);
        lastD.setFullYear(lastD.getFullYear() + intervalYear);
        nextMaintenanceDateStr = `${lastD.getFullYear()}-${String(lastD.getMonth() + 1).padStart(2, '0')}-${String(lastD.getDate()).padStart(2, '0')}`;
        
        const today = new Date();
        today.setHours(0,0,0,0);
        lastD.setHours(0,0,0,0);
        dateDiff = Math.round((lastD - today) / (1000 * 60 * 60 * 24));
      }

      // Hangisi önce gelirse belirleme
      let summaryHtml = '';

      if (!nextKmTarget && !nextMaintenanceDateStr) {
        if (elBakim) elBakim.innerHTML = 'Belirtilmedi';
        summaryHtml = 'Bakım takip bilgileri henüz kaydedilmedi.';
      } else {
        let isKmCritical = kmDiff !== null && kmDiff <= 1500;
        let isDateCritical = dateDiff !== null && dateDiff <= 30;

        let bakimColor = (isKmCritical || isDateCritical) ? '#ef4444' : '#34d399';
        
        let triggerReason = '';
        if (kmDiff !== null && dateDiff !== null) {
          if (kmDiff <= 0) {
            triggerReason = `⚠️ ${Math.abs(kmDiff).toLocaleString('tr-TR')} KM aşıldı!`;
            bakimColor = '#ef4444';
          } else if (dateDiff <= 0) {
            triggerReason = `⚠️ Süresi ${Math.abs(dateDiff)} gün geçti!`;
            bakimColor = '#ef4444';
          } else {
            triggerReason = `🎯 Hedef: ${Number(nextKmTarget).toLocaleString('tr-TR')} KM veya ${formatDateTr(nextMaintenanceDateStr)}`;
          }
        } else if (nextKmTarget) {
          triggerReason = `🎯 Hedef: ${Number(nextKmTarget).toLocaleString('tr-TR')} KM (${kmDiff <= 0 ? 'KM Doldu!' : kmDiff.toLocaleString('tr-TR') + ' KM kaldı'})`;
        } else if (nextMaintenanceDateStr) {
          triggerReason = `🎯 Hedef: ${formatDateTr(nextMaintenanceDateStr)} (${dateDiff <= 0 ? 'Süre Doldu!' : dateDiff + ' gün kaldı'})`;
        }

        if (elBakim) {
          elBakim.innerHTML = `<span style="color:${bakimColor}; font-weight:700;">${nextKmTarget ? nextKmTarget.toLocaleString('tr-TR') + ' KM' : ''} ${nextMaintenanceDateStr ? ' / ' + formatDateTr(nextMaintenanceDateStr) : ''}</span><br><small style="color:${bakimColor};">${triggerReason}</small>`;
        }

        summaryHtml = `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:4px;">
            <div><strong>Hedef Bakım KM:</strong> ${nextKmTarget ? Number(nextKmTarget).toLocaleString('tr-TR') + ' km' : '-'} ${kmDiff !== null ? `(${kmDiff > 0 ? kmDiff.toLocaleString('tr-TR') + ' km kaldı' : 'Aşıldı!'})` : ''}</div>
            <div><strong>Hedef Bakım Yılı:</strong> ${nextMaintenanceDateStr ? formatDateTr(nextMaintenanceDateStr) : '-'} ${dateDiff !== null ? `(${dateDiff > 0 ? dateDiff + ' gün kaldı' : 'Süre doldu!'})` : ''}</div>
          </div>
          <div style="margin-top:6px; color:#94a3b8; font-size:0.75rem;">
            📌 <em>Kural: ${intervalYear} Yıl veya ${intervalKm.toLocaleString('tr-TR')} KM aralığı (Hangisi önce dolarsa).</em>
          </div>
        `;
      }

      const elDetay = document.getElementById('veh-bakim-detay');
      if (elDetay) elDetay.innerHTML = summaryHtml;
      
      // Form alanlarını doldur
      const idField = document.getElementById('v-id');
      if (idField) idField.value = data.id || '';
      if (document.getElementById('v-plate')) document.getElementById('v-plate').value = data.plate || '';
      if (document.getElementById('v-brand')) document.getElementById('v-brand').value = data.brand_model || '';
      if (document.getElementById('v-year')) document.getElementById('v-year').value = data.year || '';
      if (document.getElementById('v-current-km')) document.getElementById('v-current-km').value = data.current_km || '';
      if (document.getElementById('v-last-km')) document.getElementById('v-last-km').value = data.last_maintenance_km || '';
      if (document.getElementById('v-last-date')) document.getElementById('v-last-date').value = data.last_maintenance_date || '';
      if (document.getElementById('v-interval-km')) document.getElementById('v-interval-km').value = data.interval_km || 30000;
      if (document.getElementById('v-interval-year')) document.getElementById('v-interval-year').value = data.interval_year || 2;
      if (document.getElementById('v-trafik')) document.getElementById('v-trafik').value = data.insurance_date || '';
      if (document.getElementById('v-kasko')) document.getElementById('v-kasko').value = data.kasko_date || '';
      if (document.getElementById('v-tuv')) document.getElementById('v-tuv').value = data.tuvturk_date || '';
    }
  } catch (err) {
    console.error('Araç verisi yüklenirken hata:', err);
  }
}

async function handleVehicleFormSubmit(e) {
  e.preventDefault();
  const idVal = document.getElementById('v-id') ? document.getElementById('v-id').value : '';
  const payload = {
    id: idVal ? parseInt(idVal) : null,
    plate: document.getElementById('v-plate') ? document.getElementById('v-plate').value : '',
    brand_model: document.getElementById('v-brand') ? document.getElementById('v-brand').value : '',
    year: document.getElementById('v-year') && document.getElementById('v-year').value ? parseInt(document.getElementById('v-year').value) : null,
    current_km: document.getElementById('v-current-km') && document.getElementById('v-current-km').value ? parseInt(document.getElementById('v-current-km').value) : null,
    last_maintenance_km: document.getElementById('v-last-km') && document.getElementById('v-last-km').value ? parseInt(document.getElementById('v-last-km').value) : null,
    last_maintenance_date: document.getElementById('v-last-date') ? document.getElementById('v-last-date').value : null,
    interval_km: document.getElementById('v-interval-km') && document.getElementById('v-interval-km').value ? parseInt(document.getElementById('v-interval-km').value) : 30000,
    interval_year: document.getElementById('v-interval-year') && document.getElementById('v-interval-year').value ? parseInt(document.getElementById('v-interval-year').value) : 2,
    insurance_date: document.getElementById('v-trafik') ? document.getElementById('v-trafik').value : null,
    kasko_date: document.getElementById('v-kasko') ? document.getElementById('v-kasko').value : null,
    tuvturk_date: document.getElementById('v-tuv') ? document.getElementById('v-tuv').value : null
  };

  try {
    const res = await fetch('/api/vehicle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const savedData = await res.json();
      if (savedData && savedData.id) {
        currentVehicleId = savedData.id;
      }
      closeModal('modal-vehicle');
      await loadVehicleData();
      showToast('✅ Araç bilgileri başarıyla kaydedildi!');
    } else {
      showToast('❌ Kaydedilirken bir hata oluştu.');
    }
  } catch (err) {
    showToast('❌ Sunucuya ulaşılamadı.');
  }
}

// ==========================================
// Yönetici Paneli & Ayarlar Fonksiyonları
// ==========================================
let currentAdminPass = '';

async function verifyAdminPass() {
  const pass = document.getElementById('admin-pass').value;
  if (!pass) {
    showToast('⚠️ Lütfen parolayı girin.');
    return;
  }
  
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    
    if (res.ok) {
      currentAdminPass = pass;
      document.getElementById('settings-auth-box').style.display = 'none';
      document.getElementById('settings-panel').style.display = 'block';
      const sel = document.getElementById('select-alarm-tone');
      if (sel) sel.value = selectedAlarmTone;
      const popSwitch = document.getElementById('toggle-windows-popup');
      if (popSwitch) popSwitch.checked = isWindowsPopupEnabled;
      showToast('🔓 Yönetici girişi başarılı.');
    } else {
      showToast('❌ Hatalı yönetici parolası!');
    }
  } catch (e) {
    showToast('❌ Bağlantı hatası.');
  }
}

// Enter tuşu ile yönetici girişi dinleyicisi
document.addEventListener('DOMContentLoaded', () => {
  const adminInput = document.getElementById('admin-pass');
  if (adminInput) {
    adminInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyAdminPass();
      }
    });
  }
});

async function adminChangePassword() {
  const newPass = document.getElementById('admin-new-pass').value;
  const confirmPass = document.getElementById('admin-new-pass-confirm').value;

  if (!newPass || newPass.trim().length < 3) {
    showToast('⚠️ Yeni parola en az 3 karakter olmalıdır.');
    return;
  }
  if (newPass !== confirmPass) {
    showToast('❌ Yeni parolalar birbiriyle eşleşmiyor!');
    return;
  }

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        old_password: currentAdminPass,
        new_password: newPass
      })
    });
    const data = await res.json();
    if (res.ok) {
      currentAdminPass = newPass;
      document.getElementById('admin-new-pass').value = '';
      document.getElementById('admin-new-pass-confirm').value = '';
      showToast('✅ ' + data.message);
    } else {
      showToast('❌ ' + (data.detail || 'Parola değiştirilemedi.'));
    }
  } catch (e) {
    showToast('❌ Bağlantı hatası oluştu.');
  }
}

async function adminClearHistory() {
  if (!confirm('Tüm geçmiş ödeme kayıtları silinecek. Emin misiniz?')) return;
  try {
    const res = await fetch('/api/admin/clear-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: currentAdminPass })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✅ ' + data.message);
      loadData(false);
    } else {
      showToast('❌ ' + (data.detail || 'İşlem başarısız'));
    }
  } catch (e) {
    showToast('❌ Bağlantı hatası oluştu.');
  }
}

async function adminResetFactory() {
  const answer = prompt('TÜM VERİTABANI SIFIRLANACAK! İşlemi onaylamak için "SIFIRLA" yazın:');
  if (answer !== 'SIFIRLA') {
    showToast('İşlem iptal edildi.');
    return;
  }
  try {
    const res = await fetch('/api/admin/reset-factory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: currentAdminPass })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('🚨 ' + data.message);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast('❌ ' + (data.detail || 'İşlem başarısız'));
    }
  } catch (e) {
    showToast('❌ Bağlantı hatası oluştu.');
  }
}

// ==========================================
// 📦 VERİTABANI YEDEKLEME & GERİ YÜKLEME (BACKUP & RESTORE)
// ==========================================
function toggleAutoBackupSwitch(el) {
  const slider = document.getElementById('backup-auto-slider');
  if (slider) {
    slider.style.backgroundColor = el.checked ? '#3b82f6' : '#334155';
  }
}

async function loadBackupSettings() {
  try {
    const res = await fetch('/api/backup/settings');
    if (res.ok) {
      const data = await res.json();
      const folderInput = document.getElementById('backup-folder-input');
      const autoToggle = document.getElementById('backup-auto-toggle');
      const autoSlider = document.getElementById('backup-auto-slider');
      const daySelect = document.getElementById('backup-schedule-day');
      const timeInput = document.getElementById('backup-schedule-time');
      const lastBadge = document.getElementById('backup-last-time-badge');

      if (folderInput) folderInput.value = data.backup_folder || '';
      if (autoToggle) autoToggle.checked = !!data.backup_auto_enabled;
      if (autoSlider) autoSlider.style.backgroundColor = data.backup_auto_enabled ? '#3b82f6' : '#334155';
      if (daySelect) daySelect.value = data.backup_schedule_day || 'everyday';
      if (timeInput) timeInput.value = data.backup_schedule_time || '03:00';
      if (lastBadge) lastBadge.textContent = 'Son Yedek: ' + (data.last_backup_time || 'Yok');
    }
  } catch (err) {
    console.error('Yedek ayarları yükleme hatası:', err);
  }
}

async function saveBackupSettings(e) {
  if (e) e.preventDefault();
  const folder = document.getElementById('backup-folder-input').value.trim();
  const autoEnabled = document.getElementById('backup-auto-toggle').checked;
  const day = document.getElementById('backup-schedule-day').value;
  const time = document.getElementById('backup-schedule-time').value;

  try {
    const res = await fetch('/api/backup/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backup_folder: folder,
        backup_auto_enabled: autoEnabled,
        backup_schedule_day: day,
        backup_schedule_time: time
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✅ ' + data.message);
      loadBackupSettings();
    } else {
      showToast('❌ Ayarlar kaydedilemedi: ' + (data.detail || 'Bilinmeyen hata'));
    }
  } catch (err) {
    showToast('❌ Bağlantı hatası oluştu.');
  }
}

async function createManualBackupNow() {
  showToast('⏳ Veritabanı yedeği alınıyor...');
  try {
    const res = await fetch('/api/backup/create', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showToast('💾 ' + data.message);
      loadBackupSettings();
      loadBackupList();
    } else {
      showToast('❌ Yedek alınamadı: ' + (data.detail || 'Hata'));
    }
  } catch (err) {
    showToast('❌ Bağlantı hatası oluştu.');
  }
}

async function loadBackupList() {
  const container = document.getElementById('backup-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/backup/list');
    if (!res.ok) {
      container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 14px;">Yedekler listelenemedi.</div>';
      return;
    }
    const data = await res.json();
    const backups = data.backups || [];

    if (backups.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #94a3b8; padding: 24px; font-size: 0.85rem;">
          <div style="font-size: 1.8rem; margin-bottom: 6px;">📂</div>
          Bu klasörde henüz yedek dosyası yok.<br>
          <span style="font-size: 0.76rem; color: #64748b;">"Şimdi Yedek Al" butonuna basarak ilk yedeğinizi hemen oluşturabilirsiniz.</span>
        </div>
      `;
      return;
    }

    let html = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
    `;

    backups.forEach((b) => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); padding: 8px 12px; border-radius: 8px; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 220px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
              💾
            </div>
            <div>
              <div style="font-size: 0.82rem; font-weight: 700; color: #f8fafc; font-family: monospace;">${escapeHtml(b.filename)}</div>
              <div style="font-size: 0.72rem; color: #94a3b8; display: flex; gap: 8px;">
                <span>📅 ${escapeHtml(b.created_at)}</span>
                <span style="color: #38bdf8;">📦 ${escapeHtml(b.size_kb)}</span>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="top-nav-btn top-nav-btn-briefing" onclick="restoreBackupFile('${escapeHtml(b.filename)}')" style="height: 30px; padding: 0 10px; font-size: 0.74rem;" title="Bu yedeği geri yükle">
              🔄 Geri Yükle
            </button>
            <button class="top-nav-btn" onclick="deleteBackupFile('${escapeHtml(b.filename)}')" style="height: 30px; padding: 0 8px; font-size: 0.74rem; color: #f87171; border-color: rgba(239, 68, 68, 0.3);" title="Bu yedeği sil">
              🗑️ Sil
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 14px;">Yedekler yüklenirken hata oluştu.</div>';
  }
}

async function restoreBackupFile(filename) {
  const isConfirmed = confirm(
    "⚠️ DİKKAT: GERİ YÜKLEME İŞLEMİ!\n\n" +
    "'" + filename + "' isimli yedek sisteme geri yüklenecektir.\n\n" +
    "Mevcut verileriniz bu yedeğin alındığı ana geri dönecektir. Devam etmek istiyor musunuz?"
  );
  if (!isConfirmed) return;

  showToast('⏳ Yedek geri yükleniyor...');
  try {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: filename })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('🎉 ' + data.message);
      // Tüm sistemi tazele
      loadData(false);
      if (typeof loadVehicleData === 'function') loadVehicleData();
      if (typeof loadContracts === 'function') loadContracts();
      if (typeof loadTasks === 'function') loadTasks();
      loadBackupList();
    } else {
      showToast('❌ Geri yükleme başarısız: ' + (data.detail || 'Hata'));
    }
  } catch (err) {
    showToast('❌ Bağlantı hatası oluştu.');
  }
}

async function handleBackupFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isConfirmed = confirm(
    "⚠️ DİKKAT: DIŞARIDAN YEDEK YÜKLEME!\n\n" +
    "'" + file.name + "' isimli dosya sisteme yüklenecek ve tüm veriler bu yedekle değiştirilecektir.\n\n" +
    "Bu işlemi onaylıyor musunuz?"
  );
  if (!isConfirmed) {
    e.target.value = '';
    return;
  }

  showToast('⏳ Yedek dosyası yükleniyor ve geri alınıyor...');
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/backup/upload-restore', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      showToast('🎉 ' + data.message);
      loadData(false);
      if (typeof loadVehicleData === 'function') loadVehicleData();
      if (typeof loadContracts === 'function') loadContracts();
      if (typeof loadTasks === 'function') loadTasks();
      loadBackupList();
    } else {
      showToast('❌ Yükleme başarısız: ' + (data.detail || 'Geçersiz dosya'));
    }
  } catch (err) {
    showToast('❌ Dosya yüklenirken hata oluştu.');
  } finally {
    e.target.value = '';
  }
}

async function deleteBackupFile(filename) {
  if (!confirm("'" + filename + "' yedek dosyasını kalıcı olarak silmek istediğinize emin misiniz?")) return;

  try {
    const res = await fetch('/api/backup/' + encodeURIComponent(filename), { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast('🗑️ ' + data.message);
      loadBackupList();
    } else {
      showToast('❌ Silinemedi: ' + (data.detail || 'Hata'));
    }
  } catch (err) {
    showToast('❌ Bağlantı hatası oluştu.');
  }
}

async function openBackupFolderOnPC() {
  try {
    const res = await fetch('/api/backup/open-folder', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('📁 ' + data.message);
    } else {
      showToast('⚠️ ' + (data.message || 'Klasör açılamadı'));
    }
  } catch (err) {
    showToast('❌ Klasör açılamadı.');
  }
}
// 🧾 FİŞ / FATURA / EKSTRE OCR YÜKLEME JS
// ==========================================
async function handleOcrFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const spinner = document.getElementById('ocr-loading-spinner');
  const title = document.getElementById('ocr-dropzone-title');
  if (spinner) spinner.style.display = 'block';
  if (title) title.textContent = '⏳ Analiz ediliyor: ' + file.name;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/ocr/parse-bill', {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (res.ok && result.success && result.data) {
      const data = result.data;
      if (document.getElementById('form-title')) document.getElementById('form-title').value = data.title || '';
      if (document.getElementById('form-category')) document.getElementById('form-category').value = data.category || 'fatura';
      if (document.getElementById('form-amount')) document.getElementById('form-amount').value = data.amount || '';
      if (document.getElementById('form-due-date')) document.getElementById('form-due-date').value = data.due_date || '';
      if (document.getElementById('form-notes') && data.notes) {
        document.getElementById('form-notes').value = data.notes;
      }
      showToast('✅ Fatura bilgileri Gemini tarafından otomatik dolduruldu!');
    } else {
      showToast('❌ ' + (result.detail || 'Belge çözümlenemedi.'));
    }
  } catch(e) {
    showToast('❌ Yükleme hatası oluştu: ' + e.message);
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (title) title.textContent = 'Fiş, Fatura veya Kart Ekstresi Yükle';
    event.target.value = '';
  }
}

// ==========================================
// 📬 GMAIL ENTEGRASYONU JS
// ==========================================
async function saveGmailCredentials() {
  const email_address = document.getElementById('gmail-address-input').value.trim();
  const app_password = document.getElementById('gmail-app-pw-input').value.trim();

  if (!email_address || !app_password) {
    showToast('⚠️ Lütfen e-posta adresinizi ve 16 haneli uygulama şifrenizi girin.');
    return;
  }

  try {
    const res = await fetch('/api/gmail/save-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address, app_password })
    });
    const d = await res.json();
    if (res.ok) {
      showToast('✅ ' + d.message);
    } else {
      showToast('❌ ' + (d.detail || 'Kaydedilemedi'));
    }
  } catch(e) {
    showToast('❌ Bağlantı hatası.');
  }
}

async function triggerGmailSync() {
  const btn = document.getElementById('btn-sync-gmail');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ <span>Taranıyor...</span>';
  }

  try {
    const res = await fetch('/api/gmail/sync', { method: 'POST' });
    const d = await res.json();
    if (res.ok) {
      if (d.bills && d.bills.length > 0) {
        let addedCount = 0;
        for (const bill of d.bills) {
          try {
            await fetch('/api/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: bill.title,
                category: bill.category || 'kredi_karti',
                amount: bill.amount,
                due_date: bill.due_date,
                repeat_type: 'monthly',
                notes: bill.notes || 'Gmail üzerinden otomatik çekildi'
              })
            });
            addedCount++;
          } catch(err) {}
        }
        showToast(`🎉 ${addedCount} adet ekstre/fatura tespit edildi ve listeye eklendi!`);
        loadData(false);
      } else {
        showToast('ℹ️ ' + (d.message || 'Yeni bir ekstre bulunamadı.'));
      }
    } else {
      showToast('❌ ' + (d.detail || 'Gmail taranamadı.'));
    }
  } catch(e) {
    showToast('❌ Gmail bağlantı hatası oluştu.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔄 <span>E-postaları Tara & Ekstreleri Çek</span>';
    }
  }
}

// Sayfa yüklendiğinde Gmail durumunu doldur
async function loadGmailStatus() {
  try {
    const res = await fetch('/api/gmail/status');
    if (res.ok) {
      const data = await res.json();
      if (data.email && document.getElementById('gmail-address-input')) {
        document.getElementById('gmail-address-input').value = data.email;
      }
      if (data.configured && document.getElementById('gmail-app-pw-input')) {
        document.getElementById('gmail-app-pw-input').placeholder = '•••• •••• •••• •••• (Kaydedildi)';
      }
    }
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  loadGmailStatus();
});

// ==========================================
// 📅 HAFTALIK NAKİT AKIŞI ZAMAN ÇİZELGESİ
// ==========================================
function renderWeeklyCashflow(cashflow) {
  const container = document.getElementById('weekly-cashflow-days');
  const totalEl = document.getElementById('weekly-cashflow-total');
  if (!container) return;

  if (!cashflow || !cashflow.days) {
    container.innerHTML = '<div style="grid-column: 1 / -1; color:#94a3b8; font-size:0.8rem; text-align:center;">Nakit akışı hesaplanıyor...</div>';
    return;
  }

  if (totalEl) {
    totalEl.textContent = `Toplam: ${formatCurrency(cashflow.total)}`;
    totalEl.style.color = cashflow.total > 0 ? '#f87171' : '#34d399';
    totalEl.style.borderColor = cashflow.total > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(52, 211, 153, 0.4)';
    totalEl.style.background = cashflow.total > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)';
  }

  const shortDays = {
    'Pazartesi': 'Pzt', 'Salı': 'Sal', 'Çarşamba': 'Çar', 'Perşembe': 'Per',
    'Cuma': 'Cum', 'Cumartesi': 'Cmt', 'Pazar': 'Paz'
  };

  container.innerHTML = cashflow.days.map((day, idx) => {
    const isToday = idx === 0;
    const hasExpense = day.amount > 0;
    const dayShort = shortDays[day.day_name] || day.day_name;
    const billDetails = (day.bills && day.bills.length > 0)
      ? day.bills.map(b => `${escapeHtml(b.title)}: ${formatCurrency(b.amount)}`).join('\n')
      : 'Ödeme yok';

    const bg = hasExpense
      ? 'background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.15)); border: 1px solid rgba(239, 68, 68, 0.4);'
      : (isToday ? 'background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3);' : 'background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);');

    const textColor = hasExpense ? '#f87171' : (isToday ? '#38bdf8' : '#94a3b8');
    const amtColor = hasExpense ? '#fca5a5' : '#64748b';

    return `
      <div title="${billDetails}" style="${bg} border-radius: 8px; padding: 8px 4px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; transition: transform 0.2s ease;">
        <span style="font-size: 0.7rem; font-weight: 700; color: ${textColor}; text-transform: uppercase;">
          ${isToday ? 'Bugün' : dayShort}
        </span>
        <span style="font-size: 0.72rem; color: #cbd5e1; margin: 2px 0;">
          ${day.display}
        </span>
        <strong style="font-size: 0.8rem; font-weight: 800; color: ${amtColor}; white-space: nowrap;">
          ${hasExpense ? formatCurrency(day.amount) : '0 ₺'}
        </strong>
      </div>
    `;
  }).join('');
}

// Mobilde Menüden 7 Günlük Nakit Planı Modalını Açar
function openMobileWeeklyCashflow() {
  closeModal('modal-mobile-menu');
  const target = document.getElementById('weekly-cashflow-modal-content');
  if (target && analyticsData && analyticsData.weekly_cashflow) {
    const cashflow = analyticsData.weekly_cashflow;
    let html = `
      <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; font-size: 0.88rem; color: #f8fafc;">7 Günlük Toplam Çıkış:</span>
        <span style="font-weight: 800; font-size: 1.15rem; color: ${cashflow.total > 0 ? '#f87171' : '#34d399'};">${formatCurrency(cashflow.total)}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
    `;
    cashflow.days.forEach((day, idx) => {
      const isToday = idx === 0;
      const hasExpense = day.amount > 0;
      const bg = hasExpense ? 'rgba(239, 68, 68, 0.12)' : (isToday ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.03)');
      const borderColor = hasExpense ? 'rgba(239, 68, 68, 0.3)' : (isToday ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)');
      
      let billsListHtml = '';
      if (day.bills && day.bills.length > 0) {
        billsListHtml = `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 4px;">` +
          day.bills.map(b => `<div style="display: flex; justify-content: space-between; font-size: 0.78rem;"><span style="color:#cbd5e1;">⚡ ${escapeHtml(b.title)}</span><strong style="color:#fca5a5;">${formatCurrency(b.amount)}</strong></div>`).join('') +
          `</div>`;
      }
      
      html += `
        <div style="background: ${bg}; border: 1px solid ${borderColor}; border-radius: 10px; padding: 10px 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 700; font-size: 0.82rem; color: ${isToday ? '#38bdf8' : '#f8fafc'};">${isToday ? '📌 BUGÜN' : day.day_name}</span>
              <span style="font-size: 0.74rem; color: #94a3b8; margin-left: 6px;">(${day.display})</span>
            </div>
            <strong style="font-size: 0.95rem; color: ${hasExpense ? '#f87171' : '#64748b'};">${hasExpense ? formatCurrency(day.amount) : 'Ödeme Yok'}</strong>
          </div>
          ${billsListHtml}
        </div>
      `;
    });
    html += `</div>`;
    target.innerHTML = html;
  }
  openModal('modal-weekly-cashflow');
}

// ==========================================
// 🌱 KIA EV6 ELEKTRİKLİ TASARRUF HESAPLAMA
// ==========================================
async function renderHomeEvSavings() {
  const el = document.getElementById('home-ev-savings-amount');
  if (!el) return;
  try {
    const res = await fetch('/api/ev/charges');
    if (res.ok) {
      const charges = await res.json();
      if (charges && charges.length > 0) {
        const totalCharged = charges.reduce((acc, c) => acc + (c.kwh_added || 0), 0);
        const savings = Math.round(totalCharged * 15.2);
        el.textContent = `~${savings.toLocaleString('tr-TR')} ₺`;
        return;
      }
    }
  } catch(e) {}
  el.textContent = '~4.200 ₺';
}

// ==========================================
// 🛡️ TAAHHÜT, GARANTİ & SÖZLEŞME TAKİBİ
// ==========================================
// ==========================================
// 🛡️ GARANTİ TAKİP & ÜRÜN BELGELERİ JS
// ==========================================
function autoCalculateWarrantyEndDate() {
  const purchaseInput = document.getElementById('c-purchase-date');
  const durationSelect = document.getElementById('c-duration');
  const endInput = document.getElementById('c-end-date');

  if (!purchaseInput || !durationSelect || !endInput) return;
  if (!purchaseInput.value) return;

  const durationVal = durationSelect.value;
  if (durationVal === 'custom') return;

  const months = parseInt(durationVal);
  if (isNaN(months)) return;

  const parts = purchaseInput.value.split('-');
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setMonth(dt.getMonth() + months);

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  endInput.value = `${y}-${m}-${d}`;
}

function openAddContractModal() {
  const form = document.getElementById('contractForm');
  if (form) form.reset();

  const todayStr = new Date().toISOString().split('T')[0];
  const pDate = document.getElementById('c-purchase-date');
  if (pDate) pDate.value = todayStr;

  const durSel = document.getElementById('c-duration');
  if (durSel) durSel.value = '24';

  autoCalculateWarrantyEndDate();
  openModal('modal-contract');
}

async function loadContracts() {
  const container = document.getElementById('contracts-container');
  if (!container) return;

  try {
    const res = await fetch('/api/contracts');
    if (!res.ok) {
      container.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">Garanti kayıtları yüklenemedi.</div>';
      return;
    }
    const list = await res.json();

    // 1 Ay İçinde Bitecek Ürünleri Kontrol Et (0 <= days_remaining <= 30)
    const alertBanner = document.getElementById('warranty-alert-banner');
    const alertText = document.getElementById('warranty-alert-text');
    const expiringSoon = list.filter(item => item.days_remaining >= 0 && item.days_remaining <= 30);

    if (alertBanner && alertText) {
      if (expiringSoon.length > 0) {
        alertBanner.style.display = 'block';
        alertText.innerHTML = expiringSoon.map(item => `
          <strong>${escapeHtml(item.title)}</strong> (${item.days_remaining === 0 ? 'Bugün Son Gün!' : item.days_remaining + ' gün kaldı'})
        `).join(', ') + ' &mdash; Arıza veya servis kontrolü için yetkili servise hemen başvurun.';
      } else {
        alertBanner.style.display = 'none';
      }
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="icon">🛡️</div>
          <h3>Kayıtlı Ürün veya Garanti Yok</h3>
          <p>Dyson süpürgeniz, telefonunuz, televizyonunuz veya beyaz eşyalarınızı ekleyerek garanti sürelerini takip edin, 1 ay kala uyarı alın.</p>
          <button class="btn btn-primary" onclick="openAddContractModal()" style="margin-top: 14px;">➕ Yeni Ürün / Garanti Ekle</button>
        </div>
      `;
      return;
    }

    const typeIcons = {
      garanti: '🛡️',
      telefon_pc: '📱',
      ev_aleti: '🏠',
      arac: '🚗',
      taahhut: '📶',
      sozlesme: '📄',
      diger: '📦'
    };

    const typeNames = {
      garanti: 'Elektronik & Beyaz Eşya',
      telefon_pc: 'Telefon / PC / Tablet',
      ev_aleti: 'Ev & Mutfak Aleti',
      arac: 'Araç Parçası / Donanım',
      taahhut: 'İnternet / GSM Taahhüdü',
      sozlesme: 'Hizmet Sözleşmesi',
      diger: 'Ürün Garantisi'
    };

    container.innerHTML = list.map(item => {
      const days = item.days_remaining;
      const isUrgent = days >= 0 && days <= 30;
      const isExpired = days < 0;

      let badgeColor = '#34d399';
      let badgeBg = 'rgba(52, 211, 153, 0.15)';
      let badgeBorder = 'rgba(52, 211, 153, 0.4)';
      let badgeText = `${days} Gün Kaldı`;

      if (isExpired) {
        badgeColor = '#ef4444';
        badgeBg = 'rgba(239, 68, 68, 0.15)';
        badgeBorder = 'rgba(239, 68, 68, 0.4)';
        badgeText = `❌ Garanti Doldu (${Math.abs(days)} gün önce)`;
      } else if (days === 0) {
        badgeColor = '#ef4444';
        badgeBg = 'rgba(239, 68, 68, 0.25)';
        badgeBorder = '#ef4444';
        badgeText = '🚨 Bugün Son Gün!';
      } else if (isUrgent) {
        badgeColor = '#f97316';
        badgeBg = 'rgba(249, 115, 22, 0.2)';
        badgeBorder = '#f97316';
        badgeText = `⚠️ SON 1 AY! (${days} Gün Kaldı)`;
      } else if (days > 365) {
        const years = (days / 365.25).toFixed(1);
        badgeText = `✅ ~${years} Yıl Kaldı`;
      }

      const icon = typeIcons[item.category] || '🛡️';
      const catLabel = typeNames[item.category] || 'Garanti';

      // Kart vurgusu (1 ay kala kırmızı/turuncu parlama)
      const cardBorder = isUrgent
        ? 'border: 1.5px solid #f97316; box-shadow: 0 0 18px rgba(249, 115, 22, 0.35); background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(41, 25, 15, 0.9));'
        : 'border: 1px solid #334155; background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95));';

      return `
        <div class="stat-card" style="${cardBorder} position: relative; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.6rem;">${icon}</span>
                <div>
                  <h4 style="color:#f8fafc; font-size:1.05rem; font-weight:800; margin:0;">${escapeHtml(item.title)}</h4>
                  <div style="font-size:0.75rem; color:#94a3b8; display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span>${escapeHtml(item.provider || 'Marka belirtilmedi')}</span>
                    <span>&bull;</span>
                    <span style="color:#38bdf8;">${catLabel}</span>
                  </div>
                </div>
              </div>
              <button onclick="deleteContract(${item.id})" style="background:transparent; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:2px;" title="Kaydı Sil">🗑️</button>
            </div>

            <!-- Süre Bilgileri Tablosu -->
            <div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 10px 12px; margin: 10px 0; font-size: 0.8rem; display: flex; flex-direction: column; gap: 6px;">
              ${item.purchase_date ? `
                <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                  <span>Satın Alma Tarihi:</span>
                  <strong style="color:#e2e8f0;">${formatDateTr(item.purchase_date)}</strong>
                </div>
              ` : ''}
              ${item.warranty_duration ? `
                <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                  <span>Garanti Süresi:</span>
                  <strong style="color:#38bdf8;">${escapeHtml(item.warranty_duration)}</strong>
                </div>
              ` : ''}
              <div style="display:flex; justify-content:space-between; color:#cbd5e1; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px;">
                <span>Garanti Bitiş Tarihi:</span>
                <strong style="color:#fff; font-size:0.88rem;">${formatDateTr(item.end_date)}</strong>
              </div>
            </div>

            ${isUrgent ? `
              <div style="background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.4); border-radius: 6px; padding: 6px 10px; font-size: 0.76rem; color: #fdba74; margin-bottom: 10px; display:flex; align-items:center; gap:6px;">
                <span>⚠️</span>
                <span><strong>Son 1 Ay Uyarısı:</strong> Üründe arıza, pil veya mekanik sorun varsa garanti bitmeden yetkili servise götürün!</span>
              </div>
            ` : ''}

            ${item.notes ? `
              <div style="font-size:0.78rem; color:#94a3b8; border-top: 1px dashed #334155; padding-top: 8px; margin-top: 4px;">
                📝 <em>${escapeHtml(item.notes)}</em>
              </div>
            ` : ''}
          </div>

          <!-- Alt Kalan Süre Rozeti -->
          <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
            <span style="font-size: 0.75rem; color: #94a3b8;">Kalan Süre:</span>
            <span style="font-size: 0.8rem; font-weight: 800; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 3px 10px; border-radius: 14px;">
              ${badgeText}
            </span>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    container.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">Bağlantı hatası oluştu.</div>';
  }
}

async function handleContractSubmit(e) {
  e.preventDefault();
  const durSelect = document.getElementById('c-duration');
  const durText = durSelect ? durSelect.options[durSelect.selectedIndex].text : '';

  const payload = {
    title: document.getElementById('c-title').value.trim(),
    category: document.getElementById('c-category').value,
    provider: document.getElementById('c-provider').value.trim(),
    purchase_date: document.getElementById('c-purchase-date').value || null,
    warranty_duration: durText,
    end_date: document.getElementById('c-end-date').value,
    notes: document.getElementById('c-notes').value.trim()
  };

  try {
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast(`🛡️ "${payload.title}" ürün garanti kaydı başarıyla eklendi!`);
      closeModal('modal-contract');
      loadContracts();
    } else {
      showToast('❌ Kaydedilemedi.');
    }
  } catch(err) {
    showToast('❌ Sunucuya bağlanılamadı.');
  }
}

async function deleteContract(id) {
  if (!confirm('Bu ürün garanti kaydını silmek istediğinize emin misiniz?')) return;
  try {
    const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('🗑️ Garanti kaydı silindi.');
      loadContracts();
    }
  } catch(e) {
    showToast('❌ Silinemedi.');
  }
}

// ==========================================
// 📝 OPTİMUS GÖREV & NOT DEFTERİ
// ==========================================
async function loadTasks() {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  try {
    const res = await fetch('/api/reminders');
    if (!res.ok) {
      container.innerHTML = '<div style="color:#ef4444;">Görevler yüklenemedi.</div>';
      return;
    }
    const tasks = await res.json();
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📝</div>
          <h3>Henüz bir görev notu yok</h3>
          <p>Yukarıdaki alandan Optimus'a hatırlatması gereken bir görev veya ödeme notu ekleyin.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(task => {
      const isDone = task.is_completed === 1;
      const textDecor = isDone ? 'text-decoration: line-through; opacity: 0.6;' : '';
      const checkIcon = isDone ? '✅' : '⬜';

      return `
        <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid ${isDone ? '#334155' : 'rgba(56, 189, 248, 0.4)'}; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; cursor: pointer;" onclick="toggleTask(${task.id})">
            <span style="font-size: 1.2rem;">${checkIcon}</span>
            <div>
              <div style="font-size: 0.9rem; font-weight: 600; color: #f8fafc; ${textDecor}">
                ${escapeHtml(task.task_text)}
              </div>
              ${task.due_date ? `<div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">📅 Hedef Tarih: ${formatDateTr(task.due_date)}</div>` : ''}
            </div>
          </div>
          <button onclick="deleteTask(${task.id})" style="background: transparent; border: none; color: #ef4444; font-size: 1rem; cursor: pointer; padding: 4px;" title="Görevi Sil">🗑️</button>
        </div>
      `;
    }).join('');
  } catch(e) {
    container.innerHTML = '<div style="color:#ef4444;">Bağlantı hatası.</div>';
  }
}

async function handleAddTaskSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('task-input');
  const dateInput = document.getElementById('task-date');
  if (!input || !input.value.trim()) return;

  const payload = {
    task_text: input.value.trim(),
    due_date: dateInput && dateInput.value ? dateInput.value : null
  };

  try {
    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      input.value = '';
      if (dateInput) dateInput.value = '';
      showToast('📝 Görev eklendi!');
      loadTasks();
    }
  } catch(err) {
    showToast('❌ Görev eklenemedi.');
  }
}

async function toggleTask(id) {
  try {
    const res = await fetch(`/api/reminders/${id}/toggle`, { method: 'POST' });
    if (res.ok) {
      loadTasks();
    }
  } catch(e) {}
}

async function deleteTask(id) {
  try {
    const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('🗑️ Görev silindi.');
      loadTasks();
    }
  } catch(e) {}
}
