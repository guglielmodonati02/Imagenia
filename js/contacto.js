// js/contacto.js
import { initPage, showToast } from './components.js';
import { getSettings, supabase } from './supabase.js';

async function init() {
  const settings = await initPage('Contacto');

  // Fill contact info
  const email = settings.contact_email || '';
  const phone = settings.contact_phone || '';
  const wa = settings.contact_whatsapp || '';
  const igHandle = settings.instagram_handle || '';
  const igUrl = settings.instagram_url || '#';
  const headerImg = settings.contact_header_image || '';

  const headerEl = document.getElementById('contact-header');
  if (headerEl && headerImg) {
    headerEl.style.backgroundImage = `url(${headerImg})`;
    headerEl.classList.add('has-image');
  }

  const emailEl = document.getElementById('info-email');
  if (emailEl) { emailEl.textContent = email || '—'; emailEl.href = `mailto:${email}`; }
  const phoneEl = document.getElementById('info-phone');
  if (phoneEl) { phoneEl.textContent = phone || '—'; phoneEl.href = `tel:${phone.replace(/\s/g,'')}`; }

  const socialIconsHTML = ['instagram', 'facebook', 'linkedin', 'pinterest', 'youtube']
    .map(s => {
      const url = settings[`social_${s}`];
      const icon = settings[`social_${s}_icon`];
      if (url && icon) {
        return `<a href="${url}" target="_blank" class="footer-social-icon"><img src="${icon}" alt="${s}"></a>`;
      }
      return '';
    }).join('');

  const socialEl = document.getElementById('info-social');
  if (socialEl) {
    socialEl.innerHTML = socialIconsHTML || '—';
  }

  // Pre-fill product from URL param
  const params = new URLSearchParams(window.location.search);
  if (params.get('producto')) {
    document.getElementById('f-producto').value = decodeURIComponent(params.get('producto'));
  }

  // Scroll to form if #cotizacion in hash
  if (window.location.hash === '#cotizacion') {
    setTimeout(() => document.getElementById('cotizacion')?.scrollIntoView({ behavior: 'smooth' }), 500);
  }

  document.getElementById('contact-form').addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('contact-btn');
  btn.textContent = 'Enviando...'; btn.disabled = true;

  const { error } = await supabase.from('contact_submissions').insert({
    nombre:      document.getElementById('f-nombre').value,
    empresa:     document.getElementById('f-empresa').value,
    email:       document.getElementById('f-email').value,
    telefono:    document.getElementById('f-tel').value,
    comentarios: `${document.getElementById('f-producto').value ? 'Producto: ' + document.getElementById('f-producto').value + '\n' : ''}${document.getElementById('f-comentarios').value}`,
  });

  btn.textContent = 'Enviar mensaje'; btn.disabled = false;

  if (error) { showToast('Error al enviar. Por favor intenta de nuevo.', 'error'); return; }

  showToast('¡Mensaje enviado! Te contactaremos pronto.');
  e.target.reset();
}

init();
