// js/catalogos.js
import { initPage, showToast } from './components.js';
import { getCatalogs } from './supabase.js';

async function init() {
  await initPage('Catálogos');
  const { data, error } = await getCatalogs();
  const grid = document.getElementById('catalog-grid');

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<div class="empty-catalogs">
      <span class="material-symbols-outlined">menu_book</span>
      <h3 style="color:var(--primary);margin-bottom:0.5rem">Sin catálogos disponibles</h3>
      <p style="color:var(--on-surface-variant)">Los catálogos se agregarán desde el panel de control.</p>
    </div>`;
    return;
  }

  const selectorsContainer = document.getElementById('catalog-selectors');
  if (selectorsContainer) {
    selectorsContainer.innerHTML = data.map(c => 
      `<button class="catalog-selector-chip" onclick="scrollToCatalog('catalog-${c.id}')">${c.title}</button>`
    ).join('');
  }

  grid.innerHTML = data.map(c => `
    <div class="catalog-card" id="catalog-${c.id}">
      <div class="catalog-cover">
        ${c.cover_image_url
          ? `<img src="${c.cover_image_url}" alt="${c.title}" loading="lazy" onerror="this.parentElement.innerHTML=fallbackCover('${c.title}')">`
          : `<div class="cover-placeholder"><span class="material-symbols-outlined">picture_as_pdf</span><span>${c.title}</span></div>`
        }
      </div>
      <div class="catalog-info">
        ${c.category_slug ? `<div class="catalog-badge">${c.category_slug}</div>` : ''}
        <div class="catalog-title">${c.title} ${c.year ? `<span style="color:var(--primary)">${c.year}</span>` : ''}</div>
        ${c.subtitle ? `<p class="catalog-sub">${c.subtitle}</p>` : ''}
        
        ${c.pdf_url ? `
        <div class="catalog-actions" style="margin-top:0.5rem">
          <button onclick="forceDownloadPDF('${c.pdf_url}', '${c.title}')" class="btn" style="background:#fff;color:#111;border:none;border-radius:99px;padding:0.75rem 1.75rem;font-weight:700;display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <span class="material-symbols-outlined" style="font-size:1.1rem">download</span>
            Descargar catálogo
          </button>
          <button onclick="openPDFPreview('${c.pdf_url}', '${c.title}')" class="btn" style="background:rgba(255,255,255,0.15);backdrop-filter:blur(4px);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:99px;padding:0.75rem 1.5rem;font-weight:700;display:inline-flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <span class="material-symbols-outlined" style="font-size:1.1rem">visibility</span>
            Vista previa
          </button>
        </div>
        ` : `
        <div class="catalog-actions" style="margin-top:0.5rem">
          <p style="font-size:0.85rem;color:var(--error-color, #ff6b6b);background:rgba(0,0,0,0.5);padding:0.5rem 1rem;border-radius:var(--radius-sm);width:fit-content">⚠️ PDF no disponible</p>
        </div>
        `}
      </div>
    </div>
  `).join('');
}

window.fallbackCover = (title) => `
  <div class="cover-placeholder">
    <span class="material-symbols-outlined">picture_as_pdf</span>
    <span>${title}</span>
  </div>`;

window.scrollToCatalog = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight');
    setTimeout(() => {
      el.classList.remove('highlight');
    }, 2000);
  }
};

window.openPDFPreview = function(url, title) {
  document.getElementById('pdf-preview-title').textContent = title;
  document.getElementById('pdf-iframe').src = url;
  document.getElementById('modal-pdf-preview').classList.add('open');
};

window.forceDownloadPDF = async function(url, title) {
  try {
    showToast('Iniciando descarga...', 'success');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    // Format filename properly e.g. "catalogo_columpios_2025.pdf"
    a.download = `catalogo_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    console.error('Download failed, opening in new tab instead:', error);
    showToast('Abriendo PDF directamente...', 'info');
    window.open(url, '_blank');
  }
};

init();
