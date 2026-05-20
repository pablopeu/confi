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

// Catálogo
export async function getCatalogTree() {
  return fetchJSON(`/catalog/tree&_t=${Date.now()}`)
}

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
