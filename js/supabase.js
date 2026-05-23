// js/supabase.js — IMAGENIA Supabase Client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://wtkigurrddsfnosdnpxq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0a2lndXJyZGRzZm5vc2RucHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTQ0NTUsImV4cCI6MjA5MjczMDQ1NX0.376-peehO6esYyb8EY2pCS9sVKwklme59kiGxRhJagw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth helpers ──────────────────────────────────────────────
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserRole(email) {
  if (!email) return null;
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('email', email);
    if (error) {
      console.warn('Error fetching role from user_roles, defaulting to admin:', error);
      return 'admin';
    }
    return (data && data.length > 0) ? data[0].role : 'admin';
  } catch (err) {
    console.error('Exception fetching user role:', err);
    return 'admin';
  }
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/admin/login.html';
    return null;
  }
  const role = await getUserRole(user.email);
  if (role === 'leads_viewer') {
    window.location.href = '/leads-admin/index.html';
    return null;
  }
  return user;
}

export async function requireLeadsAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/leads-admin/login.html';
    return null;
  }
  const role = await getUserRole(user.email);
  if (role !== 'leads_viewer' && role !== 'admin') {
    window.location.href = '/admin/index.html';
    return null;
  }
  return user;
}

export async function signIn(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const isLeads = window.location.pathname.startsWith('/leads-admin/');
  await supabase.auth.signOut();
  window.location.href = isLeads ? '/leads-admin/login.html' : '/admin/login.html';
}

// ── Settings helpers ──────────────────────────────────────────
export async function getSettings() {
  const { data } = await supabase.from('site_settings').select('*');
  if (!data) return {};
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}

export async function setSetting(key, value) {
  return await supabase.from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
}

// ── Products helpers ──────────────────────────────────────────
export async function getProducts({ categorySlug, tagIds, featured, bestseller, isNew, search, page = 1, pageSize = 15 } = {}) {
  let query = supabase
    .from('products_with_tags')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (categorySlug && categorySlug !== 'todos') {
    query = query.eq('category_slug', categorySlug);
  }
  if (featured) query = query.eq('is_featured', true);
  if (bestseller) query = query.eq('is_bestseller', true);
  if (isNew) query = query.eq('is_new', true);
  if (search) query = query.ilike('name', `%${search}%`);

  // Pagination
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;

  // Client-side tag filter (Supabase JSON arrays need this)
  let results = data || [];
  if (tagIds && tagIds.length > 0) {
    results = results.filter(p => {
      const productTagIds = (p.tags || []).map(t => t.tag_id);
      return tagIds.every(id => productTagIds.includes(id));
    });
  }

  return { data: results, error };
}

// ── Catalog helpers ───────────────────────────────────────────
export async function getCatalogs() {
  const { data, error } = await supabase
    .from('catalogs')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return { data, error };
}

// ── Category helpers ──────────────────────────────────────────
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return { data, error };
}

// ── Tag helpers ───────────────────────────────────────────────
export async function getTagGroups() {
  const { data: groups } = await supabase
    .from('tag_groups')
    .select('*, tags(*)')
    .eq('is_active', true)
    .order('sort_order');
  return groups || [];
}

// ── Storage upload helper ─────────────────────────────────────
export async function uploadFile(bucket, folder, file) {
  const ext = file.name.split('.').pop();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: publicUrl, error: null };
}

// ── Hero Slides helpers ───────────────────────────────────────
export async function getHeroSlides() {
  return await supabase
    .from('hero_slides')
    .select('*')
    .order('sort_order');
}

// ── Impact Stats helpers ──────────────────────────────────────
export async function getImpactStats() {
  return await supabase
    .from('impact_stats')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
}

// ── Blogs helpers ─────────────────────────────────────────────
export async function getBlogs() {
  return await supabase
    .from('blogs')
    .select('*')
    .order('sort_order');
}

// ── Impact Comparisons helpers ────────────────────────────────
export async function getImpactComparisons() {
  return await supabase
    .from('impact_comparisons')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
}


