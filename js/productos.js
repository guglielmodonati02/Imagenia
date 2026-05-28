// js/productos.js
import { initPage, showToast, imgWithFallback } from './components.js';
import { getCategories, getTagGroups, supabase } from './supabase.js';

const PAGE_SIZE = 15;
let currentPage = 1;
let currentCategory = 'todos';
let selectedTagIds = new Set();
let allTagGroups = [];
let searchQuery = '';
let totalCount = 0;
let siteSettings = {};
let currentLightboxGallery = [];
let currentLightboxIndex = 0;

async function init() {
  siteSettings = await initPage('Productos');

  // Set page header image if configured
  const headerImg = siteSettings.headers_productos || '';
  const headerEl = document.getElementById('productos-header');
  if (headerEl && headerImg) {
    headerEl.style.backgroundImage = `url(${headerImg})`;
    headerEl.classList.add('has-image');
  }

  // Check URL params
  const params = new URLSearchParams(window.location.search);
  if (params.get('cat')) currentCategory = params.get('cat');
  if (params.get('search')) searchQuery = params.get('search');

  // Load categories for tabs
  const { data: cats } = await getCategories();
  renderCategoryTabs(cats || []);

  // Load tag groups for filters
  allTagGroups = await getTagGroups();
  renderFilters();

  // Load products
  await loadProducts();
}

function renderCategoryTabs(cats) {
  const tabsEl = document.getElementById('cat-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = '';

  const activeCats = cats.filter(c => c.slug !== 'todos');

  // Build the mosaic images for the "Todos" card
  const featuredForMosaic = activeCats.slice(0, 4);
  const mosaicCells = featuredForMosaic.map(c => {
    if (c.image_url) {
      return `<div class="cat-mosaic-cell"><img src="${c.image_url}" alt="${c.name}" loading="lazy"></div>`;
    } else {
      return `<div class="cat-mosaic-cell"><div style="width:100%;height:100%;background:var(--primary-container);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="color:var(--primary);font-size:1.5rem;">${c.icon_name || 'category'}</span></div></div>`;
    }
  });

  while (mosaicCells.length < 4) {
    mosaicCells.push(`<div class="cat-mosaic-cell"><div style="width:100%;height:100%;background:var(--surface-container-high);"></div></div>`);
  }

  // Create the "Todos" card
  const todosCard = document.createElement('div');
  todosCard.className = 'cat-img-card' + (currentCategory === 'todos' ? ' active' : '');
  todosCard.setAttribute('role', 'button');
  todosCard.onclick = () => setCategory('todos', todosCard);
  todosCard.innerHTML = `
    <div class="cat-mosaic-grid">
      ${mosaicCells.join('')}
    </div>
    <div class="cat-img-card-overlay">
      <div class="cat-img-card-name">Todos</div>
      <div class="cat-img-card-link">Ver todo →</div>
    </div>
  `;
  tabsEl.appendChild(todosCard);

  // Render the remaining category cards
  activeCats.forEach(c => {
    const card = document.createElement('div');
    card.className = 'cat-img-card' + (currentCategory === c.slug ? ' active' : '');
    card.setAttribute('role', 'button');
    card.onclick = () => setCategory(c.slug, card);
    card.innerHTML = `
      ${c.image_url
        ? `<img src="${c.image_url}" alt="${c.name}" loading="lazy">`
        : `<div class="cat-img-card-placeholder"><span class="material-symbols-outlined">${c.icon_name || 'category'}</span></div>`}
      <div class="cat-img-card-overlay">
        <div class="cat-img-card-name">${c.name}</div>
        <div class="cat-img-card-link">Seleccionar →</div>
      </div>
    `;
    tabsEl.appendChild(card);
  });
}

function renderFilters() {
  const container = document.getElementById('filter-groups');
  if (!allTagGroups.length) { container.innerHTML = '<p class="text-muted" style="font-size:0.85rem">Sin filtros disponibles aún.</p>'; return; }
  container.innerHTML = allTagGroups.map(g => `
    <div class="filter-group">
      <div class="filter-group-title filter-group-toggle" onclick="toggleFilterGroup(this)">
        ${g.name}
        <span class="material-symbols-outlined" style="font-size:1rem;transition:transform 0.2s">expand_more</span>
      </div>
      <div class="filter-group-body">
        ${(g.tags || []).filter(t => t.is_active).sort((a,b)=>a.sort_order-b.sort_order).map(t => `
          <label class="filter-checkbox">
            <input type="checkbox" value="${t.id}" ${selectedTagIds.has(t.id)?'checked':''} onchange="toggleTag('${t.id}','${t.name}')">
            <span>${t.name}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = Array(6).fill('<div class="card skeleton" style="height:300px"></div>').join('');

  let query = supabase
    .from('products_with_tags')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (currentCategory !== 'todos') query = query.eq('category_slug', currentCategory);
  if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);

  // Sort
  const sort = document.getElementById('sort-select')?.value || 'sort_order';
  if (sort === 'name_asc') query = query.order('name', { ascending: true });
  else if (sort === 'name_desc') query = query.order('name', { ascending: false });
  else if (sort === 'newest') query = query.order('created_at', { ascending: false });
  else if (sort === 'featured') { query = query.eq('is_featured', true).order('sort_order'); }
  else query = query.order('sort_order').order('created_at', { ascending: false });

  const from = (currentPage - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  let { data, count, error } = await query;
  if (error) { grid.innerHTML = '<div class="no-products"><p>Error al cargar productos.</p></div>'; return; }

  // Fallback automático: Si la vista SQL no expone el SKU, lo leemos directamente de la tabla base en un solo batch query
  if (data && data.length > 0 && data[0].sku === undefined) {
    try {
      const pIds = data.map(p => p.id);
      const { data: baseSkus } = await supabase.from('products').select('id, sku').in('id', pIds);
      const skuMap = new Map((baseSkus || []).map(r => [r.id, r.sku]));
      data.forEach(p => { p.sku = skuMap.get(p.id) || ''; });
    } catch (err) { console.error('Error inyectando SKUs base:', err); }
  }

  // Client-side tag filter
  if (selectedTagIds.size > 0) {
    data = (data || []).filter(p => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      const pTagIds = tags.map(t => t.tag_id);
      return [...selectedTagIds].every(id => pTagIds.includes(id));
    });
  }

  totalCount = count || 0;
  document.getElementById('products-count').textContent = `${data?.length || 0} producto${(data?.length || 0) !== 1 ? 's' : ''}`;

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="no-products">
      <span class="material-symbols-outlined">inventory_2</span>
      <h3 style="color:var(--primary);margin-bottom:0.5rem">Sin productos</h3>
      <p class="text-muted">No se encontraron productos con los filtros seleccionados.</p>
      ${selectedTagIds.size > 0 ? `<button class="btn btn-secondary btn-sm mt-3" onclick="clearFilters()">Limpiar filtros</button>` : ''}
    </div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  grid.innerHTML = data.map(p => renderCard(p)).join('');
  renderPagination(Math.ceil(totalCount / PAGE_SIZE));
}

function renderCard(p) {
  return `
  <div class="card" onclick="openQuickView(${JSON.stringify(p).replace(/"/g,'&quot;')})" style="cursor:pointer">
    <div class="card-image">
      ${imgWithFallback(p.image_url, p.name)}
      <div style="position:absolute;top:0.75rem;right:0.75rem;display:flex;gap:0.4rem">
        ${p.is_new ? '<span style="background:var(--secondary);color:#fff;font-size:0.6rem;font-weight:700;letter-spacing:0.1em;padding:0.2rem 0.5rem;border-radius:99px;text-transform:uppercase">Nuevo</span>' : ''}
        ${p.is_bestseller ? '<span style="background:var(--tertiary);color:#fff;font-size:0.6rem;font-weight:700;letter-spacing:0.1em;padding:0.2rem 0.5rem;border-radius:99px;text-transform:uppercase">Top</span>' : ''}
      </div>
    </div>
    <div class="card-body">
      <div class="card-title">${p.name}</div>
      <div style="display:flex; gap:0.5rem; margin-top:1rem;">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="event.stopPropagation();cotizar('${encodeURIComponent(p.name)}', '${encodeURIComponent(p.sku || '')}')">Cotizar</button>
        <button class="btn btn-secondary btn-sm" style="padding:0 0.75rem; border-color:var(--outline-variant); background:var(--surface-container-low);" title="Añadir a la lista de cotización" onclick="event.stopPropagation();Cart.add('${(p.name || '').replace(/'/g, "\\'")}', '${p.sku || ''}')">
          <span class="material-symbols-outlined" style="font-size:1.2rem;">add_shopping_cart</span>
        </button>
      </div>
    </div>
  </div>`;
}

function renderPagination(totalPages) {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" onclick="goToPage(${currentPage-1})"><span class="material-symbols-outlined" style="font-size:1rem">chevron_left</span></button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      html += `<button class="page-btn${i===currentPage?' active':''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 3) {
      html += `<span class="page-btn" style="cursor:default">…</span>`;
    }
  }
  if (currentPage < totalPages) html += `<button class="page-btn" onclick="goToPage(${currentPage+1})"><span class="material-symbols-outlined" style="font-size:1rem">chevron_right</span></button>`;
  el.innerHTML = html;
}

function updateActiveFilters() {
  const container = document.getElementById('active-filters');
  if (selectedTagIds.size === 0) { container.innerHTML = ''; return; }
  const chips = [...selectedTagIds].map(id => {
    const tagName = findTagName(id);
    return `<span class="filter-chip" onclick="removeTag('${id}')">${tagName} <span class="material-symbols-outlined" style="font-size:0.9rem">close</span></span>`;
  }).join('');
  container.innerHTML = chips;
}

function findTagName(id) {
  for (const g of allTagGroups) {
    const t = (g.tags || []).find(t => t.id === id);
    if (t) return t.name;
  }
  return id;
}

// ── Global functions ─────────────────────────────────────────
window.setCategory = function(slug, el) {
  document.querySelectorAll('#cat-tabs .cat-img-card').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  currentCategory = slug;
  currentPage = 1;
  loadProducts();
};
window.toggleTag = function(id, name) {
  if (selectedTagIds.has(id)) selectedTagIds.delete(id);
  else selectedTagIds.add(id);
  updateActiveFilters();
  currentPage = 1;
  loadProducts();
};
window.removeTag = function(id) {
  selectedTagIds.delete(id);
  // Uncheck checkbox
  const cb = document.querySelector(`input[value="${id}"]`);
  if (cb) cb.checked = false;
  updateActiveFilters();
  loadProducts();
};
window.clearFilters = function() {
  selectedTagIds.clear();
  document.querySelectorAll('#filter-groups input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateActiveFilters();
  currentPage = 1;
  loadProducts();
};
window.goToPage = function(page) {
  currentPage = page;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadProducts();
};
window.toggleFilterGroup = function(el) {
  const body = el.nextElementSibling;
  const icon = el.querySelector('.material-symbols-outlined');
  body.classList.toggle('collapsed');
  icon.style.transform = body.classList.contains('collapsed') ? 'rotate(-90deg)' : '';
};
window.openMobileFilters = function() {
  document.getElementById('filters-sidebar').classList.add('mobile-open');
  document.getElementById('filter-overlay').classList.add('open');
};
window.closeMobileFilters = function() {
  document.getElementById('filters-sidebar').classList.remove('mobile-open');
  document.getElementById('filter-overlay').classList.remove('open');
};
window.loadProducts = loadProducts;
window.openQuickView = function(p) {
  const tags = Array.isArray(p.tags) ? p.tags : [];
  document.getElementById('qv-name').textContent = p.name;
  document.getElementById('qv-category').textContent = p.category_name || '';
  const qvSku = document.getElementById('qv-sku');
  if (qvSku) {
    qvSku.textContent = p.sku ? `SKU: ${p.sku}` : '';
    qvSku.style.display = p.sku ? 'block' : 'none';
  }
  document.getElementById('qv-desc').textContent = p.description || 'Producto de exterior premium IMAGENIA.';
  document.getElementById('qv-tags').innerHTML = tags.map(t => `<span class="tag-pill">${t.tag_name}</span>`).join('');
  
  // Gallery construction (limit to 10)
  const galleryImages = [];
  if (p.image_url) {
    galleryImages.push(p.image_url);
  }
  if (Array.isArray(p.gallery_urls)) {
    p.gallery_urls.forEach(url => {
      if (url && !galleryImages.includes(url)) {
        galleryImages.push(url);
      }
    });
  }
  const finalGallery = galleryImages.slice(0, 10);
  currentLightboxGallery = finalGallery;
  
  // Render main image
  const mainImgUrl = finalGallery[0] || '';
  const qvImageEl = document.getElementById('qv-image');
  if (qvImageEl) {
    if (mainImgUrl) {
      qvImageEl.innerHTML = `<img id="qv-main-img" src="${mainImgUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder\\'><span class=\\'material-symbols-outlined\\'>image_not_supported</span></div>'">`;
      qvImageEl.style.cursor = 'zoom-in';
    } else {
      qvImageEl.innerHTML = `<div class="card-placeholder"><span class="material-symbols-outlined">chair</span></div>`;
      qvImageEl.style.cursor = 'default';
    }
  }

  // Render thumbnails
  const galleryEl = document.getElementById('qv-gallery');
  if (galleryEl) {
    if (finalGallery.length > 1) {
      galleryEl.style.display = 'flex';
      galleryEl.innerHTML = finalGallery.map((url, idx) => `
        <img class="qv-thumb${idx === 0 ? ' active' : ''}" src="${url}" alt="${p.name} ${idx + 1}" style="width:50px;height:50px;object-fit:cover;" onclick="changeQuickViewImage('${url}', this)">
      `).join('');
    } else {
      galleryEl.style.display = 'none';
      galleryEl.innerHTML = '';
    }
  }
  
  let num = siteSettings?.whatsapp_number || siteSettings?.contact_whatsapp || '5219980000000';
  num = num.replace(/\D/g, '');
  const skuText = p.sku ? ` (SKU: ${p.sku})` : '';
  const message = `Hola IMAGENIA, me gustaría recibir más información sobre el producto ${p.name}${skuText}.`;
  const waBtn = document.getElementById('qv-cotizar');
  if (waBtn) {
    waBtn.href = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
    waBtn.target = '_blank';
    waBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.2rem">chat</span> Solicitar información`;
  }
  const addCartBtn = document.getElementById('qv-add-cart');
  if (addCartBtn) {
    addCartBtn.onclick = () => Cart.add(p.name, p.sku);
  }

  document.getElementById('qv-modal').classList.add('open');
};

window.changeQuickViewImage = function(url, thumbEl) {
  const mainImg = document.getElementById('qv-main-img');
  if (!mainImg) return;
  
  mainImg.style.transition = 'opacity 0.15s ease-in-out';
  mainImg.style.opacity = '0';
  
  setTimeout(() => {
    mainImg.src = url;
    mainImg.onload = () => {
      mainImg.style.opacity = '1';
    };
    // Fallback if onload doesn't trigger
    setTimeout(() => {
      mainImg.style.opacity = '1';
    }, 200);
  }, 150);
  
  // Update border highlight classes on thumbnails
  const thumbs = document.querySelectorAll('.qv-thumb');
  thumbs.forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
};

window.openLightbox = function() {
  const mainImg = document.getElementById('qv-main-img');
  if (!mainImg) return; // Don't open if there's no main image
  
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxModal = document.getElementById('lightbox-modal');
  
  if (lightboxImg && lightboxModal) {
    currentLightboxIndex = currentLightboxGallery.findIndex(url => mainImg.src.includes(url));
    if (currentLightboxIndex === -1) currentLightboxIndex = 0;
    lightboxImg.src = currentLightboxGallery[currentLightboxIndex] || mainImg.src;

    const prevBtn = document.getElementById('lb-prev');
    const nextBtn = document.getElementById('lb-next');
    if (currentLightboxGallery.length > 1) {
      if (prevBtn) prevBtn.style.display = 'flex';
      if (nextBtn) nextBtn.style.display = 'flex';
    } else {
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
    }

    lightboxModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.lightboxPrev = function(e) {
  if (e) e.stopPropagation();
  if (currentLightboxGallery.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxGallery.length) % currentLightboxGallery.length;
  document.getElementById('lightbox-img').src = currentLightboxGallery[currentLightboxIndex];
};

window.lightboxNext = function(e) {
  if (e) e.stopPropagation();
  if (currentLightboxGallery.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxGallery.length;
  document.getElementById('lightbox-img').src = currentLightboxGallery[currentLightboxIndex];
};

window.closeLightbox = function() {
  const lightboxModal = document.getElementById('lightbox-modal');
  if (lightboxModal) {
    lightboxModal.classList.remove('open');
    document.body.style.overflow = '';
  }
};

window.closeModal = function() { document.getElementById('qv-modal').classList.remove('open'); };
window.cotizar = function(name, sku = '') {
  const decName = decodeURIComponent(name);
  const decSku = decodeURIComponent(sku);
  let num = siteSettings?.whatsapp_number || siteSettings?.contact_whatsapp || '5219980000000';
  num = num.replace(/\D/g, '');
  const skuText = decSku ? ` (SKU: ${decSku})` : '';
  const message = `Hola IMAGENIA, me gustaría recibir más información sobre el producto ${decName}${skuText}.`;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
};

// Lightbox swipe and wheel navigation
const lightboxEl = document.getElementById('lightbox-modal');
if (lightboxEl) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  lightboxEl.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  lightboxEl.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    if (currentLightboxGallery.length <= 1) return;
    
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // Swipe horizontal (horizontal distance must be greater than vertical and exceed threshold)
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        window.lightboxPrev();
      } else {
        window.lightboxNext();
      }
    }
  }, { passive: true });

  let lastWheelTime = 0;
  lightboxEl.addEventListener('wheel', e => {
    if (currentLightboxGallery.length <= 1) return;
    
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheelTime < 300) return;
    
    if (e.deltaY > 0 || e.deltaX > 0) {
      window.lightboxNext();
      lastWheelTime = now;
    } else if (e.deltaY < 0 || e.deltaX < 0) {
      window.lightboxPrev();
      lastWheelTime = now;
    }
  }, { passive: false });
}

document.getElementById('qv-modal')?.addEventListener('click', e => { if (e.target.id === 'qv-modal') closeModal(); });

init();
