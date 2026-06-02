// js/leads-admin.js
import { requireLeadsAuth, signOut, supabase, getUserRole } from '/js/supabase.js';
import { showToast } from '/js/components.js';

let userRole = null;
let allContacts = [];
let allWALeads = [];

const newItems = new Set(JSON.parse(localStorage.getItem('unread_leads_messages') || '[]'));
const activeNotifications = new Map();

async function init() {
  const user = await requireLeadsAuth();
  if (user) {
    userRole = await getUserRole(user.email);
  }
  await loadDashboard();
  initSearch();
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
    if (secName === 'contacts') loadContacts();
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
  supabase.channel('public-db-leads-admin')
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

  const loaders = {
    dashboard: loadDashboard,
    contacts: loadContacts,
    'wa-leads': loadWALeads
  };
  if (loaders[name]) loaders[name]();
};

window.doSignOut = () => signOut();

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  const [contactsCount, waLeadsCount] = await Promise.all([
    supabase.from('contact_submissions').select('id', { count: 'exact', head: true }),
    supabase.from('whatsapp_leads').select('id', { count: 'exact', head: true })
  ]);

  document.getElementById('stat-contacts').textContent = contactsCount.count ?? 0;
  document.getElementById('stat-wa-leads').textContent = waLeadsCount.count ?? 0;

  const [recentContacts, recentWALeads] = await Promise.all([
    supabase.from('contact_submissions').select('*').order('submitted_at', { ascending: false }).limit(5),
    supabase.from('whatsapp_leads').select('*').order('created_at', { ascending: false }).limit(5)
  ]);

  const recentItems = [];
  
  (recentContacts.data || []).forEach(c => {
    recentItems.push({
      type: 'Contacto',
      badgeClass: 'badge-grey',
      title: c.nombre,
      detail: c.email + (c.empresa ? ` (${c.empresa})` : ''),
      date: new Date(c.submitted_at),
      section: 'contacts'
    });
  });

  (recentWALeads.data || []).forEach(l => {
    const answers = l.answers || {};
    let name = 'Lead de WhatsApp';
    for (const [k, v] of Object.entries(answers)) {
      if (k.toLowerCase().includes('nombre') && v) {
        name = v;
        break;
      }
    }
    recentItems.push({
      type: 'WhatsApp',
      badgeClass: 'badge-red',
      title: name,
      detail: (l.whatsapp_message || '').slice(0, 80) + '...',
      date: new Date(l.created_at),
      section: 'wa-leads'
    });
  });

  recentItems.sort((a, b) => b.date - a.date);

  const finalRecent = recentItems.slice(0, 5);

  document.getElementById('dash-recent-table').innerHTML = finalRecent.map(r => `
    <tr onclick="goToSection('${r.section}')" style="cursor:pointer">
      <td><span class="badge ${r.badgeClass}">${r.type}</span></td>
      <td><strong>${r.title}</strong></td>
      <td style="font-size:0.8rem;color:var(--on-surface-variant)">${r.detail}</td>
      <td style="white-space:nowrap;font-size:0.8rem">${fmt(r.date)}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin actividad reciente.</td></tr>';
}

// ── Contact Messages ─────────────────────────────────────────
async function loadContacts() {
  const { data, error } = await supabase.from('contact_submissions').select('*').order('submitted_at', { ascending: false });
  if (error) {
    showToast('Error al cargar mensajes', 'error');
    return;
  }
  allContacts = data || [];
  renderContacts(allContacts);
}

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

window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');

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

function renderContacts(list) {
  document.getElementById('contacts-table').innerHTML = list.map(r => {
    const isUnread = newItems.has(r.id);
    const deleteCell = (userRole === 'admin') ? `
      <td>
        <div class="action-btns">
          <button class="btn-icon-sm btn-del" onclick="event.stopPropagation(); deleteContact('${r.id}')">
            <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
          </button>
        </div>
      </td>
    ` : '<td></td>';
    
    let comments = r.comentarios || '';
    let cleanSubject = 'nuestros servicios';
    if (comments.startsWith('Producto: ')) {
      cleanSubject = comments.split('\n')[0].replace('Producto: ', '');
    }
    
    const waDate = getWhatsAppDate(r.submitted_at);
    const waLink = getWhatsAppLink(r.telefono, r.nombre, waDate, cleanSubject);
    
    return `
      <tr id="row-contact-${r.id}" class="${isUnread ? 'unread-item' : ''}" onclick="showContactDetail('${r.id}')" style="cursor:pointer">
        <td><strong>${r.nombre}</strong></td>
        <td>${r.empresa || '—'}</td>
        <td><a href="mailto:${r.email}" onclick="event.stopPropagation()">${r.email}</a></td>
        <td>${r.telefono ? `<a href="${waLink}" target="_blank" onclick="event.stopPropagation()">${r.telefono}</a>` : '—'}</td>
        <td style="max-width:300px;white-space:pre-wrap;font-size:0.8rem;color:var(--on-surface-variant)">${r.comentarios || '—'}</td>
        <td style="white-space:nowrap;font-size:0.8rem">${fmt(r.submitted_at)}</td>
        ${deleteCell}
      </tr>
    `;
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin mensajes de contacto.</td></tr>';
}

window.deleteContact = async function(id) {
  if (userRole !== 'admin') {
    showToast('No tienes permisos para realizar esta acción', 'error');
    return;
  }
  if (!confirm('¿Eliminar este mensaje de contacto?')) return;
  const { error } = await supabase.from('contact_submissions').delete().eq('id', id);
  if (error) {
    showToast('Error al eliminar mensaje', 'error');
  } else {
    showToast('Mensaje eliminado');
    allContacts = allContacts.filter(c => c.id !== id);
    renderContacts(allContacts);
    loadDashboard();
  }
};

window.exportContacts = function() {
  const query = document.getElementById('search-contacts')?.value.toLowerCase().trim() || '';
  const list = query ? allContacts.filter(c => 
    (c.nombre || '').toLowerCase().includes(query) ||
    (c.empresa || '').toLowerCase().includes(query) ||
    (c.email || '').toLowerCase().includes(query) ||
    (c.telefono || '').toLowerCase().includes(query) ||
    (c.comentarios || '').toLowerCase().includes(query)
  ) : allContacts;

  if (!list.length) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  const headers = ['Nombre', 'Empresa', 'Email', 'Teléfono', 'Comentarios', 'Fecha'];
  const csvRows = [headers.join(',')];

  list.forEach(r => {
    const row = [
      `"${(r.nombre || '').replace(/"/g, '""')}"`,
      `"${(r.empresa || '').replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${(r.telefono || '').replace(/"/g, '""')}"`,
      `"${(r.comentarios || '').replace(/\r?\n|\r/g, ' ').replace(/"/g, '""')}"`,
      `"${fmt(r.submitted_at)}"`
    ];
    csvRows.push(row.join(','));
  });

  downloadCSV('mensajes_contacto.csv', csvRows.join('\n'));
};



// ── WhatsApp Leads ───────────────────────────────────────────
async function loadWALeads() {
  const { data, error } = await supabase.from('whatsapp_leads').select('*').order('created_at', { ascending: false });
  if (error) {
    showToast('Error al cargar leads de WhatsApp', 'error');
    return;
  }
  allWALeads = data || [];
  renderWALeads(allWALeads);
}

function renderWALeads(list) {
  document.getElementById('wa-leads-table').innerHTML = list.map(l => {
    const answers = Object.entries(l.answers || {}).map(([k, v]) => `<div><strong>${k}:</strong> ${v || '—'}</div>`).join('');
    const isUnread = newItems.has(l.id);
    const deleteCell = (userRole === 'admin') ? `
      <td>
        <div class="action-btns">
          <button class="btn-icon-sm btn-del" onclick="event.stopPropagation(); deleteLead('${l.id}')">
            <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
          </button>
        </div>
      </td>
    ` : '<td></td>';
    return `
      <tr id="row-wa-${l.id}" class="${isUnread ? 'unread-item' : ''}" onclick="deactivateItem('${l.id}')">
        <td style="white-space:nowrap;font-size:0.8rem">${fmt(l.created_at)}</td>
        <td style="font-size:0.8rem;max-width:350px">${answers || '—'}</td>
        <td style="font-size:0.8rem;max-width:350px;color:var(--on-surface-variant);white-space:pre-wrap;">${l.whatsapp_message || '—'}</td>
        ${deleteCell}
      </tr>
    `;
  }).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin leads de WhatsApp capturados.</td></tr>';
}

window.deleteLead = async function(id) {
  if (userRole !== 'admin') {
    showToast('No tienes permisos para realizar esta acción', 'error');
    return;
  }
  if (!confirm('¿Eliminar este lead de WhatsApp?')) return;
  const { error } = await supabase.from('whatsapp_leads').delete().eq('id', id);
  if (error) {
    showToast('Error al eliminar lead', 'error');
  } else {
    showToast('Lead de WhatsApp eliminado');
    allWALeads = allWALeads.filter(l => l.id !== id);
    renderWALeads(allWALeads);
    loadDashboard();
  }
};

window.exportWALeads = function() {
  const query = document.getElementById('search-wa-leads')?.value.toLowerCase().trim() || '';
  const list = query ? allWALeads.filter(l => {
    const answersStr = Object.entries(l.answers || {}).map(([k, v]) => `${k}:${v}`).join(' ').toLowerCase();
    const msgStr = (l.whatsapp_message || '').toLowerCase();
    return answersStr.includes(query) || msgStr.includes(query);
  }) : allWALeads;

  if (!list.length) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  const allKeys = [...new Set(list.flatMap(r => Object.keys(r.answers || {})))];
  const headers = ['Fecha', ...allKeys, 'Mensaje Enviado'];
  const csvRows = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',')];

  list.forEach(r => {
    const row = [
      `"${fmt(r.created_at)}"`,
      ...allKeys.map(k => `"${(r.answers?.[k] || '').replace(/"/g, '""')}"`),
      `"${(r.whatsapp_message || '').replace(/\r?\n|\r/g, ' ').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  downloadCSV('leads_whatsapp.csv', csvRows.join('\n'));
};

// ── Search & Filter Initialization ────────────────────────────
function initSearch() {
  document.getElementById('search-contacts')?.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allContacts.filter(c => 
      (c.nombre || '').toLowerCase().includes(query) ||
      (c.empresa || '').toLowerCase().includes(query) ||
      (c.email || '').toLowerCase().includes(query) ||
      (c.telefono || '').toLowerCase().includes(query) ||
      (c.comentarios || '').toLowerCase().includes(query)
    );
    renderContacts(filtered);
  });




  document.getElementById('search-wa-leads')?.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allWALeads.filter(l => {
      const answersStr = Object.entries(l.answers || {}).map(([k, v]) => `${k}:${v}`).join(' ').toLowerCase();
      const msgStr = (l.whatsapp_message || '').toLowerCase();
      return answersStr.includes(query) || msgStr.includes(query);
    });
    renderWALeads(filtered);
  });
}

// ── Helper Utilities ──────────────────────────────────────────
function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

init();
