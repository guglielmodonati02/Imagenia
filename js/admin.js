// js/admin.js
import { requireAuth, signOut, supabase, getSettings, setSetting, uploadFile } from '/js/supabase.js';
import { showToast } from '/js/components.js';

let allCategories = [], allTagGroups = [], allTags = [], allProducts = [], allContacts = [];
let currentGalleryUrls = [];
let draggedIndex = null;

const newItems = new Set(JSON.parse(localStorage.getItem('unread_leads_messages') || '[]'));
const activeNotifications = new Map();

async function init() {
  await requireAuth();
  await loadDashboard();
  initRealtime();
  initNotifications();
}

function saveNewItems() {
  localStorage.setItem('unread_leads_messages', JSON.stringify([...newItems]));
}

function initNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotification(type, item) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  let title = '';
  let body = '';
  let tabName = '';

  if (type === 'contacts') {
    title = 'Nuevo mensaje de contacto';
    body = `${item.nombre || 'Alguien'} ha enviado un mensaje.`;
    tabName = 'contacts';
  } else if (type === 'wa-leads') {
    title = 'Nuevo lead de WhatsApp';
    const answers = item.answers || {};
    let name = 'Lead de WhatsApp';
    for (const [k, v] of Object.entries(answers)) {
      if (k.toLowerCase().includes('nombre') && v) {
        name = v;
        break;
      }
    }
    body = `Lead de ${name}.`;
    tabName = 'wa-leads';
  }

  const notification = new Notification(title, {
    body: body,
    icon: '/assets/logo.png',
    tag: item.id
  });

  activeNotifications.set(item.id, notification);

  notification.onclick = function() {
    window.focus();
    notification.close();
    
    goToSection(tabName);
    deactivateItem(item.id);
    
    setTimeout(() => {
      const rowId = type === 'contacts' ? `row-contact-${item.id}` : `row-wa-${item.id}`;
      const row = document.getElementById(rowId);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('pulse-highlight');
        setTimeout(() => row.classList.remove('pulse-highlight'), 3000);
      }
    }, 250);
  };
}

function handleNewSubmission(type, item) {
  newItems.add(item.id);
  saveNewItems();
  
  showBrowserNotification(type, item);
  loadDashboard();
  
  const activeTab = document.querySelector('.tab-sections.visible');
  if (activeTab) {
    const secName = activeTab.id.replace('sec-', '');
    if (secName === 'contacts') contacts();
    else if (secName === 'wa-leads') loadWALeads();
  }
}

window.deactivateItem = function(id) {
  if (newItems.has(id)) {
    newItems.delete(id);
    saveNewItems();
    
    const notif = activeNotifications.get(id);
    if (notif) {
      notif.close();
      activeNotifications.delete(id);
    }
    
    const rowEl = document.getElementById(`row-contact-${id}`) || document.getElementById(`row-wa-${id}`);
    if (rowEl) {
      rowEl.classList.remove('unread-item');
    }
    loadDashboard();
  }
};

window.goToSection = function(sectionId) {
  const btn = document.querySelector(`.admin-nav-item[onclick*="${sectionId}"]`);
  if (btn) {
    window.showSection(sectionId, btn);
  }
};

function initRealtime() {
  supabase.channel('public-db-admin')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_submissions' }, payload => {
      handleNewSubmission('contacts', payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_leads' }, payload => {
      handleNewSubmission('wa-leads', payload.new);
    })
    .subscribe();
}


// ── Navigation ───────────────────────────────────────────────
window.showSection = function(name, el) {
  document.querySelectorAll('.tab-sections').forEach(s => s.classList.remove('visible'));
  document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('visible');
  el.classList.add('active');
  const loaders = { products, categories, tags, catalogs, contacts, settings: loadSettings, slides, impact, blogs, comparisons, clients, counter: loadCounter, 'wa-questions': loadWAQuestions, 'wa-leads': loadWALeads, 'home-carousel': loadHomeCarousel };
  if (loaders[name]) loaders[name]();
};

window.doSignOut = () => signOut();
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
window.autoSlug = (inp, target) => {
  document.getElementById(target).value = inp.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
};

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  const [p, c, ct, bt, ba] = await Promise.all([
    supabase.from('products').select('id',{count:'exact',head:true}),
    supabase.from('catalogs').select('id',{count:'exact',head:true}),
    supabase.from('contact_submissions').select('id',{count:'exact',head:true}),
    supabase.from('blogs').select('id', {count:'exact', head:true}),
    supabase.from('blogs').select('id', {count:'exact', head:true}).eq('is_active', true)
  ]);
  const elStatProd = document.getElementById('stat-products'); if(elStatProd) elStatProd.textContent = p.count ?? 0;
  const elStatCat = document.getElementById('stat-catalogs'); if(elStatCat) elStatCat.textContent = c.count ?? 0;
  const elStatCont = document.getElementById('stat-contacts'); if(elStatCont) elStatCont.textContent = ct.count ?? 0;
  const elStatBlogs = document.getElementById('stat-blogs-total'); if(elStatBlogs) elStatBlogs.textContent = bt.count ?? 0;
  const elStatBlogsAct = document.getElementById('stat-blogs-active'); if(elStatBlogsAct) elStatBlogsAct.textContent = ba.count ?? 0;

  const { data: qs } = await supabase.from('contact_submissions').select('*').order('submitted_at',{ascending:false}).limit(5);
  const elDashContacts = document.getElementById('dash-contacts');
  if (elDashContacts) {
    elDashContacts.innerHTML = (qs||[]).map(r =>
      `<tr onclick="goToSection('contacts')" style="cursor:pointer"><td>${r.nombre}</td><td>${r.email}</td><td>${r.empresa||'—'}</td><td>${fmt(r.submitted_at)}</td></tr>`
    ).join('') || '<tr><td colspan="4" style="color:var(--on-surface-variant);text-align:center;padding:2rem">Sin mensajes aún.</td></tr>';
  }
}

// ── Counter ────────────────────────────────────────────────
async function loadCounter() {
  const settings = await getSettings();
  const val = settings.counter_value || '1563';
  document.getElementById('counter-value-input').value    = val.replace(/[^\d]/g, '');
  document.getElementById('counter-label-input').value    = settings.counter_label    || 'Toneladas de Pl\u00e1stico Recuperado';
  document.getElementById('counter-sublabel-input').value = settings.counter_sublabel || '';
  document.getElementById('counter-prefix-input').value   = settings.counter_prefix   || '';
  document.getElementById('counter-suffix-input').value   = settings.counter_suffix   || '';
  document.getElementById('counter-bg-input').value       = settings.counter_bg_color || '#f6f3f2';
  document.getElementById('counter-active-input').value   = settings.counter_is_active === 'false' ? 'false' : 'true';
  // Update preview
  const numInt = parseInt(val.replace(/[^\d]/g, ''), 10);
  document.getElementById('counter-preview-num').textContent     = numInt.toLocaleString('es-MX');
  document.getElementById('counter-preview-label').textContent   = settings.counter_label    || 'Toneladas de Pl\u00e1stico Recuperado';
  document.getElementById('counter-preview-sublabel').textContent = settings.counter_sublabel || '';
}

window.saveCounterSettings = async function() {
  const rawNum = document.getElementById('counter-value-input').value.replace(/[^\d]/g, '') || '1563';
  await Promise.all([
    setSetting('counter_value',    rawNum),
    setSetting('counter_label',    document.getElementById('counter-label-input').value),
    setSetting('counter_sublabel', document.getElementById('counter-sublabel-input').value),
    setSetting('counter_prefix',   document.getElementById('counter-prefix-input').value),
    setSetting('counter_suffix',   document.getElementById('counter-suffix-input').value),
    setSetting('counter_bg_color', document.getElementById('counter-bg-input').value),
    setSetting('counter_is_active',document.getElementById('counter-active-input').value),
  ]);
  showToast('Contador actualizado \u2713');
};

// ── Settings ─────────────────────────────────────────────────
async function loadSettings() {
  const quillEditorsToInit = [];
  const { data: dbRows } = await supabase.from('site_settings').select('*').order('key');
  
  let rows = (dbRows || []).filter(r => !r.key.startsWith('footer_ig_embed_') && r.key !== 'contact_header_image' && r.key !== 'about_title' && r.key !== 'about_text');
  if (!rows.some(r => r.key === 'footer_clients_title')) {
    rows.push({ key: 'footer_clients_title', label: 'Título de la sección Proyectos y Clientes', value: 'Proyectos y Clientes', value_type: 'text' });
  }
  
  // Asegurar existencia y migración de las claves de la sección Acerca de
  const oldAboutTitle = (dbRows || []).find(r => r.key === 'about_title');
  const oldAboutText = (dbRows || []).find(r => r.key === 'about_text');
  
  if (!rows.some(r => r.key === 'home_about_title')) {
    rows.push({ key: 'home_about_title', label: 'Título de la sección Acerca de', value: oldAboutTitle ? oldAboutTitle.value : 'Soluciones que Transforman Espacios', value_type: 'text' });
  }
  if (!rows.some(r => r.key === 'home_about_text')) {
    rows.push({ key: 'home_about_text', label: 'Texto de la sección Acerca de', value: oldAboutText ? oldAboutText.value : '', value_type: 'textarea' });
  }
  if (!rows.some(r => r.key === 'home_about_image_url')) {
    rows.push({ key: 'home_about_image_url', label: 'Imagen o Video de Acerca de + Beneficios', value: '', value_type: 'url' });
  }
  if (!rows.some(r => r.key === 'footer_privacy_text')) {
    rows.push({ key: 'footer_privacy_text', label: 'Texto de Aviso de Privacidad (HTML)', value: '<p>Aviso de privacidad (reemplaza este texto)...</p>', value_type: 'html' });
  }
  if (!rows.some(r => r.key === 'footer_terms_text')) {
    rows.push({ key: 'footer_terms_text', label: 'Texto de Términos y Condiciones (HTML)', value: '<p>Términos y condiciones (reemplaza este texto)...</p>', value_type: 'html' });
  }
  if (!rows.some(r => r.key === 'impacto_hero_badge')) {
    rows.push({ key: 'impacto_hero_badge', label: 'Badge Hero Impacto', value: 'Precisión Sustentable', value_type: 'text' });
  }
  if (!rows.some(r => r.key === 'impact_section_title')) {
    rows.push({ key: 'impact_section_title', label: 'Título de Sección Impacto', value: 'Nuestro Impacto', value_type: 'text' });
  }
  if (!rows.some(r => r.key === 'promo_banner_text')) {
    rows.push({ key: 'promo_banner_text', label: 'Texto del Banner Promocional', value: 'Pregunta por nuestros proyectos y soluciones para tu empresa', value_type: 'text' });
  }
  if (!rows.some(r => r.key === 'home_categories_badge')) {
    rows.push({ key: 'home_categories_badge', label: 'Badge de Categorías (Inicio)', value: 'Catálogo', value_type: 'text' });
  }
  if (!rows.some(r => r.key === 'home_categories_title')) {
    rows.push({ key: 'home_categories_title', label: 'Título de Categorías (Inicio)', value: 'Nuestras <span style="color:var(--secondary)">Categorías</span>', value_type: 'text' });
  }

  // Asegurar existencia de las claves de cabeceras en el panel
  const oldContactHeader = (dbRows || []).find(r => r.key === 'contact_header_image');
  if (!rows.some(r => r.key === 'headers_contacto')) {
    rows.push({ key: 'headers_contacto', label: 'Imagen de cabecera — Contacto', value: oldContactHeader ? oldContactHeader.value : '', value_type: 'url' });
  }
  if (!rows.some(r => r.key === 'headers_catalogos')) {
    rows.push({ key: 'headers_catalogos', label: 'Imagen de cabecera — Catálogos', value: '', value_type: 'url' });
  }
  if (!rows.some(r => r.key === 'headers_productos')) {
    rows.push({ key: 'headers_productos', label: 'Imagen de cabecera — Productos', value: '', value_type: 'url' });
  }

  // Asegurar que tipos de valor y etiquetas críticas sean las correctas (incluso si vienen de la BD)
  rows.forEach(r => {
    if (r.key === 'home_about_image_url') {
      r.value_type = 'url';
      r.label = 'Imagen o Video de Acerca de + Beneficios';
    }
    if (r.key.startsWith('headers_')) {
      r.value_type = 'url';
    }
  });

  const groups = {};
  const pageNames = { 
    'home': 'Página: Inicio', 
    'headers': 'Cabeceras de Páginas',
    'impacto': 'Página: Impacto', 
    'impact': 'Página: Impacto (Secciones)',
    'promo': 'Banner Promocional',
    'catalog': 'Página: Catálogos/Productos', 
    'contact': 'Página: Contacto',
    'whatsapp': 'Configuración WhatsApp',
    'social': 'Redes Sociales',
    'footer': 'Pie de Página'
  };

  rows.forEach(r => {
    if (r.key.startsWith('counter_')) return; 
    if (r.key.toLowerCase().includes('sector')) return;  
    if (r.key.toLowerCase().includes('impact') && r.key.toLowerCase().includes('card')) return;
    if (r.label && r.label.includes('Impact: Card')) return;
    if (r.label && r.label.includes('Impact: Título')) return;
    
    let prefix = r.key.split('_')[0];
    if (!pageNames[prefix]) return; // Hides anything not in the map (like global_)
    
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(r);
  });

  const container = document.getElementById('settings-container');
  let html = '';

  for (const [prefix, settings] of Object.entries(groups)) {
    const sectionName = pageNames[prefix] || prefix;
    html += `
      <div class="settings-page-group" style="margin-bottom: 3.5rem;">
        <h3 style="border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: var(--primary); font-family: 'Manrope', sans-serif;">${sectionName}</h3>
        <div class="settings-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 2rem;">
    `;
    
    settings.forEach(r => {
      if (r.key.startsWith('social_') && r.key.endsWith('_icon')) return; // Handle icons alongside URLs

      let previewHtml = '';
      if (r.value_type === 'url' && r.value) {
        previewHtml = generatePreviewHtml(r.value);
      }

      let inputHtml = '';
      let extraHtml = '';
      
      if (r.value_type === 'boolean') {
        inputHtml = `<select class="setting-input" data-key="${r.key}"><option value="true" ${r.value==='true'?'selected':''}>Activo</option><option value="false" ${r.value!=='true'?'selected':''}>Inactivo</option></select>`;
      } else if (r.key.toLowerCase().includes('icon') && !r.key.startsWith('social_')) {
        inputHtml = `
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <div style="width:40px;height:40px;border-radius:var(--radius-sm);background:var(--surface-container-low);display:flex;align-items:center;justify-content:center;border:1px solid var(--outline-variant);flex-shrink:0">
              <span class="material-symbols-outlined" id="preview-icon-${r.key}" style="font-size:1.5rem;color:var(--primary)">${r.value || 'star'}</span>
            </div>
            <input type="text" class="setting-input" data-key="${r.key}" value="${r.value||''}" placeholder="${r.label||''}" oninput="document.getElementById('preview-icon-${r.key}').textContent=this.value||'star'">
          </div>
        `;
      } else if (r.key.startsWith('social_')) {
        const iconKey = `${r.key}_icon`;
        const iconRow = settings.find(s => s.key === iconKey) || { value: '' };
        
        inputHtml = `
          <!-- Área del Ícono (Arriba) -->
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
            <div style="width:48px;height:48px;border-radius:var(--radius-sm);background:var(--surface-container-lowest);display:flex;align-items:center;justify-content:center;border:1px solid var(--outline-variant);flex-shrink:0;overflow:hidden">
              <div id="preview-${iconKey}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                ${iconRow.value ? `<img src="${iconRow.value}" style="width:100%;height:100%;object-fit:contain;">` : `<span class="material-symbols-outlined" style="font-size:1.5rem;color:var(--on-surface-variant)">image</span>`}
              </div>
            </div>
            <div>
              <input type="hidden" class="setting-input" data-key="${iconKey}" value="${iconRow.value||''}">
              <label class="btn btn-secondary btn-sm upload-btn" style="display:inline-flex; align-items:center; gap:0.25rem;">
                <span class="material-symbols-outlined" style="font-size:1.25rem">upload</span>Subir Ícono SVG
                <input type="file" accept=".svg,image/*" onchange="uploadSetting(this,'${iconKey}')">
              </label>
            </div>
          </div>
          <!-- Área del Link (Abajo) -->
          <div>
            <div style="font-size:0.75rem; color:var(--on-surface-variant); margin-bottom:0.25rem;">URL del perfil o página</div>
            <input type="text" class="setting-input" data-key="${r.key}" value="${(r.value||'').replace(/"/g, '&quot;')}" placeholder="https://..." oninput="updatePreview(this, '${r.key}')">
          </div>
        `;
      } else if (r.value_type === 'html') {
        quillEditorsToInit.push({ key: r.key, value: r.value || '' });
        inputHtml = `
          <div style="background:#fff; color:#000; border-radius:4px; margin-bottom:0.5rem;">
            <div id="quill-toolbar-${r.key}" style="border: 1px solid var(--outline-variant); border-bottom: none; border-radius: 4px 4px 0 0; background: #f8f9fa;">
              <span class="ql-formats"><select class="ql-header"></select></span>
              <span class="ql-formats"><button class="ql-bold"></button><button class="ql-italic"></button><button class="ql-underline"></button></span>
              <span class="ql-formats"><button class="ql-list" value="ordered"></button><button class="ql-list" value="bullet"></button></span>
              <span class="ql-formats"><button class="ql-link"></button></span>
            </div>
            <div id="quill-${r.key}" style="height: 300px; border: 1px solid var(--outline-variant); border-radius: 0 0 4px 4px; font-family: 'Manrope', sans-serif;"></div>
          </div>
          <textarea id="hidden-${r.key}" class="setting-input" data-key="${r.key}" style="display:none;"></textarea>
        `;
      } else if (r.value_type === 'textarea') {
        inputHtml = `<textarea class="setting-input" data-key="${r.key}" rows="8" style="resize:vertical; font-family:monospace; font-size:0.85rem; line-height:1.4; padding:0.5rem; border:1px solid var(--outline-variant); border-radius:4px; width:100%; box-sizing:border-box;">${(r.value||'').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>`;
      } else {
        inputHtml = `<input type="text" class="setting-input" data-key="${r.key}" value="${(r.value||'').replace(/"/g, '&quot;')}" placeholder="${r.label||''}" ${r.value_type==='url'?`oninput="updatePreview(this, '${r.key}')"`:''}>`;
      }

      const isSocial = r.key.startsWith('social_');
      html += `
        <div class="setting-row" style="display: block; background: var(--surface); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--surface-container-high);">
          <div class="setting-label" style="font-weight: 600; margin-bottom: 1rem; color: var(--on-surface); font-size: 0.9rem;">${r.label||r.key}</div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${inputHtml}
          </div>
          ${r.value_type==='url' && !isSocial ?`<label class="btn btn-secondary btn-sm upload-btn" style="margin-top:1rem; display:inline-flex; align-items:center; gap:0.25rem;"><span class="material-symbols-outlined" style="font-size:1.25rem">upload</span>Subir Archivo<input type="file" accept="image/*,video/mp4,.pdf" onchange="uploadSetting(this,'${r.key}')"></label>`:''}
          <div class="setting-preview" id="preview-${r.key}" style="margin-top: 1rem;">${previewHtml}</div>
        </div>
      `;
    });
    
    html += `</div></div>`;
  }
  
  if (container) {
    container.innerHTML = html;
  }
  
  quillEditorsToInit.forEach(item => {
    const q = new Quill('#quill-' + item.key, {
      theme: 'snow',
      modules: { toolbar: '#quill-toolbar-' + item.key }
    });
    q.root.innerHTML = item.value;
    const hidden = document.getElementById('hidden-' + item.key);
    hidden.value = item.value;
    q.on('text-change', function() {
      hidden.value = q.root.innerHTML;
    });
  });
}

window.generatePreviewHtml = function(url) {
  if (!url) return '';
  const val = url.toLowerCase();
  if (val.includes('<blockquote') && val.includes('instagram-media')) {
    return `<div style="max-height: 400px; overflow: auto; border: 1px solid var(--outline-variant); border-radius: 4px; padding: 1rem; background: #fff;">${url}</div>`;
  } else if (val.includes('<iframe')) {
    return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:4px;"><style>#preview-wrap iframe{position:absolute;top:0;left:0;width:100% !important;height:100% !important;border:0;}</style><div id="preview-wrap">${url}</div></div>`;
  } else if (val.match(/\.(jpeg|jpg|gif|png|webp|svg)$/)) {
    return `<img src="${url}" style="max-height:100px; max-width:100%; border-radius:4px; border:1px solid #ddd; object-fit:cover;">`;
  } else if (val.endsWith('.mp4') || val.endsWith('.webm')) {
    return `<video src="${url}" style="max-height:100px; max-width:100%; border-radius:4px; border:1px solid #ddd; object-fit:cover;" muted autoplay loop></video>`;
  } else if (val.endsWith('.pdf')) {
    return `<div style="display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; color:var(--primary); padding:0.5rem; background:var(--surface-container-low); border-radius:4px;"><span class="material-symbols-outlined" style="font-size:1.5rem;">picture_as_pdf</span> Documento PDF</div>`;
  }
  return `<a href="${url}" target="_blank" style="font-size:0.875rem; color:var(--primary); text-decoration:underline;">Ver enlace adjunto</a>`;
};

window.updatePreview = function(input, key) {
  const previewDiv = document.getElementById(`preview-${key}`);
  if (previewDiv) {
    previewDiv.innerHTML = generatePreviewHtml(input.value);
  }
};

window.saveSettings = async function() {
  const inputs = document.querySelectorAll('.setting-input[data-key]');
  const updates = [...inputs].map(inp => setSetting(inp.dataset.key, inp.value));
  await Promise.all(updates);
  showToast('Configuración guardada');
};

window.uploadSetting = async function(input, key) {
  const file = input.files[0]; if (!file) return;
  const { url, error } = await uploadFile('imagenia-assets', 'settings', file);
  if (error) { showToast('Error al subir archivo', 'error'); return; }
  const inp = document.querySelector(`.setting-input[data-key="${key}"]`);
  if (inp) {
    inp.value = url;
    updatePreview(inp, key);
  }
  showToast('Archivo subido');
};

// ── Products ─────────────────────────────────────────────────
async function products() {
  const [{ data: prods }, { data: cats }, { data: tgroups }] = await Promise.all([
    supabase.from('products_with_tags').select('*').order('sort_order').order('created_at',{ascending:false}),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('tag_groups').select('*,tags(*)').order('sort_order'),
  ]);
  allProducts = prods || [];

  // Fallback automático para inyectar SKUs desde la tabla base si la vista no los expone
  if (allProducts.length > 0 && allProducts[0].sku === undefined) {
    try {
      const pIds = allProducts.map(p => p.id);
      const { data: baseSkus } = await supabase.from('products').select('id, sku').in('id', pIds);
      const skuMap = new Map((baseSkus || []).map(r => [r.id, r.sku]));
      allProducts.forEach(p => { p.sku = skuMap.get(p.id) || ''; });
    } catch (err) { console.error('Error inyectando SKUs en admin:', err); }
  }

  allCategories = cats || [];
  allTagGroups = tgroups || [];
  allTags = tgroups?.flatMap(g => (g.tags||[]).map(t => ({...t, group_name: g.name}))) || [];
  renderProductsTable(allProducts);
  document.getElementById('product-count').textContent = `${allProducts.length} productos`;
}

function renderProductsTable(data) {
  document.getElementById('products-table').innerHTML = (data||[]).map(p => {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const flags = [p.is_bestseller&&'Top',p.is_new&&'Nuevo',p.is_featured&&'Dest.'].filter(Boolean).join(' · ');
    return `<tr>
      <td>${p.image_url?`<img src="${p.image_url}" class="img-thumb" onerror="this.style.display='none'">`:'<div class="img-thumb" style="background:var(--surface-container-low)"></div>'}</td>
      <td>
        <strong>${p.name}</strong>
        ${p.sku ? `<br><code style="font-size:0.7rem; color:var(--on-surface-variant)">SKU: ${p.sku}</code>` : ''}
        <br><span style="font-size:0.75rem;color:var(--on-surface-variant)">${p.slug}</span>
      </td>
      <td>${p.category_name||'—'}</td>
      <td><div style="display:flex;flex-wrap:wrap;gap:0.25rem">${tags.slice(0,3).map(t=>`<span class="badge badge-green">${t.tag_name}</span>`).join('')}${tags.length>3?`<span class="badge badge-grey">+${tags.length-3}</span>`:''}</div></td>
      <td><span style="font-size:0.75rem;color:var(--on-surface-variant)">${flags||'—'}</span></td>
      <td><span class="badge ${p.is_active?'badge-green':'badge-grey'}">${p.is_active?'Activo':'Inactivo'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openProductModal(${JSON.stringify(p).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteProduct('${p.id}','${p.name}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--on-surface-variant)">Sin productos. Agrega el primero.</td></tr>';
}

window.filterProducts = function(val) {
  renderProductsTable(val ? allProducts.filter(p => p.name.toLowerCase().includes(val.toLowerCase())) : allProducts);
};

window.openProductModal = async function(p = null) {
  const modal = document.getElementById('modal-product');
  document.getElementById('pm-title').textContent = p ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('pm-id').value = p?.id || '';
  document.getElementById('pm-name').value = p?.name || '';

  let currentSku = p?.sku || '';
  if (p?.id && !currentSku) {
    try {
      const { data: baseProd } = await supabase.from('products').select('sku').eq('id', p.id).single();
      if (baseProd?.sku) {
        currentSku = baseProd.sku;
        p.sku = currentSku; // Guardar en el objeto en memoria
      }
    } catch (err) { console.error('Error obteniendo SKU base:', err); }
  }
  document.getElementById('pm-sku').value = currentSku;

  document.getElementById('pm-slug').value = p?.slug || '';
  document.getElementById('pm-desc').value = p?.description || '';
  document.getElementById('pm-image').value = p?.image_url || '';
  document.getElementById('pm-order').value = p?.sort_order || 0;
  document.getElementById('pm-bestseller').checked = p?.is_bestseller || false;
  document.getElementById('pm-new').checked = p?.is_new || false;
  document.getElementById('pm-featured').checked = p?.is_featured || false;
  document.getElementById('pm-active').checked = p?.is_active !== false;

  // Category select
  document.getElementById('pm-category').innerHTML =
    `<option value="">Sin categoría</option>` +
    allCategories.map(c => `<option value="${c.id}" ${p?.category_id===c.id?'selected':''}>${c.name}</option>`).join('');

  // Image preview
  const preview = document.getElementById('pm-img-preview');
  preview.innerHTML = p?.image_url ? `<img src="${p.image_url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">` : '';

  // Tags checkboxes
  const existingTagIds = (Array.isArray(p?.tags) ? p.tags : []).map(t => t.tag_id);
  document.getElementById('pm-tags').innerHTML = allTagGroups.map(g => `
    <div style="width:100%;margin-bottom:0.5rem">
      <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--on-surface-variant);margin-bottom:0.4rem">${g.name}</div>
      <div style="display:flex;flex-wrap:wrap;gap:0.375rem">
        ${(g.tags||[]).map(t => `
          <label style="display:flex;align-items:center;gap:0.3rem;padding:0.25rem 0.6rem;background:var(--surface-container);border-radius:99px;cursor:pointer;font-size:0.8rem">
            <input type="checkbox" value="${t.id}" ${existingTagIds.includes(t.id)?'checked':''} style="accent-color:var(--primary)"> ${t.name}
          </label>`).join('')}
      </div>
    </div>`).join('');

  currentGalleryUrls = Array.isArray(p?.gallery_urls) ? [...p.gallery_urls] : [];
  renderAdminGallery();

  modal.classList.add('open');
};

window.uploadProductImage = async function(input) {
  const file = input.files[0]; if (!file) return;
  const btn = document.querySelector('#modal-product .upload-btn');
  if (btn) btn.textContent = 'Subiendo...';
  const { url, error } = await uploadFile('imagenia-assets', 'products', file);
  if (error) { showToast('Error al subir imagen', 'error'); return; }
  document.getElementById('pm-image').value = url;
  document.getElementById('pm-img-preview').innerHTML = `<img src="${url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">`;
  showToast('Imagen subida');
};

window.renderAdminGallery = function() {
  const container = document.getElementById('pm-gallery-container');
  if (!container) return;
  container.innerHTML = currentGalleryUrls.map((url, index) => `
    <div class="pm-gallery-item"
         draggable="true"
         ondragstart="dragStart(event, ${index})"
         ondragover="dragOver(event, this)"
         ondragenter="dragEnter(event, this)"
         ondragleave="dragLeave(event, this)"
         ondrop="dragDrop(event, ${index})"
         ondragend="dragEnd()"
         style="position:relative;width:60px;height:60px;border:1px solid var(--outline-variant);border-radius:var(--radius-sm);overflow:hidden;background:var(--surface-container-low)">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;">
      <button type="button" onclick="removeGalleryImage(${index})" style="position:absolute;top:2px;right:2px;background:rgba(255,255,255,0.8);border:none;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--error);padding:0;z-index:10;">
        <span class="material-symbols-outlined" style="font-size:0.75rem;font-weight:bold">close</span>
      </button>
    </div>
  `).join('');
};

window.dragStart = function(event, index) {
  draggedIndex = index;
  event.dataTransfer.effectAllowed = 'move';
};

window.dragOver = function(event, el) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

window.dragEnter = function(event, el) {
  event.preventDefault();
  el.classList.add('drag-over');
};

window.dragLeave = function(event, el) {
  el.classList.remove('drag-over');
};

window.dragDrop = function(event, index) {
  event.preventDefault();
  if (draggedIndex === null || draggedIndex === index) return;
  
  const movedItem = currentGalleryUrls.splice(draggedIndex, 1)[0];
  currentGalleryUrls.splice(index, 0, movedItem);
  
  draggedIndex = null;
  renderAdminGallery();
};

window.dragEnd = function() {
  draggedIndex = null;
  document.querySelectorAll('.pm-gallery-item').forEach(el => el.classList.remove('drag-over'));
};

window.removeGalleryImage = function(index) {
  currentGalleryUrls.splice(index, 1);
  renderAdminGallery();
};

window.uploadGalleryImages = async function(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const btn = input.closest('.upload-btn');
  const originalText = btn.innerHTML;
  
  for (const file of files) {
    if (currentGalleryUrls.length >= 10) {
      showToast('Límite de 10 imágenes alcanzado', 'warning');
      break;
    }
    btn.innerHTML = 'Subiendo...';
    const { url, error } = await uploadFile('imagenia-assets', 'products', file);
    if (error) {
      showToast('Error al subir imagen de galería', 'error');
      console.error(error);
    } else if (url) {
      currentGalleryUrls.push(url);
    }
  }
  
  btn.innerHTML = originalText;
  input.value = ''; // Reset file input
  renderAdminGallery();
  showToast('Galería actualizada');
};

window.saveProduct = async function() {
  const id = document.getElementById('pm-id').value;
  const selectedTagIds = [...document.querySelectorAll('#pm-tags input:checked')].map(cb => cb.value);
  const payload = {
    name: document.getElementById('pm-name').value,
    sku:  document.getElementById('pm-sku').value || null,
    slug: document.getElementById('pm-slug').value,
    category_id: document.getElementById('pm-category').value || null,
    description: document.getElementById('pm-desc').value,
    image_url: document.getElementById('pm-image').value,
    gallery_urls: currentGalleryUrls,
    sort_order: parseInt(document.getElementById('pm-order').value) || 0,
    is_bestseller: document.getElementById('pm-bestseller').checked,
    is_new: document.getElementById('pm-new').checked,
    is_featured: document.getElementById('pm-featured').checked,
    is_active: document.getElementById('pm-active').checked,
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from('products').update(payload).eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
  } else {
    const { data, error } = await supabase.from('products').insert(payload).select('id').single();
    if (error) { showToast(error.message, 'error'); return; }
    productId = data.id;
  }

  // Sync tags
  await supabase.from('product_tags').delete().eq('product_id', productId);
  if (selectedTagIds.length > 0) {
    await supabase.from('product_tags').insert(selectedTagIds.map(tag_id => ({ product_id: productId, tag_id })));
  }

  showToast(id ? 'Producto actualizado' : 'Producto creado');
  closeModal('modal-product');
  products();
};

window.deleteProduct = async function(id, name) {
  if (!confirm(`¿Eliminar "${name}"?`)) return;
  await supabase.from('products').delete().eq('id', id);
  showToast('Producto eliminado');
  products();
};

// ── Categories ───────────────────────────────────────────────
async function categories() {
  const { data } = await supabase.from('categories').select('*').order('sort_order');
  allCategories = data || [];
  document.getElementById('categories-table').innerHTML = (data||[]).map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td><code>${c.slug}</code></td>
      <td><span class="material-symbols-outlined" style="font-size:1.25rem;color:var(--secondary)">${c.icon_name||'category'}</span> ${c.icon_name||''}</td>
      <td>${c.sort_order}</td>
      <td><span class="badge ${c.is_active?'badge-green':'badge-grey'}">${c.is_active?'Sí':'No'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openCatModal(${JSON.stringify(c).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteCat('${c.id}','${c.name}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin categorías.</td></tr>';

  await populateHomeCategoriesSelectors();
}

async function populateHomeCategoriesSelectors() {
  const settings = await getSettings();
  let featured = [];
  if (settings.home_featured_categories) {
    try {
      featured = JSON.parse(settings.home_featured_categories);
    } catch (e) {
      console.error("Error parsing home_featured_categories:", e);
    }
  }

  const activeCats = allCategories.filter(c => c.is_active);
  for (let i = 1; i <= 4; i++) {
    const select = document.getElementById(`home-cat-pos-${i}`);
    if (!select) continue;

    const optionsHtml = activeCats.map(c => `
      <option value="${c.id}" ${featured[i-1] === c.id ? 'selected' : ''}>${c.name}</option>
    `).join('');
    
    select.innerHTML = '<option value="">-- Seleccionar --</option>' + optionsHtml;
  }
}

window.saveHomeCategoriesConfig = async function() {
  const ids = [];
  const activeCount = allCategories.filter(c => c.is_active).length;
  for (let i = 1; i <= 4; i++) {
    const select = document.getElementById(`home-cat-pos-${i}`);
    if (select && select.value) {
      ids.push(select.value);
    }
  }

  if (ids.length < 4 && activeCount >= 4) {
    showToast('Debes seleccionar exactamente 4 categorías.', 'warning');
    return;
  }

  // Check for duplicates
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    showToast('No puedes seleccionar la misma categoría en múltiples posiciones.', 'error');
    return;
  }

  const { error } = await setSetting('home_featured_categories', JSON.stringify(ids));
  if (error) {
    showToast('Error al guardar configuración: ' + error.message, 'error');
  } else {
    showToast('Configuración de categorías de inicio guardada');
  }
};

window.openCatModal = function(c = null) {
  document.getElementById('cm-title').textContent = c ? 'Editar categoría' : 'Nueva categoría';
  document.getElementById('cm-id').value = c?.id || '';
  document.getElementById('cm-name').value = c?.name || '';
  document.getElementById('cm-slug').value = c?.slug || '';
  document.getElementById('cm-icon').value = c?.icon_name || '';
  document.getElementById('cm-image').value = c?.image_url || '';
  document.getElementById('cm-order').value = c?.sort_order || 0;
  document.getElementById('cm-active').checked = c?.is_active !== false;
  document.getElementById('modal-cat').classList.add('open');
};

window.uploadCatImage = async function(input) {
  const file = input.files[0]; if (!file) return;
  const { url } = await uploadFile('imagenia-assets', 'categories', file);
  if (url) document.getElementById('cm-image').value = url;
};

window.saveCat = async function() {
  const id = document.getElementById('cm-id').value;
  const payload = {
    name: document.getElementById('cm-name').value,
    slug: document.getElementById('cm-slug').value,
    icon_name: document.getElementById('cm-icon').value,
    image_url: document.getElementById('cm-image').value,
    sort_order: parseInt(document.getElementById('cm-order').value) || 0,
    is_active: document.getElementById('cm-active').checked,
  };
  const { error } = id
    ? await supabase.from('categories').update(payload).eq('id', id)
    : await supabase.from('categories').insert(payload);
  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Categoría actualizada' : 'Categoría creada');
  closeModal('modal-cat'); categories();
};

window.deleteCat = async function(id, name) {
  if (!confirm(`¿Eliminar categoría "${name}"?`)) return;
  await supabase.from('categories').delete().eq('id', id);
  showToast('Categoría eliminada'); categories();
};

// ── Tags ─────────────────────────────────────────────────────
async function tags() {
  const { data: groups } = await supabase.from('tag_groups').select('*,tags(*)').order('sort_order');
  allTagGroups = groups || [];
  
  // Render Groups Table
  document.getElementById('groups-table').innerHTML = allTagGroups.map(g => `
    <tr>
      <td><strong>${g.name}</strong></td>
      <td><code>${g.slug}</code></td>
      <td>${g.sort_order}</td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openGroupModal(${JSON.stringify(g).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteGroup('${g.id}','${g.name}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin grupos de filtros.</td></tr>';

  // Render Tags Table
  const rows = allTagGroups.flatMap(g => (g.tags||[]).map(t => ({...t, group_name: g.name})));
  document.getElementById('tags-table').innerHTML = rows.map(t => `
    <tr>
      <td><strong>${t.name}</strong></td>
      <td><span class="badge badge-green">${t.group_name}</span></td>
      <td><code>${t.slug}</code></td>
      <td>${t.sort_order}</td>
      <td><span class="badge ${t.is_active?'badge-green':'badge-grey'}">${t.is_active?'Sí':'No'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openTagModal(${JSON.stringify(t).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteTag('${t.id}','${t.name}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin tags. Crea tags primero.</td></tr>';
}

window.openGroupModal = function(g = null) {
  document.getElementById('gm-id').value = g?.id || '';
  document.getElementById('gm-name').value = g?.name || '';
  document.getElementById('gm-slug').value = g?.slug || '';
  document.getElementById('gm-order').value = g?.sort_order || 0;
  document.getElementById('modal-group').classList.add('open');
};

window.saveGroup = async function() {
  const id = document.getElementById('gm-id').value;
  const payload = { name: document.getElementById('gm-name').value, slug: document.getElementById('gm-slug').value, sort_order: parseInt(document.getElementById('gm-order').value)||0 };
  const { error } = id ? await supabase.from('tag_groups').update(payload).eq('id',id) : await supabase.from('tag_groups').insert(payload);
  if (error) { showToast(error.message,'error'); return; }
  showToast('Grupo guardado'); closeModal('modal-group'); tags();
};

window.deleteGroup = async function(id, name) {
  if (!confirm(`¿Eliminar grupo de filtros "${name}"? ADVERTENCIA: Esto podría fallar si el grupo tiene tags asociados.`)) return;
  const { error } = await supabase.from('tag_groups').delete().eq('id', id);
  if (error) { showToast('Error al eliminar. Puede que tenga tags asociados.', 'error'); return; }
  showToast('Grupo eliminado'); tags();
};

window.openTagModal = function(t = null) {
  document.getElementById('tm-title').textContent = t ? 'Editar tag' : 'Nuevo tag';
  document.getElementById('tm-id').value = t?.id || '';
  document.getElementById('tm-name').value = t?.name || '';
  document.getElementById('tm-slug').value = t?.slug || '';
  document.getElementById('tm-order').value = t?.sort_order || 0;
  document.getElementById('tm-group').innerHTML = allTagGroups.map(g =>
    `<option value="${g.id}" ${t?.group_id===g.id?'selected':''}>${g.name}</option>`).join('');
  document.getElementById('modal-tag').classList.add('open');
};

window.saveTag = async function() {
  const id = document.getElementById('tm-id').value;
  const payload = { group_id: document.getElementById('tm-group').value, name: document.getElementById('tm-name').value, slug: document.getElementById('tm-slug').value, sort_order: parseInt(document.getElementById('tm-order').value)||0 };
  const { error } = id ? await supabase.from('tags').update(payload).eq('id',id) : await supabase.from('tags').insert(payload);
  if (error) { showToast(error.message,'error'); return; }
  showToast('Tag guardado'); closeModal('modal-tag'); tags();
};

window.deleteTag = async function(id, name) {
  if (!confirm(`¿Eliminar tag "${name}"?`)) return;
  await supabase.from('tags').delete().eq('id',id);
  showToast('Tag eliminado'); tags();
};

// ── Catalogs ─────────────────────────────────────────────────
async function catalogs() {
  const { data } = await supabase.from('catalogs').select('*').order('sort_order');
  document.getElementById('catalogs-table').innerHTML = (data||[]).map(c => `
    <tr>
      <td>${c.cover_image_url?`<img src="${c.cover_image_url}" class="img-thumb">`:'—'}</td>
      <td><strong>${c.title}</strong>${c.subtitle?`<br><span style="font-size:0.75rem;color:var(--on-surface-variant)">${c.subtitle}</span>`:''}</td>
      <td>${c.category_slug||'—'}</td>
      <td>${c.year||'—'}</td>
      <td>${c.pdf_url?`<button onclick="openPDFPreview('${c.pdf_url}', '${c.title}')" class="btn btn-secondary btn-sm">Ver PDF</button>`:'—'}</td>
      <td><span class="badge ${c.is_active?'badge-green':'badge-grey'}">${c.is_active?'Activo':'Inactivo'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openCatalogModal(${JSON.stringify(c).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteCatalog('${c.id}','${c.title}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin catálogos.</td></tr>';
}

window.openPDFPreview = function(url, title) {
  document.getElementById('pdf-preview-title').textContent = title;
  document.getElementById('pdf-iframe').src = url;
  document.getElementById('modal-pdf-preview').classList.add('open');
};

window.openCatalogModal = function(c = null) {
  document.getElementById('catm-title').textContent = c ? 'Editar catálogo' : 'Nuevo catálogo';
  document.getElementById('catm-id').value = c?.id || '';
  document.getElementById('catm-title-in').value = c?.title || '';
  document.getElementById('catm-sub').value = c?.subtitle || '';
  document.getElementById('catm-cat').value = c?.category_slug || '';
  document.getElementById('catm-year').value = c?.year || 2025;
  document.getElementById('catm-pdf').value = c?.pdf_url || '';
  document.getElementById('catm-cover').value = c?.cover_image_url || '';
  document.getElementById('catm-order').value = c?.sort_order || 0;
  document.getElementById('catm-active').checked = c?.is_active !== false;
  document.getElementById('modal-catalog').classList.add('open');
};

window.uploadPDF = async function(input) {
  const file = input.files[0]; if (!file) return;
  const btn = input.closest('.upload-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Subiendo...';
  const { url, error } = await uploadFile('imagenia-assets', 'catalogs', file);
  btn.innerHTML = originalText;
  if (error) { showToast('Error: ' + error.message, 'error'); console.error('Upload PDF error:', error); return; }
  if (url) document.getElementById('catm-pdf').value = url;
  showToast('PDF subido');
};

window.uploadCatalogCover = async function(input) {
  const file = input.files[0]; if (!file) return;
  const btn = input.closest('.upload-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Subiendo...';
  const { url, error } = await uploadFile('imagenia-assets', 'catalogs', file);
  btn.innerHTML = originalText;
  if (error) { showToast('Error: ' + error.message, 'error'); console.error('Upload Cover error:', error); return; }
  if (url) document.getElementById('catm-cover').value = url;
  showToast('Imagen subida');
};

function getWhatsAppLink(phone, name, dateStr, subject) {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^\d]/g, '');
  const finalPhone = (cleanPhone.length === 10) ? '52' + cleanPhone : cleanPhone;
  const cleanName = (name || '').trim();
  const cleanDate = (dateStr || '').trim();
  const cleanSubject = (subject || 'nuestros servicios').trim();
  const text = `Hola por parte de Imagenia! Un gusto saludarle, *${cleanName}* el día *${cleanDate}* nos envió un mensaje para preguntar sobre _${cleanSubject}_, ¿ Podemos seguir la comunicación por este medio o prefiere por correo?`;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
}

function getWhatsAppDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

window.saveCatalog = async function() {
  const id = document.getElementById('catm-id').value;
  const payload = {
    title: document.getElementById('catm-title-in').value,
    subtitle: document.getElementById('catm-sub').value,
    category_slug: document.getElementById('catm-cat').value,
    year: parseInt(document.getElementById('catm-year').value),
    pdf_url: document.getElementById('catm-pdf').value,
    cover_image_url: document.getElementById('catm-cover').value,
    sort_order: parseInt(document.getElementById('catm-order').value)||0,
    is_active: document.getElementById('catm-active').checked,
  };
  const { error } = id ? await supabase.from('catalogs').update(payload).eq('id',id) : await supabase.from('catalogs').insert(payload);
  if (error) { showToast(error.message,'error'); return; }
  showToast('Catálogo guardado'); closeModal('modal-catalog'); catalogs();
};

window.deleteCatalog = async function(id, title) {
  if (!confirm(`¿Eliminar catálogo "${title}"?`)) return;
  await supabase.from('catalogs').delete().eq('id',id);
  showToast('Catálogo eliminado'); catalogs();
};

window.showContactDetail = function(id) {
  deactivateItem(id);
  const contact = allContacts.find(c => c.id === id);
  if (!contact) return;
  
  let comments = contact.comentarios || '';
  let asunto = 'Mensaje de Contacto';
  let mainText = comments;
  let cleanSubject = 'nuestros servicios';
  if (comments.startsWith('Producto: ')) {
    const parts = comments.split('\n');
    asunto = parts[0].replace('Producto: ', '');
    cleanSubject = asunto;
    mainText = parts.slice(1).join('\n');
  }
  
  const waDate = getWhatsAppDate(contact.submitted_at);
  const waLink = getWhatsAppLink(contact.telefono, contact.nombre, waDate, cleanSubject);
  
  const contentEl = document.getElementById('contact-detail-content');
  if (contentEl) {
    contentEl.innerHTML = `
      <div class="message-letter">
        <div class="letter-header">
          <div class="letter-from">
            <div class="sender-name">${contact.nombre}</div>
            <div class="sender-company">${contact.empresa || 'Empresa particular'}</div>
          </div>
          <div class="letter-meta-right">
            <div class="letter-date">${fmt(contact.submitted_at)}</div>
            <div class="letter-subject">${asunto}</div>
          </div>
        </div>
        <div class="letter-body">${mainText || 'Sin comentarios.'}</div>
        <div class="letter-footer-right">
          <div><a href="mailto:${contact.email}">${contact.email}</a></div>
          <div>${contact.telefono ? `<a href="${waLink}" target="_blank" onclick="event.stopPropagation()">${contact.telefono}</a>` : 'Sin teléfono'}</div>
        </div>
      </div>
    `;
  }
  document.getElementById('modal-contact-detail')?.classList.add('open');
};

async function contacts() {
  const { data } = await supabase.from('contact_submissions').select('*').order('submitted_at',{ascending:false});
  allContacts = data || [];
  document.getElementById('contacts-table').innerHTML = allContacts.map(r => {
    const isUnread = newItems.has(r.id);
    
    let comments = r.comentarios || '';
    let cleanSubject = 'nuestros servicios';
    if (comments.startsWith('Producto: ')) {
      cleanSubject = comments.split('\n')[0].replace('Producto: ', '');
    }
    
    const waDate = getWhatsAppDate(r.submitted_at);
    const waLink = getWhatsAppLink(r.telefono, r.nombre, waDate, cleanSubject);
    
    return `
      <tr id="row-contact-${r.id}" class="${isUnread ? 'unread-item' : ''}" onclick="showContactDetail('${r.id}')" style="cursor:pointer">
        <td>${r.nombre}</td>
        <td>${r.empresa||'—'}</td>
        <td><a href="mailto:${r.email}" onclick="event.stopPropagation()">${r.email}</a></td>
        <td>${r.telefono ? `<a href="${waLink}" target="_blank" onclick="event.stopPropagation()">${r.telefono}</a>` : '—'}</td>
        <td style="max-width:240px;white-space:pre-wrap;font-size:0.8rem">${r.comentarios||'—'}</td>
        <td>${fmt(r.submitted_at)}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon-sm btn-del" onclick="event.stopPropagation(); deleteContact('${r.id}')">
              <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin mensajes aún.</td></tr>';
}

window.deleteContact = async function(id) {
  if (!confirm('¿Eliminar este mensaje de contacto?')) return;
  const { error } = await supabase.from('contact_submissions').delete().eq('id', id);
  if (error) {
    showToast('Error al eliminar mensaje', 'error');
  } else {
    showToast('Mensaje eliminado');
    contacts();
    loadDashboard();
  }
};

// ── Helpers ──────────────────────────────────────────────────
function fmt(ts) { return ts ? new Date(ts).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; }

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(mo => {
  mo.addEventListener('click', e => { if (e.target === mo) mo.classList.remove('open'); });
});

// Auto slug from name in product modal
document.getElementById('pm-name')?.addEventListener('input', function() {
  if (!document.getElementById('pm-id').value) {
    document.getElementById('pm-slug').value = this.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  }
});

// ── Hero Slides ───────────────────────────────────────────────
async function slides() {
  const { data } = await supabase.from('hero_slides').select('*').order('sort_order');
  document.getElementById('slides-table').innerHTML = (data||[]).map(s => `
    <tr>
      <td>${s.image_url ? `<img src="${s.image_url}" class="img-thumb" onerror="this.style.display='none'">` : '—'}</td>
      <td><strong>${s.title||'—'}</strong></td>
      <td style="max-width:200px;font-size:0.8rem;color:var(--on-surface-variant)">${s.subtitle||'—'}</td>
      <td style="font-size:0.8rem">${s.cta_text ? `<a href="${s.cta_url}" target="_blank">${s.cta_text}</a>` : '—'}</td>
      <td>${s.sort_order}</td>
      <td><span class="badge ${s.is_active?'badge-green':'badge-grey'}">${s.is_active?'Sí':'No'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openSlideModal(${JSON.stringify(s).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteSlide('${s.id}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin slides. Agrega el primero.</td></tr>';
}

window.openSlideModal = function(s = null) {
  document.getElementById('slm-title').textContent = s ? 'Editar slide' : 'Nuevo slide';
  document.getElementById('slm-id').value = s?.id || '';
  document.getElementById('slm-title-in').value = s?.title || '';
  document.getElementById('slm-subtitle').value = s?.subtitle || '';
  document.getElementById('slm-image').value = s?.image_url || '';
  document.getElementById('slm-cta-text').value = s?.cta_text || '';
  document.getElementById('slm-cta-url').value = s?.cta_url || '';
  document.getElementById('slm-order').value = s?.sort_order || 0;
  document.getElementById('slm-active').checked = s?.is_active !== false;
  const preview = document.getElementById('slm-img-preview');
  preview.innerHTML = s?.image_url ? `<img src="${s.image_url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">` : '';
  document.getElementById('modal-slide').classList.add('open');
  window.updateSlideTextPreview();
};

window.updateSlideTextPreview = function() {
  const title = document.getElementById('slm-title-in')?.value || '';
  const subtitle = document.getElementById('slm-subtitle')?.value || '';
  const titlePreview = document.getElementById('slm-preview-title');
  const subPreview = document.getElementById('slm-preview-sub');
  if (titlePreview) titlePreview.textContent = title;
  if (subPreview) subPreview.textContent = subtitle;
};

window.uploadSlideImage = async function(input) {
  const file = input.files[0]; if (!file) return;
  const { url, error } = await uploadFile('imagenia-assets', 'slides', file);
  if (error) { showToast('Error al subir imagen', 'error'); return; }
  document.getElementById('slm-image').value = url;
  document.getElementById('slm-img-preview').innerHTML = `<img src="${url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">`;
  showToast('Imagen subida');
};

window.saveSlide = async function() {
  const id = document.getElementById('slm-id').value;
  const imageUrl = document.getElementById('slm-image').value;
  if (!imageUrl) { showToast('La imagen es requerida', 'error'); return; }
  const payload = {
    title: document.getElementById('slm-title-in').value || null,
    subtitle: document.getElementById('slm-subtitle').value || null,
    image_url: imageUrl,
    cta_text: document.getElementById('slm-cta-text').value || null,
    cta_url: document.getElementById('slm-cta-url').value || null,
    sort_order: parseInt(document.getElementById('slm-order').value) || 0,
    is_active: document.getElementById('slm-active').checked,
  };
  const { error } = id
    ? await supabase.from('hero_slides').update(payload).eq('id', id)
    : await supabase.from('hero_slides').insert(payload);
  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Slide actualizado' : 'Slide creado');
  closeModal('modal-slide'); slides();
};

window.deleteSlide = async function(id) {
  if (!confirm('¿Eliminar este slide?')) return;
  await supabase.from('hero_slides').delete().eq('id', id);
  showToast('Slide eliminado'); slides();
};

// ── Impact Stats ──────────────────────────────────────────────
async function impact() {
  const { data } = await supabase.from('impact_stats').select('*').order('sort_order');
  document.getElementById('impact-table').innerHTML = (data||[]).map(s => `
    <tr>
      <td><span class="material-symbols-outlined" style="color:var(--secondary)">${s.icon}</span> <code>${s.icon}</code></td>
      <td><strong>${s.value}</strong></td>
      <td>${s.label}</td>
      <td>${s.sort_order}</td>
      <td><span class="badge ${s.is_active?'badge-green':'badge-grey'}">${s.is_active?'Sí':'No'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openImpactModal(${JSON.stringify(s).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteImpact('${s.id}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin stats. Agrega el primero.</td></tr>';
}

window.openImpactModal = function(s = null) {
  document.getElementById('imp-title').textContent = s ? 'Editar stat' : 'Nuevo stat';
  document.getElementById('imp-id').value = s?.id || '';
  document.getElementById('imp-icon').value = s?.icon || '';
  document.getElementById('imp-value').value = s?.value || '';
  document.getElementById('imp-label').value = s?.label || '';
  document.getElementById('imp-stat-title').value = s?.title || '';
  document.getElementById('imp-description').value = s?.description || '';
  document.getElementById('imp-order').value = s?.sort_order || 0;
  document.getElementById('imp-active').checked = s?.is_active !== false;
  document.getElementById('modal-impact').classList.add('open');
};

window.saveImpact = async function() {
  const id = document.getElementById('imp-id').value;
  const payload = {
    icon:        document.getElementById('imp-icon').value,
    value:       document.getElementById('imp-value').value,
    label:       document.getElementById('imp-label').value,
    title:       document.getElementById('imp-stat-title').value || null,
    description: document.getElementById('imp-description').value || null,
    sort_order:  parseInt(document.getElementById('imp-order').value) || 0,
    is_active:   document.getElementById('imp-active').checked,
  };
  if (!payload.icon || !payload.value || !payload.label) { showToast('Ícono, valor y label son requeridos', 'error'); return; }
  const { error } = id
    ? await supabase.from('impact_stats').update(payload).eq('id', id)
    : await supabase.from('impact_stats').insert(payload);
  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Stat actualizado' : 'Stat creado');
  closeModal('modal-impact'); impact();
};

window.deleteImpact = async function(id) {
  if (!confirm('¿Eliminar este stat?')) return;
  await supabase.from('impact_stats').delete().eq('id', id);
  showToast('Stat eliminado'); impact();
};

// ── Blogs ────────────────────────────────────────────────────────
async function blogs() {
  const { data } = await supabase.from('blogs').select('*').order('sort_order');
  document.getElementById('blogs-table').innerHTML = (data||[]).map(s => `
    <tr>
      <td>${s.image_url ? `<img src="${s.image_url}" class="img-thumb" onerror="this.style.display='none'">` : '—'}</td>
      <td><strong>${s.title}</strong></td>
      <td style="max-width:200px;font-size:0.8rem;color:var(--on-surface-variant)">${(s.excerpt||'').slice(0,80)}${s.excerpt?.length>80?'...':''}</td>
      <td style="font-size:0.8rem">${s.content_url ? `<a href="${s.content_url}" target="_blank">Enlace</a>` : '—'}</td>
      <td>${s.sort_order}</td>
      <td><span class="badge ${s.is_active?'badge-green':'badge-grey'}">${s.is_active?'Sí':'No'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openBlogModal(${JSON.stringify(s).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteBlog('${s.id}','${s.title}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin blogs. Agrega el primero.</td></tr>';
}
let blogQuill = null;

window.openBlogModal = function(s = null) {
  document.getElementById('blog-modal-title').textContent = s ? 'Editar blog' : 'Nuevo blog';
  document.getElementById('blog-id').value = s?.id || '';
  document.getElementById('blog-title').value = s?.title || '';
  document.getElementById('blog-excerpt').value = s?.excerpt || '';
  
  if (!blogQuill) {
    blogQuill = new Quill('#blog-content-editor', {
      theme: 'snow',
      modules: {
        toolbar: {
          container: [
            [{ 'size': ['small', false, 'large', 'huge'] }],
            [{ 'header': [2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'image', 'video', 'clean']
          ],
          handlers: {
            // Handler personalizado: sube la imagen a Supabase Storage en lugar de base64
            image: function() {
              const input = document.createElement('input');
              input.setAttribute('type', 'file');
              input.setAttribute('accept', 'image/*');
              input.click();
              input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;
                showToast('Subiendo imagen...');
                const { url, error } = await uploadFile('imagenia-assets', 'blogs', file);
                if (error || !url) { showToast('Error al subir imagen', 'error'); return; }
                const range = blogQuill.getSelection(true);
                blogQuill.insertEmbed(range.index, 'image', url);
                blogQuill.setSelection(range.index + 1);
                showToast('Imagen insertada en el contenido ✓');
              };
            }
          }
        }
      }
    });
  }
  let contentToLoad = s?.content || '';
  if (contentToLoad && !contentToLoad.includes('<')) {
    contentToLoad = contentToLoad.replace(/\n/g, '<br>');
  }
  blogQuill.root.innerHTML = contentToLoad;

  document.getElementById('blog-image').value = s?.image_url || '';
  document.getElementById('blog-content-url').value = s?.content_url || '';
  document.getElementById('blog-order').value = s?.sort_order || 0;
  document.getElementById('blog-active').checked = s?.is_active !== false;
  const preview = document.getElementById('blog-img-preview');
  preview.innerHTML = s?.image_url ? `<img src="${s.image_url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">` : '';
  document.getElementById('modal-blog').classList.add('open');
};

window.uploadBlogImage = async function(input) {
  const file = input.files[0]; if (!file) return;
  const { url, error } = await uploadFile('imagenia-assets', 'blogs', file);
  if (error) { showToast('Error al subir imagen', 'error'); return; }
  document.getElementById('blog-image').value = url;
  document.getElementById('blog-img-preview').innerHTML = `<img src="${url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">`;
  showToast('Imagen subida');
};

window.saveBlog = async function() {
  const id = document.getElementById('blog-id').value;
  const title = document.getElementById('blog-title').value;
  if (!title) { showToast('El título es requerido', 'error'); return; }
  const payload = {
    title,
    excerpt: document.getElementById('blog-excerpt').value || null,
    content: (blogQuill && blogQuill.root.innerHTML !== '<p><br></p>') ? blogQuill.root.innerHTML : null,
    image_url:   document.getElementById('blog-image').value || null,
    content_url: document.getElementById('blog-content-url').value || null,
    sort_order:  parseInt(document.getElementById('blog-order').value) || 0,
    is_active:   document.getElementById('blog-active').checked,
  };
  const { error } = id
    ? await supabase.from('blogs').update(payload).eq('id', id)
    : await supabase.from('blogs').insert(payload);
  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Blog actualizado' : 'Blog creado');
  closeModal('modal-blog'); blogs();
};

window.deleteBlog = async function(id, name) {
  if (!confirm(`¿Eliminar blog "${name}"?`)) return;
  await supabase.from('blogs').delete().eq('id', id);
  showToast('Blog eliminado'); blogs();
};

// ── Impact Comparisons ──────────────────────────────────────────
async function comparisons() {
  const { data } = await supabase.from('impact_comparisons').select('*').order('sort_order');
  document.getElementById('comparisons-table').innerHTML = (data||[]).map(c => `
    <tr>
      <td><strong>${c.feature}</strong></td>
      <td style="max-width:220px;font-size:0.8rem">${c.col_imagenia}</td>
      <td style="max-width:220px;font-size:0.8rem;color:var(--on-surface-variant)">${c.col_traditional}</td>
      <td>${c.sort_order}</td>
      <td><span class="badge ${c.is_active?'badge-green':'badge-grey'}">${c.is_active?'Sí':'No'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openCompModal(${JSON.stringify(c).replace(/"/g,'&quot;')})"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteComp('${c.id}','${c.feature}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin comparaciones. Agrega la primera.</td></tr>';
}

window.openCompModal = function(c = null) {
  document.getElementById('comp-modal-title').textContent = c ? 'Editar fila' : 'Nueva fila';
  document.getElementById('cmp-id').value = c?.id || '';
  document.getElementById('cmp-feature').value = c?.feature || '';
  document.getElementById('cmp-imagenia').value = c?.col_imagenia || '';
  document.getElementById('cmp-trad').value = c?.col_traditional || '';
  document.getElementById('cmp-order').value = c?.sort_order || 0;
  document.getElementById('cmp-active').checked = c?.is_active !== false;
  document.getElementById('modal-comp').classList.add('open');
};

window.saveComp = async function() {
  const id = document.getElementById('cmp-id').value;
  const payload = {
    feature:         document.getElementById('cmp-feature').value,
    col_imagenia:    document.getElementById('cmp-imagenia').value,
    col_traditional: document.getElementById('cmp-trad').value,
    sort_order:      parseInt(document.getElementById('cmp-order').value) || 0,
    is_active:       document.getElementById('cmp-active').checked,
  };
  if (!payload.feature || !payload.col_imagenia || !payload.col_traditional) {
    showToast('Los tres campos de texto son requeridos', 'error'); return;
  }
  const { error } = id
    ? await supabase.from('impact_comparisons').update(payload).eq('id', id)
    : await supabase.from('impact_comparisons').insert(payload);
  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Fila actualizada' : 'Fila creada');
  closeModal('modal-comp'); comparisons();
};

window.deleteComp = async function(id, name) {
  if (!confirm(`¿Eliminar "${name}"?`)) return;
  await supabase.from('impact_comparisons').delete().eq('id', id);
  showToast('Fila eliminada'); comparisons();
};

// ── WhatsApp Questions CRUD ────────────────────────────────────
async function loadWAQuestions() {
  const { data } = await supabase.from('whatsapp_questions').select('*').order('sort_order');
  const typeLabel = { text: 'Texto', textarea: 'Párrafo', select: 'Selección' };
  document.getElementById('wa-questions-table').innerHTML = (data || []).map(q => `
    <tr>
      <td>${q.sort_order}</td>
      <td><strong>${q.question}</strong>${q.placeholder ? `<br><span style="font-size:0.75rem;color:var(--on-surface-variant)">${q.placeholder}</span>` : ''}</td>
      <td><span class="badge badge-grey">${typeLabel[q.field_type] || q.field_type}</span></td>
      <td><span class="badge ${q.is_required ? 'badge-green' : 'badge-grey'}">${q.is_required ? 'Sí' : 'No'}</span></td>
      <td><span class="badge ${q.is_active ? 'badge-green' : 'badge-grey'}">${q.is_active ? 'Activa' : 'Oculta'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick='openWAQModal(${JSON.stringify(q).replace(/"/g,"&quot;")})'><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteWAQ('${q.id}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin preguntas. Agrega la primera.</td></tr>';
}

window.openWAQModal = function(q = null) {
  document.getElementById('waq-modal-title').textContent = q ? 'Editar pregunta' : 'Nueva pregunta';
  document.getElementById('waq-id').value          = q?.id || '';
  document.getElementById('waq-question').value     = q?.question || '';
  document.getElementById('waq-placeholder').value  = q?.placeholder || '';
  document.getElementById('waq-type').value         = q?.field_type || 'text';
  document.getElementById('waq-options').value      = q?.options || '';
  document.getElementById('waq-order').value        = q?.sort_order ?? 0;
  document.getElementById('waq-required').checked   = q?.is_required !== false;
  document.getElementById('waq-active').checked     = q?.is_active !== false;
  toggleWAQOptions(q?.field_type || 'text');
  document.getElementById('modal-waq').classList.add('open');
};

window.toggleWAQOptions = function(type) {
  document.getElementById('waq-options-wrap').style.display = type === 'select' ? '' : 'none';
};

window.saveWAQ = async function() {
  const id  = document.getElementById('waq-id').value;
  const q   = document.getElementById('waq-question').value.trim();
  if (!q) { showToast('La pregunta es requerida', 'error'); return; }
  const type = document.getElementById('waq-type').value;
  const payload = {
    question:    q,
    placeholder: document.getElementById('waq-placeholder').value || null,
    field_type:  type,
    options:     type === 'select' ? document.getElementById('waq-options').value : null,
    sort_order:  parseInt(document.getElementById('waq-order').value) || 0,
    is_required: document.getElementById('waq-required').checked,
    is_active:   document.getElementById('waq-active').checked,
  };
  const { error } = id
    ? await supabase.from('whatsapp_questions').update(payload).eq('id', id)
    : await supabase.from('whatsapp_questions').insert(payload);
  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Pregunta actualizada' : 'Pregunta creada');
  closeModal('modal-waq'); loadWAQuestions();
};

window.deleteWAQ = async function(id) {
  if (!confirm('¿Eliminar esta pregunta?')) return;
  await supabase.from('whatsapp_questions').delete().eq('id', id);
  showToast('Pregunta eliminada'); loadWAQuestions();
};

// ── WhatsApp Leads ─────────────────────────────────────────
async function loadWALeads() {
  const { data } = await supabase.from('whatsapp_leads').select('*').order('created_at', { ascending: false });
  document.getElementById('wa-leads-table').innerHTML = (data || []).map(l => {
    const date   = new Date(l.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    const answers = Object.entries(l.answers || {}).map(([k,v]) => `<div><strong>${k}:</strong> ${v||'—'}</div>`).join('');
    const isUnread = newItems.has(l.id);
    return `
      <tr id="row-wa-${l.id}" class="${isUnread ? 'unread-item' : ''}" onclick="deactivateItem('${l.id}')">
        <td style="white-space:nowrap;font-size:0.8rem">${date}</td>
        <td style="font-size:0.8rem;max-width:280px">${answers}</td>
        <td style="font-size:0.8rem;max-width:260px;color:var(--on-surface-variant)">${(l.whatsapp_message||'').slice(0,120)}...</td>
        <td>
          <button class="btn-icon-sm btn-del" onclick="event.stopPropagation(); deleteLead('${l.id}')">
            <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
          </button>
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin leads capturados aún.</td></tr>';
}

window.deleteLead = async function(id) {
  if (!confirm('¿Eliminar este lead?')) return;
  await supabase.from('whatsapp_leads').delete().eq('id', id);
  showToast('Lead eliminado');
  loadWALeads();
  loadDashboard();
};

window.exportWALeads = async function() {
  const { data } = await supabase.from('whatsapp_leads').select('*').order('created_at', { ascending: false });
  if (!data?.length) { showToast('Sin datos para exportar', 'error'); return; }
  // Build CSV
  const allKeys = [...new Set(data.flatMap(r => Object.keys(r.answers || {})))];
  const header  = ['Fecha', ...allKeys, 'Mensaje', 'Teléfono'].join(',');
  const rows    = data.map(r => [
    new Date(r.created_at).toLocaleString('es-MX'),
    ...allKeys.map(k => `"${(r.answers?.[k] || '').replace(/"/g, '""')}"`),
    `"${(r.whatsapp_message || '').replace(/"/g, '""')}"`,
    r.phone_sent_to || ''
  ].join(','));
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'leads_whatsapp.csv' });
  a.click();
  showToast('CSV exportado ✓');
};

// ── Clients / Logos ────────────────────────────────────────
let allClients = [];

async function clients() {
  const settings = await getSettings();
  let parsed = [];
  if (settings.client_logos_json) {
    try { parsed = JSON.parse(settings.client_logos_json); } catch(e){}
  }
  allClients = Array.isArray(parsed) ? parsed : [];
  renderClientsTable();
}

function renderClientsTable() {
  const tbody = document.getElementById('clients-table');
  if (!tbody) return;
  tbody.innerHTML = allClients.map(c => `
    <tr>
      <td>${c.logo ? `<img src="${c.logo}" style="max-height:40px;max-width:80px;object-fit:contain;border-radius:4px;background:var(--surface-container)">` : '—'}</td>
      <td><strong>${c.name || '—'}</strong></td>
      <td>${c.link ? `<a href="${c.link}" target="_blank" style="color:var(--primary);font-size:0.8rem">Enlace</a>` : '—'}</td>
      <td>${c.order || 0}</td>
      <td><span style="color:${c.active !== false ? 'var(--primary)' : 'var(--on-surface-variant)'}">${c.active !== false ? '✓' : '✗'}</span></td>
      <td style="white-space:nowrap; text-align:right;">
        <button class="btn-icon-sm btn-edit" onclick="openClientModal('${c.id}')"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteClient('${c.id}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin clientes agregados aún.</td></tr>';
}

window.openClientModal = function(id = null) {
  const modal = document.getElementById('modal-client');
  if (!modal) return;
  
  const titleEl = document.getElementById('clm-title');
  const idInp   = document.getElementById('clm-id');
  const nameInp = document.getElementById('clm-name');
  const logoInp = document.getElementById('clm-logo');
  const linkInp = document.getElementById('clm-link');
  const orderInp= document.getElementById('clm-order');
  const actInp  = document.getElementById('clm-active');
  const preview = document.getElementById('clm-img-preview');

  if (id) {
    const c = allClients.find(x => x.id === id);
    if (c) {
      titleEl.textContent = 'Editar Cliente';
      idInp.value   = c.id;
      nameInp.value = c.name || '';
      logoInp.value = c.logo || '';
      linkInp.value = c.link || '';
      orderInp.value= c.order || 0;
      actInp.checked= c.active !== false;
      preview.innerHTML = c.logo ? window.generatePreviewHtml(c.logo) : '';
    }
  } else {
    titleEl.textContent = 'Nuevo Cliente';
    idInp.value   = '';
    nameInp.value = '';
    logoInp.value = '';
    linkInp.value = '';
    orderInp.value= 0;
    actInp.checked= true;
    preview.innerHTML = '';
  }
  modal.classList.add('open');
};

window.uploadClientLogo = async function(input) {
  const file = input.files[0]; if (!file) return;
  const { url, error } = await uploadFile('imagenia-assets', 'clients', file);
  if (error) { showToast('Error al subir imagen', 'error'); return; }
  document.getElementById('clm-logo').value = url;
  document.getElementById('clm-img-preview').innerHTML = window.generatePreviewHtml(url);
  showToast('Logo subido');
};

window.saveClient = async function() {
  const idInp   = document.getElementById('clm-id');
  const nameInp = document.getElementById('clm-name');
  const logoInp = document.getElementById('clm-logo');
  const linkInp = document.getElementById('clm-link');
  const orderInp= document.getElementById('clm-order');
  const actInp  = document.getElementById('clm-active');

  const name = nameInp.value.trim();
  const logo = logoInp.value.trim();
  if (!name || !logo) { showToast('Nombre y Logo son obligatorios', 'error'); return; }

  const idData = idInp.value || 'c-' + Date.now();
  const clientObj = {
    id: idData,
    name,
    logo,
    link: linkInp.value.trim(),
    order: parseInt(orderInp.value) || 0,
    active: actInp.checked
  };

  if (idInp.value) {
    const idx = allClients.findIndex(x => x.id === idData);
    if (idx !== -1) allClients[idx] = clientObj;
  } else {
    allClients.push(clientObj);
  }

  allClients.sort((a,b) => (a.order || 0) - (b.order || 0));
  await setSetting('client_logos_json', JSON.stringify(allClients));
  showToast('Cliente guardado con éxito');
  window.closeModal('modal-client');
  renderClientsTable();
};

window.deleteClient = async function(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  allClients = allClients.filter(x => x.id !== id);
  await setSetting('client_logos_json', JSON.stringify(allClients));
  showToast('Cliente eliminado');
  renderClientsTable();
};

init();

// ── Home Photo Carousel ────────────────────────────────────────
let allHCItems = [];

async function loadHomeCarousel() {
  const settings = await getSettings();
  try { allHCItems = JSON.parse(settings.home_photo_carousel_json || '[]'); } catch(e) { allHCItems = []; }
  if (!Array.isArray(allHCItems)) allHCItems = [];
  allHCItems.sort((a, b) => (a.order || 0) - (b.order || 0));
  renderHCTable();
}

function renderHCTable() {
  const tbody = document.getElementById('home-carousel-table');
  if (!tbody) return;
  const tooMany = allHCItems.length >= 7;
  tbody.innerHTML = allHCItems.map(item => `
    <tr>
      <td>${item.image_url ? `<img src="${item.image_url}" class="img-thumb" onerror="this.style.display='none'">` : '—'}</td>
      <td><strong>${item.title || '—'}</strong></td>
      <td style="font-size:0.8rem;color:var(--on-surface-variant)">${item.subtitle || '—'}</td>
      <td style="font-size:0.8rem">${item.link ? `<a href="${item.link}" target="_blank">Enlace</a>` : '—'}</td>
      <td>${item.order || 0}</td>
      <td><span class="badge ${item.active !== false ? 'badge-green' : 'badge-grey'}">${item.active !== false ? 'Sí' : 'No'}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon-sm btn-edit" onclick="openHCModal('${item.id}')"><span class="material-symbols-outlined" style="font-size:1rem">edit</span></button>
        <button class="btn-icon-sm btn-del" onclick="deleteHC('${item.id}')"><span class="material-symbols-outlined" style="font-size:1rem">delete</span></button>
      </div></td>
    </tr>`)  .join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin fotos. Agrega la primera (máx. 7).</td></tr>';
}

window.openHCModal = function(id = null) {
  const item = id ? allHCItems.find(x => x.id === id) : null;
  if (allHCItems.length >= 7 && !item) { showToast('Máximo 7 fotos permitidas', 'error'); return; }
  document.getElementById('hc-modal-title').textContent = item ? 'Editar foto' : 'Nueva foto';
  document.getElementById('hc-id').value = item?.id || '';
  document.getElementById('hc-image').value = item?.image_url || '';
  document.getElementById('hc-title').value = item?.title || '';
  document.getElementById('hc-subtitle').value = item?.subtitle || '';
  document.getElementById('hc-link').value = item?.link || '';
  document.getElementById('hc-order').value = item?.order ?? allHCItems.length;
  document.getElementById('hc-active').checked = item?.active !== false;
  document.getElementById('hc-img-preview').innerHTML =
    item?.image_url ? `<img src="${item.image_url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">` : '';
  document.getElementById('modal-hc').classList.add('open');
};

window.uploadHCImage = async function(input) {
  const file = input.files[0]; if (!file) return;
  const btn = input.closest('.upload-btn');
  btn.innerHTML = 'Subiendo...';
  const { url, error } = await uploadFile('imagenia-assets', 'home-carousel', file);
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">upload</span> Subir';
  if (error || !url) { showToast('Error al subir imagen', 'error'); return; }
  document.getElementById('hc-image').value = url;
  document.getElementById('hc-img-preview').innerHTML = `<img src="${url}" style="height:80px;border-radius:var(--radius-sm);object-fit:cover">`;
  showToast('Imagen subida ✓');
};

window.saveHC = async function() {
  const imageUrl = document.getElementById('hc-image').value.trim();
  if (!imageUrl) { showToast('La imagen es requerida', 'error'); return; }
  const editId = document.getElementById('hc-id').value;
  const item = {
    id:        editId || 'hc-' + Date.now(),
    image_url: imageUrl,
    title:     document.getElementById('hc-title').value.trim() || null,
    subtitle:  document.getElementById('hc-subtitle').value.trim() || null,
    link:      document.getElementById('hc-link').value.trim() || null,
    order:     parseInt(document.getElementById('hc-order').value) || 0,
    active:    document.getElementById('hc-active').checked,
  };
  if (editId) {
    const idx = allHCItems.findIndex(x => x.id === editId);
    if (idx !== -1) allHCItems[idx] = item;
  } else {
    if (allHCItems.length >= 7) { showToast('Máximo 7 fotos permitidas', 'error'); return; }
    allHCItems.push(item);
  }
  allHCItems.sort((a, b) => (a.order || 0) - (b.order || 0));
  await setSetting('home_photo_carousel_json', JSON.stringify(allHCItems));
  showToast('Foto guardada ✓');
  closeModal('modal-hc');
  renderHCTable();
};

window.deleteHC = async function(id) {
  if (!confirm('¿Eliminar esta foto del carousel?')) return;
  allHCItems = allHCItems.filter(x => x.id !== id);
  await setSetting('home_photo_carousel_json', JSON.stringify(allHCItems));
  showToast('Foto eliminada');
  renderHCTable();
};


/* ── Icon Picker (Material Symbols) ───────────────────────────── */
const ALL_ICONS = [
  // Exterior / Mobiliario
  'deck','chair','table_restaurant','outdoor_grill','cottage','home',
  'park','spa','pool','beach_access','camping','forest',
  // Materiales / Productos
  'texture','layers','inventory_2','category','shopping_bag','storefront',
  'eco','recycling','energy_savings_leaf','water_drop','grass','nature',
  // Espacios
  'hotel','apartment','villa','corporate_fare','domain','business',
  'school','sports_soccer','stadium','landscape','terrain','map',
  // Construcción / Diseño
  'architecture','foundation','carpenter','engineering','construction',
  'build','handyman','square_foot','straighten','design_services',
  // Clima / Outdoor
  'wb_sunny','umbrella','air','thunderstorm','grain','ac_unit',
  // Personas / Negocio
  'groups','person','family_restroom','emoji_people','support_agent',
  'star','grade','verified','workspace_premium','trophy',
  // Acciones
  'add_shopping_cart','favorite','bookmark','share','download',
  'filter_list','sort','search','settings','tune',
  // Forma / estilo
  'circle','square','hexagon','pentagon','diamond','shapes',
  'palette','format_paint','brush','style','color_lens',
];

let _iconFiltered = [...ALL_ICONS];

function renderIconGrid(icons) {
  const grid = document.getElementById('cm-icon-grid');
  if (!grid) return;
  grid.innerHTML = icons.map(name => `
    <button type="button" title="${name}"
      onclick="selectIcon('${name}')"
      style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border:none;background:none;cursor:pointer;border-radius:6px;transition:background 0.15s"
      onmouseover="this.style.background='var(--surface-container)'"
      onmouseout="this.style.background='none'">
      <span class="material-symbols-outlined" style="font-size:1.5rem;color:var(--primary)">${name}</span>
      <span style="font-size:0.55rem;color:var(--on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40px">${name}</span>
    </button>`).join('');
}

window.filterIcons = function(query) {
  const q = (query || '').toLowerCase().trim();
  const filtered = q
    ? ALL_ICONS.filter(n => n.includes(q))
    : ALL_ICONS;
  renderIconGrid(filtered);
};

window.selectIcon = function(name) {
  const input = document.getElementById('cm-icon');
  const preview = document.getElementById('cm-icon-preview-glyph');
  if (input) input.value = name;
  if (preview) preview.textContent = name;
};

// Initialize grid when category modal opens — hook into openCatModal
const _origOpenCatModal = window.openCatModal;
window.openCatModal = function(cat = null) {
  if (_origOpenCatModal) _origOpenCatModal(cat);
  // Render grid after modal is open
  setTimeout(() => {
    renderIconGrid(ALL_ICONS);
    const currentIcon = document.getElementById('cm-icon')?.value;
    if (currentIcon) {
      const preview = document.getElementById('cm-icon-preview-glyph');
      if (preview) preview.textContent = currentIcon;
    }
  }, 50);
};
