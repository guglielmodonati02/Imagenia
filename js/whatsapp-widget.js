// js/whatsapp-widget.js — Widget de WhatsApp con captura de leads
import { supabase } from './supabase.js';

let _settings = {};
let _questions = [];
let _currentStep = 0;
let _answers = {};

export async function initWhatsApp(settings) {
  if (settings.whatsapp_active === 'false') return;
  _settings = settings;

  const { data } = await supabase
    .from('whatsapp_questions')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  _questions = data || [];

  injectStyles();
  injectHTML();
  bindEvents();
}

/* ── HTML ─────────────────────────────────────────────────────── */
function injectHTML() {
  const el = document.createElement('div');
  el.id = 'wa-widget';
  el.innerHTML = `
  <!-- Botón flotante -->
  <button class="wa-btn" id="wa-trigger" aria-label="Abrir chat WhatsApp">
    <span class="wa-btn-ring"></span>
    <svg class="wa-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.017 22l4.932-1.396A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.946 7.946 0 01-4.031-1.1l-.29-.172-2.927.829.786-2.858-.19-.295A7.96 7.96 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
    </svg>
    <span class="wa-btn-label">¿Necesitas asesoría?</span>
  </button>

  <!-- Panel -->
  <div class="wa-panel" id="wa-panel" aria-hidden="true">
    <div class="wa-panel-inner">
      <!-- Header -->
      <div class="wa-header">
        <div class="wa-header-left">
          <div class="wa-avatar">
            <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
          </div>
          <div>
            <div class="wa-header-name">IMAGENIA</div>
            <div class="wa-header-status"><span class="wa-dot"></span>En línea · responde en minutos</div>
          </div>
        </div>
        <button class="wa-close" id="wa-close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Progress bar -->
      <div class="wa-progress-wrap">
        <div class="wa-progress-bar" id="wa-progress"></div>
      </div>

      <!-- Body -->
      <div class="wa-body" id="wa-body"></div>

      <!-- Footer -->
      <div class="wa-footer">
        <button class="wa-btn-back" id="wa-back">← Atrás</button>
        <button class="wa-btn-next" id="wa-next">Continuar →</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(el);
}

/* ── Eventos ──────────────────────────────────────────────────── */
function bindEvents() {
  document.getElementById('wa-trigger').addEventListener('click', openPanel);
  document.getElementById('wa-close').addEventListener('click', closePanel);
  document.getElementById('wa-next').addEventListener('click', nextStep);
  document.getElementById('wa-back').addEventListener('click', prevStep);

  document.getElementById('wa-panel').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePanel();
  });
}

function openPanel() {
  _currentStep = 0;
  _answers = {};
  document.getElementById('wa-panel').classList.add('open');
  document.getElementById('wa-trigger').classList.add('hidden');
  document.getElementById('wa-panel').setAttribute('aria-hidden', 'false');
  renderStep();
}

function closePanel() {
  document.getElementById('wa-panel').classList.remove('open');
  document.getElementById('wa-trigger').classList.remove('hidden');
  document.getElementById('wa-panel').setAttribute('aria-hidden', 'true');
}

/* ── Steps ────────────────────────────────────────────────────── */
function renderStep() {
  const total = _questions.length;
  const pct   = total ? Math.round((_currentStep / total) * 100) : 0;
  document.getElementById('wa-progress').style.width = pct + '%';

  const backBtn = document.getElementById('wa-back');
  const nextBtn = document.getElementById('wa-next');
  backBtn.style.display = _currentStep === 0 ? 'none' : '';

  if (_currentStep >= total) {
    renderSummary();
    nextBtn.style.display = 'none';
    backBtn.style.display = '';
    return;
  }

  const q = _questions[_currentStep];
  const stepNum = _currentStep + 1;
  const prevVal = _answers[q.id] || '';

  let inputHTML = '';
  if (q.field_type === 'textarea') {
    inputHTML = `<textarea class="wa-input wa-textarea" id="wa-field" placeholder="${q.placeholder || ''}" autocomplete="off">${prevVal}</textarea>`;
  } else if (q.field_type === 'select' && q.options) {
    const opts = q.options.split(',').map(o => o.trim());
    inputHTML = `<select class="wa-input wa-select" id="wa-field">
      <option value="">Selecciona una opción...</option>
      ${opts.map(o => `<option ${prevVal === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>`;
  } else {
    inputHTML = `<input type="text" class="wa-input" id="wa-field" placeholder="${q.placeholder || ''}" value="${prevVal}" autocomplete="off">`;
  }

  document.getElementById('wa-body').innerHTML = `
    <div class="wa-step">
      <div class="wa-step-counter">${stepNum} de ${total}</div>
      <div class="wa-question">${q.question}${q.is_required ? ' <span class="wa-required">*</span>' : ''}</div>
      ${inputHTML}
      ${q.is_required ? '<p class="wa-hint">* Campo obligatorio</p>' : '<p class="wa-hint">Opcional — puedes saltarlo</p>'}
    </div>`;

  document.getElementById('wa-field')?.focus();
  nextBtn.textContent = _currentStep === total - 1 ? 'Ver resumen →' : 'Continuar →';
}

function nextStep() {
  if (_currentStep < _questions.length) {
    const q     = _questions[_currentStep];
    const field = document.getElementById('wa-field');
    const val   = field?.value?.trim() || '';

    if (q.is_required && !val) {
      field?.classList.add('wa-error');
      field?.addEventListener('input', () => field.classList.remove('wa-error'), { once: true });
      return;
    }
    _answers[q.id] = val;
  }
  _currentStep++;
  renderStep();
}

function prevStep() {
  if (_currentStep > 0) { _currentStep--; renderStep(); }
}

/* ── Summary ──────────────────────────────────────────────────── */
function renderSummary() {
  document.getElementById('wa-progress').style.width = '100%';

  const rows = _questions.map(q => {
    const val = _answers[q.id] || '—';
    return `<div class="wa-summary-row">
      <span class="wa-summary-label">${q.question.replace(/ \*$/, '')}</span>
      <span class="wa-summary-value">${val || '<em>No respondido</em>'}</span>
    </div>`;
  }).join('');

  document.getElementById('wa-body').innerHTML = `
    <div class="wa-step">
      <div class="wa-question" style="margin-bottom:1rem">¡Listo! Revisa tu información:</div>
      <div class="wa-summary">${rows}</div>
    </div>
    <button class="wa-send-btn" id="wa-send">
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      </svg>
      Abrir WhatsApp y enviar
    </button>`;

  document.getElementById('wa-back').style.display = '';
  document.getElementById('wa-send').addEventListener('click', sendToWhatsApp);
}

/* ── Send ─────────────────────────────────────────────────────── */
async function sendToWhatsApp() {
  const btn = document.getElementById('wa-send');
  const originalBtnText = btn.innerHTML;
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    // Build message from template
    const template = _settings.whatsapp_template || 'Hola IMAGENIA! Soy {1}. {2}';
    const vals = _questions.map((q, i) => _answers[q.id] || '—');
    let message = template;

    // Replace named placeholders {nombre}, {proyecto}, etc.
    _questions.forEach((q, i) => {
      const key = `{${i + 1}}`;
      message = message.replaceAll(key, vals[i]);
    });

    // Also try slug-style {nombre} {proyecto} etc from question text
    _questions.forEach((q, i) => {
      const slug = q.question
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      
      // Match {nombre} if question contains "nombre", etc.
      message = message.replaceAll(`{${slug}}`, vals[i]);
      if (slug.includes('nombre')) message = message.replaceAll('{nombre}', vals[i]);
      if (slug.includes('proyecto')) message = message.replaceAll('{proyecto}', vals[i]);
      if (slug.includes('ciudad') || slug.includes('estado')) message = message.replaceAll('{ciudad}', vals[i]);
      if (slug.includes('metro')) message = message.replaceAll('{metros}', vals[i]);
      if (slug.includes('presupuesto')) message = message.replaceAll('{presupuesto}', vals[i]);
    });

    // Get and clean number
    let num = _settings.whatsapp_number || _settings.contact_whatsapp || '5219980000000';
    num = num.replace(/\D/g, ''); // Remove non-digits

    const waURL = `https://api.whatsapp.com/send/?phone=${num}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;

    // Save lead
    const answersPayload = {};
    _questions.forEach(q => { answersPayload[q.question] = _answers[q.id] || ''; });

    await supabase.from('whatsapp_leads').insert({
      answers:          answersPayload,
      whatsapp_message: message,
      phone_sent_to:    num,
    });

    // Render success
    document.getElementById('wa-body').innerHTML = `
      <div class="wa-success">
        <div class="wa-success-icon">✅</div>
        <div class="wa-success-title">¡Todo listo!</div>
        <div class="wa-success-text">Tu WhatsApp se abrirá en unos segundos. Nuestro equipo te responderá a la brevedad.</div>
      </div>`;
    
    if (document.getElementById('wa-back')) document.getElementById('wa-back').style.display = 'none';
    const footer = document.querySelector('.wa-footer');
    if (footer) footer.style.display = 'none';

    // Redirect
    window.open(waURL, '_blank');
    setTimeout(closePanel, 4000);

  } catch (err) {
    console.error('Error sending WhatsApp:', err);
    btn.innerHTML = originalBtnText;
    btn.disabled = false;
    alert('Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.');
  }
}

/* ── Inline styles ────────────────────────────────────────────── */
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
  #wa-widget { position: fixed; z-index: 9999; bottom: 2rem; right: 2rem; }

  /* ── Trigger Button ─────────────────────── */
  .wa-btn {
    display: flex; align-items: center; gap: 0.625rem;
    background: #154212; color: #fff;
    border: none; border-radius: 999px;
    padding: 0.875rem 1.25rem;
    font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 0.875rem;
    cursor: pointer; position: relative;
    box-shadow: 0 8px 32px rgba(21,66,18,0.45);
    transition: transform 0.25s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.25s ease;
  }
  .wa-btn:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(21,66,18,0.55); }
  .wa-btn.hidden { opacity: 0; pointer-events: none; transform: scale(0.8); }
  .wa-icon { width: 22px; height: 22px; fill: #25D366; flex-shrink: 0; }
  .wa-btn-label { letter-spacing: 0.01em; }
  .wa-btn-ring {
    position: absolute; inset: -6px; border-radius: 999px;
    border: 2px solid rgba(21,66,18,0.3);
    animation: wa-pulse 2s ease-out infinite;
    pointer-events: none;
  }
  @keyframes wa-pulse {
    0%   { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.4); opacity: 0; }
  }
  @media (max-width: 600px) { .wa-btn-label { display: none; } .wa-btn { padding: 1rem; border-radius: 50%; } }

  /* ── Panel ─────────────────────────────── */
  .wa-panel {
    position: fixed; inset: 0; z-index: 9998;
    display: flex; align-items: flex-end; justify-content: flex-end;
    padding: 0 1rem 7rem;
    pointer-events: none; opacity: 0;
    transition: opacity 0.3s ease;
  }
  .wa-panel.open { pointer-events: all; opacity: 1; }
  .wa-panel-inner {
    width: 100%; max-width: 400px;
    background: #fff; border-radius: 1.25rem;
    box-shadow: 0 32px 80px rgba(21,66,18,0.2), 0 0 0 1px rgba(21,66,18,0.06);
    transform: translateY(24px) scale(0.97);
    transition: transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275);
    overflow: hidden; display: flex; flex-direction: column;
  }
  .wa-panel.open .wa-panel-inner { transform: translateY(0) scale(1); }
  @media (max-width: 600px) { .wa-panel { padding: 0; align-items: flex-end; } .wa-panel-inner { max-width: 100%; border-radius: 1.25rem 1.25rem 0 0; } }

  /* ── Header ────────────────────────────── */
  .wa-header {
    background: #154212; color: #fff;
    padding: 1.25rem 1.25rem 1rem;
    display: flex; align-items: center; justify-content: space-between;
  }
  .wa-header-left { display: flex; align-items: center; gap: 0.75rem; }
  .wa-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: #25D366; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .wa-header-name { font-family: 'Manrope',sans-serif; font-weight: 800; font-size: 1rem; }
  .wa-header-status { font-size: 0.75rem; opacity: 0.75; display: flex; align-items: center; gap: 0.375rem; margin-top: 0.125rem; }
  .wa-dot { width: 8px; height: 8px; border-radius: 50%; background: #25D366; display: inline-block; }
  .wa-close {
    background: rgba(255,255,255,0.12); border: none; color: #fff;
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.2s;
  }
  .wa-close:hover { background: rgba(255,255,255,0.25); }

  /* ── Progress ──────────────────────────── */
  .wa-progress-wrap { height: 3px; background: #eae8e7; }
  .wa-progress-bar { height: 100%; background: #25D366; transition: width 0.4s ease; }

  /* ── Body ──────────────────────────────── */
  .wa-body { padding: 1.5rem; flex: 1; overflow-y: auto; }
  .wa-step-counter { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #42493e; margin-bottom: 0.75rem; }
  .wa-question { font-family: 'Manrope',sans-serif; font-weight: 700; font-size: 1rem; color: #154212; line-height: 1.4; margin-bottom: 1rem; }
  .wa-required { color: #006e1c; }
  .wa-hint { font-size: 0.75rem; color: #72796e; margin-top: 0.5rem; }
  .wa-input {
    width: 100%; padding: 0.75rem 1rem;
    border: 1.5px solid #c2c9bb; border-radius: 0.5rem;
    font-family: 'Inter',sans-serif; font-size: 0.9375rem;
    background: #fff; color: #1b1c1c;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .wa-input:focus { border-color: #154212; box-shadow: 0 0 0 3px rgba(21,66,18,0.1); }
  .wa-input.wa-error { border-color: #ba1a1a; animation: wa-shake 0.35s ease; }
  .wa-textarea { resize: vertical; min-height: 90px; }
  .wa-select { appearance: none; cursor: pointer; }
  @keyframes wa-shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }

  /* ── Summary ──────────────────────────── */
  .wa-summary { display: flex; flex-direction: column; gap: 0.625rem; }
  .wa-summary-row {
    padding: 0.75rem; background: #f6f3f2; border-radius: 0.5rem;
    display: flex; flex-direction: column; gap: 0.25rem;
  }
  .wa-summary-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #72796e; }
  .wa-summary-value { font-size: 0.9rem; color: #154212; font-weight: 600; }

  /* ── Send Button ──────────────────────── */
  .wa-send-btn {
    width: 100%; margin-top: 1.25rem; padding: 0.875rem;
    background: #25D366; color: #fff; border: none; border-radius: 0.625rem;
    font-family: 'Manrope',sans-serif; font-weight: 800; font-size: 0.9375rem;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    cursor: pointer; transition: all 0.2s ease;
  }
  .wa-send-btn:hover { background: #128C7E; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,211,102,0.4); }
  .wa-send-btn:disabled { opacity: 0.6; pointer-events: none; }

  /* ── Footer ───────────────────────────── */
  .wa-footer {
    padding: 1rem 1.5rem; border-top: 1px solid #f0eded;
    display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
  }
  .wa-btn-back {
    font-family: 'Inter',sans-serif; font-size: 0.8rem; font-weight: 600;
    color: #42493e; background: none; border: none; cursor: pointer;
    padding: 0.5rem; border-radius: 0.375rem;
    transition: color 0.2s;
  }
  .wa-btn-back:hover { color: #154212; }
  .wa-btn-next {
    margin-left: auto;
    background: #154212; color: #fff; border: none;
    padding: 0.625rem 1.25rem; border-radius: 999px;
    font-family: 'Manrope',sans-serif; font-weight: 700; font-size: 0.875rem;
    cursor: pointer; transition: all 0.2s ease;
  }
  .wa-btn-next:hover { background: #2D5A27; transform: translateY(-1px); }

  /* ── Success ──────────────────────────── */
  .wa-success { text-align: center; padding: 2rem 1rem; }
  .wa-success-icon { font-size: 3rem; margin-bottom: 1rem; }
  .wa-success-title { font-family: 'Manrope',sans-serif; font-weight: 800; font-size: 1.25rem; color: #154212; margin-bottom: 0.75rem; }
  .wa-success-text { font-size: 0.875rem; color: #42493e; line-height: 1.65; }
  `;
  document.head.appendChild(style);
}
