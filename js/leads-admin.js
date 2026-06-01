// js/leads-admin.js
import { requireLeadsAuth, signOut, supabase } from '/js/supabase.js';
import { showToast } from '/js/components.js';
let allContacts = [];
let allWALeads = [];
let allQuotes = [];

async function init() {
  await requireLeadsAuth();
  await loadDashboard();
  initSearch();
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
    quotes: loadQuotes,
    'wa-leads': loadWALeads
  };
  if (loaders[name]) loaders[name]();
};

window.doSignOut = () => signOut();

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  const [contactsCount, quotesCount, waLeadsCount] = await Promise.all([
    supabase.from('contact_submissions').select('id', { count: 'exact', head: true }),
    supabase.from('quote_submissions').select('id', { count: 'exact', head: true }),
    supabase.from('whatsapp_leads').select('id', { count: 'exact', head: true })
  ]);

  document.getElementById('stat-contacts').textContent = contactsCount.count ?? 0;
  document.getElementById('stat-quotes').textContent = quotesCount.count ?? 0;
  document.getElementById('stat-wa-leads').textContent = waLeadsCount.count ?? 0;

  const [recentContacts, recentQuotes, recentWALeads] = await Promise.all([
    supabase.from('contact_submissions').select('*').order('submitted_at', { ascending: false }).limit(5),
    supabase.from('quote_submissions').select('*').order('submitted_at', { ascending: false }).limit(5),
    supabase.from('whatsapp_leads').select('*').order('created_at', { ascending: false }).limit(5)
  ]);

  const recentItems = [];
  
  (recentContacts.data || []).forEach(c => {
    recentItems.push({
      type: 'Contacto',
      badgeClass: 'badge-grey',
      title: c.nombre,
      detail: c.email + (c.empresa ? ` (${c.empresa})` : ''),
      date: new Date(c.submitted_at)
    });
  });
  (recentQuotes.data || []).forEach(q => {
    recentItems.push({
      type: 'Cotización',
      badgeClass: 'badge-green',
      title: q.nombre,
      detail: q.email + (q.tipo_proyecto ? ` (${q.tipo_proyecto})` : ''),
      date: new Date(q.submitted_at)
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
      date: new Date(l.created_at)
    });
  });

  recentItems.sort((a, b) => b.date - a.date);

  const finalRecent = recentItems.slice(0, 5);

  document.getElementById('dash-recent-table').innerHTML = finalRecent.map(r => `
    <tr>
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

function renderContacts(list) {
  document.getElementById('contacts-table').innerHTML = list.map(r => `
    <tr id="row-contact-${r.id}">
      <td><strong>${r.nombre}</strong></td>
      <td>${r.empresa || '—'}</td>
      <td><a href="mailto:${r.email}">${r.email}</a></td>
      <td>${r.telefono ? `<a href="tel:${r.telefono}">${r.telefono}</a>` : '—'}</td>
      <td style="max-width:300px;white-space:pre-wrap;font-size:0.8rem;color:var(--on-surface-variant)">${r.comentarios || '—'}</td>
      <td style="white-space:nowrap;font-size:0.8rem">${fmt(r.submitted_at)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon-sm btn-del" onclick="deleteContact('${r.id}')">
            <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin mensajes de contacto.</td></tr>';
}

window.deleteContact = async function(id) {
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


// ── Cotizaciones ─────────────────────────────────────────────
async function loadQuotes() {
  const { data, error } = await supabase.from('quote_submissions').select('*').order('submitted_at', { ascending: false });
  if (error) {
    showToast('Error al cargar cotizaciones', 'error');
    return;
  }
  allQuotes = data || [];
  renderQuotes(allQuotes);
}

function renderQuotes(list) {
  document.getElementById('quotes-table').innerHTML = list.map(r => `
    <tr id="row-quote-${r.id}">
      <td><strong>${r.nombre}</strong></td>
      <td><a href="mailto:${r.email}">${r.email}</a></td>
      <td>${r.tipo_proyecto || '—'}</td>
      <td style="white-space:nowrap;font-size:0.8rem">${fmt(r.submitted_at)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon-sm btn-del" onclick="deleteQuote('${r.id}')">
            <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin cotizaciones.</td></tr>';
}

window.deleteQuote = async function(id) {
  if (!confirm('¿Eliminar esta cotización?')) return;
  const { error } = await supabase.from('quote_submissions').delete().eq('id', id);
  if (error) {
    showToast('Error al eliminar', 'error');
  } else {
    showToast('Cotización eliminada');
    allQuotes = allQuotes.filter(c => c.id !== id);
    renderQuotes(allQuotes);
    loadDashboard();
  }
};

window.exportQuotes = function() {
  const query = document.getElementById('search-quotes')?.value.toLowerCase().trim() || '';
  const list = query ? allQuotes.filter(c => 
    (c.nombre || '').toLowerCase().includes(query) ||
    (c.email || '').toLowerCase().includes(query) ||
    (c.tipo_proyecto || '').toLowerCase().includes(query)
  ) : allQuotes;

  if (!list.length) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  const headers = ['Nombre', 'Email', 'Tipo de Proyecto', 'Fecha'];
  const csvRows = [headers.join(',')];

  list.forEach(r => {
    const row = [
      `"${(r.nombre || '').replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${(r.tipo_proyecto || '').replace(/"/g, '""')}"`,
      `"${fmt(r.submitted_at)}"`
    ];
    csvRows.push(row.join(','));
  });

  downloadCSV('cotizaciones.csv', csvRows.join('\n'));
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
    return `
      <tr id="row-wa-${l.id}">
        <td style="white-space:nowrap;font-size:0.8rem">${fmt(l.created_at)}</td>
        <td style="font-size:0.8rem;max-width:350px">${answers || '—'}</td>
        <td style="font-size:0.8rem;max-width:350px;color:var(--on-surface-variant);white-space:pre-wrap;">${l.whatsapp_message || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon-sm btn-del" onclick="deleteLead('${l.id}')">
              <span class="material-symbols-outlined" style="font-size:1rem">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--on-surface-variant)">Sin leads de WhatsApp capturados.</td></tr>';
}

window.deleteLead = async function(id) {
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



  document.getElementById('search-quotes')?.addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allQuotes.filter(c => 
      (c.nombre || '').toLowerCase().includes(query) ||
      (c.email || '').toLowerCase().includes(query) ||
      (c.tipo_proyecto || '').toLowerCase().includes(query)
    );
    renderQuotes(filtered);
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
