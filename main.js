/* ================================================================
   IRGXYMODS — SHARED JAVASCRIPT (Multi-Page v4.0)
   ================================================================ */
(function () {
  'use strict';

  /* ================================================================
     GLOBAL ERROR GUARD — cegah 1 error mematikan seluruh script
     ================================================================ */
  window.addEventListener('error', (e) => {
    console.warn('[IRGXYMODS] Runtime error caught:', e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[IRGXYMODS] Unhandled promise rejection:', e.reason);
  });

  /* ---------- HELPERS ---------- */
  const $  = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  /**
   * withTimeout — Polyfill untuk AbortSignal.timeout()
   * Alasan: AbortSignal.timeout() hanya didukung Chrome 103+, Firefox 100+,
   * Safari 16+. Untuk Safari ≤15 (masih banyak di iOS lama), ini akan crash.
   * Solusi: gunakan AbortController + setTimeout sebagai fallback.
   */
  const withTimeout = (ms) => {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      try { return AbortSignal.timeout(ms); } catch (_) { /* fallback di bawah */ }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try { controller.abort(new DOMException('TimeoutError', 'TimeoutError')); }
      catch (_) { controller.abort(); }
    }, ms);
    // Bersihkan timer jika sudah selesai (mencegah memory leak)
    if (controller.signal && typeof controller.signal.addEventListener === 'function') {
      controller.signal.addEventListener('abort', () => clearTimeout(timer));
    }
    return controller.signal;
  };

  /**
   * safeFetch — Wrapper fetch dengan timeout + error handling konsisten
   * Mengembalikan: Response object ATAU throw Error dengan message yang jelas
   */
  const safeFetch = async (url, options = {}, timeoutMs = 12000) => {
    const opts = { ...options, signal: withTimeout(timeoutMs) };
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (res.statusText || ''));
    return res;
  };

  /**
   * fixUrl — Normalisasi URL dari API (TikWM kadang return tanpa protokol)
   */
  const fixUrl = (u, base = 'https://www.tikwm.com') => {
    if (!u || typeof u !== 'string') return '';
    const s = u.trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('//')) return 'https:' + s;
    return base + (s.startsWith('/') ? s : '/' + s);
  };

  /* ---------- AOS ---------- */
  if (window.AOS && typeof AOS.init === 'function') {
    try {
      AOS.init({ duration: 650, easing: 'ease-out-expo', once: true, offset: 30 });
    } catch (e) { console.warn('AOS init failed:', e); }
  }

  /* ---------- TOAST ---------- */
  function showToast(message, type = 'success') {
    const container = $('#toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
  }
  window.showToast = showToast;

  /* ---------- AUTH (Login State) ---------- */
  const Auth = {
    KEY_LOGGED: 'irgxy_logged_in',
    KEY_USER:   'irgxy_username',
    KEY_TIME:   'irgxy_login_time',
    isLoggedIn() { try { return localStorage.getItem(this.KEY_LOGGED) === 'true'; } catch { return false; } },
    getUser()    { try { return localStorage.getItem(this.KEY_USER) || ''; } catch { return ''; } },
    login(name) {
      try {
        localStorage.setItem(this.KEY_LOGGED, 'true');
        localStorage.setItem(this.KEY_USER, name);
        localStorage.setItem(this.KEY_TIME, String(Date.now()));
      } catch {}
    },
    logout() {
      try {
        localStorage.removeItem(this.KEY_LOGGED);
        localStorage.removeItem(this.KEY_USER);
      } catch {}
    }
  };
  window.IrgxyAuth = Auth;

  /* ---------- ACTIVITY SYSTEM ---------- */
  const Activity = {
    STORAGE: 'irgxy_activities',
    items: [],
    load() { try { this.items = JSON.parse(localStorage.getItem(this.STORAGE) || '[]'); } catch { this.items = []; } },
    save() { try { localStorage.setItem(this.STORAGE, JSON.stringify(this.items.slice(0, 20))); } catch {} },
    add(type, title) {
      try {
        this.items.unshift({ id: Date.now(), type, title, timeAgo: 'Baru saja' });
        this.items = this.items.slice(0, 20);
        this.save();
        this.render();
        updateProfileStats();
      } catch (e) { console.warn('Activity.add failed:', e); }
    },
    render() {
      const timeline = $('#activityTimeline');
      if (!timeline) return;
      if (!this.items.length) {
        timeline.innerHTML = '<div class="no-activity"><i class="fas fa-history"></i><p>Belum ada aktivitas</p><small>Riwayat aktivitas Anda akan muncul di sini</small></div>';
        return;
      }
      const iconMap  = { download: 'download', share: 'share-alt', copy_link: 'link', cheat_download: 'gamepad' };
      const colorMap = { download: 'success', share: 'warning', copy_link: 'secondary', cheat_download: 'warning' };
      timeline.innerHTML = this.items.map(a => `
        <div class="activity-item">
          <div class="activity-icon ${colorMap[a.type] || 'primary'}"><i class="fas fa-${iconMap[a.type] || 'circle'}"></i></div>
          <div class="activity-content"><div class="activity-title">${a.title}</div><div class="activity-time">${a.timeAgo}</div></div>
        </div>`).join('');
    }
  };
  Activity.load();
  window.addActivity = Activity.add.bind(Activity);
  window.IrgxyActivity = Activity;

  function updateProfileStats() {
    const items = Activity.items;
    const downloads = items.filter(a => a.type === 'download' || a.type === 'cheat_download').length;
    const earliest  = items.length ? Math.min(...items.map(a => a.id)) : Date.now();
    const days      = Math.max(1, Math.ceil((Date.now() - earliest) / 86400000));
    const bugs      = items.filter(a => a.type === 'bug').length;
    if ($('#statDownloads')) $('#statDownloads').textContent = downloads;
    if ($('#statDays'))      $('#statDays').textContent = days;
    if ($('#statBugs'))      $('#statBugs').textContent = bugs;
  }

  /* ---------- SETTINGS DROPDOWN ---------- */
  (function initSettingsDropdown() {
    const toggle   = $('#settingsToggle');
    const dropdown = $('#settingsDropdown');
    if (!toggle || !dropdown) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });
    document.addEventListener('click', () => dropdown.classList.remove('active'));
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    $('#themeToggleBtn')?.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      showToast('Tema diubah', 'info');
      dropdown.classList.remove('active');
    });

    $('#helpBtn')?.addEventListener('click', () => {
      showToast('Bantuan: Hubungi kami di Telegram @irgxyzmods', 'info');
      dropdown.classList.remove('active');
    });

    $('#profileDropdownBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      dropdown.classList.remove('active');
      if (!Auth.isLoggedIn()) {
        showToast('Silakan login terlebih dahulu', 'warning');
        setTimeout(() => location.href = 'login.html', 700);
        return;
      }
      $('#profileModal')?.classList.add('active');
      Activity.render();
      updateProfileStats();
      const nameEl = $('#profileModal .profile-name');
      if (nameEl && Auth.getUser()) nameEl.textContent = Auth.getUser();
    });
  })();

  /* ---------- PROFILE MODAL ---------- */
  (function initProfileModal() {
    const modal = $('#profileModal');
    if (!modal) return;

    $('#profileModalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    modal.querySelector('.edit-profile')?.addEventListener('click', () =>
      showToast('Fitur edit profil akan segera hadir!', 'info'));
    modal.querySelector('.upgrade-premium')?.addEventListener('click', () =>
      showToast('Anda sudah menggunakan paket premium!', 'success'));
    modal.querySelector('.logout')?.addEventListener('click', () => {
      Auth.logout();
      showToast('Anda berhasil keluar', 'success');
      setTimeout(() => { modal.classList.remove('active'); location.reload(); }, 800);
    });

    Activity.render();
    updateProfileStats();
  })();

  /* ---------- reCAPTCHA MODAL (Download) ---------- */
  (function initRecaptchaModal() {
    const modal = $('#recaptchaModal');
    if (!modal) return;

    let currentUrl = '';
    let currentName = '';
    const verifiedBtn = $('#downloadVerifiedBtn');
    const statusBox   = $('#downloadRecaptchaStatus');

    window.openRecaptchaModal = function (url, name) {
      currentUrl = url;
      currentName = name;
      modal.style.display = 'flex';
      if (statusBox) { statusBox.style.display = 'none'; statusBox.textContent = ''; }
      if (verifiedBtn) verifiedBtn.disabled = true;
      if (window.grecaptcha?.reset) { try { window.grecaptcha.reset(); } catch {} }
    };

    window.onDownloadRecaptchaSuccess = function () {
      if (verifiedBtn) verifiedBtn.disabled = false;
      if (statusBox) {
        statusBox.textContent = 'Verifikasi berhasil! Anda dapat melanjutkan download.';
        statusBox.style.display = 'block';
      }
    };
    window.onDownloadRecaptchaExpired = function () {
      if (verifiedBtn) verifiedBtn.disabled = true;
      if (statusBox) {
        statusBox.textContent = 'Verifikasi telah kedaluwarsa. Silakan verifikasi ulang.';
        statusBox.style.display = 'block';
      }
    };

    $('#recaptchaModalClose')?.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    verifiedBtn?.addEventListener('click', () => {
      modal.style.display = 'none';
      if (currentUrl && currentUrl !== '#') {
        window.open(currentUrl, '_blank', 'noopener');
        showToast('Download ' + currentName + ' dimulai!', 'success');
        Activity.add('download', 'Mengunduh ' + currentName);
      } else {
        showToast('Link download tidak tersedia', 'error');
      }
    });
  })();

  /* ---------- CARD ACTIONS (download / share / copy) ---------- */
  document.addEventListener('click', (e) => {
    const dlBtn = e.target.closest('.download-btn');
    if (dlBtn) {
      e.preventDefault();
      const url  = dlBtn.getAttribute('data-appurl') || '';
      const name = dlBtn.getAttribute('data-appname') || 'Aplikasi';
      const section = dlBtn.closest('section');
      if (section?.id === 'cheat-section') {
        Activity.add('cheat_download', 'Mengunduh cheat ' + name);
      } else {
        Activity.add('download', 'Mengunduh ' + name);
      }
      if (window.openRecaptchaModal) window.openRecaptchaModal(url, name);
      else if (url && url !== '#') window.open(url, '_blank', 'noopener');
      return;
    }

    const shareBtn = e.target.closest('.share-btn');
    if (shareBtn) {
      const name = shareBtn.getAttribute('data-appname') || 'Aplikasi';
      const url  = shareBtn.getAttribute('data-appurl') || location.href;
      if (navigator.share) {
        navigator.share({ title: name, text: 'Download ' + name + ' dari IRGXYMODS', url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => showToast('Link disalin!', 'success')).catch(() => {});
      } else { prompt('Salin link ini:', url); }
      Activity.add('share', 'Membagikan ' + name);
      return;
    }

    const copyBtn = e.target.closest('.copy-link-btn');
    if (copyBtn) {
      const url  = copyBtn.getAttribute('data-appurl') || location.href;
      const name = copyBtn.closest('.app-card')?.querySelector('h3')?.textContent?.trim() || 'Aplikasi';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => showToast('Link berhasil disalin!', 'success')).catch(() => prompt('Salin link:', url));
      } else { prompt('Salin link:', url); }
      Activity.add('copy_link', 'Menyalin link ' + name);
    }
  });

  /* ---------- SEARCH ---------- */
  (function initSearch() {
    const input    = $('#searchInput');
    const btn      = $('#searchBtn');
    const clearBtn = $('#clearSearchBtn');
    const info     = $('#searchResultsInfo');
    const termEl   = $('#searchTerm');
    const noRes    = $('#noResults');
    if (!input) return;

    const selectors = '.app-card,.luxury-card,.portfolio-card,.portfolio-item,.testimonial-card,.testimoni-card,.feature-card,.stat-card,.tagline-item,.link-card';

    function reset() {
      $$(selectors).forEach(el => { el.style.display = ''; });
      if (info) info.style.display = 'none';
      if (noRes) noRes.style.display = 'none';
    }
    function perform() {
      const q = input.value.trim().toLowerCase();
      if (!q) return reset();
      const scope = $('main') || document;
      let count = 0;
      $$(selectors, scope).forEach(el => {
        const txt = (el.textContent || '').toLowerCase();
        if (txt.includes(q)) { el.style.display = ''; count++; }
        else el.style.display = 'none';
      });
      if (info) info.style.display = count ? 'block' : 'none';
      if (termEl) termEl.textContent = '"' + q + '"';
      if (noRes) noRes.style.display = count ? 'none' : 'block';
    }
    btn?.addEventListener('click', perform);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); perform(); } });
    clearBtn?.addEventListener('click', () => { input.value = ''; reset(); });
  })();

  /* ---------- BACK TO TOP ---------- */
  (function initBackToTop() {
    const el = $('#backToTop');
    if (!el) return;
    window.addEventListener('scroll', () => {
      el.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
    el.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  })();

  /* ---------- CONTACT FORM ---------- */
  window.handleContactForm = function (e) {
    e.preventDefault();
    const form = e.target;
    const name  = form.querySelector('input[type="text"]')?.value.trim() || '';
    const email = form.querySelector('input[type="email"]')?.value.trim() || '';
    const msg   = form.querySelector('textarea')?.value.trim() || '';
    if (!name || !email || !msg) { showToast('Harap isi semua field', 'error'); return false; }
    showToast(`Terima kasih, ${name}! Pesan Anda telah terkirim.`, 'success');
    form.reset();
    return false;
  };

  /* ---------- SKILL BARS ---------- */
  (function initSkillBars() {
    const bars = $$('.skill-bar-fill[data-width]');
    if (!bars.length) return;
    if (!('IntersectionObserver' in window)) {
      bars.forEach(b => b.style.width = b.getAttribute('data-width') || '0%');
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.width = entry.target.getAttribute('data-width') || '0%';
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    bars.forEach(b => obs.observe(b));
  })();

  /* ---------- GOLD PARTICLES ---------- */
  (function initParticles() {
    if ($('#irgxy-particles')) return;
    const container = document.createElement('div');
    container.id = 'irgxy-particles';
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
    document.body.appendChild(container);
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div');
      const size = 2 + Math.random() * 5;
      p.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,#FFD700 0%,#D4AF37 50%,transparent 70%);border-radius:50%;box-shadow:0 0 15px 3px rgba(255,215,0,0.5);left:${Math.random()*100}%;top:100%;animation:floatGold ${15 + Math.random()*20}s linear ${Math.random()*15}s infinite;`;
      container.appendChild(p);
    }
    if (!$('#irgxy-particles-style')) {
      const style = document.createElement('style');
      style.id = 'irgxy-particles-style';
      style.textContent = '@keyframes floatGold{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:0.8}90%{opacity:0.8}100%{transform:translateY(-110vh) translateX(60px);opacity:0}}';
      document.head.appendChild(style);
    }
  })();

  /* ---------- PORTFOLIO GRID ---------- */
  const portfolioItems = [
    { id:1, title:'Landing Page Startup Fintech', desc:'Desain modern dengan animasi scroll, dark mode, dan integrasi form booking.', category:'web', emoji:'🏢', tech:['HTML','CSS','JS','Figma'] },
    { id:2, title:'Dashboard Analytics SaaS', desc:'UI kompleks dengan grafik real-time, filter dinamis, dan role-based access.', category:'web', emoji:'📊', tech:['React','Chart.js','Node.js'] },
    { id:3, title:'Game UI Concept — RPG', desc:'Konsep antarmuka game RPG dengan inventory system, skill tree, dan minimap.', category:'uiux', emoji:'🎮', tech:['Figma','Illustrator'] },
    { id:4, title:'APK Mod Legal — Premium Unlocker', desc:'Modifikasi aplikasi open-source dengan fitur premium terbuka secara legal.', category:'apk', emoji:'📱', tech:['Android Studio','Java','Patch'] },
    { id:5, title:'Custom Tool — APK Patcher', desc:'Alat bantu patch legal untuk modifikasi ringan aplikasi Android secara aman.', category:'tools', emoji:'🔧', tech:['Python','ADB','Shell'] },
    { id:6, title:'UI/UX Design — Mobile App', desc:'Desain antarmuka aplikasi mobile modern dengan prinsip UX terbaik.', category:'uiux', emoji:'🖌️', tech:['Figma','Prototyping'] },
    { id:7, title:'Template Website Portfolio', desc:'Desain website portfolio responsif menggunakan HTML, CSS, dan JavaScript murni.', category:'web', emoji:'🎨', tech:['HTML','CSS','JS'] },
    { id:8, title:'Sistem Autentikasi 2FA', desc:'Microservice autentikasi dengan JWT, 2FA, reset password, dan social login.', category:'tools', emoji:'🔐', tech:['Node.js','JWT','MongoDB'] }
  ];

  function renderPortfolioGrid(filter = 'all') {
    const grid = $('#portfolioGridPage');
    const no   = $('#portfolioNoResultsPage');
    if (!grid || !no) return;
    const filtered = filter === 'all' ? portfolioItems : portfolioItems.filter(i => i.category === filter);
    grid.innerHTML = '';
    if (!filtered.length) { grid.classList.add('hidden'); no.classList.remove('hidden'); return; }
    grid.classList.remove('hidden'); no.classList.add('hidden');
    filtered.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'portfolio-item';
      div.style.animation = `fadeSlideIn 0.4s ease ${idx * 0.06}s forwards`;
      div.innerHTML = `
        <div class="item-thumb"><span style="font-size:2.8rem;">${item.emoji}</span><span class="item-badge">${item.category.toUpperCase()}</span></div>
        <div class="item-info">
          <h4>${item.title}</h4>
          <div class="item-desc">${item.desc}</div>
          <div class="item-tech">${item.tech.map(t => `<span class="tech-tag">${t}</span>`).join('')}</div>
          <a href="#" class="item-link">🔗 Lihat Detail →</a>
        </div>`;
      div.addEventListener('click', (e) => {
        if (e.target.closest('.item-link')) { e.preventDefault(); }
        alert(`📌 ${item.title}\n${item.desc}\n🛠️ ${item.tech.join(', ')}`);
      });
      grid.appendChild(div);
    });
  }

  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderPortfolioGrid(this.getAttribute('data-filter'));
    });
  });
  if ($('#portfolioGridPage')) renderPortfolioGrid('all');

  /* ---------- SHOP RENDERING ---------- */
  const ecommerceProducts = [
    { id:1, name:'Smartphone Pro X', category:'Elektronik', price:8999000, rating:4.8, emoji:'📱', badge:'terlaris', oldPrice:null },
    { id:2, name:'Laptop UltraSlim 15', category:'Elektronik', price:15499000, rating:4.7, emoji:'💻', badge:'hot', oldPrice:17999000 },
    { id:3, name:'Wireless Headphone ANC', category:'Elektronik', price:1299000, rating:4.5, emoji:'🎧', badge:null, oldPrice:null },
    { id:4, name:'Smartwatch Sport Pro', category:'Elektronik', price:3799000, rating:4.6, emoji:'⌚', badge:'sale', oldPrice:4999000 },
    { id:5, name:'Tablet Draw Pro 12"', category:'Elektronik', price:7299000, rating:4.4, emoji:'📋', badge:null, oldPrice:null },
    { id:6, name:'Kamera Mirrorless 4K', category:'Elektronik', price:12999000, rating:4.9, emoji:'📸', badge:'terlaris', oldPrice:14999000 },
    { id:7, name:'Tas Ransel Premium', category:'Fashion', price:599000, rating:4.3, emoji:'🎒', badge:null, oldPrice:null },
    { id:8, name:'Sepatu Lari Pro Running', category:'Fashion', price:899000, rating:4.6, emoji:'👟', badge:'hot', oldPrice:1199000 }
  ];
  const cuacaProducts = [
    { id:1, name:'Payung Lipat Premium', category:'Aksesoris Hujan', price:149000, rating:4.7, emoji:'☂️', badge:'terlaris', oldPrice:null },
    { id:2, name:'Jas Hujan Fashionable', category:'Aksesoris Hujan', price:299000, rating:4.5, emoji:'🧥', badge:'sale', oldPrice:399000 },
    { id:3, name:'Jaket Waterproof Pro', category:'Pakaian Outdoor', price:499000, rating:4.8, emoji:'🧥', badge:'hot', oldPrice:null },
    { id:4, name:'Sepatu Boot Hujan', category:'Alas Kaki', price:349000, rating:4.4, emoji:'👢', badge:null, oldPrice:null },
    { id:5, name:'Kacamata Hitam UV400', category:'Aksesoris Panas', price:199000, rating:4.6, emoji:'🕶️', badge:'terlaris', oldPrice:null },
    { id:6, name:'Sunblock SPF 50+', category:'Perawatan Kulit', price:89000, rating:4.9, emoji:'🧴', badge:null, oldPrice:null }
  ];
  const portfolioShopProducts = [
    { id:1, name:'Template Portfolio Premium', category:'Template Website', price:299000, rating:4.9, emoji:'🎨', badge:'terlaris', oldPrice:499000 },
    { id:2, name:'Jasa Desain UI/UX Pro', category:'Jasa Kreatif', price:1499000, rating:4.8, emoji:'🎯', badge:'premium', oldPrice:null },
    { id:3, name:'Paket Website Portfolio', category:'Paket Bundling', price:2499000, rating:4.7, emoji:'📦', badge:'hot', oldPrice:3499000 },
    { id:4, name:'Asset Ilustrasi Digital', category:'Aset Digital', price:149000, rating:4.6, emoji:'🖼️', badge:null, oldPrice:null }
  ];
  const authShopProducts = [
    { id:1, name:'Kemeja Flanel Premium', category:'Atasan Pria', price:299000, rating:4.7, emoji:'👔', badge:'terlaris', oldPrice:399000 },
    { id:2, name:'Dress Brokat Elegan', category:'Dress Wanita', price:599000, rating:4.9, emoji:'👗', badge:'hot', oldPrice:null },
    { id:3, name:'Kaos Polos Cotton 30s', category:'Atasan Pria', price:89000, rating:4.5, emoji:'👕', badge:'sale', oldPrice:129000 },
    { id:4, name:'Blouse Kantor Elegan', category:'Atasan Wanita', price:249000, rating:4.6, emoji:'👚', badge:'new', oldPrice:null }
  ];

  const formatPrice = p => 'Rp ' + p.toLocaleString('id-ID');
  const renderStars = r => {
    const full = Math.floor(r);
    const half = (r - full) >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return '★'.repeat(full) + (half ? '<span class="star-shop half">★</span>' : '') + '<span class="star-shop empty">★</span>'.repeat(empty);
  };

  function renderShopProducts(gridId, noId, counterId, data, buyBtnClass) {
    const grid = $('#' + gridId), no = $('#' + noId), counter = $('#' + counterId);
    if (!grid || !no || !counter) return;
    grid.innerHTML = '';
    if (!data.length) { grid.classList.add('hidden'); no.classList.remove('hidden'); counter.textContent = ''; return; }
    grid.classList.remove('hidden'); no.classList.add('hidden');
    counter.textContent = `Menampilkan ${data.length} produk`;
    data.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'product-card-shop';
      card.style.animation = `fadeSlideIn 0.4s ease ${idx * 0.04}s forwards`;
      let badgeHTML = '';
      if (p.badge === 'terlaris') badgeHTML = '<span class="product-badge-shop">⭐ Terlaris</span>';
      else if (p.badge === 'hot') badgeHTML = '<span class="product-badge-shop hot">🔥 Hot</span>';
      else if (p.badge === 'sale') badgeHTML = '<span class="product-badge-shop sale">💸 Diskon</span>';
      else if (p.badge === 'premium') badgeHTML = '<span class="product-badge-shop" style="background:linear-gradient(135deg,#ffd700,#ff8f00);color:#1a1a2e;">💎 Premium</span>';
      else if (p.badge === 'new') badgeHTML = '<span class="product-badge-shop" style="background:linear-gradient(135deg,#43e97b,#38f9d7);color:#1a1a2e;">🆕 Baru</span>';
      const priceHTML = p.oldPrice
        ? `<span class="product-price-shop">${formatPrice(p.price)}<span class="old-price-shop">${formatPrice(p.oldPrice)}</span></span>`
        : `<span class="product-price-shop">${formatPrice(p.price)}</span>`;
      card.innerHTML = `
        <div class="product-image-shop" style="background:linear-gradient(135deg,rgba(201,169,110,0.06),transparent);">${badgeHTML}<span class="product-image-emoji">${p.emoji}</span></div>
        <div class="product-info-shop">
          <span class="product-category-shop">${p.category}</span>
          <span class="product-name-shop">${p.name}</span>
          <div class="product-rating-shop"><span class="stars-container-shop">${renderStars(p.rating)}</span><span class="rating-number-shop">${p.rating}</span></div>
          ${priceHTML}
          <button class="${buyBtnClass}"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>Beli</button>
        </div>`;
      card.querySelector('.' + buyBtnClass)?.addEventListener('click', (e) => {
        e.stopPropagation();
        showToast(`✅ ${p.name} ditambahkan ke keranjang!`, 'success');
      });
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        alert(`📦 ${p.name}\n💰 ${formatPrice(p.price)}\n⭐ ${p.rating}/5.0`);
      });
      grid.appendChild(card);
    });
  }

  const filterShopData = (q, data) => {
    q = (q || '').trim().toLowerCase();
    if (!q) return [...data];
    return data.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  };

  window.renderEcommerceProducts     = d => renderShopProducts('ecommerceProductGrid', 'ecommerceNoResults', 'ecommerceResultsCounter', d, 'buy-btn-shop');
  window.renderCuacaProducts         = d => renderShopProducts('cuacaProductGrid', 'cuacaNoResults', 'cuacaResultsCounter', d, 'weather-buy-btn');
  window.renderPortfolioShopProducts = d => renderShopProducts('portfolioShopProductGrid', 'portfolioShopNoResults', 'portfolioShopResultsCounter', d, 'portfolio-buy-btn');
  window.renderAuthShopProducts      = d => renderShopProducts('authShopProductGrid', 'authShopNoResults', 'authShopResultsCounter', d, 'auth-buy-btn');

  function bindShopSearch(inputId, clearId, renderFn, data) {
    const inp = $('#' + inputId), clr = $('#' + clearId);
    if (!inp || !clr) return;
    inp.addEventListener('input', function () {
      clr.classList.toggle('visible', this.value.trim().length > 0);
      renderFn(filterShopData(this.value, data));
    });
    clr.addEventListener('click', () => {
      inp.value = ''; clr.classList.remove('visible'); inp.focus(); renderFn([...data]);
    });
  }
  bindShopSearch('ecommerceSearchInput', 'ecommerceSearchClear', window.renderEcommerceProducts, ecommerceProducts);
  bindShopSearch('cuacaSearchInput', 'cuacaSearchClear', window.renderCuacaProducts, cuacaProducts);
  bindShopSearch('portfolioShopSearchInput', 'portfolioShopSearchClear', window.renderPortfolioShopProducts, portfolioShopProducts);
  bindShopSearch('authShopSearchInput', 'authShopSearchClear', window.renderAuthShopProducts, authShopProducts);

  if ($('#ecommerceProductGrid'))     window.renderEcommerceProducts(ecommerceProducts);
  if ($('#cuacaProductGrid'))         window.renderCuacaProducts(cuacaProducts);
  if ($('#portfolioShopProductGrid')) window.renderPortfolioShopProducts(portfolioShopProducts);
  if ($('#authShopProductGrid'))      window.renderAuthShopProducts(authShopProducts);

  /* ---------- LOGIN PAGE HANDLER ---------- */
  (function initLoginPage() {
    const form = $('#loginForm');
    if (!form) return;

    if (Auth.isLoggedIn()) {
      const banner = $('#loginAlreadyBanner');
      if (banner) banner.style.display = 'block';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = form.querySelector('#username')?.value.trim();
      const pass = form.querySelector('#password')?.value.trim();
      if (!user || !pass) { showToast('Isi username dan password', 'error'); return; }
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      setTimeout(() => {
        Auth.login(user);
        showToast('Login berhasil! Mengalihkan...', 'success');
        setTimeout(() => location.href = 'index.html', 900);
      }, 1000);
    });
  })();

  /* ================================================================
     TIKTOK DOWNLOADER — Multi-Source (v4.0)
     ✅ CORS-friendly sources • withTimeout • anchor-download photos
     ================================================================ */
  (function initTikTokDownloader() {
    const input       = $('#tiktokUrlInput');
    const parseBtn    = $('#tiktokParseBtn');
    const btnText     = $('#tiktokParseBtnText');
    const pasteBtn    = $('#tiktokPasteBtn');
    const clearBtn    = $('#tiktokClearBtn');
    const statusEl    = $('#tiktokStatus');
    const statusIcon  = $('#tiktokStatusIcon');
    const statusText  = $('#tiktokStatusText');
    const resultCard  = $('#tiktokResultCard');
    const descToggle  = $('#tiktokDescToggle');
    const historyWrap = $('#tiktokHistory');
    const historyList = $('#tiktokHistoryList');
    const clearHistory= $('#tiktokClearHistory');

    if (!input || !parseBtn) return;

    let isLoading = false;
    let lastClickTime = 0;
    let currentData = null;
    let history = [];
    try { history = JSON.parse(localStorage.getItem('irgxy_tt_history') || '[]'); } catch { history = []; }

    /* ---- UTILS ---- */
    const fmtNum = (n) => {
      n = Number(n) || 0;
      if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return String(n);
    };
    const fmtDate = (ts) => {
      if (!ts) return '—';
      const d = new Date(Number(ts) * 1000);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const isValidTikTokUrl = (url) => /^https?:\/\/(www\.|vm\.|vt\.|m\.)?tiktok\.com\//i.test((url || '').trim());
    const sanitizeUrl = (url) => (url || '').trim().replace(/\s+/g, '').replace(/[<>"'`]/g, '');

    const setStatus = (type, icon, text) => {
      if (!statusEl) return;
      statusEl.className = 'tiktok-status ' + type;
      if (statusIcon) statusIcon.innerHTML = icon;
      if (statusText) statusText.textContent = text;
    };
    const hideStatus = () => { if (statusEl) statusEl.className = 'tiktok-status'; };
    const setLoading = (state) => {
      isLoading = state;
      parseBtn.disabled = state;
      if (btnText) btnText.textContent = state ? 'Memproses...' : 'Download';
      const icon = parseBtn.querySelector('i');
      if (icon) icon.className = state ? 'tiktok-spinner' : 'fas fa-download';
    };

    const validateLive = () => {
      const v = sanitizeUrl(input.value);
      input.classList.remove('valid', 'invalid');
      if (!v) { if (clearBtn) clearBtn.style.display = 'none'; return; }
      if (clearBtn) clearBtn.style.display = 'flex';
      input.classList.toggle('valid', isValidTikTokUrl(v));
      input.classList.toggle('invalid', !isValidTikTokUrl(v));
    };

    /* ---- RENDER RESULT ---- */
    function renderResult(data) {
      currentData = data;
      const noWm  = data.noWatermark || '';
      const wm    = data.watermark || '';
      const audio = data.music || '';
      const thumb = data.cover || data.originCover || '';
      const isPhoto = !!(data.images && data.images.length);

      const thumbEl = $('#tiktokThumb');
      if (thumbEl) {
        thumbEl.src = thumb || '';
        thumbEl.onerror = function () {
          this.onerror = null;
          this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23222" width="100" height="100"/></svg>';
        };
      }
      $('#tiktokAuthorAvatar').textContent = (data.author || data.uniqueId || '?').charAt(0).toUpperCase();
      $('#tiktokAuthorName').textContent   = data.author || 'TikTok User';
      $('#tiktokAuthorHandle').textContent = '@' + (data.uniqueId || 'user');
      $('#tiktokDesc').textContent         = data.title || data.desc || 'Tanpa deskripsi';
      $('#tiktokDuration').textContent     = data.duration ? data.duration + 's' : '';
      $('#tiktokDate').textContent         = fmtDate(data.dateCreated);
      $('#tiktokSource').textContent       = 'via ' + (data.source || '—');
      $('#tiktokPlays').textContent        = fmtNum(data.playCount);
      $('#tiktokLikes').textContent        = fmtNum(data.diggCount);
      $('#tiktokComments').textContent     = fmtNum(data.commentCount);
      $('#tiktokShares').textContent       = fmtNum(data.shareCount);

      const typeBadge = $('#tiktokTypeBadge');
      if (typeBadge) {
        if (isPhoto) { typeBadge.textContent = '📸 Foto'; typeBadge.classList.add('visible'); }
        else typeBadge.classList.remove('visible');
      }

      const descEl = $('#tiktokDesc');
      if (descEl && descEl.textContent.length > 100 && descToggle) {
        descToggle.style.display = 'inline-block';
        descToggle.textContent = 'Selengkapnya';
        descToggle.onclick = () => {
          const expanded = descEl.classList.toggle('expanded');
          descToggle.textContent = expanded ? 'Sembunyikan' : 'Selengkapnya';
        };
      } else if (descToggle) {
        descToggle.style.display = 'none';
      }

      const dlNoWm   = $('#tiktokDownloadNoWm');
      const dlWm     = $('#tiktokDownloadWm');
      const dlAudio  = $('#tiktokDownloadAudio');
      const dlThumb  = $('#tiktokDownloadThumb');
      const dlPhotos = $('#tiktokDownloadAllPhotos');

      if (dlNoWm)  dlNoWm.href   = noWm  || '#';
      if (dlWm)    dlWm.href     = wm    || noWm || '#';
      if (dlAudio) dlAudio.href  = audio || '#';
      if (dlThumb) dlThumb.href  = thumb || '#';

      if (dlNoWm)  dlNoWm.style.display   = noWm  ? 'flex' : 'none';
      if (dlWm)    dlWm.style.display     = wm    ? 'flex' : 'none';
      if (dlAudio) dlAudio.style.display  = audio ? 'flex' : 'none';
      if (dlThumb) dlThumb.style.display  = thumb ? 'flex' : 'none';

      if (isPhoto && dlPhotos) {
        dlPhotos.style.display = 'flex';
        const lbl = $('#tiktokPhotosLabel');
        if (lbl) lbl.textContent = `Download Semua Foto (${data.images.length})`;
      } else if (dlPhotos) {
        dlPhotos.style.display = 'none';
      }

      resultCard?.classList.add('visible');
      setTimeout(() => resultCard?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    /* ---- HISTORY ---- */
    function saveHistory(data, originalUrl) {
      const item = {
        id: Date.now(),
        title: (data.title || 'Video TikTok').slice(0, 80),
        author: data.uniqueId || data.author || 'user',
        thumb: data.cover || data.originCover || '',
        url: originalUrl,
        ts: Date.now()
      };
      history = history.filter(h => h.url !== originalUrl);
      history.unshift(item);
      if (history.length > 8) history = history.slice(0, 8);
      try { localStorage.setItem('irgxy_tt_history', JSON.stringify(history)); } catch {}
      renderHistory();
    }

    function renderHistory() {
      if (!historyWrap || !historyList) return;
      if (!history.length) { historyWrap.style.display = 'none'; return; }
      historyWrap.style.display = 'block';
      historyList.innerHTML = history.map(h => `
        <div class="tiktok-history-item" data-url="${String(h.url).replace(/"/g, '&quot;')}">
          ${h.thumb ? `<img src="${h.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="h-info">
            <div class="h-title">${h.title}</div>
            <div class="h-sub">@${h.author}</div>
          </div>
        </div>`).join('');
      historyList.querySelectorAll('.tiktok-history-item').forEach(el => {
        el.addEventListener('click', () => {
          input.value = el.getAttribute('data-url') || '';
          validateLive();
          handleParse();
        });
      });
    }

    clearHistory?.addEventListener('click', () => {
      history = [];
      try { localStorage.removeItem('irgxy_tt_history'); } catch {}
      renderHistory();
      showToast('Riwayat berhasil dihapus', 'success');
    });

    /* ================================================================
       API SOURCES — Semua CORS-friendly (v4)
       ================================================================ */
    const SOURCES = [
      // 1. TikWM — paling reliable, tanpa auth, CORS-friendly
      {
        name: 'TikWM',
        async fetch(url) {
          const fd = new FormData();
          fd.append('url', url);
          fd.append('hd', '1');
          const r = await safeFetch('https://www.tikwm.com/api/', { method: 'POST', body: fd }, 12000);
          const j = await r.json();
          if (j.code !== 0) throw new Error(j.msg || 'API error');
          return j;
        },
        map(j) {
          const d = j.data || {};
          const isPhoto = Array.isArray(d.images) && d.images.length > 0;
          return {
            author: d.author?.nickname || d.author?.unique_id || 'TikTok User',
            uniqueId: d.author?.unique_id || 'user',
            title: d.title || '',
            cover: fixUrl(d.cover || d.origin_cover || ''),
            originCover: fixUrl(d.origin_cover || ''),
            duration: d.duration || 0,
            playCount: d.play_count || 0,
            diggCount: d.digg_count || 0,
            commentCount: d.comment_count || 0,
            shareCount: d.share_count || 0,
            noWatermark: fixUrl(d.hdplay || d.play || ''),
            watermark: fixUrl(d.wmplay || ''),
            music: fixUrl(d.music || ''),
            images: isPhoto ? d.images.map(u => fixUrl(u)) : [],
            isPhoto,
            dateCreated: d.create_time || 0,
            source: 'TikWM'
          };
        }
      },

      // 2. Tiklydown — CORS-friendly, reliable
      {
        name: 'Tiklydown',
        async fetch(url) {
          const r = await safeFetch(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
            {}, 12000
          );
          return r.json();
        },
        map(j) {
          const v = j.video || {};
          const m = j.music || {};
          const a = j.author || {};
          const s = j.stats || {};
          const imgs = Array.isArray(j.images) ? j.images.map(i => i.url || i).filter(Boolean) : [];
          const isPhoto = imgs.length > 0;
          return {
            author: a.name || a.nickname || 'TikTok User',
            uniqueId: a.unique_id || a.uniqueId || 'user',
            title: j.title || '',
            cover: v.cover || j.cover || '',
            originCover: v.cover || '',
            duration: v.duration || 0,
            playCount: s.playCount || 0,
            diggCount: s.diggCount || 0,
            commentCount: s.commentCount || 0,
            shareCount: s.shareCount || 0,
            noWatermark: v.noWatermark || v.playAddr || '',
            watermark: v.watermark || '',
            music: m.play_url || m.playUrl || '',
            images: imgs,
            isPhoto,
            dateCreated: j.created_at || 0,
            source: 'Tiklydown'
          };
        }
      },

      // 3. Douyin.wtf — Public instance, CORS-friendly
      {
        name: 'Douyin.wtf',
        async fetch(url) {
          const r = await safeFetch(
            `https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=false`,
            {}, 12000
          );
          return r.json();
        },
        map(j) {
          const d = j.data || j;
          if (!d || !d.video_data && !d.aweme_detail) throw new Error('Data tidak ditemukan');
          const detail = d.aweme_detail || d.video_data || d;
          const video  = detail.video || {};
          const author = detail.author || {};
          const music  = detail.music || {};
          const stats  = detail.statistics || {};
          const isPhoto = Array.isArray(detail.images) && detail.images.length > 0;
          const getPlayUrl = (v) => {
            if (!v) return '';
            if (v.play_addr?.url_list) return v.play_addr.url_list[0] || '';
            if (Array.isArray(v.play_addr)) return v.play_addr[0] || '';
            if (v.play_addr?.uri) return v.play_addr.uri;
            return '';
          };
          return {
            author: author.nickname || 'TikTok User',
            uniqueId: author.unique_id || 'user',
            title: detail.desc || '',
            cover: video.origin_cover?.url_list?.[0] || video.cover?.url_list?.[0] || '',
            originCover: video.origin_cover?.url_list?.[0] || '',
            duration: video.duration || 0,
            playCount: stats.play_count || 0,
            diggCount: stats.digg_count || 0,
            commentCount: stats.comment_count || 0,
            shareCount: stats.share_count || 0,
            noWatermark: getPlayUrl(video) || getPlayUrl(video.download_addr) || '',
            watermark: getPlayUrl(video.download_addr) || '',
            music: music.play_url?.url_list?.[0] || '',
            images: isPhoto ? detail.images.map(img => img.url_list?.[0] || '').filter(Boolean) : [],
            isPhoto,
            dateCreated: detail.create_time || 0,
            source: 'Douyin.wtf'
          };
        }
      },

      // 4. TikXedd — Endpoint cadangan (kadang offline)
      {
        name: 'TikXedd',
        async fetch(url) {
          const r = await safeFetch(
            `https://tikxedd.vercel.app/api/resolve?url=${encodeURIComponent(url)}`,
            {}, 10000
          );
          return r.json();
        },
        map(j) {
          const d = j.data || j;
          const isPhoto = Array.isArray(d.images) && d.images.length > 0;
          return {
            author: d.author || d.nickname || 'TikTok User',
            uniqueId: d.uniqueId || d.author || 'user',
            title: d.description || d.title || '',
            cover: d.cover || d.thumbnail || '',
            originCover: d.originCover || '',
            duration: d.meta?.duration || d.duration || 0,
            playCount: d.meta?.playCount || d.playCount || 0,
            diggCount: d.meta?.diggCount || d.diggCount || 0,
            commentCount: d.meta?.commentCount || d.commentCount || 0,
            shareCount: d.meta?.shareCount || d.shareCount || 0,
            noWatermark: d.download?.noWatermark || d.video || d.play || '',
            watermark: d.download?.watermark || d.wmplay || '',
            music: d.download?.music || d.music || '',
            images: isPhoto ? d.images : [],
            isPhoto,
            dateCreated: d.createTime || d.create_time || 0,
            source: 'TikXedd'
          };
        }
      },

      // 5. TikTok OEmbed — Fallback terakhir (hanya metadata + thumbnail)
      {
        name: 'TikTok OEmbed',
        async fetch(url) {
          const r = await safeFetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
            {}, 10000
          );
          return r.json();
        },
        map(j) {
          const thumb = j.thumbnail_url || '';
          return {
            author: j.author_name || 'TikTok User',
            uniqueId: (j.author_url || '').split('@').pop() || 'user',
            title: j.title || '',
            cover: thumb,
            originCover: thumb,
            duration: 0,
            playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0,
            noWatermark: '', watermark: '', music: '',
            images: [], isPhoto: false, dateCreated: 0,
            source: 'TikTok OEmbed'
          };
        }
      }
    ];

    /* ---- CORE PARSER ---- */
    async function parseTikTok(url) {
      let lastErr = null;
      for (const src of SOURCES) {
        try {
          setStatus('loading', '<span class="tiktok-spinner"></span>', `Memproses dengan ${src.name}...`);
          const raw = await src.fetch(url);
          const data = src.map(raw);
          const hasMedia = data.noWatermark || data.watermark || data.music || (data.images && data.images.length);
          if (!hasMedia) throw new Error('Tidak ada link download ditemukan');
          return { data, source: src.name };
        } catch (e) {
          lastErr = e;
          console.warn(`[TikTok] ${src.name} gagal:`, e.message);
        }
      }
      throw lastErr || new Error('Semua server gagal. Coba lagi nanti.');
    }

    /* ================================================================
       DOWNLOAD ALL PHOTOS — v4: Anchor-based (no CORS issue)
       ================================================================ */
    async function downloadAllPhotos(images) {
      if (!images || !images.length) return;

      const btn = $('#tiktokDownloadAllPhotos');
      const origLabel = btn?.querySelector('span')?.textContent || 'Download Semua Foto';

      showToast(`Memulai unduhan ${images.length} foto...`, 'info');
      if (btn) btn.disabled = true;

      let successCount = 0;
      for (let i = 0; i < images.length; i++) {
        setStatus('loading', '<span class="tiktok-spinner"></span>', `Menyiapkan foto ${i + 1}/${images.length}...`);
        try {
          // Metode anchor — biarkan browser handle download via CDN header
          // Tidak kena CORS karena bukan fetch()
          const a = document.createElement('a');
          a.href = images[i];
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.download = `tiktok_photo_${Date.now()}_${i + 1}.jpg`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          successCount++;
          // Jeda lebih panjang agar browser tidak memblokir multiple downloads
          await new Promise(res => setTimeout(res, 600));
        } catch (err) {
          console.warn('Gagal proses foto ke-' + (i + 1), err);
          try { window.open(images[i], '_blank', 'noopener'); } catch {}
        }
      }

      setStatus('success', '✅', `${successCount} dari ${images.length} foto berhasil diproses!`);
      setTimeout(hideStatus, 5000);
      showToast(`Selesai! ${successCount}/${images.length} foto diunduh`, 'success');
      Activity.add('download', `Mengunduh ${successCount} foto TikTok`);

      if (btn) {
        btn.disabled = false;
        const span = btn.querySelector('span');
        if (span) span.textContent = origLabel;
      }
    }

    /* ---- MAIN HANDLER ---- */
    async function handleParse() {
      const now = Date.now();
      if (now - lastClickTime < 800) return;
      lastClickTime = now;
      if (isLoading) return;

      const url = sanitizeUrl(input.value);
      if (!url) {
        setStatus('error', '⚠️', 'Tempel link TikTok terlebih dahulu.');
        showToast('Tempel link TikTok terlebih dahulu', 'error');
        return;
      }
      if (!isValidTikTokUrl(url)) {
        setStatus('error', '❌', 'Link tidak valid. Pastikan dari tiktok.com / vm.tiktok.com / vt.tiktok.com');
        showToast('Link tidak valid', 'error');
        return;
      }

      resultCard?.classList.remove('visible');
      setLoading(true);
      setStatus('loading', '<span class="tiktok-spinner"></span>', 'Mengambil data video...');

      try {
        const { data, source } = await parseTikTok(url);
        renderResult(data);
        saveHistory(data, url);
        const isPhoto = data.isPhoto && data.images?.length;
        setStatus('success', '✅',
          `Berhasil via ${source}! ${isPhoto ? `${data.images.length} foto siap diunduh.` : 'Pilih format di bawah.'}`
        );
        Activity.add('download', `Mengunduh TikTok dari @${data.uniqueId || 'user'}`);
        showToast('Data berhasil diambil!', 'success');
        setTimeout(() => { if (statusEl?.classList.contains('success')) hideStatus(); }, 5000);
      } catch (e) {
        console.error('[TikTok] Semua source gagal:', e);
        const msg = (e && e.message) || '';
        let userMsg = 'Maaf, semua server sedang sibuk. Coba lagi dalam 1 menit atau gunakan link lain.';
        if (/private|deleted|not found|not available/i.test(msg)) {
          userMsg = 'Video tidak dapat diakses (mungkin private atau telah dihapus).';
        } else if (/region|geo/i.test(msg)) {
          userMsg = 'Video tidak tersedia di region Anda.';
        } else if (/timeout|abort/i.test(msg)) {
          userMsg = 'Koneksi timeout. Periksa jaringan Anda dan coba lagi.';
        }
        setStatus('error', '❌', userMsg);
        showToast('Gagal mengambil data. Coba lagi.', 'error');
      } finally {
        setLoading(false);
      }
    }

    /* ---- EVENTS ---- */
    parseBtn.addEventListener('click', handleParse);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); handleParse(); } });
    input.addEventListener('input', validateLive);
    input.addEventListener('paste', () => setTimeout(() => { input.value = input.value.trim(); validateLive(); }, 30));

    pasteBtn?.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        input.value = txt.trim();
        validateLive();
        if (isValidTikTokUrl(input.value)) handleParse();
        else showToast('Clipboard bukan link TikTok', 'warning');
      } catch { showToast('Gagal paste dari clipboard', 'error'); }
    });

    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.classList.remove('valid', 'invalid');
      clearBtn.style.display = 'none';
      resultCard?.classList.remove('visible');
      hideStatus();
      input.focus();
    });

    $('#tiktokDownloadAllPhotos')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentData?.images?.length) downloadAllPhotos(currentData.images);
      else showToast('Tidak ada foto untuk diunduh', 'warning');
    });

    $('#tiktokCopyLinkBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk disalin', 'warning'); return; }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link berhasil disalin!', 'success');
        Activity.add('copy_link', 'Menyalin link TikTok');
      } catch { prompt('Salin link:', url); }
    });

    $('#tiktokShareBtn')?.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) { showToast('Tidak ada link untuk dibagikan', 'warning'); return; }
      const title = currentData ? `TikTok @${currentData.uniqueId}` : 'TikTok Video';
      if (navigator.share) {
        try {
          await navigator.share({ title, text: 'Download TikTok via IRGXYMODS', url });
          Activity.add('share', 'Membagikan link TikTok');
        } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          showToast('Link disalin ke clipboard', 'success');
        } catch { prompt('Salin link:', url); }
      }
    });

    ['tiktokDownloadNoWm', 'tiktokDownloadWm', 'tiktokDownloadAudio', 'tiktokDownloadThumb'].forEach(id => {
      $('#' + id)?.addEventListener('click', () => {
        if (currentData) {
          const type = id.replace('tiktokDownload', '').toLowerCase();
          Activity.add('download', `Mengunduh ${type} TikTok dari @${currentData.uniqueId}`);
        }
      });
    });

    // FAQ accordion
    $$('.tiktok-faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.tiktok-faq-item');
        if (!item) return;
        const wasOpen = item.classList.contains('open');
        $$('.tiktok-faq-item').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });

    // INIT
    renderHistory();
    validateLive();
    console.log('✅ TikTok downloader siap (5-source CORS-safe, anchor-download, withTimeout polyfill)');
  })();

  console.log('✅ IRGXYMODS shared script loaded (v4.0 — Production Ready)');
})();