import { useState, useEffect, useRef } from 'react'
import Modal from '../components/Modal'
import { useModal } from '../hooks/useModal'
import SearchBar from '../components/SearchBar/SearchBar'
import { capitalize, normalizeText } from '../utils'

const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'

function apiUrl(route) {
  return `${API_BASE}?route=${route.replace(/^\//, '')}`
}

// Credenciales compartidas para el wrapper de fetch
let authCreds = { user: '', pass: '' }
const setAuthCreds = (next) => { authCreds = next }

// Wrapper de fetch: agrega Authorization: Basic para no exponer credenciales
// en el query string (fuga en logs, historial y Referer)
const originalFetch = window.fetch
window.fetch = (url, options = {}) => {
  const headers = new Headers(options.headers || {})
  if (authCreds.user && authCreds.pass && !headers.has('Authorization')) {
    const token = btoa(String.fromCharCode(...new TextEncoder().encode(`${authCreds.user}:${authCreds.pass}`)))
    headers.set('Authorization', 'Basic ' + token)
  }
  return originalFetch(url, { ...options, headers })
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [credentials, setCredentials] = useState({ user: '', pass: '' })
  const [activeTab, setActiveTab] = useState('manage')
  const [tagGroups, setTagGroups] = useState([])
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pendingSave, setPendingSave] = useState(null) // Función para guardar antes de cambiar tab
  const [backendTitle, setBackendTitle] = useState(null)
  const [loginTitle, setLoginTitle] = useState(null)
  const [titlesLoaded, setTitlesLoaded] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false) // Menú hamburguesa en móvil

  const { isOpen, modalProps, closeModal, showSuccess, showError, showConfirm } = useModal()

  const getAuthParams = () => ({
    auth_user: credentials.user,
    auth_pass: credentials.pass
  })

  // Mantener las credenciales actualizadas para el wrapper de fetch
  useEffect(() => {
    setAuthCreds(credentials)
  }, [credentials])

  // Cargar títulos públicos al montar (sin autenticación)
  useEffect(() => {
    const loadPublicTitles = async () => {
      try {
        const response = await fetch(apiUrl('config'))
        if (response.ok) {
          const data = await response.json()
          if (data.login_title) {
            setLoginTitle(data.login_title)
          }
          setTitlesLoaded(true)
        }
      } catch (error) {
        // Error silencioso, usar fallback
        setLoginTitle('Admin')
        setTitlesLoaded(true)
      }
    }

    loadPublicTitles()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      setAuthCreds({ user: credentials.user, pass: credentials.pass })
      const response = await fetch(apiUrl('admin/verify'))
      if (response.ok) {
        setAuthenticated(true)
        loadData()
        loadBackendTitle() // Cargar título del backend
      } else {
        showError('Error', 'Credenciales inválidas')
      }
    } catch (error) {
      showError('Error', 'No se pudo conectar con el servidor')
    }
  }

  const loadBackendTitle = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/site-info'))
      if (response.ok) {
        const data = await response.json()
        setBackendTitle(data.backend_title || 'Admin')
        setLoginTitle(data.login_title || data.backend_title || 'Admin')
      }
    } catch (error) {
      // Error silencioso, mantener el valor actual
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [catRes, photoRes] = await Promise.all([
        fetch(apiUrl('tags')),
        fetch(apiUrl('photos'))
      ])
      const catData = await catRes.json()
      const photoData = await photoRes.json()
      setTagGroups(catData.tag_groups || [])
      setPhotos(photoData.photos || [])
    } catch (error) {
      showError('Error', 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 12) {
      showError('Error', 'La contraseña debe tener al menos 12 caracteres')
      return
    }

    try {
      const response = await fetch(apiUrl('admin/password'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword, ...getAuthParams() })
      })

      if (response.ok) {
        setCredentials({ ...credentials, pass: newPassword })
        setShowPasswordModal(false)
        setNewPassword('')
        showSuccess('Éxito', 'Contraseña actualizada')
      } else {
        showError('Error', 'No se pudo cambiar la contraseña')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleTabChange = async (newTab) => {
    // Si hay una función de guardado pendiente, ejecutarla antes de cambiar
    if (pendingSave) {
      await pendingSave()
    }
    setActiveTab(newTab)
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            {!titlesLoaded ? 'Cargando...' : loginTitle || 'Admin'}
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuario</label>
              <input
                type="text"
                autoComplete="username"
                value={credentials.user}
                onChange={(e) => setCredentials({ ...credentials, user: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                value={credentials.pass}
                onChange={(e) => setCredentials({ ...credentials, pass: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            <button type="submit" className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
              Iniciar sesión
            </button>
          </form>
          <a href="#/" target="_blank" rel="noopener noreferrer" className="block text-center mt-4 text-sm text-gray-500 dark:text-gray-400 hover:underline">
            Volver al catálogo
          </a>
        </div>
        <Modal isOpen={isOpen} onClose={closeModal} {...modalProps} />
      </div>
    )
  }

  const tabs = [
    { id: 'manage', label: 'Administrar fotos' },
    { id: 'upload', label: 'Subir fotos' },
    { id: 'tags', label: 'Tags' },
    { id: 'config', label: 'Configuración' },
  ]

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden">
      <header className="bg-white dark:bg-gray-800 shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-between items-center">
          <button
            onClick={() => handleTabChange('manage')}
            className="text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Ir a Administrar fotos"
          >
            {backendTitle || 'Admin'}
          </button>

          {/* Desktop: Tabs en el header */}
          <div className="hidden md:flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-1.5 font-medium text-sm rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop: Acciones */}
          <div className="hidden md:flex items-center gap-4">
            <a href="#/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-300 hover:underline">Ver catálogo</a>
            <button onClick={() => setShowPasswordModal(true)} className="text-sm text-gray-600 dark:text-gray-300 hover:underline">
              Cambiar contraseña
            </button>
            <button onClick={() => setAuthenticated(false)} className="text-sm text-red-600 dark:text-red-400 hover:underline">
              Cerrar sesión
            </button>
          </div>

          {/* Mobile: Menú hamburguesa */}
          <div className="md:hidden flex items-center gap-2">
            <a href="#/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-300 hover:underline px-2">Ver catálogo</a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile: Menú desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="px-4 py-3 space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    handleTabChange(tab.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2 font-medium text-sm rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 space-y-2">
                <button
                  onClick={() => {
                    setShowPasswordModal(true)
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cambiar contraseña
                </button>
                <button
                  onClick={() => setAuthenticated(false)}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden px-4">
        <div className="max-w-7xl mx-auto h-full">
          {activeTab === 'upload' && (
            <UploadPhotos
              tagGroups={tagGroups}
              authParams={getAuthParams()}
              onRefresh={loadData}
              showSuccess={showSuccess}
              showError={showError}
              setPendingSave={setPendingSave}
            />
          )}
          {activeTab === 'manage' && (
            <ManagePhotos
              photos={photos}
              tagGroups={tagGroups}
              authParams={getAuthParams()}
              onRefresh={loadData}
              showSuccess={showSuccess}
              showError={showError}
              showConfirm={showConfirm}
              setPendingSave={setPendingSave}
            />
          )}
          {activeTab === 'tags' && (
            <TagsManager
              tagGroups={tagGroups}
              authParams={getAuthParams()}
              onRefresh={loadData}
              showSuccess={showSuccess}
              showError={showError}
              showConfirm={showConfirm}
            />
          )}
          {activeTab === 'config' && (
            <Configuration
              authParams={getAuthParams()}
              showSuccess={showSuccess}
              showError={showError}
              onLogoChange={loadData}
              backendTitle={backendTitle}
              setBackendTitle={setBackendTitle}
              loginTitle={loginTitle}
              setLoginTitle={setLoginTitle}
            />
          )}
        </div>
      </main>

      {/* Modal cambiar contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cambiar contraseña</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 12 caracteres)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              autoComplete="new-password"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleChangePassword} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isOpen} onClose={closeModal} {...modalProps} />
    </div>
  )
}

// ==================
// Upload Photos - Nueva sección de subida
// ==================
function UploadPhotos({ tagGroups, authParams, onRefresh, showSuccess, showError, setPendingSave }) {
  const [buckets, setBuckets] = useState([])
  const [activeBucketId, setActiveBucketId] = useState(null)
  const [uploadedPhotos, setUploadedPhotos] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoTags, setPhotoTags] = useState({}) // { photoId: [tagIds] }
  const [photoTexts, setPhotoTexts] = useState({}) // { photoId: text }
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false) // Para feedback visual verde
  const [arrowFeedback, setArrowFeedback] = useState(null) // 'prev' | 'next' | null
  const saveTimeout = useRef(null)
  const [bucketToDelete, setBucketToDelete] = useState(null)
  const [deletedBucketFeedback, setDeletedBucketFeedback] = useState(null)
  const [bucketAndPhotosToDelete, setBucketAndPhotosToDelete] = useState(null)

  const currentPhoto = uploadedPhotos[currentIndex]

  // Cargar buckets al montar
  useEffect(() => {
    loadBuckets()
  }, [])

  const loadBuckets = async () => {
    try {
      const response = await fetch(apiUrl('buckets'))
      const data = await response.json()
      setBuckets(data.buckets || [])
    } catch (error) {
      // Error silencioso
    }
  }

  // Registrar función de guardado para cuando se cambie de tab
  useEffect(() => {
    if (currentPhoto && setPendingSave) {
      setPendingSave(() => () => handleSaveCurrentPhoto(false))
    }
    return () => setPendingSave && setPendingSave(null)
  }, [currentPhoto, photoTags, photoTexts])

  // Manejar Escape y clicks fuera para deseleccionar bucket
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeBucketId) {
        setActiveBucketId(null)
        setUploadedPhotos([])
        setCurrentIndex(0)
        setPhotoTags({})
        setPhotoTexts({})
      }
    }

    const handleClickOutside = (e) => {
      if (activeBucketId && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select') && !e.target.closest('textarea')) {
        setActiveBucketId(null)
        setUploadedPhotos([])
        setCurrentIndex(0)
        setPhotoTags({})
        setPhotoTexts({})
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [activeBucketId])

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return

    setUploading(true)
    const MAX_FILES_PER_REQUEST = 20 // Límite del hosting
    const allPhotos = []
    let bucketId = null

    try {
      // Dividir en lotes de MAX_FILES_PER_REQUEST
      const chunks = []
      for (let i = 0; i < files.length; i += MAX_FILES_PER_REQUEST) {
        chunks.push(Array.from(files).slice(i, i + MAX_FILES_PER_REQUEST))
      }

      // Subir cada lote secuencialmente
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const formData = new FormData()

        // Agregar archivos del lote
        for (const file of chunk) {
          formData.append('photos[]', file)
        }

        // Si es el primer lote, usar bucket vacío
        // Para lotes subsiguientes, enviar el bucket_id para agregar al mismo bucket
        if (bucketId) {
          formData.append('bucket_id', bucketId)
        }

        formData.append('tags', '')
        formData.append('text', '')
        formData.append('auth_user', authParams.auth_user)
        formData.append('auth_pass', authParams.auth_pass)

        const response = await fetch(apiUrl('admin/upload'), {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          const uploadedPhotos = data.photos || []
          allPhotos.push(...uploadedPhotos)

          // Guardar el bucket_id del primer lote
          if (data.bucket_id && !bucketId) {
            bucketId = data.bucket_id
          }
        } else if (response.status === 401) {
          showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
          return
        } else {
          const error = await response.json()
          showError('Error', error.error || 'Error al subir lote ' + (i + 1))
          return
        }
      }

      // Recargar buckets al final
      await loadBuckets()

      // Activar el nuevo bucket
      if (bucketId) {
        setActiveBucketId(bucketId)
      }

      // Cargar fotos del nuevo bucket
      setUploadedPhotos(allPhotos)
      setCurrentIndex(0)

      // Inicializar tags y textos vacíos para las nuevas fotos
      const newTags = {}
      const newTexts = {}
      allPhotos.forEach(p => {
        newTags[p.id] = []
        newTexts[p.id] = ''
      })
      setPhotoTags(newTags)
      setPhotoTexts(newTexts)

      showSuccess('Éxito', `${allPhotos.length} foto(s) subida(s)`)
      onRefresh()
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  const handleTagToggle = (tagId) => {
    if (!currentPhoto) return
    setPhotoTags(prev => {
      const current = prev[currentPhoto.id] || []
      const newTags = current.includes(tagId)
        ? current.filter(t => t !== tagId)
        : [...current, tagId]
      return { ...prev, [currentPhoto.id]: newTags }
    })
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => handleSaveCurrentPhoto(false), 1000)
  }

  const handleTextChange = (text) => {
    if (!currentPhoto) return
    setPhotoTexts(prev => ({ ...prev, [currentPhoto.id]: text }))
  }

  const handleCreateTag = async (groupId, tagName) => {
    try {
      const response = await fetch(apiUrl('admin/tags'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, name: tagName, ...authParams })
      })

      if (response.ok) {
        const newTag = await response.json()
        // Auto-seleccionar el nuevo tag SIN perder los anteriores
        if (currentPhoto) {
          setPhotoTags(prev => ({
            ...prev,
            [currentPhoto.id]: [...(prev[currentPhoto.id] || []), newTag.id]
          }))
        }
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => handleSaveCurrentPhoto(false), 1000)
        // Refrescar tags después de actualizar el estado local
        onRefresh()
        return newTag
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      }
    } catch (error) {
      showError('Error', 'Error al crear tag')
    }
    return null
  }

  const handleSaveCurrentPhoto = async (showFeedback = true) => {
    if (!currentPhoto) return

    setSaving(true)
    try {
      const response = await fetch(apiUrl(`admin/photos/${currentPhoto.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: photoTexts[currentPhoto.id] || '',
          tags: photoTags[currentPhoto.id] || [],
          ...authParams
        })
      })

      if (response.ok && showFeedback) {
        // Feedback visual verde en el botón
        setSavedFeedback(true)
        setTimeout(() => setSavedFeedback(false), 1000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      }
    } catch (error) {
      showError('Error', 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const goToPrev = async () => {
    await handleSaveCurrentPhoto(false)
    setArrowFeedback('prev')
    setTimeout(() => setArrowFeedback(null), 500)
    // Continuo: si está en la primera, va a la última
    setCurrentIndex(currentIndex === 0 ? uploadedPhotos.length - 1 : currentIndex - 1)
  }

  const goToNext = async () => {
    await handleSaveCurrentPhoto(false)
    setArrowFeedback('next')
    setTimeout(() => setArrowFeedback(null), 500)
    // Continuo: si está en la última, va a la primera
    setCurrentIndex(currentIndex === uploadedPhotos.length - 1 ? 0 : currentIndex + 1)
  }

  // Manejar teclas de flecha del teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, uploadedPhotos.length])

  const handleChangeBucket = async (bucketId) => {
    // Guardar bucket actual si hay fotos
    if (uploadedPhotos.length > 0 && currentPhoto) {
      await handleSaveCurrentPhoto(false)
    }

    // Cambiar al nuevo bucket
    const bucket = buckets.find(b => b.id === bucketId)
    if (bucket) {
      setActiveBucketId(bucketId)

      // Obtener información actualizada de las fotos desde el servidor
      try {
        const response = await fetch(apiUrl('photos'))
        const photosData = await response.json()
        const allPhotos = photosData.photos || []

        // Mapear IDs del bucket a fotos actualizadas
        const photoIds = bucket.photos.map(p => p.id)
        const updatedPhotos = allPhotos.filter(p => photoIds.includes(p.id))

        setUploadedPhotos(updatedPhotos)
        setCurrentIndex(0)

        // Inicializar tags y textos desde las fotos actualizadas
        const newTags = {}
        const newTexts = {}
        updatedPhotos.forEach(p => {
          newTags[p.id] = p.tags || []
          newTexts[p.id] = p.text || ''
        })
        setPhotoTags(newTags)
        setPhotoTexts(newTexts)
      } catch (error) {
        // Fallback: usar las fotos del bucket
        setUploadedPhotos(bucket.photos || [])
        setCurrentIndex(0)

        const newTags = {}
        const newTexts = {}
        bucket.photos.forEach(p => {
          newTags[p.id] = p.tags || []
          newTexts[p.id] = p.text || ''
        })
        setPhotoTags(newTags)
        setPhotoTexts(newTexts)
      }
    }
  }

  const handleDeleteBucket = async (bucketId) => {
    try {
      const response = await fetch(apiUrl(`admin/buckets/${bucketId}`), {
        method: 'DELETE'
      })

      if (response.ok) {
        // Feedback visual
        setDeletedBucketFeedback(bucketId)
        setTimeout(() => setDeletedBucketFeedback(null), 1000)

        // Si el bucket eliminado es el activo, limpiar la vista
        if (activeBucketId === bucketId) {
          setActiveBucketId(null)
          setUploadedPhotos([])
          setCurrentIndex(0)
          setPhotoTags({})
          setPhotoTexts({})
        }

        // Recargar buckets
        await loadBuckets()
        setBucketToDelete(null)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        showError('Error', 'Error al eliminar bucket')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleDeleteBucketAndPhotos = async (bucketId) => {
    try {
      const response = await fetch(apiUrl(`admin/buckets/${bucketId}/photos`), {
        method: 'DELETE'
      })

      if (response.ok) {
        showSuccess('Éxito', 'Bucket y fotos eliminadas del sistema')

        // Si el bucket eliminado es el activo, limpiar la vista
        if (activeBucketId === bucketId) {
          setActiveBucketId(null)
          setUploadedPhotos([])
          setCurrentIndex(0)
          setPhotoTags({})
          setPhotoTexts({})
        }

        // Recargar buckets
        await loadBuckets()
        setBucketAndPhotosToDelete(null)
        onRefresh() // Refrescar la lista de fotos en el admin
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al eliminar bucket y fotos')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const currentTags = currentPhoto ? (photoTags[currentPhoto.id] || []) : []
  const currentText = currentPhoto ? (photoTexts[currentPhoto.id] || '') : ''

  // Renderizar botones de buckets (siempre visibles)
  const renderBucketsButtons = () => (
    <div className="flex gap-2 items-center flex-shrink-0 px-2">
      {[0, 1, 2, 3, 4].map(index => {
        const bucket = buckets[index]
        const isActive = bucket && bucket.id === activeBucketId
        const isEmpty = !bucket
        const isAwaitingConfirmation = bucket && bucketToDelete === bucket.id
        const wasDeleted = bucket && deletedBucketFeedback === bucket.id

        return (
          <div key={index} className="relative flex items-center gap-1">
            <button
              onClick={() => bucket && handleChangeBucket(bucket.id)}
              disabled={isEmpty}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                wasDeleted
                  ? 'bg-red-500 text-white'
                  : isActive
                  ? 'bg-blue-600 text-white'
                  : isEmpty
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Bucket {index + 1}
              {bucket && ` (${bucket.photos.length})`}
            </button>
            {bucket && (
              isAwaitingConfirmation ? (
                <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-lg">
                  <span className="text-xs text-red-600 dark:text-red-400">¿Eliminar?</span>
                  <button
                    onClick={() => handleDeleteBucket(bucket.id)}
                    className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setBucketToDelete(null)}
                    className="text-xs px-2 py-0.5 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setBucketToDelete(bucket.id)
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Vaciar bucket (las fotos subidas no se eliminan)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )
            )}
          </div>
        )
      })}
      {/* Botón para eliminar bucket activo y todas sus fotos del sistema */}
      {activeBucketId && (
        <div className="relative">
          {bucketAndPhotosToDelete === activeBucketId ? (
            <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-lg">
              <span className="text-xs text-red-600 dark:text-red-400">¿Eliminar todo?</span>
              <button
                onClick={() => handleDeleteBucketAndPhotos(activeBucketId)}
                className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sí
              </button>
              <button
                onClick={() => setBucketAndPhotosToDelete(null)}
                className="text-xs px-2 py-0.5 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setBucketAndPhotosToDelete(activeBucketId)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1"
              title="Eliminar bucket y todas las fotos del sistema"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar bucket y su contenido
            </button>
          )}
        </div>
      )}
    </div>
  )

  // Si no hay fotos subidas, mostrar área de drop
  if (uploadedPhotos.length === 0) {
    return (
      <div className="h-full flex flex-col py-2 gap-3">
        {/* Sub-header: Botones de Buckets */}
        {renderBucketsButtons()}

        {/* Área de drop */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600 dark:text-gray-300">Subiendo fotos...</span>
              </div>
            ) : (
              <>
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-3">Arrastra las fotos aquí</p>
                <p className="text-sm text-gray-400 mb-4">o</p>
                <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                  Seleccionar archivos
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Vista de edición de fotos
  return (
    <div className="h-full flex flex-col py-2 gap-3">
      {/* Sub-header: Botones de Buckets */}
      {renderBucketsButtons()}

      {/* Carrusel de fotos */}
      <PhotoCarousel
        photos={uploadedPhotos}
        currentIndex={currentIndex}
        onSelectPhoto={async (newIndex) => {
          await handleSaveCurrentPhoto(false)
          setCurrentIndex(newIndex)
        }}
      />

      {/* Área superior: foto con flechas + descripción */}
      <div className="flex gap-4 flex-shrink-0" style={{ height: '40%' }}>
        {/* Flecha izquierda */}
        <button
          onClick={goToPrev}
          className={`p-2 rounded-full transition-all duration-300 self-center ${
            arrowFeedback === 'prev'
              ? 'text-green-500 bg-green-100 dark:bg-green-900/30'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Foto con zoom */}
        <ZoomableImage src={currentPhoto?.url} alt={currentText} />

        {/* Flecha derecha */}
        <button
          onClick={goToNext}
          className={`p-2 rounded-full transition-all duration-300 self-center ${
            arrowFeedback === 'next'
              ? 'text-green-500 bg-green-100 dark:bg-green-900/30'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Descripción y controles - ocupa el resto del espacio */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Foto {currentIndex + 1} de {uploadedPhotos.length}
            </span>
            <label className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
              + Agregar fotos
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </label>
          </div>
          <textarea
            value={currentText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Descripción de la foto..."
            rows={3}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
          />
          <button
            onClick={() => handleSaveCurrentPhoto(true)}
            disabled={saving}
            className={`w-full px-4 py-2 rounded-lg transition-all duration-300 ${
              savedFeedback
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            } disabled:opacity-50`}
          >
            {saving ? 'Guardando...' : savedFeedback ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Área inferior: 4 secciones de tags - Tipo más pequeño, otros más grandes */}
      <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns: '1fr 2fr 2fr 2fr' }}>
        {tagGroups.map((group) => (
          <TagSection
            key={group.id}
            group={group}
            selectedTags={currentTags}
            onTagToggle={handleTagToggle}
            onCreateTag={(name) => handleCreateTag(group.id, name)}
          />
        ))}
      </div>
    </div>
  )
}

// ==================
// Zoomable Image - Imagen con zoom y drag
// ==================
function ZoomableImage({ src, alt }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Resetear cuando cambia la imagen
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [src])

  // Event listener para wheel con { passive: false } para evitar error de consola
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setScale(prev => Math.min(Math.max(prev + delta, 1), 5))
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    } else {
      setScale(2)
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-full bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 relative"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
    >
      {src && (
        <img
          src={src}
          alt={alt}
          className="h-full w-auto max-w-md object-contain select-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          draggable={false}
        />
      )}
      {/* Indicador de zoom */}
      {scale > 1 && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
          {Math.round(scale * 100)}% (doble click para resetear)
        </div>
      )}
      {scale === 1 && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity">
          Rueda del mouse para zoom
        </div>
      )}
    </div>
  )
}

// ==================
// Photo Carousel - Carrusel de fotos con drag & drop para reordenar
// ==================
function PhotoCarousel({ photos, currentIndex, onSelectPhoto, disableRepeat = false, onReorder }) {
  const carouselRef = useRef(null)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragJustEnded = useRef(false)

  const THUMBNAIL_SIZE = 120

  const handlePrevious = () => {
    // Navegar a la foto anterior en ciclo
    const newIndex = currentIndex === 0 ? photos.length - 1 : currentIndex - 1
    onSelectPhoto(newIndex)
    // Scroll para centrar la foto seleccionada
    setTimeout(() => {
      if (carouselRef.current) {
        const targetPosition = newIndex * THUMBNAIL_SIZE - carouselRef.current.offsetWidth / 2 + THUMBNAIL_SIZE / 2
        carouselRef.current.scrollTo({ left: targetPosition, behavior: 'smooth' })
      }
    }, 0)
  }

  const handleNext = () => {
    // Navegar a la foto siguiente en ciclo
    const newIndex = currentIndex === photos.length - 1 ? 0 : currentIndex + 1
    onSelectPhoto(newIndex)
    // Scroll para centrar la foto seleccionada
    setTimeout(() => {
      if (carouselRef.current) {
        const targetPosition = newIndex * THUMBNAIL_SIZE - carouselRef.current.offsetWidth / 2 + THUMBNAIL_SIZE / 2
        carouselRef.current.scrollTo({ left: targetPosition, behavior: 'smooth' })
      }
    }, 0)
  }

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    if (!onReorder) return
    setDraggedIndex(index)
    dragJustEnded.current = false
    e.dataTransfer.effectAllowed = 'move'
    // Crear imagen fantasma personalizada
    const dragImage = e.target.cloneNode(true)
    dragImage.style.opacity = '0.5'
    e.dataTransfer.setDragImage(e.target, 60, 60)
  }

  const handleDragOver = (e, index) => {
    if (!onReorder || draggedIndex === null) return
    e.preventDefault()
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    dragJustEnded.current = true
    setTimeout(() => { dragJustEnded.current = false }, 100)
  }

  const handleDrop = (e, dropIndex) => {
    if (!onReorder || draggedIndex === null || draggedIndex === dropIndex) return
    e.preventDefault()
    onReorder(draggedIndex, dropIndex)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  if (!photos || photos.length === 0) {
    return null
  }

  // Solo triplicar si hay suficientes fotos para scroll continuo y no está deshabilitada la repetición
  // Pero si hay drag & drop, no triplicar para evitar confusiones
  const displayPhotos = (!disableRepeat && photos.length >= 5 && !onReorder)
    ? [...photos, ...photos, ...photos]
    : photos

  // Si hay drag & drop, mostrar solo las fotos originales una vez
  const photosToRender = onReorder ? photos : displayPhotos

  return (
    <div className="relative w-full bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Flecha izquierda - siempre visible */}
      <button
        onClick={handlePrevious}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 dark:bg-gray-700/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-600 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Container del carrusel */}
      <div
        ref={carouselRef}
        className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        {photosToRender.map((photo, idx) => {
          const originalIdx = onReorder ? idx : idx % photos.length
          const isDragging = draggedIndex === originalIdx
          const isDragOver = dragOverIndex === originalIdx

          return (
            <div
              key={`${photo.id}-${idx}`}
              draggable={!!onReorder}
              onDragStart={(e) => handleDragStart(e, originalIdx)}
              onDragOver={(e) => handleDragOver(e, originalIdx)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, originalIdx)}
              onClick={() => { if (!dragJustEnded.current) onSelectPhoto(originalIdx) }}
              className={`flex-shrink-0 overflow-hidden border-2 transition-all relative ${
                originalIdx === currentIndex
                  ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              } ${isDragging ? 'opacity-50' : ''} ${isDragOver && !isDragging ? 'border-orange-500 ring-2 ring-orange-300 dark:ring-orange-700' : ''}`}
              style={{ width: `${THUMBNAIL_SIZE}px`, height: `${THUMBNAIL_SIZE}px`, cursor: onReorder ? 'grab' : 'pointer' }}
            >
              <img
                src={photo.url}
                alt={`Foto ${originalIdx + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
                style={{ cursor: onReorder ? 'grab' : 'pointer' }}
              />
              {onReorder && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors pointer-events-none">
                  <svg className="w-6 h-6 text-white opacity-0 hover:opacity-100 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Flecha derecha - siempre visible */}
      <button
        onClick={handleNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 dark:bg-gray-700/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-600 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

// ==================
// Tag Section - Sección individual de tags
// ==================
function TagSection({ group, selectedTags, onTagToggle, onCreateTag, onFilterMissing, filterGroupActive }) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  // Ordenar tags alfabéticamente
  const sortedTags = [...group.tags].sort((a, b) => a.name.localeCompare(b.name))

  // Filtrar por búsqueda
  const filteredTags = search
    ? sortedTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : sortedTags

  // Verificar si el search es un tag nuevo
  const searchMatchesExisting = sortedTags.some(
    t => t.name.toLowerCase() === search.toLowerCase()
  )
  const canCreate = search.trim() && !searchMatchesExisting

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true)
    await onCreateTag(search.trim())
    setSearch('')
    setCreating(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canCreate) {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header con nombre del grupo y botón de filtro */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{group.name}</h3>
        {onFilterMissing && (
          <button
            onClick={() => onFilterMissing(filterGroupActive ? null : group.id)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              filterGroupActive
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
            }`}
            title={filterGroupActive ? 'Mostrar todas las fotos' : 'Filtrar fotos sin tags de este grupo'}
          >
            {filterGroupActive ? '✓ Todo' : 'Filtrar'}
          </button>
        )}
      </div>

      {/* Input de búsqueda/creación */}
      <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="flex gap-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar o crear..."
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {canCreate && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {creating ? '...' : '+'}
            </button>
          )}
        </div>
      </div>

      {/* Lista de tags con scroll */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-wrap gap-1">
          {filteredTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => onTagToggle(tag.id)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500'
                }`}
              >
                {capitalize(tag.name)}
              </button>
            )
          })}
          {filteredTags.length === 0 && !canCreate && (
            <p className="text-xs text-gray-400 italic">Sin tags</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================
// Manage Photos - Administrar fotos existentes (misma interfaz que Upload)
// ==================
function ManagePhotos({ photos, tagGroups, authParams, onRefresh, showSuccess, showError, showConfirm, setPendingSave }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoTags, setPhotoTags] = useState({})
  const [photoTexts, setPhotoTexts] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [arrowFeedback, setArrowFeedback] = useState(null)
  const saveTimeout = useRef(null)
  const [showOnlyUntagged, setShowOnlyUntagged] = useState(false)
  const [filterMissingGroup, setFilterMissingGroup] = useState(null) // ID del grupo para filtrar fotos sin tags de ese grupo
  const [searchQuery, setSearchQuery] = useState('')
  const currentPhotoRef = useRef(null) // Para evitar que la foto actual desaparezca del filtro

  // Filtrar fotos por búsqueda y tags
  let filteredPhotos = photos

  // Filtrar por búsqueda de texto y tags (ignorando acentos)
  if (searchQuery) {
    const normalizedQuery = normalizeText(searchQuery.trim())

    filteredPhotos = filteredPhotos.filter(photo => {
      // Buscar en el texto de descripción
      const photoText = photoTexts[photo.id] || photo.text || ''
      if (normalizeText(photoText).includes(normalizedQuery)) {
        return true
      }

      // Buscar en los tags de la foto
      const tags = photoTags[photo.id] || photo.tags || []
      for (const group of tagGroups) {
        for (const tag of group.tags) {
          if (tags.includes(tag.id)) {
            // Matchear si el nombre del tag contiene la búsqueda (sin acentos)
            if (normalizeText(tag.name).includes(normalizedQuery)) {
              return true
            }
          }
        }
      }

      return false
    })
  }

  // Filtrar fotos sin tags si está activo el filtro
  if (showOnlyUntagged) {
    filteredPhotos = filteredPhotos.filter(p => {
      // No filtrar la foto actual que se está editando (usando ref para evitar ciclos)
      if (currentPhotoRef.current && p.id === currentPhotoRef.current.id) return true
      const tags = photoTags[p.id] || p.tags || []
      return tags.length === 0
    })
  }

  // Filtrar fotos sin tags de un grupo específico
  if (filterMissingGroup) {
    const group = tagGroups.find(g => g.id === filterMissingGroup)
    if (group) {
      const groupTagIds = group.tags.map(t => t.id)
      filteredPhotos = filteredPhotos.filter(p => {
        // No filtrar la foto actual que se está editando
        if (currentPhotoRef.current && p.id === currentPhotoRef.current.id) return true
        const tags = photoTags[p.id] || p.tags || []
        // Ver si la foto tiene algún tag de este grupo
        const hasTagFromGroup = tags.some(t => groupTagIds.includes(t))
        return !hasTagFromGroup // Mostrar solo las que NO tienen tags del grupo
      })
    }
  }

  const currentPhoto = filteredPhotos[currentIndex]

  // Actualizar ref cuando cambia la foto actual (no causa re-render)
  useEffect(() => {
    currentPhotoRef.current = currentPhoto
  }, [currentPhoto])

  // Inicializar datos cuando cambian las fotos (sin sobrescribir los locales)
  useEffect(() => {
    setPhotoTags(prev => {
      const tags = { ...prev }
      photos.forEach(p => {
        // Solo inicializar si no existe en el estado local
        if (!(p.id in tags)) {
          tags[p.id] = p.tags || []
        }
      })
      return tags
    })
    setPhotoTexts(prev => {
      const texts = { ...prev }
      photos.forEach(p => {
        // Solo inicializar si no existe en el estado local
        if (!(p.id in texts)) {
          texts[p.id] = p.text || ''
        }
      })
      return texts
    })
  }, [photos])

  // Registrar función de guardado para cuando se cambie de tab
  useEffect(() => {
    if (currentPhoto && setPendingSave) {
      setPendingSave(() => () => handleSaveCurrentPhoto(false))
    }
    return () => setPendingSave && setPendingSave(null)
  }, [currentPhoto, photoTags, photoTexts])

  const handleTagToggle = (tagId) => {
    if (!currentPhoto) return
    setPhotoTags(prev => {
      const current = prev[currentPhoto.id] || []
      const newTags = current.includes(tagId)
        ? current.filter(t => t !== tagId)
        : [...current, tagId]
      return { ...prev, [currentPhoto.id]: newTags }
    })
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => handleSaveCurrentPhoto(false), 1000)
  }

  const handleTextChange = (text) => {
    if (!currentPhoto) return
    setPhotoTexts(prev => ({ ...prev, [currentPhoto.id]: text }))
  }

  const handleCreateTag = async (groupId, tagName) => {
    try {
      const response = await fetch(apiUrl('admin/tags'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, name: tagName, ...authParams })
      })

      if (response.ok) {
        const newTag = await response.json()
        // Auto-seleccionar el nuevo tag SIN perder los anteriores
        if (currentPhoto) {
          setPhotoTags(prev => ({
            ...prev,
            [currentPhoto.id]: [...(prev[currentPhoto.id] || []), newTag.id]
          }))
        }
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => handleSaveCurrentPhoto(false), 1000)
        // Refrescar tags después de actualizar el estado local
        onRefresh()
        return newTag
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      }
    } catch (error) {
      showError('Error', 'Error al crear tag')
    }
    return null
  }

  const handleSaveCurrentPhoto = async (showFeedback = true) => {
    if (!currentPhoto) return

    setSaving(true)
    try {
      const response = await fetch(apiUrl(`admin/photos/${currentPhoto.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: photoTexts[currentPhoto.id] || '',
          tags: photoTags[currentPhoto.id] || [],
          ...authParams
        })
      })

      if (response.ok && showFeedback) {
        setSavedFeedback(true)
        setTimeout(() => setSavedFeedback(false), 1000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      }
    } catch (error) {
      showError('Error', 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePhoto = () => {
    if (!currentPhoto) return
    showConfirm('Eliminar foto', '¿Eliminar esta foto permanentemente?', async () => {
      try {
        const response = await fetch(apiUrl(`admin/photos/${currentPhoto.id}`), {
          method: 'DELETE'
        })
        if (response.ok) {
          // Ajustar índice si estamos en la última foto
          if (currentIndex >= photos.length - 1 && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1)
          }
          onRefresh()
        } else if (response.status === 401) {
          showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
        }
      } catch (error) {
        showError('Error', 'Error de conexión')
      }
    })
  }

  const handleReorder = async (fromIndex, toIndex) => {
    try {
      // Crear nuevo array con las fotos reordenadas
      const newPhotos = [...filteredPhotos]
      const [movedPhoto] = newPhotos.splice(fromIndex, 1)
      newPhotos.splice(toIndex, 0, movedPhoto)

      // Enviar nuevo orden al backend
      const photoIds = newPhotos.map(p => p.id)
      const response = await fetch(apiUrl('admin/photos/reorder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_ids: photoIds,
          ...authParams
        })
      })

      if (response.ok) {
        // Actualizar índice actual si es necesario
        if (currentIndex === fromIndex) {
          setCurrentIndex(toIndex)
        } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
          setCurrentIndex(currentIndex - 1)
        } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
          setCurrentIndex(currentIndex + 1)
        }
        // Refrescar fotos desde el servidor
        onRefresh()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        showError('Error', 'Error al reordenar fotos')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const goToPrev = async () => {
    await handleSaveCurrentPhoto(false)
    setArrowFeedback('prev')
    setTimeout(() => setArrowFeedback(null), 500)
    // Limpiar ref al cambiar explícitamente
    currentPhotoRef.current = null
    // Continuo: si está en la primera, va a la última
    setCurrentIndex(currentIndex === 0 ? filteredPhotos.length - 1 : currentIndex - 1)
  }

  const goToNext = async () => {
    await handleSaveCurrentPhoto(false)
    setArrowFeedback('next')
    setTimeout(() => setArrowFeedback(null), 500)
    // Limpiar ref al cambiar explícitamente
    currentPhotoRef.current = null
    // Continuo: si está en la última, va a la primera
    setCurrentIndex(currentIndex === filteredPhotos.length - 1 ? 0 : currentIndex + 1)
  }

  // Manejar teclas de flecha del teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, filteredPhotos.length])

  const currentTags = currentPhoto ? (photoTags[currentPhoto.id] || []) : []
  const currentText = currentPhoto ? (photoTexts[currentPhoto.id] || '') : ''

  if (photos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>No hay fotos en el catálogo</p>
          <p className="text-sm mt-2">Usa "Subir fotos" para agregar fotos</p>
        </div>
      </div>
    )
  }

  if (filteredPhotos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>No hay fotos sin etiquetar</p>
          <button
            onClick={() => {
              setShowOnlyUntagged(false)
              setFilterMissingGroup(null)
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Mostrar todas las fotos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col py-2 gap-3">
      {/* Carrusel de fotos */}
      <PhotoCarousel
        photos={filteredPhotos}
        currentIndex={currentIndex}
        disableRepeat={showOnlyUntagged || filterMissingGroup !== null} // No repetir fotos en modo filtro
        onSelectPhoto={async (newIndex) => {
          await handleSaveCurrentPhoto(false)
          currentPhotoRef.current = null // Limpiar ref al cambiar explícitamente
          setCurrentIndex(newIndex)
        }}
        onReorder={handleReorder}
      />

      {/* Área superior: foto con flechas + descripción */}
      <div className="flex gap-4 flex-shrink-0" style={{ height: '40%' }}>
        {/* Flecha izquierda */}
        <button
          onClick={goToPrev}
          className={`p-2 rounded-full transition-all duration-300 self-center ${
            arrowFeedback === 'prev'
              ? 'text-green-500 bg-green-100 dark:bg-green-900/30'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Foto con zoom */}
        <ZoomableImage src={currentPhoto?.url} alt={currentText} />

        {/* Flecha derecha */}
        <button
          onClick={goToNext}
          className={`p-2 rounded-full transition-all duration-300 self-center ${
            arrowFeedback === 'next'
              ? 'text-green-500 bg-green-100 dark:bg-green-900/30'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Controles y Tags de Encabado */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Foto {currentIndex + 1} de {filteredPhotos.length}
            </span>
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={(value) => {
                  setSearchQuery(value)
                  setCurrentIndex(0)
                  currentPhotoRef.current = null // Limpiar ref al cambiar búsqueda
                }}
                placeholder="Buscar..."
              />
            </div>
            <button
              onClick={() => {
                setShowOnlyUntagged(!showOnlyUntagged)
                setCurrentIndex(0)
                currentPhotoRef.current = null // Limpiar ref al cambiar filtro
              }}
              className={`px-3 py-1 text-sm rounded-lg transition-colors whitespace-nowrap ${
                showOnlyUntagged
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {showOnlyUntagged ? 'Mostrar todas' : 'Fotos sin tag'}
            </button>
            <button
              onClick={handleDeletePhoto}
              className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900 whitespace-nowrap"
            >
              Eliminar foto
            </button>
          </div>
          {/* Sección de tags Encabado */}
          <div className="flex-1 min-h-0">
            {tagGroups.filter(g => g.id === 'encabado').map((group) => (
              <TagSection
                key={group.id}
                group={group}
                selectedTags={currentTags}
                onTagToggle={handleTagToggle}
                onCreateTag={(name) => handleCreateTag(group.id, name)}
                onFilterMissing={(groupId) => {
                  setFilterMissingGroup(groupId)
                  setCurrentIndex(0)
                  currentPhotoRef.current = null // Limpiar ref al cambiar filtro
                }}
                filterGroupActive={filterMissingGroup === group.id}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Área inferior: 3 secciones de tags - Tipo pequeño, Extras y Acero más grandes */}
      <div className="flex-1 grid gap-3 min-h-0" style={{ gridTemplateColumns: '1fr 3fr 3fr' }}>
        {tagGroups.filter(g => g.id !== 'encabado').map((group) => (
          <TagSection
            key={group.id}
            group={group}
            selectedTags={currentTags}
            onTagToggle={handleTagToggle}
            onCreateTag={(name) => handleCreateTag(group.id, name)}
            onFilterMissing={(groupId) => {
              setFilterMissingGroup(groupId)
              setCurrentIndex(0)
              currentPhotoRef.current = null // Limpiar ref al cambiar filtro
            }}
            filterGroupActive={filterMissingGroup === group.id}
          />
        ))}
      </div>
    </div>
  )
}

// ==================
// Tags Manager - Gestión de tags
// ==================
function TagsManager({ tagGroups, authParams, onRefresh, showSuccess, showError, showConfirm }) {
  const [newTagName, setNewTagName] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [editingGroup, setEditingGroup] = useState(null)
  const [editingTag, setEditingTag] = useState(null) // { groupId, tagId, name }
  const [confirmingDelete, setConfirmingDelete] = useState(null) // { groupId, tagId, tagName }
  const [draggedTag, setDraggedTag] = useState(null) // { groupId, tagId, index }

  // Manejar tecla Escape para cancelar confirmación
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && confirmingDelete) {
        setConfirmingDelete(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [confirmingDelete])

  const handleCreateTag = async (e) => {
    e.preventDefault()
    if (!newTagName.trim() || !selectedGroup) return

    try {
      const response = await fetch(apiUrl('admin/tags'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: selectedGroup, name: newTagName, ...authParams })
      })

      if (response.ok) {
        showSuccess('Creado', 'Tag creado correctamente')
        setNewTagName('')
        onRefresh()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al crear')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleDeleteTag = async (groupId, tagId) => {
    try {
      const response = await fetch(apiUrl(`admin/tags/${groupId}/${tagId}`), {
        method: 'DELETE'
      })
      if (response.ok) {
        setConfirmingDelete(null)
        onRefresh()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleRenameGroup = async () => {
    if (!editingGroup) return

    try {
      const response = await fetch(apiUrl(`admin/tag-groups/${editingGroup.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingGroup.name, ...authParams })
      })

      if (response.ok) {
        showSuccess('Actualizado', 'Grupo renombrado')
        setEditingGroup(null)
        onRefresh()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleRenameTag = async () => {
    if (!editingTag) return

    try {
      const response = await fetch(apiUrl(`admin/tags/${editingTag.groupId}/${editingTag.tagId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTag.name })
      })

      if (response.ok) {
        showSuccess('Actualizado', 'Tag renombrado')
        setEditingTag(null)
        onRefresh()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al renombrar tag')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleDragStart = (groupId, tagId, index) => {
    setDraggedTag({ groupId, tagId, index })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (groupId, dropIndex) => {
    if (!draggedTag || draggedTag.groupId !== groupId) return

    const group = tagGroups.find(g => g.id === groupId)
    if (!group) return

    const tags = [...group.tags]
    const [draggedItem] = tags.splice(draggedTag.index, 1)
    tags.splice(dropIndex, 0, draggedItem)

    try {
      const response = await fetch(apiUrl(`admin/tag-groups/${groupId}/reorder`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_order: tags.map(t => t.id) })
      })

      if (response.ok) {
        onRefresh()
      } else {
        showError('Error', 'Error al reordenar tags')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setDraggedTag(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto py-4 space-y-6">
      {/* Create Tag */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Crear nuevo tag</h2>
        <form onSubmit={handleCreateTag} className="flex gap-4">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          >
            <option value="">Seleccionar grupo</option>
            {tagGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Nombre del tag"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          />
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Crear
          </button>
        </form>
      </div>

      {/* Tag Groups */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tagGroups.map(group => (
          <div key={group.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
              <button
                onClick={() => setEditingGroup({ ...group })}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Renombrar
              </button>
            </div>

            {group.tags.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sin tags</p>
            ) : (
              <div className="space-y-1 max-h-[345px] overflow-y-auto">
                {(group.id === 'tipo' ? group.tags : [...group.tags].sort((a, b) => a.name.localeCompare(b.name))).map((tag, index) => {
                  const isConfirming = confirmingDelete?.tagId === tag.id && confirmingDelete?.groupId === group.id
                  const isHeaderTag = group.id === 'tipo' && index < 3
                  const isDragging = draggedTag?.tagId === tag.id

                  return (
                    <div
                      key={tag.id}
                      draggable={group.id === 'tipo'}
                      onDragStart={() => handleDragStart(group.id, tag.id, index)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(group.id, index)}
                      className={`flex items-center justify-between py-1 px-2 bg-gray-50 dark:bg-gray-700 rounded ${isDragging ? 'opacity-50' : ''} ${group.id === 'tipo' ? 'cursor-move' : ''}`}
                    >
                      <span className={`text-sm text-gray-700 dark:text-gray-300 ${isHeaderTag ? 'font-bold' : ''}`}>
                        {capitalize(tag.name)}
                      </span>
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteTag(group.id, tag.id)}
                            className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Borrar
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(null)}
                            className="px-2 py-0.5 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingTag({ groupId: group.id, tagId: tag.id, name: tag.name })}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Renombrar
                          </button>
                          <button
                            onClick={() => setConfirmingDelete({ groupId: group.id, tagId: tag.id, tagName: tag.name })}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {group.id === 'tipo' && group.tags.length > 0 && (
                  <>
                    <p className="text-xs text-gray-500 italic mt-2">
                      Los tags se pueden reordenar arrastrándolos a la posición deseada.
                    </p>
                    <p className="text-xs text-gray-500 italic">
                      Los tags en negrita aparecen en el header del frontend (primeras 3 posiciones)
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rename Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingGroup(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Renombrar grupo</h3>
            <input
              type="text"
              value={editingGroup.name}
              onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingGroup(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleRenameGroup} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingTag(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Renombrar tag</h3>
            <input
              type="text"
              value={editingTag.name}
              onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingTag(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleRenameTag} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================
// Configuration - Configuración del sistema (backups, logo)
// ==================
function Configuration({ authParams, showSuccess, showError, onLogoChange, backendTitle, setBackendTitle, loginTitle, setLoginTitle }) {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [backupToDelete, setBackupToDelete] = useState(null)
  const [deletingBackup, setDeletingBackup] = useState(null) // Filename del backup siendo eliminado (para fade out)
  const [createdBackupFeedback, setCreatedBackupFeedback] = useState(null) // Filename del backup recién creado
  const [logo, setLogo] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [caratula, setCaratula] = useState(null)
  const [uploadingCaratula, setUploadingCaratula] = useState(false)

  // Estado para título y subtítulo del sitio
  const [siteTitle, setSiteTitle] = useState('PEU Cuchillos Artesanales')
  const [siteSubtitleMobile, setSiteSubtitleMobile] = useState('Buscador interactivo')
  const [siteSubtitleDesktop, setSiteSubtitleDesktop] = useState('Buscador interactivo de modelos y materiales')
  const [savingSiteInfo, setSavingSiteInfo] = useState(false)
  const [savedSiteInfoFeedback, setSavedSiteInfoFeedback] = useState(false)

  // Estado para WhatsApp y Telegram
  const [whatsappConfig, setWhatsappConfig] = useState({ enabled: false, number: '', message: '', catalog_message: '' })
  const [telegramConfig, setTelegramConfig] = useState({ enabled: false, username: '', message: '', catalog_message: '' })
  const [savingContact, setSavingContact] = useState(false)
  const [savedContactFeedback, setSavedContactFeedback] = useState(false)

  // Estado para Headers (visibilidad de grupos y selectores)
  const [headersConfig, setHeadersConfig] = useState({
    showTypeGroups: true,
    showSelectors: true,
    showThumbnails: true,
    showTags: true
  })
  const [savingHeaders, setSavingHeaders] = useState(false)
  const [savedHeadersFeedback, setSavedHeadersFeedback] = useState(false)

  // Estado para metadatos HTML
  const [metaTags, setMetaTags] = useState('')
  const [savingMetaTags, setSavingMetaTags] = useState(false)
  const [savedMetaTagsFeedback, setSavedMetaTagsFeedback] = useState(false)

  // Estado para mensaje del configurador
  const [configuratorMessage, setConfiguratorMessage] = useState('Hola Pablo, te envío mi página del configurador de cuchillos: {link}')
  const [savingConfiguratorMessage, setSavingConfiguratorMessage] = useState(false)
  const [savedConfiguratorMessageFeedback, setSavedConfiguratorMessageFeedback] = useState(false)

  // Estado para footer
  const [footerConfig, setFooterConfig] = useState({
    enabled: false,
    website_url: '',
    website_text: 'Visita mi página web',
    social_text: 'Seguime en mis redes sociales',
    instagram: '',
    twitter: '',
    facebook: ''
  })
  const [savingFooter, setSavingFooter] = useState(false)
  const [savedFooterFeedback, setSavedFooterFeedback] = useState(false)

  // Estado para instrucciones
  const [instructionsConfig, setInstructionsConfig] = useState({
    enabled: false,
    text: ''
  })
  const [savingInstructions, setSavingInstructions] = useState(false)
  const [savedInstructionsFeedback, setSavedInstructionsFeedback] = useState(false)

  // Estado para instrucciones del configurador
  const [configuratorInstructions, setConfiguratorInstructions] = useState({
    enabled: false,
    text: ''
  })
  const [savingConfiguratorInstructions, setSavingConfiguratorInstructions] = useState(false)
  const [savedConfiguratorInstructionsFeedback, setSavedConfiguratorInstructionsFeedback] = useState(false)

  useEffect(() => {
    loadBackups()
    loadConfig()
    loadContactConfig()
    loadHeadersConfig()
    loadMetaTags()
    loadConfiguratorMessage()
    loadFooterConfig()
    loadInstructionsConfig()
    loadConfiguratorInstructionsConfig()
    loadSiteInfo()
  }, [])

  const loadBackups = async () => {
    setLoading(true)
    try {
      const response = await fetch(apiUrl('admin/backups'))
      if (response.ok) {
        const data = await response.json()
        setBackups(data.backups || [])
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      }
    } catch (error) {
      showError('Error', 'Error al cargar backups')
    } finally {
      setLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      const response = await fetch(apiUrl('config'))
      if (response.ok) {
        const data = await response.json()
        setLogo(data.logo || null)
        setCaratula(data.caratula || null)
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const loadContactConfig = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/contact'))
      if (response.ok) {
        const data = await response.json()
        setWhatsappConfig(data.whatsapp || { enabled: false, number: '', message: '', catalog_message: '' })
        setTelegramConfig(data.telegram || { enabled: false, username: '', message: '', catalog_message: '' })
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const loadHeadersConfig = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/headers'))
      if (response.ok) {
        const data = await response.json()
        setHeadersConfig(data.headers || { showTypeGroups: true, showSelectors: true, showThumbnails: true, showTags: true })
      }
    } catch (error) {
      // Error silencioso - usar valores por defecto
    }
  }

  const loadMetaTags = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/metatags'))
      if (response.ok) {
        const data = await response.json()
        setMetaTags(data.meta_tags || '')
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const loadConfiguratorMessage = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/configurator'))
      if (response.ok) {
        const data = await response.json()
        setConfiguratorMessage(data.configurator_message || 'Hola Pablo, te envío mi página del configurador de cuchillos: {link}')
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const loadFooterConfig = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/footer'))
      if (response.ok) {
        const data = await response.json()
        setFooterConfig(data.footer || {
          enabled: false,
          website_url: '',
          website_text: 'Visita mi página web',
          social_text: 'Seguime en mis redes sociales',
          instagram: '',
          twitter: '',
          facebook: '',
          whatsapp: '',
          telegram: ''
        })
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const loadSiteInfo = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/site-info'))
      if (response.ok) {
        const data = await response.json()
        setSiteTitle(data.site_title || 'PEU Cuchillos Artesanales')
        setSiteSubtitleMobile(data.site_subtitle_mobile || 'Buscador interactivo')
        setSiteSubtitleDesktop(data.site_subtitle_desktop || 'Buscador interactivo de modelos y materiales')
        setBackendTitle(data.backend_title || 'Admin')
        setLoginTitle(data.login_title || data.backend_title || 'Admin')
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const handleSaveMetaTags = async () => {
    setSavingMetaTags(true)
    try {
      const response = await fetch(apiUrl('admin/config/metatags'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta_tags: metaTags })
      })

      if (response.ok) {
        setSavedMetaTagsFeedback(true)
        setTimeout(() => setSavedMetaTagsFeedback(false), 2000)
        // Recargar metadatos para actualizar el estado y limpiar avisos de conflicto
        await loadMetaTags()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar metadatos')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingMetaTags(false)
    }
  }

  const handleSaveConfiguratorMessage = async () => {
    setSavingConfiguratorMessage(true)
    try {
      const response = await fetch(apiUrl('admin/config/configurator'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurator_message: configuratorMessage })
      })

      if (response.ok) {
        setSavedConfiguratorMessageFeedback(true)
        setTimeout(() => setSavedConfiguratorMessageFeedback(false), 2000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar mensaje')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingConfiguratorMessage(false)
    }
  }

  const handleSaveFooter = async () => {
    setSavingFooter(true)
    try {
      const response = await fetch(apiUrl('admin/config/footer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ footer: footerConfig })
      })

      if (response.ok) {
        setSavedFooterFeedback(true)
        setTimeout(() => setSavedFooterFeedback(false), 2000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar footer')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingFooter(false)
    }
  }

  const loadInstructionsConfig = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/instructions'))
      if (response.ok) {
        const data = await response.json()
        setInstructionsConfig(data.instructions || {
          enabled: false,
          text: ''
        })
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const handleSaveInstructions = async () => {
    setSavingInstructions(true)
    try {
      const response = await fetch(apiUrl('admin/config/instructions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: instructionsConfig })
      })

      if (response.ok) {
        setSavedInstructionsFeedback(true)
        setTimeout(() => setSavedInstructionsFeedback(false), 2000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar instrucciones')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingInstructions(false)
    }
  }

  const loadConfiguratorInstructionsConfig = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/configurator-instructions'))
      if (response.ok) {
        const data = await response.json()
        setConfiguratorInstructions(data.configurator_instructions)
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const handleSaveConfiguratorInstructions = async () => {
    setSavingConfiguratorInstructions(true)
    try {
      const response = await fetch(apiUrl('admin/config/configurator-instructions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurator_instructions: configuratorInstructions })
      })

      if (response.ok) {
        setSavedConfiguratorInstructionsFeedback(true)
        setTimeout(() => setSavedConfiguratorInstructionsFeedback(false), 2000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar instrucciones')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingConfiguratorInstructions(false)
    }
  }

  const handleSaveSiteInfo = async () => {
    setSavingSiteInfo(true)
    try {
      const response = await fetch(apiUrl('admin/config/site-info'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_title: siteTitle,
          site_subtitle_mobile: siteSubtitleMobile,
          site_subtitle_desktop: siteSubtitleDesktop,
          backend_title: backendTitle,
          login_title: loginTitle
        })
      })

      if (response.ok) {
        setSavedSiteInfoFeedback(true)
        setTimeout(() => setSavedSiteInfoFeedback(false), 2000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar información del sitio')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingSiteInfo(false)
    }
  }

  const handleCreateBackup = async () => {
    if (backups.length >= 5) {
      showError('Límite alcanzado', 'Debes eliminar un backup antes de crear uno nuevo')
      return
    }

    setCreating(true)
    try {
      const response = await fetch(apiUrl('admin/backups'), {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        const newBackupFilename = data.backup?.filename

        // Feedback visual
        if (newBackupFilename) {
          setCreatedBackupFeedback(newBackupFilename)
          setTimeout(() => setCreatedBackupFeedback(null), 2000)
        }

        await loadBackups()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        const errorMsg = error.details
          ? `${error.error}\n\nDetalles: ${error.details}\n\nComando: ${error.command || 'N/A'}`
          : error.error || 'Error al crear backup'
        showError('Error al crear backup', errorMsg)
      }
    } catch (error) {
      showError('Error', 'Error de conexión: ' + error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDownloadBackup = async (filename) => {
    try {
      const response = await fetch(apiUrl(`admin/backups/${filename}`))
      if (!response.ok) {
        showError('Error', response.status === 401 ? 'Sesión expirada' : 'No se pudo descargar el backup')
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleDeleteBackup = async (filename) => {
    // Activar animación fade out
    setDeletingBackup(filename)
    setBackupToDelete(null)

    // Esperar animación antes de eliminar
    setTimeout(async () => {
      try {
        const response = await fetch(apiUrl(`admin/backups/${filename}`), {
          method: 'DELETE'
        })

        if (response.ok) {
          await loadBackups()
          setDeletingBackup(null)
        } else if (response.status === 401) {
          showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
          setDeletingBackup(null)
        } else {
          showError('Error', 'Error al eliminar backup')
          setDeletingBackup(null)
        }
      } catch (error) {
        showError('Error', 'Error de conexión')
        setDeletingBackup(null)
      }
    }, 400) // 400ms para la animación
  }

  const handleUploadLogo = async (file) => {
    if (!file) return

    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      formData.append('auth_user', authParams.auth_user)
      formData.append('auth_pass', authParams.auth_pass)

      const response = await fetch(apiUrl('admin/config/logo'), {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setLogo(data.logo)
        // Notificar al componente padre para que actualice el logo en el header público
        if (onLogoChange) onLogoChange()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al subir logo')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleDeleteLogo = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/logo'), {
        method: 'DELETE'
      })

      if (response.ok) {
        setLogo(null)
        // Notificar al componente padre para que actualice el logo en el header público
        if (onLogoChange) onLogoChange()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        showError('Error', 'Error al eliminar logo')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleUploadCaratula = async (file) => {
    if (!file) return

    setUploadingCaratula(true)
    try {
      const formData = new FormData()
      formData.append('caratula', file)
      formData.append('auth_user', authParams.auth_user)
      formData.append('auth_pass', authParams.auth_pass)

      const response = await fetch(apiUrl('admin/config/caratula'), {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setCaratula(data.caratula)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al subir carátula')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setUploadingCaratula(false)
    }
  }

  const handleDeleteCaratula = async () => {
    try {
      const response = await fetch(apiUrl('admin/config/caratula'), {
        method: 'DELETE'
      })

      if (response.ok) {
        setCaratula(null)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        showError('Error', 'Error al eliminar carátula')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    }
  }

  const handleSaveContactConfig = async () => {
    setSavingContact(true)
    try {
      const response = await fetch(apiUrl('admin/config/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: whatsappConfig,
          telegram: telegramConfig
        })
      })

      if (response.ok) {
        setSavedContactFeedback(true)
        setTimeout(() => setSavedContactFeedback(false), 2000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar configuración')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingContact(false)
    }
  }

  const handleSaveHeadersConfig = async () => {
    setSavingHeaders(true)
    try {
      const response = await fetch(apiUrl('admin/config/headers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers: headersConfig
        })
      })

      if (response.ok) {
        setSavedHeadersFeedback(true)
        setTimeout(() => setSavedHeadersFeedback(false), 2000)
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al guardar configuración')
      }
    } catch (error) {
      showError('Error', 'Error de conexión')
    } finally {
      setSavingHeaders(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="h-full overflow-y-auto py-4 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Grid de 3 columnas compactas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Sección de Logo y Títulos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Logo y Títulos</h2>

            {/* Logo */}
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              {logo ? (
                <div className="flex items-center gap-2 mb-2">
                  <img src={logo} alt="Logo" className="h-8 object-contain" />
                  <button
                    onClick={handleDeleteLogo}
                    className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900"
                  >
                    Eliminar
                  </button>
                  <label className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                    Cambiar
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadLogo(e.target.files[0])}
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
              ) : (
                <label className="block w-full text-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer text-sm">
                  {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadLogo(e.target.files[0])}
                    disabled={uploadingLogo}
                  />
                </label>
              )}
            </div>

            {/* Títulos compactos */}
            <div className="space-y-2">
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                placeholder="Título del sitio"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={siteSubtitleMobile}
                onChange={(e) => setSiteSubtitleMobile(e.target.value)}
                placeholder="Subtítulo móvil"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={siteSubtitleDesktop}
                onChange={(e) => setSiteSubtitleDesktop(e.target.value)}
                placeholder="Subtítulo escritorio"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={backendTitle}
                onChange={(e) => setBackendTitle(e.target.value)}
                placeholder="Título backend (header)"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={loginTitle}
                onChange={(e) => setLoginTitle(e.target.value)}
                placeholder="Título login (página de inicio)"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleSaveSiteInfo}
                disabled={savingSiteInfo}
                className={`w-full px-3 py-1.5 text-sm rounded transition-all duration-300 ${
                  savedSiteInfoFeedback
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {savingSiteInfo ? 'Guardando...' : savedSiteInfoFeedback ? '✓' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Sección de Mensaje del Configurador - con flex */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Mensaje Configurador</h2>

            <textarea
              value={configuratorMessage}
              onChange={(e) => setConfiguratorMessage(e.target.value)}
              placeholder="Mensaje al compartir configuración..."
              className="flex-1 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />

            <button
              onClick={handleSaveConfiguratorMessage}
              disabled={savingConfiguratorMessage}
              className={`w-full px-3 py-2 text-sm rounded transition-all duration-300 ${
                savedConfiguratorMessageFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingConfiguratorMessage ? 'Guardando...' : savedConfiguratorMessageFeedback ? '✓' : 'Guardar'}
            </button>
          </div>

          {/* Sección de Backups */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Backups</h2>

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handleCreateBackup}
                disabled={creating || backups.length >= 5}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? '...' : 'Crear'}
              </button>
              {backups.length >= 5 && (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Límite: 5 backups
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Cargando...</p>
            ) : backups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin backups</p>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => {
                  const wasCreated = createdBackupFeedback === backup.filename
                  const isDeleting = deletingBackup === backup.filename
                  return (
                    <div
                      key={backup.filename}
                      className={`flex items-center justify-between p-2 rounded transition-all duration-400 ${
                        isDeleting
                          ? 'opacity-0 scale-95'
                          : wasCreated
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {backup.filename}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {backup.created_at} • {formatFileSize(backup.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {backupToDelete === backup.filename ? (
                          <>
                            <span className="text-sm text-red-600 dark:text-red-400 mr-2">¿Eliminar?</span>
                            <button
                              onClick={() => handleDeleteBackup(backup.filename)}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setBackupToDelete(null)}
                              className="px-3 py-1 text-sm bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDownloadBackup(backup.filename)}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                              title="Descargar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setBackupToDelete(backup.filename)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Eliminar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Grid de Contacto y Headers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Sección de Contacto - 2 columnas compactas */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contacto</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* WhatsApp */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="whatsapp-enabled"
                    checked={whatsappConfig.enabled}
                    onChange={(e) => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="whatsapp-enabled" className="text-sm font-medium text-gray-900 dark:text-white">
                    WhatsApp
                  </label>
                </div>

                {whatsappConfig.enabled && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Número (sin +)"
                      value={whatsappConfig.number}
                      onChange={(e) => setWhatsappConfig({ ...whatsappConfig, number: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <label className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">Mensaje del configurador:</label>
                    <textarea
                      placeholder="Mensaje del configurador..."
                      value={whatsappConfig.message}
                      onChange={(e) => setWhatsappConfig({ ...whatsappConfig, message: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                    <label className="text-xs text-gray-500 dark:text-gray-400 mt-2 block">Mensaje del catálogo:</label>
                    <textarea
                      placeholder="Mensaje para el catálogo..."
                      value={whatsappConfig.catalog_message || ''}
                      onChange={(e) => setWhatsappConfig({ ...whatsappConfig, catalog_message: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Telegram */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="telegram-enabled"
                    checked={telegramConfig.enabled}
                    onChange={(e) => setTelegramConfig({ ...telegramConfig, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="telegram-enabled" className="text-sm font-medium text-gray-900 dark:text-white">
                    Telegram
                  </label>
                </div>

                {telegramConfig.enabled && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block">Usuario:</label>
                    <input
                      type="text"
                      placeholder="Usuario (sin @)"
                      value={telegramConfig.username}
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, username: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <label className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">Mensaje del configurador:</label>
                    <textarea
                      placeholder="Mensaje del configurador..."
                      value={telegramConfig.message}
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, message: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                    <label className="text-xs text-gray-500 dark:text-gray-400 mt-2 block">Mensaje del catálogo:</label>
                    <textarea
                      placeholder="Mensaje para el catálogo..."
                      value={telegramConfig.catalog_message || ''}
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, catalog_message: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveContactConfig}
              disabled={savingContact}
              className={`w-full px-3 py-2 text-sm rounded transition-all duration-300 mt-3 ${
                savedContactFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingContact ? 'Guardando...' : savedContactFeedback ? '✓' : 'Guardar'}
            </button>
          </div>

          {/* Sección de Configuraciones Generales - Visibilidad del frontend */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Configuraciones Generales</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Configura qué elementos se muestran en el frontend</p>

            <div className="space-y-4">
              {/* Mostrar grupos de tipo */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="show-type-groups"
                    checked={headersConfig.showTypeGroups}
                    onChange={(e) => setHeadersConfig({ ...headersConfig, showTypeGroups: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="show-type-groups" className="text-sm font-medium text-gray-900 dark:text-white">
                    Mostrar grupos de tipo
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                  Muestra los tabs "Todos", "Nakiri", "Santoku", etc. y los selectores
                </p>
              </div>

              {/* Mostrar selectores */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="show-selectors"
                    checked={headersConfig.showSelectors}
                    onChange={(e) => setHeadersConfig({ ...headersConfig, showSelectors: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="show-selectors" className="text-sm font-medium text-gray-900 dark:text-white">
                    Mostrar selectores
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                  Muestra los 3 selectores: Encabado, Acero y Tipo de Cuchillo
                </p>
              </div>

              {/* Mostrar thumbnails flotantes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="show-thumbnails"
                    checked={headersConfig.showThumbnails}
                    onChange={(e) => setHeadersConfig({ ...headersConfig, showThumbnails: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="show-thumbnails" className="text-sm font-medium text-gray-900 dark:text-white">
                    Mostrar thumbnails flotantes
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                  Muestra miniaturas flotantes de los cuchillos seleccionados al hacer scroll
                </p>
              </div>

              {/* Mostrar tags en las tarjetas */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="show-tags"
                    checked={headersConfig.showTags}
                    onChange={(e) => setHeadersConfig({ ...headersConfig, showTags: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="show-tags" className="text-sm font-medium text-gray-900 dark:text-white">
                    Mostrar tags en las tarjetas
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                  Muestra los tags (tipo, encabado, acero) debajo de cada foto en el catálogo
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveHeadersConfig}
              disabled={savingHeaders}
              className={`w-full px-3 py-2 text-sm rounded transition-all duration-300 mt-3 ${
                savedHeadersFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingHeaders ? 'Guardando...' : savedHeadersFeedback ? '✓' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Sección de Metadatos HTML */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Metadatos HTML</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Etiquetas meta que se inyectarán en el &lt;head&gt; del HTML. Incluye Open Graph, Twitter Cards, etc.
          </p>

          {/* Carátula para previews */}
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Carátula para Previews</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Imagen que se mostrará en los preview de configuración</p>
            {caratula ? (
              <div className="flex items-center gap-2 mb-2">
                <img src={caratula} alt="Carátula" className="h-12 object-cover rounded border border-gray-200 dark:border-gray-600" />
                <button
                  onClick={handleDeleteCaratula}
                  className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900"
                >
                  Eliminar
                </button>
                <label className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                  Cambiar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadCaratula(e.target.files[0])}
                    disabled={uploadingCaratula}
                  />
                </label>
              </div>
            ) : (
              <label className="block w-full text-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer text-sm">
                {uploadingCaratula ? 'Subiendo...' : 'Subir carátula'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadCaratula(e.target.files[0])}
                  disabled={uploadingCaratula}
                />
              </label>
            )}
          </div>

          <textarea
            value={metaTags}
            onChange={(e) => setMetaTags(e.target.value)}
            placeholder='<meta name="description" content="...">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:type" content="website">
...'
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-none mb-4"
          />

          {/* Aviso si hay carátula y meta tags de imagen en conflicto */}
          {caratula && (metaTags.includes('og:image') || metaTags.includes('twitter:image')) && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex gap-2">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Conflicto de meta tags de imagen</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Tienes una carátula cargada y también agregaste manualmente <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded">og:image</code> o <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded">twitter:image</code>. Por favor, elimina esos meta tags del texto de arriba para evitar conflictos.
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSaveMetaTags}
            disabled={savingMetaTags}
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${
              savedMetaTagsFeedback
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            {savingMetaTags ? 'Guardando...' : savedMetaTagsFeedback ? '✓ Guardado' : 'Guardar Metadatos'}
          </button>
        </div>

        {/* Sección de Footer - compacta 2 columnas */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Footer</h2>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="footer-enabled"
                checked={footerConfig.enabled}
                onChange={(e) => setFooterConfig({ ...footerConfig, enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="footer-enabled" className="text-sm font-medium text-gray-900 dark:text-white">
                Mostrar
              </label>
            </div>
          </div>

          {footerConfig.enabled && (
            <div className="grid grid-cols-2 gap-4">
              {/* Link a página web */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sitio Web</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Texto del enlace"
                    value={footerConfig.website_text}
                    onChange={(e) => setFooterConfig({ ...footerConfig, website_text: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={footerConfig.website_url}
                    onChange={(e) => setFooterConfig({ ...footerConfig, website_url: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Redes sociales */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Redes Sociales</h3>
                <div className="space-y-2 mb-2">
                  <input
                    type="text"
                    placeholder="Texto intro"
                    value={footerConfig.social_text}
                    onChange={(e) => setFooterConfig({ ...footerConfig, social_text: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Instagram"
                    value={footerConfig.instagram}
                    onChange={(e) => setFooterConfig({ ...footerConfig, instagram: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="X / Twitter"
                    value={footerConfig.twitter}
                    onChange={(e) => setFooterConfig({ ...footerConfig, twitter: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Facebook"
                    value={footerConfig.facebook}
                    onChange={(e) => setFooterConfig({ ...footerConfig, facebook: e.target.value })}
                    className="col-span-2 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {footerConfig.enabled ? 'Nota: WhatsApp y Telegram en "Contacto"' : ''}
            </p>
            <button
              onClick={handleSaveFooter}
              disabled={savingFooter}
              className={`px-3 py-2 text-sm rounded transition-all duration-300 ${
                savedFooterFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingFooter ? 'Guardando...' : savedFooterFeedback ? '✓' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Sección de Instrucciones */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Instrucciones Flotantes</h2>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="instructions-enabled"
                checked={instructionsConfig.enabled}
                onChange={(e) => setInstructionsConfig({ ...instructionsConfig, enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="instructions-enabled" className="text-sm font-medium text-gray-900 dark:text-white">
                Mostrar
              </label>
            </div>
          </div>

          {instructionsConfig.enabled && (
            <div className="space-y-4">
              <div>
                <label htmlFor="instructions-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contenido (puedes usar saltos de línea)
                </label>
                <textarea
                  id="instructions-text"
                  value={instructionsConfig.text}
                  onChange={(e) => setInstructionsConfig({ ...instructionsConfig, text: e.target.value })}
                  placeholder="Escribe aquí las instrucciones..."
                  rows={8}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 El botón flotante con ícono aparecerá arriba de WhatsApp y Telegram.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {instructionsConfig.enabled ? 'El botón flotante se muestra en la página principal' : ''}
            </p>
            <button
              onClick={handleSaveInstructions}
              disabled={savingInstructions}
              className={`px-3 py-2 text-sm rounded transition-all duration-300 ${
                savedInstructionsFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingInstructions ? 'Guardando...' : savedInstructionsFeedback ? '✓' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Sección de Instrucciones del Configurador */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Instrucciones del Configurador</h2>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="configurator-instructions-enabled"
                checked={configuratorInstructions.enabled}
                onChange={(e) => setConfiguratorInstructions({ ...configuratorInstructions, enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="configurator-instructions-enabled" className="text-sm font-medium text-gray-900 dark:text-white">
                Mostrar
              </label>
            </div>
          </div>

          {configuratorInstructions.enabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contenido (Markdown)
                </label>
                <textarea
                  value={configuratorInstructions.text}
                  onChange={(e) => setConfiguratorInstructions({ ...configuratorInstructions, text: e.target.value })}
                  placeholder="# Título

## Sección

- Lista item 1
- Lista item 2

**Negrita** e *itálica*"
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-none"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 El botón flotante aparecerá solo en la página del configurador.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {configuratorInstructions.enabled ? 'El botón flotante se muestra en el configurador' : ''}
            </p>
            <button
              onClick={handleSaveConfiguratorInstructions}
              disabled={savingConfiguratorInstructions}
              className={`px-3 py-2 text-sm rounded transition-all duration-300 ${
                savedConfiguratorInstructionsFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingConfiguratorInstructions ? 'Guardando...' : savedConfiguratorInstructionsFeedback ? '✓' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
