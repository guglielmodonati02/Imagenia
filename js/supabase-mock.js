// js/supabase-mock.js — Mock Supabase Client for local testing & screenshot generation

// Mock Data Store
const mockData = {
  products: [
    { id: 1, name: 'Silla Acapulco Verde', category_slug: 'exterior', is_featured: true, is_bestseller: false, is_new: true, image_url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400', tags: [{ tag_id: 101, name: 'Verde' }], sort_order: 1, is_active: true, sku: 'SL-001', slug: 'silla-acapulco-verde', description: 'Una silla clásica hecha con plástico reciclado' },
    { id: 2, name: 'Mesa de Centro Nopal', category_slug: 'exterior', is_featured: true, is_bestseller: true, is_new: false, image_url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=400', tags: [{ tag_id: 102, name: 'Gris' }], sort_order: 2, is_active: true, sku: 'MS-002', slug: 'mesa-nopal', description: 'Mesa resistente a exteriores' },
    { id: 3, name: 'Maceta Cónica Grande', category_slug: 'macetas', is_featured: false, is_bestseller: false, is_new: true, image_url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400', tags: [{ tag_id: 101, name: 'Verde' }], sort_order: 3, is_active: true, sku: 'MC-003', slug: 'maceta-conica', description: 'Maceta ecológica de plástico biodegradable' }
  ],
  categories: [
    { id: 10, name: 'Exterior', slug: 'exterior', icon_glyph: 'deck', sort_order: 1, is_active: true, image_url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=200' },
    { id: 11, name: 'Macetas', slug: 'macetas', icon_glyph: 'local_florist', sort_order: 2, is_active: true, image_url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=200' },
    { id: 12, name: 'Accesorios', slug: 'accesorios', icon_glyph: 'eco', sort_order: 3, is_active: true, image_url: '' }
  ],
  tag_groups: [
    { id: 1, name: 'Colores', slug: 'colores', sort_order: 1, is_active: true },
    { id: 2, name: 'Materiales', slug: 'materiales', sort_order: 2, is_active: true }
  ],
  tags: [
    { id: 101, group_id: 1, name: 'Verde', slug: 'verde', sort_order: 1, is_active: true },
    { id: 102, group_id: 1, name: 'Gris', slug: 'gris', sort_order: 2, is_active: true },
    { id: 201, group_id: 2, name: 'Polietileno', slug: 'polietileno', sort_order: 1, is_active: true }
  ],
  catalogs: [
    { id: 1, title: 'Catálogo de Muebles 2025', subtitle: 'Línea de exterior ecológica', category_slug: 'exterior', year: 2025, pdf_url: '#', cover_image_url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400', sort_order: 1, is_active: true }
  ],
  contact_submissions: [
    { id: 1, nombre: 'Juan Pérez', empresa: 'EcoDiseño S.A.', email: 'juan@ecodiseno.com', telefono: '555-0199', comentarios: 'Me interesa cotizar 20 sillas Acapulco para un proyecto corporativo.', submitted_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 2, nombre: 'Ana Gómez', empresa: 'Jardines CDMX', email: 'ana.gomez@gmail.com', telefono: '555-0244', comentarios: '¿Hacen envíos a Guadalajara de las macetas cónicas?', submitted_at: new Date(Date.now() - 7200000).toISOString() }
  ],
  blogs: [
    { id: 1, title: 'El Futuro del Plástico Reciclado', summary: 'Cómo transformamos residuos en piezas de diseño duraderas para exteriores.', content: 'Texto completo de la noticia...', image_url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400', is_active: true, sort_order: 1 }
  ],
  hero_slides: [
    { id: 1, title: 'Diseño Sustentable para tu Hogar', subtitle: 'Muebles premium creados a partir de plástico 100% reciclado.', image_url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200', cta_text: 'Ver Catálogo', cta_url: '/catalogos.html', sort_order: 1, is_active: true }
  ],
  impact_stats: [
    { id: 1, icon_glyph: 'eco', value_text: '2,500 Toneladas', label_text: 'Plástico Reciclado', title: 'Impacto Global', description: 'Residuos recolectados y procesados.', sort_order: 1, is_active: true }
  ],
  impact_comparisons: [
    { id: 1, characteristic: 'Vida útil estimada', imagenia_val: 'Más de 50 años', traditional_val: '10-15 años (madera/metal)', sort_order: 1, is_active: true }
  ],
  clients: [
    { id: 1, name: 'EcoHotel Tulum', logo_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100', project_url: '#', sort_order: 1, is_active: true }
  ],
  wa_questions: [
    { id: 1, question: '¿Cuál es tu nombre?', type: 'text', is_required: true, sort_order: 1, is_active: true },
    { id: 2, question: '¿Qué producto te interesa?', type: 'text', is_required: false, sort_order: 2, is_active: true }
  ],
  wa_leads: [
    { id: 1, created_at: new Date().toISOString(), answers: { '¿Cuál es tu nombre?': 'Carlos Ruiz', '¿Qué producto te interesa?': 'Silla Acapulco' }, raw_message: 'Hola, me interesa la Silla Acapulco.' }
  ],
  site_settings: [
    { key: 'counter_value', value: '2540' },
    { key: 'counter_label', value: 'Toneladas de Plástico Reciclado' },
    { key: 'counter_sublabel', value: 'Comprometidos con el medio ambiente' },
    { key: 'counter_is_active', value: 'true' },
    { key: 'promo_banner_text', value: '¡Descuento corporativo este mes!' }
  ]
};

// Mock Auth User
const mockUser = {
  id: 'mock-user-id',
  email: 'admin@imagenia.mx',
  role: 'admin'
};

export const supabase = {
  auth: {
    async getUser() {
      return { data: { user: mockUser }, error: null };
    },
    async signInWithPassword() {
      return { data: { user: mockUser }, error: null };
    },
    async signOut() {
      return { error: null };
    }
  },
  from(tableName) {
    return {
      select(columns, { count, head } = {}) {
        let list = mockData[tableName] || [];
        if (tableName === 'products_with_tags') {
          list = mockData.products;
        } else if (tableName === 'contact_submissions') {
          list = mockData.contact_submissions;
        } else if (tableName === 'site_settings') {
          list = mockData.site_settings;
        } else if (tableName === 'tag_groups') {
          // Resolve tags inside group
          list = mockData.tag_groups.map(g => ({
            ...g,
            tags: mockData.tags.filter(t => t.group_id === g.id)
          }));
        } else if (tableName === 'wa-questions' || tableName === 'wa_questions') {
          list = mockData.wa_questions;
        } else if (tableName === 'wa-leads' || tableName === 'wa_leads') {
          list = mockData.wa_leads;
        }

        const chain = {
          eq(col, val) {
            return this;
          },
          order(col, opts) {
            return this;
          },
          limit(n) {
            return this;
          },
          range(from, to) {
            return this;
          },
          ilike(col, val) {
            return this;
          },
          then(resolve) {
            resolve({
              data: JSON.parse(JSON.stringify(list)),
              count: list.length,
              error: null
            });
          }
        };
        return chain;
      },
      upsert(data) {
        return {
          then(resolve) {
            resolve({ data, error: null });
          }
        };
      },
      insert(data) {
        return {
          then(resolve) {
            resolve({ data, error: null });
          }
        };
      },
      update(data) {
        return {
          then(resolve) {
            resolve({ data, error: null });
          }
        };
      },
      delete() {
        return {
          eq(col, val) {
            return {
              then(resolve) {
                resolve({ error: null });
              }
            };
          }
        };
      }
    };
  },
  storage: {
    from(bucket) {
      return {
        async upload(path, file, opts) {
          return { data: { path }, error: null };
        },
        getPublicUrl(path) {
          return { data: { publicUrl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400' } };
        }
      };
    }
  }
};

export async function getUser() {
  return mockUser;
}

export async function getUserRole(email) {
  return 'admin';
}

export async function requireAuth() {
  return mockUser;
}

export async function requireLeadsAuth() {
  return mockUser;
}

export async function signIn(email, password) {
  return { data: { user: mockUser }, error: null };
}

export async function signOut() {
  return { error: null };
}

export async function getSettings() {
  return Object.fromEntries(mockData.site_settings.map(r => [r.key, r.value]));
}

export async function setSetting(key, value) {
  const row = mockData.site_settings.find(r => r.key === key);
  if (row) {
    row.value = value;
  } else {
    mockData.site_settings.push({ key, value });
  }
  return { error: null };
}

export async function getProducts() {
  return { data: mockData.products, error: null };
}

export async function getCatalogs() {
  return { data: mockData.catalogs, error: null };
}

export async function getCategories() {
  return { data: mockData.categories, error: null };
}

export async function getTagGroups() {
  // Resolve tags inside group
  return mockData.tag_groups.map(g => ({
    ...g,
    tags: mockData.tags.filter(t => t.group_id === g.id)
  }));
}

export async function uploadFile(bucket, folder, file) {
  return { url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=400', error: null };
}

export async function getHeroSlides() {
  return { data: mockData.hero_slides, error: null };
}

export async function getImpactStats() {
  return { data: mockData.impact_stats, error: null };
}

export async function getBlogs() {
  return { data: mockData.blogs, error: null };
}

export async function getImpactComparisons() {
  return { data: mockData.impact_comparisons, error: null };
}
