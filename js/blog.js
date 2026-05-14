import { initPage } from './components.js';
import { getBlogs } from './supabase.js';

function generateSlug(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '_')           // Replace spaces with _
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\_\_+/g, '_')         // Replace multiple _ with single _
    .replace(/^_+/, '')             // Trim _ from start
    .replace(/_+$/, '');            // Trim _ from end
}

async function init() {
  await initPage('Blog');
  
  const urlParams = new URLSearchParams(window.location.search);
  const slugParam = urlParams.get('t');
  
  const container = document.getElementById('blog-container');
  
  if (!slugParam) {
    container.innerHTML = `
      <div class="loading-state">
        <h2>Blog no encontrado</h2>
        <p>No se especificó ningún artículo en la URL.</p>
      </div>`;
    return;
  }

  try {
    const { data: blogs } = await getBlogs();
    if (!blogs || blogs.length === 0) {
      throw new Error("No hay blogs disponibles");
    }

    // Find the blog that matches the slug
    const blog = blogs.find(b => generateSlug(b.title) === slugParam);

    if (!blog) {
      container.innerHTML = `
        <div class="loading-state">
          <h2>Artículo no encontrado</h2>
          <p>El artículo que buscas no existe o ha sido movido.</p>
        </div>`;
      return;
    }
    
    // Set page title for SEO
    document.title = `${blog.title} — IMAGENIA`;

    // Render Blog Content
    let extraMedia = '';
    if (blog.content_url) {
      const url = blog.content_url.toLowerCase();
      if (url.endsWith('.pdf')) {
        const name = url.split('/').pop() || 'Documento PDF';
        extraMedia = `<div class="blog-media-wrap">
          <a href="${blog.content_url}" target="_blank" class="btn btn-secondary">📄 Descargar ${name}</a>
        </div>`;
      } else if (url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null) {
        extraMedia = `<div class="blog-media-wrap"><img src="${blog.content_url}" alt="Media adjunto"></div>`;
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let embedUrl = blog.content_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
        extraMedia = `<div class="blog-media-wrap" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:var(--radius-md);">
          <iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>
        </div>`;
      } else {
        extraMedia = `<div class="blog-media-wrap">
          <a href="${blog.content_url}" target="_blank" class="btn btn-secondary">🔗 Visitar enlace adjunto</a>
        </div>`;
      }
    }

    const dateStr = new Date(blog.created_at).toLocaleDateString('es-ES', {
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });

    container.innerHTML = `
      <div class="blog-header">
        <h1>${blog.title}</h1>
        <div class="blog-meta">Publicado el ${dateStr}</div>
      </div>
      <div class="blog-content ql-snow">
        <div class="ql-editor">${blog.content || ''}</div>
      </div>
      ${extraMedia}
    `;

  } catch (error) {
    console.error("Error loading blog:", error);
    container.innerHTML = `
      <div class="loading-state">
        <h2>Error al cargar</h2>
        <p>Hubo un problema al cargar el artículo. Inténtalo más tarde.</p>
      </div>`;
  }
}

init();
