// js/producto.js — Página de detalle individual de producto
import { initPage } from './components.js';
import { supabase, getCategories } from './supabase.js';

// ── Estado del lightbox ──────────────────────────────────────
let currentLightboxGallery = [];
let currentLightboxIndex = 0;

async function init() {
  const siteSettings = await initPage('Productos');

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  if (!productId) {
    showError('No se especificó ningún producto.');
    return;
  }

  // Obtener el producto por ID desde la vista con tags
  const { data: productData, error } = await supabase
    .from('products_with_tags')
    .select('*')
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (error || !productData) {
    showError('El producto no existe o no está disponible.');
    return;
  }

  // Fallback SKU si la vista no lo expone
  if (productData.sku === undefined) {
    try {
      const { data: skuData } = await supabase.from('products').select('sku').eq('id', productId).single();
      productData.sku = skuData?.sku || '';
    } catch (_) {}
  }

  // Actualizar SEO dinámico
  document.title = `${productData.name} — IMAGENIA`;
  const metaDesc = document.getElementById('meta-desc');
  const ogTitle = document.getElementById('og-title');
  const ogDesc = document.getElementById('og-desc');
  const ogImage = document.getElementById('og-image');
  const ogUrl = document.getElementById('og-url');
  const twTitle = document.getElementById('tw-title');
  const twDesc = document.getElementById('tw-desc');
  const twImage = document.getElementById('tw-image');

  const prodDesc = productData.description || `Producto IMAGENIA: ${productData.name}`;
  const prodTitle = `${productData.name} — IMAGENIA`;
  const prodImage = productData.image_url || 'https://www.imagenia.com.mx/assets/logo_con_letras_blancas.png';

  if (metaDesc) metaDesc.content = prodDesc;
  if (ogTitle) ogTitle.content = prodTitle;
  if (ogDesc) ogDesc.content = prodDesc;
  if (ogImage) ogImage.content = prodImage;
  if (ogUrl) ogUrl.content = window.location.href;
  if (twTitle) twTitle.content = prodTitle;
  if (twDesc) twDesc.content = prodDesc;
  if (twImage) twImage.content = prodImage;

  // Construir galería
  const galleryImages = [];
  if (productData.image_url) galleryImages.push(productData.image_url);
  if (Array.isArray(productData.gallery_urls)) {
    productData.gallery_urls.forEach(url => {
      if (url && !galleryImages.includes(url)) galleryImages.push(url);
    });
  }
  const finalGallery = galleryImages.slice(0, 10);
  currentLightboxGallery = finalGallery;

  const tags = Array.isArray(productData.tags) ? productData.tags : [];

  let num = siteSettings?.whatsapp_number || siteSettings?.contact_whatsapp || '5219980000000';
  num = num.replace(/\D/g, '');
  const skuText = productData.sku ? ` (SKU: ${productData.sku})` : '';
  const waMessage = `Hola IMAGENIA, me gustaría recibir más información sobre el producto ${productData.name}${skuText}.`;
  const waHref = `https://wa.me/${num}?text=${encodeURIComponent(waMessage)}`;

  // Renderizar la página
  const galleryHtml = finalGallery.length > 1
    ? `<div class="pd-gallery">${finalGallery.map((url, idx) => `
        <div class="pd-thumb${idx === 0 ? ' active' : ''}" onclick="pdChangeImage('${url}', this)">
          <img src="${url}" alt="${productData.name} ${idx + 1}" loading="lazy">
        </div>`).join('')}</div>`
    : '';

  const badgesHtml = [
    productData.is_new ? '<span class="pd-badge pd-badge-new">Nuevo</span>' : '',
    productData.is_bestseller ? '<span class="pd-badge pd-badge-top">Top</span>' : '',
  ].filter(Boolean).join('');

  const tagsHtml = tags.length > 0
    ? `<div>
        <p class="pd-tags-label">Características</p>
        <div class="pd-tags">${tags.map(t => `<span class="tag-pill">${t.tag_name}</span>`).join('')}</div>
       </div>`
    : '';

  const mainImgHtml = finalGallery.length > 0
    ? `<img id="pd-main-img" src="${finalGallery[0]}" alt="${productData.name}" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder\\'><span class=\\'material-symbols-outlined\\'>image_not_supported</span></div>'">`
    : `<div class="card-placeholder" style="height:100%;"><span class="material-symbols-outlined">chair</span></div>`;

  const detailHtml = `
    <nav class="breadcrumb">
      <a href="/productos.html">Productos</a>
      <span class="material-symbols-outlined">chevron_right</span>
      ${productData.category_name ? `<a href="/productos.html?cat=${productData.category_slug}">${productData.category_name}</a><span class="material-symbols-outlined">chevron_right</span>` : ''}
      <span style="color:var(--on-surface);">${productData.name}</span>
    </nav>

    <div class="product-detail-grid">
      <!-- Columna izquierda: media -->
      <div class="pd-media">
        <div class="pd-main-image" id="pd-image-container" onclick="openLightbox()">
          ${mainImgHtml}
        </div>
        ${galleryHtml}
      </div>

      <!-- Columna derecha: info -->
      <div class="pd-info">
        ${badgesHtml ? `<div class="pd-badges">${badgesHtml}</div>` : ''}
        ${productData.category_name ? `<div class="pd-category-badge"><span class="card-tag">${productData.category_name}</span></div>` : ''}
        ${productData.sku ? `<p class="pd-sku">SKU: ${productData.sku}</p>` : ''}

        <h1 class="pd-title">${productData.name}</h1>

        ${productData.description ? `<p class="pd-description">${productData.description}</p>` : ''}

        <hr class="pd-divider">

        ${tagsHtml}

        <div class="pd-actions">
          <a href="${waHref}" target="_blank" class="btn btn-primary" id="pd-cotizar">
            <span class="material-symbols-outlined" style="font-size:1.2rem">chat</span>
            Solicitar información
          </a>
          <button class="btn btn-secondary" id="pd-add-cart" onclick="Cart.add('${(productData.name || '').replace(/'/g, "\\'")}', '${productData.sku || ''}')">
            <span class="material-symbols-outlined" style="font-size:1.2rem">add_shopping_cart</span>
            Añadir
          </button>
        </div>

        <button class="pd-share" onclick="shareProduct()">
          <span class="material-symbols-outlined" style="font-size:1.1rem">share</span>
          Compartir este producto
        </button>

        <a href="/productos.html${productData.category_slug ? '?cat=' + productData.category_slug : ''}" class="pd-share" style="text-decoration:none;">
          <span class="material-symbols-outlined" style="font-size:1.1rem">arrow_back</span>
          Volver al catálogo
        </a>
      </div>
    </div>
  `;

  // Ocultar loading, mostrar contenido
  document.getElementById('pd-loading').style.display = 'none';
  const pdContent = document.getElementById('pd-content');
  pdContent.innerHTML = detailHtml;
  pdContent.style.display = 'block';

  // Cargar productos relacionados (misma categoría, excluyendo el actual)
  loadRelated(productData);

  // Lightbox overlay inteligente
  setupLightboxOverlay();
}

function showError(msg) {
  document.getElementById('pd-loading').style.display = 'none';
  const pdContent = document.getElementById('pd-content');
  pdContent.innerHTML = `
    <div class="pd-error">
      <span class="material-symbols-outlined">inventory_2</span>
      <h2 style="color:var(--primary);margin-bottom:0.75rem">Producto no encontrado</h2>
      <p class="text-muted">${msg}</p>
      <a href="/productos.html" class="btn btn-primary" style="margin-top:2rem">Ver catálogo completo</a>
    </div>`;
  pdContent.style.display = 'block';
}

async function loadRelated(product) {
  if (!product.category_slug) return;

  const { data } = await supabase
    .from('products_with_tags')
    .select('*')
    .eq('is_active', true)
    .eq('category_slug', product.category_slug)
    .neq('id', product.id)
    .order('sort_order')
    .limit(4);

  if (!data || data.length === 0) return;

  const relatedGrid = document.getElementById('related-grid');
  const relatedSection = document.getElementById('related-section');
  const relatedTitle = document.getElementById('related-title');

  if (relatedTitle) relatedTitle.textContent = `Más de ${product.category_name || 'esta categoría'}`;

  relatedGrid.innerHTML = data.map(p => `
    <a href="/producto.html?id=${p.id}" class="card" style="cursor:pointer;text-decoration:none;color:inherit;">
      <div class="card-image">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder\\'><span class=\\'material-symbols-outlined\\'>image_not_supported</span></div>'">`
          : `<div class="card-placeholder"><span class="material-symbols-outlined">chair</span></div>`}
        <div style="position:absolute;top:0.75rem;right:0.75rem;display:flex;gap:0.4rem">
          ${p.is_new ? '<span style="background:var(--secondary);color:#fff;font-size:0.6rem;font-weight:700;letter-spacing:0.1em;padding:0.2rem 0.5rem;border-radius:99px;text-transform:uppercase">Nuevo</span>' : ''}
          ${p.is_bestseller ? '<span style="background:var(--tertiary);color:#fff;font-size:0.6rem;font-weight:700;letter-spacing:0.1em;padding:0.2rem 0.5rem;border-radius:99px;text-transform:uppercase">Top</span>' : ''}
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${p.name}</div>
      </div>
    </a>
  `).join('');

  relatedSection.style.display = 'block';
}

// ── Funciones globales del lightbox ─────────────────────────

window.pdChangeImage = function(url, thumbEl) {
  const mainImg = document.getElementById('pd-main-img');
  if (!mainImg) return;

  mainImg.style.transition = 'opacity 0.15s ease';
  mainImg.style.opacity = '0';

  setTimeout(() => {
    mainImg.src = url;
    mainImg.onload = () => { mainImg.style.opacity = '1'; };
    setTimeout(() => { mainImg.style.opacity = '1'; }, 200);
  }, 150);

  document.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
};

window.openLightbox = function() {
  const mainImg = document.getElementById('pd-main-img');
  if (!mainImg || currentLightboxGallery.length === 0) return;

  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxModal = document.getElementById('lightbox-modal');
  if (!lightboxImg || !lightboxModal) return;

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

window.shareProduct = async function() {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url });
    } catch (_) {}
  } else {
    await navigator.clipboard.writeText(url);
    if (window.showToast) window.showToast('Enlace copiado al portapapeles');
  }
};

function setupLightboxOverlay() {
  const lightboxEl = document.getElementById('lightbox-modal');
  if (!lightboxEl) return;

  let touchStartX = 0, touchStartY = 0;

  lightboxEl.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  lightboxEl.addEventListener('touchend', e => {
    const diffX = e.changedTouches[0].screenX - touchStartX;
    const diffY = e.changedTouches[0].screenY - touchStartY;
    if (currentLightboxGallery.length <= 1) return;
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      diffX > 0 ? window.lightboxPrev() : window.lightboxNext();
    }
  }, { passive: true });

  let lastWheelTime = 0;
  lightboxEl.addEventListener('wheel', e => {
    if (currentLightboxGallery.length <= 1) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheelTime < 300) return;
    (e.deltaY > 0 || e.deltaX > 0) ? window.lightboxNext() : window.lightboxPrev();
    lastWheelTime = now;
  }, { passive: false });

  // Overlay inteligente: distingue tap de swipe
  const lbOverlay = document.getElementById('lb-overlay');
  if (lbOverlay) {
    let pdTime = 0, pdX = 0, pdY = 0;
    lbOverlay.addEventListener('pointerdown', e => { pdTime = Date.now(); pdX = e.clientX; pdY = e.clientY; });
    lbOverlay.addEventListener('pointerup', e => {
      if (Date.now() - pdTime < 200 && Math.abs(e.clientX - pdX) < 10 && Math.abs(e.clientY - pdY) < 10) {
        window.closeLightbox();
      }
    });
  }
}

init();
