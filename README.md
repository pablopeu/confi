# Configurador Interactivo PEU - Sistema de Catálogo y Configurador de Cuchillos Artesanales

Sistema web completo para gestionar un catálogo de cuchillos artesanales con sistema de configuración interactivo y compartición de diseños personalizados.

## Características Principales

### Catálogo Frontend
- 📸 Visualización de fotos con zoom interactivo (Ctrl + Scroll)
- 🏷️ Sistema de tags por categorías (Tipo, Encabado, Acero, Extras)
- 🔍 Búsqueda en tiempo real con normalización de texto (sin acentos)
- 🎨 Filtros interactivos por múltiples categorías
- 📱 Diseño responsive (Mobile + Desktop)
- 📋 Copiar imagen al portapapeles con un click
- 🌙 Soporte para modo oscuro

### Sistema de Configurador
- 🗂️ **5 Buckets** independientes (Cuchillo 1-5) con selección de hasta 6 fotos cada uno
- ⚙️ Configuración detallada por foto:
  - Checkboxes: Forma, Acero, Encabado, Detalle 1, 2, 3
  - Campo de comentarios libre
- 💾 Persistencia en cookies (365 días)
- 🔗 Generación de links compartibles con código único (8 caracteres alfanuméricos)
- 📤 Compartir por WhatsApp y Telegram con mensaje personalizable
- 🔄 Carga completa de configuraciones desde URL

### Panel de Administración
- 👤 Sistema de autenticación con credenciales personalizables
- 📂 Gestión completa de fotos (subir, editar, eliminar)
- 🏷️ Sistema de tags jerárquico por grupos
- 🎨 Configuración de logo del sitio
- 💬 Configuración de botones flotantes (WhatsApp/Telegram)
- 🔖 Inyección de metadatos HTML para SEO
- 💾 Sistema de backups (hasta 5, con restauración)
- ✉️ Mensaje personalizable para compartir configuraciones

## Stack Tecnológico

### Frontend
- **React 18** + Vite
- **Tailwind CSS** para estilos
- **JavaScript ES6+**
- Componentes funcionales con Hooks

### Backend
- **PHP 8.1+** (sin frameworks)
- Almacenamiento en **JSON** (sin base de datos)
- API RESTful

## Instrucciones de Uso

Este configurador **[no es mi página web](https://peu.net)**, sino una herramienta para ayudarte a **personalizar tu cuchillo** usando detalles de otros modelos.

### 1. Selección de imágenes
* En la página principal podés elegir **hasta 6 imágenes por cuchillo**.
* Hay **5 cuchillos configurables** (5 botones para guardar distintos diseños).
* Tocá una imagen para seleccionarla (aparece un ✔ verde).
* Si intentás agregar más de 6, primero debés deseleccionar alguna.

### 2. Configuración de detalles
* Al terminar la selección, presioná el **botón del configurador**.
* En esta sección, cada imagen tiene **6 campos para destacar lo que te gusta**.
* También hay un campo adicional para **comentarios generales**.

### 3. Guardar y compartir
* Al guardar la configuración podés:
  * Compartir por **WhatsApp o Telegram**.
  * Usar el **link que el sistema copia al portapapeles** (email, iMessage, etc.).
* Ese link también queda en la barra del navegador y permite **ver y modificar la configuración completa**.

---

Gracias por pensar en mí para tu próximo cuchillo. **Pablo**
