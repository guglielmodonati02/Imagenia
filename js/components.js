// js/components.js — Shared Nav, Footer, Toast
import { getSettings, supabase } from './supabase.js';
import { initWhatsApp } from './whatsapp-widget.js';
import { Cart } from './cart.js';

/* ── Toast ─────────────────────────────────────────────────── */
export function showToast(message, type = 'success') {
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
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ── Image fallback ─────────────────────────────────────────── */
export function imgWithFallback(url, alt = '') {
  if (url) return `<img src="${url}" alt="${alt}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder\\'><span class=\\'material-symbols-outlined\\'>image_not_supported</span></div>'">`;
  return `<div class="card-placeholder"><span class="material-symbols-outlined">chair</span></div>`;
}

/* ── Nav (glassmorphism — style of Impact Area.html) ────────── */
export function renderNav(activeLink = '') {
  const links = [
    { href: '/index.html', label: 'Inicio' },
    { href: '/catalogos.html', label: 'Catálogos' },
    { href: '/productos.html', label: 'Productos' },
    { href: '/impacto.html', label: 'Impacto' },
    { href: '/contacto.html', label: 'Contacto' },
  ];
  const navLinks = links.map(l =>
    `<a href="${l.href}" class="${l.label === activeLink ? 'active' : ''}">${l.label}</a>`
  ).join('');

  return `
  <header>
    <nav class="glass-nav">
      <div class="nav-inner">
        <a href="/index.html" class="nav-logo">IMAGENIA</a>
        <div class="nav-links" id="nav-links">
          ${navLinks}
        </div>
        <div class="nav-cta">
          <div class="nav-search">
            <span class="material-symbols-outlined search-icon">search</span>
            <input type="text" placeholder="Buscar productos..." id="nav-search-input" oninput="handleSearch(this.value)">
          </div>
          <button onclick="Cart.openModal()" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:0.4rem; padding:0.4rem 0.6rem; border-color:rgba(255,255,255,0.3); position:relative; background:rgba(255,255,255,0.05); color:var(--primary, #00ff00);">
            <span class="material-symbols-outlined" style="font-size:1.2rem;">shopping_cart</span>
            <span id="cart-badge" style="display:none; position:absolute; top:-8px; right:-8px; background:var(--primary, #00ff00); color:#000; font-size:0.7rem; font-weight:bold; min-width:18px; height:18px; border-radius:9px; align-items:center; justify-content:center; padding:0 4px; border:2px solid var(--surface, #121212);">0</span>
          </button>
          <a href="/contacto.html#cotizacion" class="btn btn-primary btn-sm" style="white-space:nowrap">Cotizar</a>
          <button class="hamburger" id="hamburger" aria-label="Menu" onclick="toggleNav()">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </nav>
  </header>`;
}

/* ── Footer (dark, with impact stats from DB) ───────────────── */
export function renderFooter(settings = {}, impactStats = []) {
  const impactRows = impactStats.length > 0
    ? impactStats.map(s => `
      <div class="footer-impact-stat">
        <span class="material-symbols-outlined footer-impact-icon">${s.icon}</span>
        <div>
          <div class="footer-impact-value">${s.value}</div>
          <div class="footer-impact-label">${s.label}</div>
        </div>
      </div>`).join('')
    : '<p style="color:rgba(255,255,255,0.3);font-size:0.8rem">Sin datos de impacto aún.</p>';

  const socialIcons = ['instagram', 'facebook', 'linkedin', 'pinterest', 'youtube']
    .map(s => {
      const url = settings[`social_${s}`];
      const icon = settings[`social_${s}_icon`];
      if (url && icon) {
        return `<a href="${url}" target="_blank" class="footer-social-icon"><img src="${icon}" alt="${s}"></a>`;
      }
      return '';
    }).join('');

  let clientsArr = [];
  if (settings.client_logos_json) {
    try { clientsArr = JSON.parse(settings.client_logos_json); } catch (e) { }
  }
  const activeClients = (Array.isArray(clientsArr) ? clientsArr : [])
    .filter(c => c.active !== false && c.logo)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const clientsTitle = settings.footer_clients_title || 'Proyectos y Clientes';
  
  const half = Math.ceil(activeClients.length / 2);
  const row1 = activeClients.slice(0, half);
  const row2 = activeClients.slice(half).length ? activeClients.slice(half) : activeClients;

  const renderLogo = (c) => {
    const content = `<div class="client-logo-wrapper"><img src="${c.logo}" alt="${c.name || 'Cliente'}" loading="lazy"></div>`;
    return c.link
      ? `<a href="${c.link}" target="_blank" rel="noopener noreferrer" class="client-logo-item" title="${c.name || ''}">${content}</a>`
      : `<div class="client-logo-item" title="${c.name || ''}">${content}</div>`;
  };

  const row1Html = row1.map(renderLogo).join('').repeat(4);
  const row2Html = row2.map(renderLogo).join('').repeat(4);

  const clientsSection = activeClients.length > 0 ? `
    <style>
      @keyframes marqueeLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      @keyframes marqueeRight { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
      .marquee-track { display:flex; align-items:center; width:max-content; gap: 3rem; }
    </style>
    <div class="footer-clients" style="margin-top:4rem; width:100%; overflow:hidden; text-align:center;">
      <h4 style="color:rgba(255,255,255,0.6); font-size:0.8rem; margin-bottom:2.5rem; letter-spacing:0.15em; text-transform:uppercase;">${clientsTitle}</h4>
      <div style="display:flex; flex-direction:column; gap:2.5rem;">
        <div class="marquee-track" style="animation: marqueeLeft 120s linear infinite;">
          ${row1Html}
        </div>
        <div class="marquee-track" style="animation: marqueeRight 120s linear infinite;">
          ${row2Html}
        </div>
      </div>
    </div>
  ` : '';

  return `
  <footer class="footer-dark">
    <div class="container">
      <div class="footer-top" style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:1.5rem; margin-bottom:4rem; padding-bottom:3rem; border-bottom:1px solid rgba(255,255,255,0.08)">
        <div style="max-width:600px">
          <div class="footer-logo">IMAGENIA</div>
          <p class="footer-tagline" style="margin-top:0.5rem">${settings.footer_tagline || 'Ingeniería sustentable para espacios que perduran.'}</p>
        </div>
        <div class="footer-social" style="display:flex; gap:1rem; justify-content:center;">
          ${socialIcons}
        </div>
        ${clientsSection}
      </div>

      <div class="footer-grid">
        <div>
          <div class="footer-heading">Menú</div>
          <ul class="footer-links">
            <li><a href="/index.html">Inicio</a></li>
            <li><a href="/catalogos.html">Catálogos</a></li>
            <li><a href="/productos.html">Productos</a></li>
            <li><a href="/impacto.html">Impacto</a></li>
            <li><a href="/contacto.html">Contacto</a></li>
          </ul>
          <div style="margin-top:1.5rem">
            <div class="footer-heading">Legales</div>
            <ul class="footer-links">
              <li><a href="#" onclick="openLegalModal('privacy'); return false;">Aviso de privacidad</a></li>
              <li><a href="#" onclick="openLegalModal('terms'); return false;">Términos y condiciones</a></li>
            </ul>
          </div>
        </div>
        <div>
          <div class="footer-heading">Impacto</div>
          ${impactRows}
        </div>
        <div>
          <div class="footer-heading">Contacto</div>
          <ul class="footer-links">
            ${settings.contact_email ? `<li><a href="mailto:${settings.contact_email}">${settings.contact_email}</a></li>` : ''}
            ${settings.contact_phone ? `<li><a href="tel:${settings.contact_phone}">${settings.contact_phone}</a></li>` : ''}
          </ul>
          <div style="max-width:240px; width:100%; height:auto; aspect-ratio:240/80; background:rgba(255, 255, 255, 0); border:0px solid rgba(255,255,255,0.1); border-radius:0px; display:flex; align-items:center; justify-content:left; padding:0px;">
            <img src="assets/Worldwide shipping.svg" style="width:100%; height:100%; object-fit:contain; filter:brightness(0) invert(1); opacity:0.5;" alt="Worldwide Shipping">
          </div>
          <div style="margin-top:1.5rem; display:flex; flex-direction:column; gap:1rem;">
            ${settings.footer_map_iframe ? `
            <div class="footer-map-container" style="height:150px; width:100%; max-width:400px; border-radius:8px;">
              ${settings.footer_map_iframe}
            </div>` : ''}
          </div>
        </div>
      </div>

      <div class="footer-bottom" style="position:relative; text-align:center; display:block; width:100%;">
        <span style="display:inline-block;">Guglielmo Donati © ${new Date().getFullYear()} IMAGENIA. Todos los derechos reservados.</span>
        <a href="/admin/index.html" style="position:absolute; right:0; top:50%; transform:translateY(-50%); opacity:0.1; font-size:0.7rem; color:inherit; text-decoration:none;">Admin</a>
      </div>
    </div>
    
    <div id="legal-text-privacy" style="display:none;">${settings.footer_privacy_text || '<p>Aviso de Privacidad (pendiente)</p>'}</div>
    <div id="legal-text-terms" style="display:none;">${settings.footer_terms_text || '<p>Términos y Condiciones (pendientes)</p>'}</div>

    <div id="legal-modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:99999; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(5px);">
      <div style="background:#ffffff; width:100%; max-width:800px; max-height:85vh; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; border:1px solid #e9ecef; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        <div style="padding:1.5rem; border-bottom:1px solid #e9ecef; display:flex; justify-content:space-between; align-items:center; background:#f8f9fa;">
          <h3 id="legal-modal-title" style="margin:0; font-size:1.25rem; font-family:'Manrope', sans-serif; color:var(--primary, #00ff00); font-weight:700;">Legal</h3>
          <button onclick="closeLegalModal()" style="background:none; border:none; color:var(--primary, #00ff00); cursor:pointer; padding:0.5rem; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:background 0.3s;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='none'">
            <span class="material-symbols-outlined" style="font-size:1.5rem; font-weight:bold;">close</span>
          </button>
        </div>
        <div id="legal-modal-content" style="padding:2rem; overflow-y:auto; color:#000000; line-height:1.6; font-size:0.95rem; text-align:left;">
        </div>
      </div>
    </div>
    </div>
  </footer>
  `;
}

/* ── Init shared page elements ──────────────────────────────── */
export async function initPage(activeLink = '') {
  // Load impact stats from DB
  const { data: impactStats } = await supabase
    .from('impact_stats')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  const settings = await getSettings();

  // Inject nav
  const navPlaceholder = document.getElementById('nav-placeholder');
  if (navPlaceholder) navPlaceholder.outerHTML = renderNav(activeLink);

  // Inject footer
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) footerPlaceholder.outerHTML = renderFooter(settings, impactStats || []);

  // Pad main for fixed glass nav (no promo bar)
  const main = document.querySelector('main');
  if (main) main.style.paddingTop = '0';

  // WhatsApp widget
  initWhatsApp(settings);
  
  window.siteSettings = settings;
  window.showToast = showToast;
  Cart.init();

  return settings;
}

/* ── Mobile nav toggle ──────────────────────────────────────── */
window.toggleNav = function () {
  const links = document.getElementById('nav-links');
  if (links) links.classList.toggle('open');
};

/* ── Nav search redirect ────────────────────────────────────── */
window.handleSearch = function (val) {
  if (val.length > 2) {
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(() => {
      window.location.href = `/productos.html?search=${encodeURIComponent(val)}`;
    }, 600);
  }
};

window.openLegalModal = function(type) {
  const modal = document.getElementById('legal-modal-overlay');
  const title = document.getElementById('legal-modal-title');
  const content = document.getElementById('legal-modal-content');
  
  if (!modal || !title || !content) return;

  if (type === 'privacy') {
    title.textContent = 'Aviso de Privacidad';
    const privacyText = document.getElementById('legal-text-privacy');
    content.innerHTML = privacyText ? privacyText.innerHTML : '';
  } else {
    title.textContent = 'Términos y Condiciones';
    const termsText = document.getElementById('legal-text-terms');
    content.innerHTML = termsText ? termsText.innerHTML : '';
  }
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeLegalModal = function() {
  const modal = document.getElementById('legal-modal-overlay');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
};
