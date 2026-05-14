// js/counter.js — Animated plastic counter (shared module)
// Usage: import { renderCounter, initCounter } from './counter.js';
//        renderCounter(containerId, settings)  → injects HTML
//        initCounter()                          → starts IntersectionObserver

/**
 * Injects the counter HTML into an element.
 * @param {string} containerId  - ID of the placeholder element
 * @param {Object} s            - site_settings object
 */
export function renderCounter(containerId, s) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const isActive = s.counter_is_active !== 'false';
  if (!isActive) { el.style.display = 'none'; return; }

  const rawValue = s.counter_value || '1563';
  const label = s.counter_label || 'Toneladas de Plástico Recuperado';
  const sublabel = s.counter_sublabel || '';
  const prefix = s.counter_prefix || '';
  const suffix = s.counter_suffix || '';
  const bgColor = s.counter_bg_color || '#f6f3f2';

  el.style.backgroundColor = bgColor;

  el.innerHTML = `
  <div class="counter-inner">
    <div class="counter-number-wrap">
      ${prefix ? `<span class="counter-prefix">${prefix}</span>` : ''}
      <span class="counter-num" data-target="${rawValue.replace(/[^\d]/g, '')}" data-raw="${rawValue}">0</span>
      ${suffix ? `<span class="counter-suffix">${suffix}</span>` : ''}
    </div>
    <div class="counter-label">${label}</div>
    ${sublabel ? `<div class="counter-sublabel">${sublabel}</div>` : ''}
  </div>`;
}

/**
 * Sets up IntersectionObserver on all .counter-section elements.
 * Triggers the count-up animation when the section enters the viewport.
 */
export function initCounter() {
  const sections = document.querySelectorAll('.counter-section');
  if (!sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const numEl = entry.target.querySelector('.counter-num');
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        if (numEl) animateCount(numEl);
      } else {
        entry.target.classList.remove('in-view');
        if (numEl) {
          numEl.textContent = '0';
          if (numEl._animationId) cancelAnimationFrame(numEl._animationId);
        }
      }
    });
  }, { threshold: 0.2 });

  sections.forEach(sec => observer.observe(sec));
}

/**
 * Eases a number from 0 to target over ~2s.
 */
function animateCount(el) {
  if (el._animationId) cancelAnimationFrame(el._animationId);

  const target = parseInt(el.dataset.target, 10);
  const rawVal = el.dataset.raw;
  const hasComma = rawVal.includes(',');
  const duration = 2000;
  const start = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.round(easeOut(progress) * target);
    
    el.textContent = hasComma ? current.toLocaleString('es-MX') : current;

    if (progress < 1) {
      el._animationId = requestAnimationFrame(step);
    } else {
      el.textContent = hasComma ? target.toLocaleString('es-MX') : target;
      delete el._animationId;
    }
  }

  el._animationId = requestAnimationFrame(step);
}
