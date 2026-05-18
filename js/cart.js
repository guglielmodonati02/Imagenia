// js/cart.js

export const Cart = {
  items: [],
  
  init() {
    const saved = sessionStorage.getItem('quoteCart');
    if (saved) {
      try { this.items = JSON.parse(saved); } catch(e){}
    }
    this.injectModalHtml();
    this.updateBadge();
    
    // Attach to window so onclick works directly
    window.Cart = this;
  },
  
  save() {
    sessionStorage.setItem('quoteCart', JSON.stringify(this.items));
    this.updateBadge();
    this.renderModalContent();
  },
  
  add(name, sku) {
    if (!sku) sku = 'GENERIC-' + Math.floor(Math.random()*1000);
    const existing = this.items.find(i => i.sku === sku);
    if (existing) {
      existing.qty++;
    } else {
      this.items.push({ name, sku, qty: 1 });
    }
    this.save();
    this.showToast('Producto agregado al carrito de cotización');
  },
  
  update(sku, delta) {
    const item = this.items.find(i => i.sku === sku);
    if (item) {
      item.qty += delta;
      if (item.qty <= 0) {
        this.items = this.items.filter(i => i.sku !== sku);
      }
      this.save();
    }
  },
  
  remove(sku) {
    this.items = this.items.filter(i => i.sku !== sku);
    this.save();
  },
  
  updateBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
      const total = this.items.reduce((sum, item) => sum + item.qty, 0);
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
  },
  
  openModal() {
    this.renderModalContent();
    const modal = document.getElementById('cart-modal-overlay');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  },
  
  closeModal() {
    const modal = document.getElementById('cart-modal-overlay');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },
  
  injectModalHtml() {
    if (document.getElementById('cart-modal-overlay')) return;
    const html = `
      <div id="cart-modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:99999; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(5px);">
        <div style="background:var(--surface, #121212); width:100%; max-width:500px; max-height:85vh; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--outline-variant); box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          <div style="padding:1.5rem; border-bottom:1px solid var(--outline-variant); display:flex; justify-content:space-between; align-items:center; background:var(--surface-container-low);">
            <h3 style="margin:0; font-size:1.25rem; font-family:'Manrope', sans-serif; color:var(--primary); display:flex; align-items:center; gap:0.5rem;">
              <span class="material-symbols-outlined">shopping_cart</span> Cotización
            </h3>
            <button onclick="Cart.closeModal()" style="background:none; border:none; color:var(--on-surface); cursor:pointer; padding:0.5rem; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:background 0.3s;" onmouseover="this.style.background='var(--surface-container-high)'" onmouseout="this.style.background='none'">
              <span class="material-symbols-outlined" style="font-size:1.5rem;">close</span>
            </button>
          </div>
          <div id="cart-modal-content" style="padding:1.5rem; overflow-y:auto; color:var(--on-surface-variant); line-height:1.6; flex:1;">
          </div>
          <div id="cart-modal-footer" style="padding:1.5rem; border-top:1px solid var(--outline-variant); background:var(--surface-container-low);">
            <button class="btn btn-primary btn-full" onclick="Cart.send()" style="display:flex; justify-content:center; align-items:center; gap:0.5rem;">
              <span class="material-symbols-outlined">send</span> Solicitar Cotización por WhatsApp
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  },
  
  renderModalContent() {
    const content = document.getElementById('cart-modal-content');
    const footer = document.getElementById('cart-modal-footer');
    if (!content) return;
    
    if (this.items.length === 0) {
      content.innerHTML = `<div style="text-align:center; padding:3rem 1rem; color:var(--on-surface-variant);"><span class="material-symbols-outlined" style="font-size:3rem; opacity:0.5; margin-bottom:1rem; display:block;">production_quantity_limits</span>Tu lista de cotización está vacía.</div>`;
      if (footer) footer.style.display = 'none';
      return;
    }
    
    if (footer) footer.style.display = 'block';
    content.innerHTML = this.items.map(item => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem 0; border-bottom:1px solid var(--outline-variant);">
        <div style="flex:1; padding-right:1rem;">
          <div style="font-weight:600; color:var(--on-surface); margin-bottom:0.25rem;">${item.name}</div>
          <div style="font-size:0.75rem; color:var(--on-surface-variant);">SKU: ${item.sku}</div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; background:var(--surface-container-high); border-radius:20px; padding:0.25rem;">
          <button onclick="Cart.update('${item.sku}', -1)" style="width:28px; height:28px; border-radius:50%; border:none; background:none; color:var(--on-surface); cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">-</button>
          <span style="font-size:0.9rem; font-weight:600; width:20px; text-align:center; color:var(--on-surface);">${item.qty}</span>
          <button onclick="Cart.update('${item.sku}', 1)" style="width:28px; height:28px; border-radius:50%; border:none; background:none; color:var(--on-surface); cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">+</button>
        </div>
        <button onclick="Cart.remove('${item.sku}')" style="background:none; border:none; color:var(--error); cursor:pointer; padding:0.5rem; margin-left:0.5rem; display:flex; align-items:center; justify-content:center; opacity:0.8; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
          <span class="material-symbols-outlined" style="font-size:1.25rem;">delete</span>
        </button>
      </div>
    `).join('');
  },
  
  send() {
    if (this.items.length === 0) return;
    
    let msg = "Hola, me interesa cotizar los siguientes productos:\n\n";
    this.items.forEach(item => {
      msg += `- ${item.qty} x ${item.name} (SKU: ${item.sku})\n`;
    });
    
    let num = '529842112951'; 
    if (window.siteSettings && window.siteSettings.whatsapp_number) {
      num = window.siteSettings.whatsapp_number.replace(/\\D/g, '');
      if(!num) num = '529842112951';
    }
    
    const waURL = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    window.open(waURL, '_blank');
  },
  
  showToast(msg) {
    if (window.showToast) {
      window.showToast(msg);
    } else {
      alert(msg);
    }
  }
};
