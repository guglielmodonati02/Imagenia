# IMAGENIA 🌴

Sitio web corporativo y panel de administración (CMS) a medida para **Imagenia** (Muebles de exterior).
Este proyecto está construido como una Single Page Application (SPA) pura usando Vanilla JavaScript (ES Modules), HTML5 y CSS3, sin necesidad de frameworks pesados como React o dependencias de Node.js (NPM).

El backend y la gestión de la base de datos están potenciados por **Supabase**.

---

## 🚀 Cómo ejecutar el proyecto localmente

Dado que el proyecto utiliza ES Modules nativos (`import`/`export`), **no puedes simplemente hacer doble clic en el archivo `index.html`** (esto arrojará un error de CORS en el navegador). Necesitas levantar un servidor local.

### 1. Prerrequisitos
Asegúrate de tener instalado [Python](https://www.python.org/) en tu computadora. Windows y Mac suelen traerlo o es muy fácil de instalar.

### 2. Levantar el servidor
Abre una terminal (PowerShell o CMD) en la carpeta raíz del proyecto y ejecuta:

```bash
python -m http.server 3000
```

### 3. Acceder al sitio
Una vez que el servidor esté corriendo, abre tu navegador web y visita:

- **Sitio Público:** [http://localhost:3000](http://localhost:3000)
- **Panel Administrativo:** [http://localhost:3000/admin/index.html](http://localhost:3000/admin/index.html)

---

## ⚙️ Arquitectura y Tecnologías

- **Frontend:** Vanilla JS, HTML, CSS (Custom Properties / Variables).
- **Iconografía:** Material Symbols Outlined (Cargado vía Google Fonts).
- **Backend / DB:** Supabase (PostgreSQL, Storage, Auth).

### Estructura de Carpetas

```text
/
├── admin/          # Interfaz y login del panel de control
├── css/            # Hojas de estilo globales y variables
├── js/             # Lógica de la aplicación (Módulos JS)
│   ├── admin.js       # Lógica del panel administrativo
│   ├── components.js  # Componentes reutilizables (Modales, Toasts)
│   ├── supabase.js    # Cliente de conexión a la base de datos
│   └── *.js           # Scripts específicos de cada página
├── database/       # (Ignorado en Git) Migraciones y scripts SQL
├── design/         # (Ignorado en Git) Recursos de diseño (Figma, assets)
└── *.html          # Vistas públicas (index, catalogos, productos, etc)
```

---

## 🗄️ Base de Datos (Supabase)

Toda la información del sitio se gestiona de forma dinámica desde el Panel de Control. 
Si vas a desplegar el proyecto en un entorno nuevo, asegúrate de configurar las siguientes características en Supabase:

1. **Storage Bucket:** Debe existir un bucket público llamado `imagenia-assets`.
2. **Políticas (RLS):** El bucket requiere políticas que permitan lecturas públicas (`SELECT`) e inserciones/actualizaciones (`INSERT`/`UPDATE`) únicamente para usuarios con rol `authenticated`. (Ver `migration_v7_storage.sql` si lo tienes respaldado).
3. **Módulos Activos:** El sitio cuenta con soporte para captura de leads de WhatsApp Premium (`whatsapp_leads`, `whatsapp_questions`), gestión de catálogo (`catalogs`, `products`), estadísticas dinámicas, entre otros.

---

## 📦 Despliegue en Producción

Debido a que son archivos puramente estáticos, puedes desplegar esta carpeta en servicios gratuitos o de bajo costo como:
- **Vercel**
- **Netlify**
- **GitHub Pages**
- **Cloudflare Pages**

Solo necesitas conectar el repositorio y el sitio funcionará automáticamente. No requiere comandos de construcción (`npm run build`).

---
*Documentación generada automáticamente para mantener el proyecto a lo largo del tiempo.*
