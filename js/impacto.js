// js/impacto.js — Página de Impacto (100% data-driven)
import { initPage, showToast } from './components.js';
import { getSettings, getImpactStats, getBlogs, getImpactComparisons, supabase } from './supabase.js';
import { renderCounter, initCounter } from './counter.js';

async function init() {
  const settings = await initPage('Impacto');

  await Promise.all([
    loadHero(settings),
    loadCards(settings),
    loadWhySection(settings),
    loadBlogs(),
    loadComparison(settings),
    loadCTA(settings),
  ]);

  renderCounter('counter-section', settings);
  initCounter();

  document.getElementById('cta-form')?.addEventListener('submit', handleCTAForm);
}

/* ── Hero ──────────────────────────────────────────────────── */
function loadHero(s) {
  setText('hero-badge',    s.impacto_hero_badge   || 'Precisión Sustentable');
  setText('hero-title',    s.impacto_hero_title   || 'Un Impacto que Transforma Espacios');
  setText('hero-text',     s.impacto_hero_text    || '');
  setText('hero-stat-val', s.impacto_hero_stat_value || '2,400');
  setText('hero-stat-lbl', s.impacto_hero_stat_label || 'Toneladas de plástico reciclado en 2024');

  const ctaPrimary = document.getElementById('hero-cta-primary');
  if (ctaPrimary) {
    ctaPrimary.textContent = s.impacto_hero_cta_primary_text || 'Solicitar Asesoría';
    ctaPrimary.href = s.impacto_hero_cta_primary_url || '/contacto.html';
  }
  const ctaSecondary = document.getElementById('hero-cta-secondary');
  if (ctaSecondary) {
    ctaSecondary.textContent = s.impacto_hero_cta_secondary_text || 'Ver Catálogo';
    ctaSecondary.href = s.impacto_hero_cta_secondary_url || '/catalogos.html';
  }
  const heroImgWrap = document.querySelector('.impacto-hero-img');
  const url = s.impacto_hero_image_url;
  
  if (heroImgWrap && url) {
    let iframeCode = null;
    if (url.toLowerCase().includes('<iframe')) {
      iframeCode = url;
    } else {
      let videoId = null;
      if (url.includes('youtube.com/watch')) videoId = new URL(url).searchParams.get('v');
      else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
      
      if (videoId) {
        const origin = window.location.origin;
        iframeCode = `<iframe src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${origin}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen frameborder="0"></iframe>`;
      }
    }

    if (iframeCode) {
      heroImgWrap.style.aspectRatio = '16/9';
      heroImgWrap.innerHTML = `
        <div style="position:relative; width:100%; height:100%; cursor:pointer;" id="hero-media-container">
          <style>#hero-iframe-wrap iframe { position:absolute; top:0; left:0; width:100% !important; height:100% !important; border:0; }</style>
          <div id="hero-iframe-wrap" style="position:absolute; inset:0;">${iframeCode}</div>
          <div id="hero-click-overlay" style="position:absolute; inset:0; z-index:2; background:transparent;"></div>
        </div>
      `;
    } else {
      heroImgWrap.style.aspectRatio = '4/5';
      heroImgWrap.innerHTML = `
        <div style="position:relative; width:100%; height:100%; cursor:pointer;" id="hero-media-container">
          <img src="${url}" alt="IMAGENIA — Impacto" style="width:100%;height:100%;object-fit:cover;">
        </div>
      `;
    }

    // Handle the movement of stats
    const mediaContainer = document.getElementById('hero-media-container');
    const heroWrap = document.querySelector('.impacto-hero-img-wrap');
    if (mediaContainer && heroWrap) {
      mediaContainer.addEventListener('click', () => {
        heroWrap.classList.add('stats-moved');
        const overlay = document.getElementById('hero-click-overlay');
        if (overlay) overlay.remove(); // Allow interaction with video after moving stats
      });
    }
  }
}

/* ── Impact Cards ──────────────────────────────────────────── */
async function loadCards(settings) {
  if (settings && settings.impact_section_title) {
    const titleEl = document.getElementById('impact-cards-title');
    if (titleEl) titleEl.textContent = settings.impact_section_title;
  }
  const { data } = await getImpactStats();
  const container = document.getElementById('impact-cards');
  if (!container) return;
  if (!data || !data.length) {
    container.innerHTML = '<p class="text-muted" style="grid-column:1/-1">Sin datos de impacto. Agrégalos desde el panel de control.</p>';
    return;
  }
  container.innerHTML = data.map(c => `
    <div class="impact-card">
      <span class="material-symbols-outlined impact-card-icon">${c.icon}</span>
      <h3 class="impact-card-title">${c.title || c.label}</h3>
      <p class="impact-card-desc">${c.description || ''}</p>
    </div>`).join('');
}

/* ── Why Section ───────────────────────────────────────────── */
function loadWhySection(s) {
  setText('why-title',  s.impacto_why_title   || '¿Por qué Madera Plástica Reciclada?');
  setText('why-text1',  s.impacto_why_text1   || '');
  setText('why-text2',  s.impacto_why_text2   || '');
  setText('why-m1-lbl', s.impacto_why_metric1_label || 'Vida Útil');
  setText('why-m1-val', s.impacto_why_metric1_value || '40+ Años');
  setText('why-m2-lbl', s.impacto_why_metric2_label || 'Ahorro Mantenimiento');
  setText('why-m2-val', s.impacto_why_metric2_value || '-85%');

  function renderWhyMedia(imgId, pId, containerClass, value) {
    const img = document.getElementById(imgId);
    if (!value || !img) return;
    
    const container = img.parentElement;
    const p = document.getElementById(pId);
    if (p) p.style.display = 'none';

    if (value.includes('<iframe')) {
      img.style.display = 'none';
      if (!container.querySelector('.responsive-iframe-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'responsive-iframe-wrap';
        wrap.style.position = 'relative';
        wrap.style.paddingBottom = '56.25%';
        wrap.style.height = '0';
        wrap.style.overflow = 'hidden';
        wrap.style.borderRadius = 'var(--radius-md)';
        wrap.style.width = '100%';
        wrap.innerHTML = value;
        const iframe = wrap.querySelector('iframe');
        if (iframe) {
          iframe.style.position = 'absolute';
          iframe.style.top = '0';
          iframe.style.left = '0';
          iframe.style.width = '100%';
          iframe.style.height = '100%';
        }
        container.appendChild(wrap);
      }
    } else {
      img.src = value;
      img.style.display = 'block';
    }
  }

  renderWhyMedia('why-img1', 'why-p1', 'why-img', s.impacto_why_image1_url);
  renderWhyMedia('why-img2', 'why-p2', 'why-img', s.impacto_why_image2_url);
}

let loadedBlogs = [];

/* ── Blogs ─────────────────────────────────────────────────── */
async function loadBlogs() {
  const { data } = await getBlogs();
  loadedBlogs = data || [];
  const container = document.getElementById('blogs-slider');
  if (!container) return;
  if (!loadedBlogs.length) {
    container.innerHTML = '<p class="text-muted">Próximamente nuevas noticias.</p>';
    return;
  }
  container.innerHTML = loadedBlogs.map(blog => `
    <div class="blog-card" onclick="openBlogReader('${blog.id}')" ${!blog.is_active ? 'style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;"' : ''}>
      ${blog.image_url
        ? `<img src="${blog.image_url}" alt="${blog.title}" class="blog-img">`
        : `<div class="blog-img-placeholder"><span class="material-symbols-outlined">article</span></div>`}
      <div class="blog-overlay">
        <div class="blog-gradient"></div>
        <div class="blog-content">
          <h3 class="blog-title" style="margin-bottom:0;">${blog.title}</h3>
        </div>
      </div>
    </div>`).join('');
}

window.openBlogReader = function(id) {
  const blog = loadedBlogs.find(b => b.id === id);
  if (!blog) return;
  
  // Generate slug exactly as done in blog.js
  const slug = blog.title.toString().toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-]+/g, '')
    .replace(/\_\_+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
    
  window.location.href = `/blog.html?t=${slug}`;
};

/* ── Comparison Table ──────────────────────────────────────── */
async function loadComparison(s) {
  setText('comp-title',    s.impacto_comparison_title    || 'La Diferencia de Rendimiento');
  setText('comp-subtitle', s.impacto_comparison_subtitle || 'Cuantificando la superioridad arquitectónica de los materiales IMAGENIA.');
  setText('comp-col1',     s.impacto_comparison_col1     || 'Madera Plástica Reciclada');
  setText('comp-col2',     s.impacto_comparison_col2     || 'Madera/Metal Tradicional');

  const { data } = await getImpactComparisons();
  const tbody = document.getElementById('comp-tbody');
  if (!tbody) return;
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin comparaciones configuradas.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(row => `
    <tr>
      <td class="comp-feature">${row.feature}</td>
      <td class="comp-imagenia">
        <span class="material-symbols-outlined comp-check">check_circle</span>
        ${row.col_imagenia}
      </td>
      <td class="comp-trad">${row.col_traditional}</td>
    </tr>`).join('');
}

/* ── CTA Section ───────────────────────────────────────────── */
function loadCTA(s) {
  setText('cta-title', s.impacto_cta_title || '¿Listo para construir un legado sustentable?');
  setText('cta-text',  s.impacto_cta_text  || '');
}

/* ── CTA Form ──────────────────────────────────────────────── */
async function handleCTAForm(e) {
  e.preventDefault();
  const btn = document.getElementById('cta-submit');
  btn.textContent = 'Enviando...';
  btn.disabled = true;
  const { error } = await supabase.from('quote_submissions').insert({
    nombre:        document.getElementById('cta-nombre').value,
    email:         document.getElementById('cta-email').value,
    tipo_proyecto: document.getElementById('cta-tipo').value,
  });
  btn.textContent = 'Solicitar Asesoría';
  btn.disabled = false;
  if (error) { showToast('Error al enviar. Inténtalo de nuevo.', 'error'); return; }
  showToast('¡Solicitud enviada! Te contactaremos pronto.');
  e.target.reset();
}

/* ── Utility ───────────────────────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.textContent = val;
}

init();
