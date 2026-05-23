// js/home.js — IMAGENIA Homepage v2 (fully data-driven)
import { initPage, showToast, imgWithFallback } from './components.js';
import { getSettings, getCategories, getProducts, supabase } from './supabase.js';
import { renderCounter, initCounter } from './counter.js';

/* ── Slider state ─────────────────────────────────────────────── */
let slides = [];
let currentSlide = 0;
let sliderTimer = null;

/* ── Bootstrap ────────────────────────────────────────────────── */
async function init() {
  const settings = await initPage('Inicio');

  await Promise.all([
    loadSlider(),
    loadAbout(settings),
    loadCategories(settings),
    loadProducts('bestseller'),
    loadPromoBanner(settings),
    loadQuoteForm(settings),
  ]);

  // Counter (after settings loaded)
  renderCounter('counter-section', settings);
  initCounter();

  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContact);
  }
}

/* ── Hero Slider ──────────────────────────────────────────────── */
async function loadSlider() {
  const { data } = await supabase
    .from('hero_slides')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  slides = data || [];
  const container = document.getElementById('slides-container');
  const dotsContainer = document.getElementById('slider-dots');

  if (!slides.length) {
    // Fallback: show default green hero
    container.innerHTML = `
      <div class="slide active">
        <div class="slide-bg" style="background:var(--primary)"></div>
        <div class="slide-overlay"></div>
        <div class="slide-content">
          <div class="slide-text">
            <h1>Muebles de Exterior Premium</h1>
            <p>Transformamos plástico reciclado en soluciones duraderas para hoteles, desarrollos inmobiliarios y espacios al aire libre.</p>
            <div class="slide-cta">
              <a href="/catalogos.html" class="btn btn-primary">Ver Catálogos</a>
              <a href="#cotizacion" class="btn btn-secondary" style="background:rgba(255,255,255,0.15);color:#fff;border-color:rgba(255,255,255,0.3)">Cotizar</a>
            </div>
          </div>
        </div>
      </div>`;
    dotsContainer.innerHTML = '';
    document.getElementById('slider-prev').style.display = 'none';
    document.getElementById('slider-next').style.display = 'none';
    return;
  }

  // Render slides
  container.innerHTML = slides.map((s, i) => `
    <div class="slide${i === 0 ? ' active' : ''}" data-index="${i}">
      <div class="slide-bg" style="background-image:url('${s.image_url}')"></div>
      <div class="slide-overlay"></div>
      <div class="slide-content">
        <div class="slide-text">
          ${s.title ? `<h1>${s.title}</h1>` : ''}
          ${s.subtitle ? `<p>${s.subtitle}</p>` : ''}
          ${s.cta_text && s.cta_url ? `
          <div class="slide-cta">
            <a href="${s.cta_url}" class="btn btn-primary">${s.cta_text}</a>
            <a href="#cotizacion" class="btn btn-secondary" style="background:rgba(255,255,255,0.15);color:#fff;border-color:rgba(255,255,255,0.3)">Cotizar</a>
          </div>` : ''}
        </div>
      </div>
    </div>`).join('');

  // Render dots
  dotsContainer.innerHTML = slides.map((_, i) =>
    `<button class="slider-dot${i === 0 ? ' active' : ''}" onclick="sliderGoTo(${i})" aria-label="Slide ${i+1}"></button>`
  ).join('');

  if (slides.length <= 1) {
    document.getElementById('slider-prev').style.display = 'none';
    document.getElementById('slider-next').style.display = 'none';
  }

  startAutoplay();
}

function sliderGoTo(index) {
  const allSlides = document.querySelectorAll('.slide');
  const allDots = document.querySelectorAll('.slider-dot');
  allSlides[currentSlide]?.classList.remove('active');
  allDots[currentSlide]?.classList.remove('active');
  currentSlide = (index + slides.length) % slides.length;
  allSlides[currentSlide]?.classList.add('active');
  allDots[currentSlide]?.classList.add('active');
  resetAutoplay();
}

function startAutoplay() {
  sliderTimer = setInterval(() => sliderGoTo(currentSlide + 1), 5000);
}

function resetAutoplay() {
  clearInterval(sliderTimer);
  startAutoplay();
}

window.sliderPrev = () => sliderGoTo(currentSlide - 1);
window.sliderNext = () => sliderGoTo(currentSlide + 1);
window.sliderGoTo = sliderGoTo;

/* ── About section ────────────────────────────────────────────── */
function loadAbout(settings) {
  const title = document.getElementById('about-title');
  const text = document.getElementById('about-text');
  const wrap = document.getElementById('about-image-wrap');
  
  const aboutTitle = settings.home_about_title || settings.about_title;
  const aboutText = settings.home_about_text || settings.about_text;
  
  if (title && aboutTitle) title.textContent = aboutTitle;
  if (text && aboutText) text.textContent = aboutText;
  
  if (wrap && settings.home_about_image_url) {
    const url = settings.home_about_image_url;
    const isVideo = url.toLowerCase().match(/\.(mp4|webm)$/);
    if (isVideo) {
      wrap.innerHTML = `<video src="${url}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;" autoplay muted loop playsinline></video>`;
    } else {
      wrap.innerHTML = `<img src="${url}" alt="Acerca de IMAGENIA" loading="lazy" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;">`;
    }
  }
}

/* ── Categories ───────────────────────────────────────────────── */
async function loadCategories(settings) {
  if (settings) {
    const badge = document.getElementById('home-categories-badge');
    const title = document.getElementById('home-categories-title');
    if (badge && settings.home_categories_badge) badge.textContent = settings.home_categories_badge;
    if (title && settings.home_categories_title) title.innerHTML = settings.home_categories_title;
  }
  const { data: allCats } = await getCategories();
  const grid = document.getElementById('category-grid');
  if (!allCats || !allCats.length) {
    grid.innerHTML = `<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:2rem">Sin categorías aún. Agrégalas desde el panel de control.</p>`;
    return;
  }

  // Parse home categories config
  let featuredIds = [];
  if (settings && settings.home_featured_categories) {
    try {
      featuredIds = JSON.parse(settings.home_featured_categories);
    } catch (e) {
      console.error("Error parsing home_featured_categories:", e);
    }
  }

  // Get active and featured categories
  let featuredCats = [];
  if (featuredIds && featuredIds.length) {
    featuredCats = featuredIds
      .map(id => allCats.find(c => c.id === id))
      .filter(Boolean); // remove inactive/deleted categories
  }

  // Fallback: if no config or not enough categories, take first 4 active ones
  if (featuredCats.length < 4) {
    featuredCats = allCats.slice(0, 4);
  } else {
    featuredCats = featuredCats.slice(0, 4); // ensure exactly 4
  }

  // Render the 4 category cards
  let html = featuredCats.map(c => `
    <div class="cat-img-card" onclick="window.location.href='/productos.html?cat=${c.slug}'" role="link" tabindex="0">
      ${c.image_url
        ? `<img src="${c.image_url}" alt="${c.name}" loading="lazy">`
        : `<div class="cat-img-card-placeholder"><span class="material-symbols-outlined">${c.icon_name || 'category'}</span></div>`}
      <div class="cat-img-card-overlay">
        <div class="cat-img-card-name">${c.name}</div>
        <div class="cat-img-card-link">Ver productos →</div>
      </div>
    </div>`).join('');

  // Build the mosaic images for the "Todos" card
  const mosaicCells = featuredCats.map(c => {
    if (c.image_url) {
      return `<div class="cat-mosaic-cell"><img src="${c.image_url}" alt="${c.name}" loading="lazy"></div>`;
    } else {
      return `<div class="cat-mosaic-cell"><div style="width:100%;height:100%;background:var(--primary-container);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="color:var(--primary);font-size:1.5rem;">${c.icon_name || 'category'}</span></div></div>`;
    }
  });

  // Pad the mosaic with empty placeholders if less than 4 categories
  while (mosaicCells.length < 4) {
    mosaicCells.push(`<div class="cat-mosaic-cell"><div style="width:100%;height:100%;background:var(--surface-container-high);"></div></div>`);
  }

  // Add the "Todos" card html
  const todosCardHtml = `
    <div class="cat-img-card" onclick="window.location.href='/productos.html'" role="link" tabindex="0">
      <div class="cat-mosaic-grid">
        ${mosaicCells.join('')}
      </div>
      <div class="cat-img-card-overlay">
        <div class="cat-img-card-name">Todos</div>
        <div class="cat-img-card-link">Ver todo el catálogo →</div>
      </div>
    </div>
  `;

  grid.innerHTML = html + todosCardHtml;
}


/* ── Promo Banner ─────────────────────────────────────────────── */
function loadPromoBanner(settings) {
  const el = document.getElementById('promo-banner-text');
  const cta = document.getElementById('promo-banner-cta');
  const bg = document.getElementById('promo-banner-bg');
  if (el && settings.promo_banner_text) el.textContent = settings.promo_banner_text;
  if (cta) {
    if (settings.promo_banner_cta_text) cta.textContent = settings.promo_banner_cta_text;
    if (settings.promo_banner_cta_url) cta.href = settings.promo_banner_cta_url;
  }
  if (bg && settings.promo_banner_image_url) {
    bg.style.backgroundImage = `url('${settings.promo_banner_image_url}')`;
  }
}

/* ── Quote form image ─────────────────────────────────────────── */
function loadQuoteForm(settings) {
  const wrap = document.getElementById('quote-image-wrap');
  if (wrap && settings.contact_form_image_url) {
    wrap.innerHTML = `<img src="${settings.contact_form_image_url}" alt="Proyecto IMAGENIA" loading="lazy">`;
  }
}

/* ── Products ─────────────────────────────────────────────────── */
async function loadProducts(tab) {
  const grid = document.getElementById('products-grid-home');
  grid.innerHTML = Array(8).fill('<div class="card skeleton" style="height:280px"></div>').join('');

  const opts = { pageSize: 8 };
  if (tab === 'bestseller') opts.bestseller = true;
  else if (tab === 'new') opts.isNew = true;
  else if (tab === 'featured') opts.featured = true;

  const { data } = await getProducts(opts);
  if (!data || !data.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--on-surface-variant)">
      <span class="material-symbols-outlined" style="font-size:3rem;display:block;margin-bottom:1rem">inventory_2</span>
      Aún no hay productos en esta categoría.
    </div>`;
    return;
  }
  grid.innerHTML = data.map(p => renderProductCard(p)).join('');
}

function renderProductCard(p) {
  return `
  <div class="card">
    <div class="card-image">${imgWithFallback(p.image_url, p.name)}</div>
    <div class="card-body">
      <div class="card-title">${p.name}</div>
      <button class="btn btn-primary btn-sm btn-full mt-3"
        onclick="event.stopPropagation();window.location.href='/contacto.html?producto=${encodeURIComponent(p.name)}'">
        Cotizar
      </button>
    </div>
  </div>`;
}

/* ── Contact form submission ────────────────────────────────────── */
async function handleContact(e) {
  e.preventDefault();
  const btn = document.getElementById('contact-btn');
  btn.textContent = 'Enviando...';
  btn.disabled = true;
  
  const producto = document.getElementById('f-producto')?.value || '';
  const comentariosRaw = document.getElementById('f-comentarios')?.value || '';
  const comentariosFull = producto ? `Producto de interés: ${producto}\n\n${comentariosRaw}` : comentariosRaw;

  const { error } = await supabase.from('contact_submissions').insert({
    nombre: document.getElementById('f-nombre').value,
    empresa: document.getElementById('f-empresa')?.value || null,
    email: document.getElementById('f-email').value,
    telefono: document.getElementById('f-tel')?.value || null,
    comentarios: comentariosFull || null,
  });
  
  btn.textContent = 'Solicitar Asesoría';
  btn.disabled = false;
  if (error) { 
    console.error("Supabase Error:", error);
    showToast('Error: ' + error.message, 'error'); 
    return; 
  }
  showToast('¡Solicitud enviada! Te contactaremos pronto.');
  e.target.reset();
}

/* ── Tab switching ────────────────────────────────────────────── */
window.switchTab = async function(tab, el) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  await loadProducts(tab);
};

init();
