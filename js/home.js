// js/home.js — IMAGENIA Homepage v2 (fully data-driven)
import { initPage, showToast, imgWithFallback } from './components.js';
import { getSettings, getCategories, supabase } from './supabase.js';
import { renderCounter, initCounter } from './counter.js';

/* ── Hero Slider state ────────────────────────────────────────── */
let slides = [];
let currentSlide = 0;
let sliderTimer = null;

/* ── Photo Carousel state ─────────────────────────────────────── */
let photoSlides = [];
let photoCurrentIndex = 0;
let photoTimer = null;

/* ── Bootstrap ────────────────────────────────────────────────── */
async function init() {
  const settings = await initPage('Inicio');

  await Promise.all([
    loadSlider(),
    loadAbout(settings),
    loadCategories(settings),
    loadPhotoCarousel(settings),
    loadPromoBanner(settings),
    loadQuoteForm(settings),
  ]);

  renderCounter('counter-section', settings);
  initCounter();

  const contactForm = document.getElementById('contact-form');
  if (contactForm) contactForm.addEventListener('submit', handleContact);
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
function startAutoplay() { sliderTimer = setInterval(() => sliderGoTo(currentSlide + 1), 5000); }
function resetAutoplay() { clearInterval(sliderTimer); startAutoplay(); }

window.sliderPrev  = () => sliderGoTo(currentSlide - 1);
window.sliderNext  = () => sliderGoTo(currentSlide + 1);
window.sliderGoTo  = sliderGoTo;

/* ── About section ────────────────────────────────────────────── */
function loadAbout(settings) {
  const title = document.getElementById('about-title');
  const text  = document.getElementById('about-text');
  const wrap  = document.getElementById('about-image-wrap');
  if (title && (settings.home_about_title || settings.about_title))
    title.textContent = settings.home_about_title || settings.about_title;
  if (text && (settings.home_about_text || settings.about_text))
    text.textContent = settings.home_about_text || settings.about_text;
  if (wrap && settings.home_about_image_url) {
    const url = settings.home_about_image_url;
    const isVideo = url.toLowerCase().match(/\.(mp4|webm)$/);
    wrap.innerHTML = isVideo
      ? `<video src="${url}" style="width:100%;height:100%;border-radius:12px;object-fit:cover;" autoplay muted loop playsinline></video>`
      : `<img src="${url}" alt="Acerca de IMAGENIA" loading="lazy" style="width:100%;height:100%;border-radius:12px;object-fit:cover;">`;
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
  if (!allCats?.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin categorías aún.</p>`;
    return;
  }

  let featuredIds = [];
  try { featuredIds = JSON.parse(settings?.home_featured_categories || '[]'); } catch (e) {}

  let featuredCats = featuredIds.length
    ? featuredIds.map(id => allCats.find(c => c.id === id)).filter(Boolean)
    : [];
  if (featuredCats.length < 4) featuredCats = allCats.slice(0, 4);
  else featuredCats = featuredCats.slice(0, 4);

  const html = featuredCats.map(c => `
    <div class="cat-img-card" onclick="window.location.href='/productos.html?cat=${c.slug}'" role="link" tabindex="0">
      ${c.image_url
        ? `<img src="${c.image_url}" alt="${c.name}" loading="lazy">`
        : `<div class="cat-img-card-placeholder"><span class="material-symbols-outlined">${c.icon_name || 'category'}</span></div>`}
      <div class="cat-img-card-overlay">
        <div class="cat-img-card-name">${c.name}</div>
        <div class="cat-img-card-link">Ver productos →</div>
      </div>
    </div>`).join('');

  const mosaicCells = featuredCats.map(c =>
    c.image_url
      ? `<div class="cat-mosaic-cell"><img src="${c.image_url}" alt="${c.name}" loading="lazy"></div>`
      : `<div class="cat-mosaic-cell"><div style="width:100%;height:100%;background:var(--primary-container);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="color:var(--primary);font-size:1.5rem;">${c.icon_name || 'category'}</span></div></div>`
  );
  while (mosaicCells.length < 4) mosaicCells.push(`<div class="cat-mosaic-cell"><div style="width:100%;height:100%;background:var(--surface-container-high);"></div></div>`);

  grid.innerHTML = html + `
    <div class="cat-img-card" onclick="window.location.href='/productos.html'" role="link" tabindex="0">
      <div class="cat-mosaic-grid">${mosaicCells.join('')}</div>
      <div class="cat-img-card-overlay">
        <div class="cat-img-card-name">Todos</div>
        <div class="cat-img-card-link">Ver todo el catálogo →</div>
      </div>
    </div>`;
}

/* ── Photo Carousel ───────────────────────────────────────────── */
function loadPhotoCarousel(settings) {
  const section = document.getElementById('home-photo-carousel-section');
  if (!section) return;

  let items = [];
  try { items = JSON.parse(settings.home_photo_carousel_json || '[]'); } catch (e) {}
  items = items
    .filter(i => i.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .slice(0, 7); // máximo 7

  if (!items.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  photoSlides = items;

  const track = document.getElementById('photo-carousel-track');
  const dots  = document.getElementById('photo-carousel-dots');

  track.innerHTML = items.map((item, i) => `
    <div class="photo-carousel-slide${i === 0 ? ' active' : ''}"
         ${item.link ? `onclick="window.location.href='${item.link}'" style="cursor:pointer"` : ''}>
      <img src="${item.image_url}" alt="${item.title || 'IMAGENIA'}" loading="${i === 0 ? 'eager' : 'lazy'}">
      ${(item.title || item.subtitle) ? `
        <div class="photo-carousel-caption">
          ${item.title ? `<h3>${item.title}</h3>` : ''}
          ${item.subtitle ? `<p>${item.subtitle}</p>` : ''}
          ${item.link ? `<span class="photo-carousel-cta">Ver más →</span>` : ''}
        </div>` : ''}
    </div>`).join('');

  dots.innerHTML = items.map((_, i) =>
    `<button class="photo-carousel-dot${i === 0 ? ' active' : ''}" onclick="photoCarouselGoTo(${i})" aria-label="Foto ${i+1}"></button>`
  ).join('');

  if (items.length <= 1) {
    document.querySelector('.photo-carousel-prev')?.style && (document.querySelector('.photo-carousel-prev').style.display = 'none');
    document.querySelector('.photo-carousel-next')?.style && (document.querySelector('.photo-carousel-next').style.display = 'none');
  }

  // Touch / swipe
  const carousel = document.getElementById('photo-carousel');
  let startX = 0;
  carousel.addEventListener('touchstart', e => { startX = e.changedTouches[0].screenX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - startX;
    if (Math.abs(diff) > 50) diff < 0 ? photoCarouselGoTo(photoCurrentIndex + 1) : photoCarouselGoTo(photoCurrentIndex - 1);
  }, { passive: true });

  const isMobile = window.innerWidth <= 768;
  const visibleSlides = isMobile ? 1 : 3;
  if (items.length > visibleSlides) {
    photoTimer = setInterval(() => photoCarouselGoTo(photoCurrentIndex + 1), 4500);
  } else {
    // Hide prev/next buttons if not enough slides to scroll
    document.querySelector('.photo-carousel-prev')?.style && (document.querySelector('.photo-carousel-prev').style.display = 'none');
    document.querySelector('.photo-carousel-next')?.style && (document.querySelector('.photo-carousel-next').style.display = 'none');
  }
}

function photoCarouselGoTo(index) {
  const allSlides = document.querySelectorAll('.photo-carousel-slide');
  const allDots   = document.querySelectorAll('.photo-carousel-dot');
  
  allSlides[photoCurrentIndex]?.classList.remove('active');
  allDots[photoCurrentIndex]?.classList.remove('active');
  
  const isMobile = window.innerWidth <= 768;
  const visibleSlides = isMobile ? 1 : 3;
  const maxIndex = Math.max(0, photoSlides.length - visibleSlides);
  
  if (index < 0) {
    index = maxIndex;
  } else if (index > maxIndex) {
    index = 0;
  }

  photoCurrentIndex = index;
  
  allSlides[photoCurrentIndex]?.classList.add('active');
  // Puede que haya más puntos que maxIndex, si se hace click en uno mayor, activamos el último posible
  if(allDots[photoCurrentIndex]) {
    allDots[photoCurrentIndex].classList.add('active');
  } else {
    allDots[maxIndex]?.classList.add('active');
  }
  
  const track = document.getElementById('photo-carousel-track');
  const slidePercentage = isMobile ? 100 : 33.3333;
  track.style.transform = `translateX(-${photoCurrentIndex * slidePercentage}%)`;

  clearInterval(photoTimer);
  if (photoSlides.length > visibleSlides) photoTimer = setInterval(() => photoCarouselGoTo(photoCurrentIndex + 1), 4500);
}

window.photoCarouselPrev = () => photoCarouselGoTo(photoCurrentIndex - 1);
window.photoCarouselNext = () => photoCarouselGoTo(photoCurrentIndex + 1);
window.photoCarouselGoTo = photoCarouselGoTo;

/* ── Promo Banner ─────────────────────────────────────────────── */
function loadPromoBanner(settings) {
  const el  = document.getElementById('promo-banner-text');
  const cta = document.getElementById('promo-banner-cta');
  const bg  = document.getElementById('promo-banner-bg');
  if (el && settings.promo_banner_text) el.textContent = settings.promo_banner_text;
  if (cta) {
    if (settings.promo_banner_cta_text) cta.textContent = settings.promo_banner_cta_text;
    if (settings.promo_banner_cta_url)  cta.href = settings.promo_banner_cta_url;
  }
  if (bg && settings.promo_banner_image_url) bg.style.backgroundImage = `url('${settings.promo_banner_image_url}')`;
}

/* ── Quote form image ─────────────────────────────────────────── */
function loadQuoteForm(settings) {
  const wrap = document.getElementById('quote-image-wrap');
  if (wrap && settings.contact_form_image_url)
    wrap.innerHTML = `<img src="${settings.contact_form_image_url}" alt="Proyecto IMAGENIA" loading="lazy">`;
}

/* ── Contact form ─────────────────────────────────────────────── */
async function handleContact(e) {
  e.preventDefault();
  const btn = document.getElementById('contact-btn');
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  const producto = document.getElementById('f-producto')?.value || '';
  const comentariosRaw = document.getElementById('f-comentarios')?.value || '';
  const comentariosFull = producto ? `Producto de interés: ${producto}\n\n${comentariosRaw}` : comentariosRaw;

  const { error } = await supabase.from('contact_submissions').insert({
    nombre:     document.getElementById('f-nombre').value,
    empresa:    document.getElementById('f-empresa')?.value || null,
    email:      document.getElementById('f-email').value,
    telefono:   document.getElementById('f-tel')?.value || null,
    comentarios: comentariosFull || null,
  });

  btn.textContent = 'Solicitar Asesoría';
  btn.disabled = false;
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('¡Solicitud enviada! Te contactaremos pronto.');
  e.target.reset();
}

init();
