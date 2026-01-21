const API_BASE = import.meta.env.VITE_API_URL || './api/index.php?route='

async function fetchJSON(url, options = {}) {
  // Convertir /path a route=path
  const route = url.startsWith('/') ? url.slice(1) : url
  const fullUrl = `${API_BASE}${route}`

  const response = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Tags (antes llamado Categorías)
export async function getCategories() {
  return fetchJSON('/tags')
}

// Fotos
export async function getPhotos() {
  return fetchJSON('/photos')
}

export async function getPhoto(id) {
  return fetchJSON(`/photos/${id}`)
}

// Búsqueda
export async function searchPhotos({ query, steel, category }) {
  const params = new URLSearchParams()
  if (query) params.append('query', query)
  if (steel) params.append('steel', steel)
  if (category) params.append('category', category)

  const queryString = params.toString()
  return fetchJSON(`/search${queryString ? `?${queryString}` : ''}`)
}

// Health check
export async function healthCheck() {
  return fetchJSON('/health')
}

// ==================
// Funciones de copia al portapapeles
// ==================

export async function copyImageToClipboard(imageUrl) {
  try {
    // Verificar si el navegador soporta la API de clipboard con imágenes
    if (!navigator.clipboard || !navigator.clipboard.write) {
      return { success: false, message: 'Tu navegador no soporta copiar imágenes' }
    }

    // Siempre usar canvas para convertir a PNG (los navegadores solo soportan PNG en clipboard)
    const img = new Image()
    img.crossOrigin = 'anonymous'

    return new Promise((resolve) => {
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)

          // Convertir canvas a blob PNG
          canvas.toBlob(async (pngBlob) => {
            if (!pngBlob) {
              resolve({ success: false, message: 'Error al procesar la imagen' })
              return
            }

            try {
              const item = new ClipboardItem({ 'image/png': pngBlob })
              await navigator.clipboard.write([item])
              resolve({ success: true, message: 'Imagen copiada al portapapeles' })
            } catch (err) {
              resolve({ success: false, message: 'Error al copiar imagen: ' + err.message })
            }
          }, 'image/png')
        } catch (err) {
          resolve({ success: false, message: 'Error al procesar imagen: ' + err.message })
        }
      }

      img.onerror = () => {
        resolve({ success: false, message: 'Error al cargar la imagen' })
      }

      img.src = imageUrl
    })
  } catch (error) {
    return { success: false, message: 'Error al copiar imagen: ' + error.message }
  }
}

export async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return { success: true, message: 'Texto copiado al portapapeles' }
    }

    // Fallback para navegadores antiguos
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      document.execCommand('copy')
      return { success: true, message: 'Texto copiado al portapapeles' }
    } finally {
      document.body.removeChild(textarea)
    }
  } catch (error) {
    return { success: false, message: 'Error al copiar texto: ' + error.message }
  }
}

export async function copyMultipleTexts(texts) {
  const combined = texts.filter(Boolean).join('\n\n---\n\n')
  return copyTextToClipboard(combined)
}
