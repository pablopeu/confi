import { useState, useEffect, useRef } from 'react'
import Modal from '../components/Modal'
import { useModal } from '../hooks/useModal'
import SearchBar from '../components/SearchBar/SearchBar'

const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'

// Helper para capitalizar primera letra
const capitalize = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Helper para normalizar texto (remover acentos)
const normalizeText = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function apiUrl(route) {
  return `${API_BASE}?route=${route.replace(/^\//, '')}`
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

  const { isOpen, modalProps, closeModal, showSuccess, showError, showConfirm } = useModal()

  const getAuthParams = () => ({
    auth_user: credentials.user,
    auth_pass: credentials.pass
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const params = new URLSearchParams({
        auth_user: credentials.user,
        auth_pass: credentials.pass
      })
      const response = await fetch(apiUrl('admin/verify') + '&' + params.toString())
      if (response.ok) {
        setAuthenticated(true)
        loadData()
      } else {
        showError('Error', 'Credenciales inválidas')
      }
    } catch (error) {
      showError('Error', 'No se pudo conectar con el servidor')
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
    if (newPassword.length < 6) {
      showError('Error', 'La contraseña debe tener al menos 6 caracteres')
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
            FotoCRM Admin
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">FotoCRM Admin</h1>

          {/* Tabs en el header */}
          <div className="flex gap-1">
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

          <div className="flex items-center gap-4">
            <a href="#/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-300 hover:underline">Ver catálogo</a>
            <button onClick={() => setShowPasswordModal(true)} className="text-sm text-gray-600 dark:text-gray-300 hover:underline">
              Cambiar contraseña
            </button>
            <button onClick={() => setAuthenticated(false)} className="text-sm text-red-600 dark:text-red-400 hover:underline">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 h-full">
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
              placeholder="Nueva contraseña (mín. 6 caracteres)"
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
  const [bucketToDelete, setBucketToDelete] = useState(null) // ID del bucket esperando confirmación
  const [deletedBucketFeedback, setDeletedBucketFeedback] = useState(null) // ID del bucket recién eliminado

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

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    for (const file of files) {
      formData.append('photos[]', file)
    }
    formData.append('tags', '')
    formData.append('text', '')
    formData.append('auth_user', authParams.auth_user)
    formData.append('auth_pass', authParams.auth_pass)

    try {
      const response = await fetch(apiUrl('admin/upload'), {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        const newPhotos = data.photos || []
        const newBucketId = data.bucket_id

        // Recargar buckets
        await loadBuckets()

        // Activar el nuevo bucket
        if (newBucketId) {
          setActiveBucketId(newBucketId)
        }

        // Cargar fotos del nuevo bucket
        setUploadedPhotos(newPhotos)
        setCurrentIndex(0)

        // Inicializar tags y textos vacíos para las nuevas fotos
        const newTags = {}
        const newTexts = {}
        newPhotos.forEach(p => {
          newTags[p.id] = []
          newTexts[p.id] = ''
        })
        setPhotoTags(newTags)
        setPhotoTexts(newTexts)

        showSuccess('Éxito', `${newPhotos.length} foto(s) subida(s)`)
        onRefresh()
      } else if (response.status === 401) {
        showError('Sesión expirada', 'Por favor, vuelve a iniciar sesión')
      } else {
        const error = await response.json()
        showError('Error', error.error || 'Error al subir')
      }
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl(`admin/buckets/${bucketId}`) + '&' + params.toString(), {
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
                  title="Eliminar bucket"
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
// Photo Carousel - Carrusel de fotos
// ==================
function PhotoCarousel({ photos, currentIndex, onSelectPhoto }) {
  const carouselRef = useRef(null)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartScroll, setDragStartScroll] = useState(0)

  const THUMBNAIL_SIZE = 120

  // Aplicar scroll position sin límites (continuo)
  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = scrollPosition
    }
  }, [scrollPosition])

  const handlePrevious = () => {
    const containerWidth = carouselRef.current.offsetWidth
    setScrollPosition(prev => prev - containerWidth * 0.8)
  }

  const handleNext = () => {
    if (!carouselRef.current) return
    const containerWidth = carouselRef.current.offsetWidth
    setScrollPosition(prev => prev + containerWidth * 0.8)
  }

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStartX(e.clientX)
    setDragStartScroll(scrollPosition)
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    const deltaX = dragStartX - e.clientX
    // Sin límites, se queda donde lo sueltes
    setScrollPosition(dragStartScroll + deltaX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  if (!photos || photos.length === 0) {
    return null
  }

  // Solo triplicar si hay suficientes fotos para scroll continuo
  const displayPhotos = photos.length >= 5
    ? [...photos, ...photos, ...photos]
    : photos

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
        className="flex overflow-x-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {displayPhotos.map((photo, idx) => {
          const originalIdx = idx % photos.length
          return (
            <button
              key={`${photo.id}-${idx}`}
              onClick={(e) => {
                if (!isDragging) {
                  onSelectPhoto(originalIdx)
                }
                e.preventDefault()
              }}
              className={`flex-shrink-0 overflow-hidden border-2 transition-all ${
                originalIdx === currentIndex
                  ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              style={{ width: `${THUMBNAIL_SIZE}px`, height: `${THUMBNAIL_SIZE}px` }}
            >
              <img
                src={photo.url}
                alt={`Foto ${originalIdx + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            </button>
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
function TagSection({ group, selectedTags, onTagToggle, onCreateTag }) {
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
      {/* Header con nombre del grupo */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{group.name}</h3>
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
  const [showOnlyUntagged, setShowOnlyUntagged] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
      const tags = photoTags[p.id] || p.tags || []
      return tags.length === 0
    })
  }

  const currentPhoto = filteredPhotos[currentIndex]

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
        const params = new URLSearchParams(authParams)
        const response = await fetch(apiUrl(`admin/photos/${currentPhoto.id}`) + '&' + params.toString(), {
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

  const goToPrev = async () => {
    await handleSaveCurrentPhoto(false)
    setArrowFeedback('prev')
    setTimeout(() => setArrowFeedback(null), 500)
    // Continuo: si está en la primera, va a la última
    setCurrentIndex(currentIndex === 0 ? filteredPhotos.length - 1 : currentIndex - 1)
  }

  const goToNext = async () => {
    await handleSaveCurrentPhoto(false)
    setArrowFeedback('next')
    setTimeout(() => setArrowFeedback(null), 500)
    // Continuo: si está en la última, va a la primera
    setCurrentIndex(currentIndex === filteredPhotos.length - 1 ? 0 : currentIndex + 1)
  }

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
            onClick={() => setShowOnlyUntagged(false)}
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
                }}
                placeholder="Buscar..."
              />
            </div>
            <button
              onClick={() => {
                setShowOnlyUntagged(!showOnlyUntagged)
                setCurrentIndex(0)
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
  const [confirmingDelete, setConfirmingDelete] = useState(null) // { groupId, tagId, tagName }

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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl(`admin/tags/${groupId}/${tagId}`) + '&' + params.toString(), {
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
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tagGroups.map(group => (
          <div key={group.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
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
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {[...group.tags].sort((a, b) => a.name.localeCompare(b.name)).map(tag => {
                  const isConfirming = confirmingDelete?.tagId === tag.id && confirmingDelete?.groupId === group.id

                  return (
                    <div key={tag.id} className="flex items-center justify-between py-1 px-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{capitalize(tag.name)}</span>
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
                        <button
                          onClick={() => setConfirmingDelete({ groupId: group.id, tagId: tag.id, tagName: tag.name })}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  )
                })}
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
    </div>
  )
}

// ==================
// Configuration - Configuración del sistema (backups, logo)
// ==================
function Configuration({ authParams, showSuccess, showError, onLogoChange }) {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [backupToDelete, setBackupToDelete] = useState(null)
  const [deletingBackup, setDeletingBackup] = useState(null) // Filename del backup siendo eliminado (para fade out)
  const [createdBackupFeedback, setCreatedBackupFeedback] = useState(null) // Filename del backup recién creado
  const [logo, setLogo] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Estado para título y subtítulo del sitio
  const [siteTitle, setSiteTitle] = useState('PEU Cuchillos Artesanales')
  const [siteSubtitleMobile, setSiteSubtitleMobile] = useState('Buscador interactivo')
  const [siteSubtitleDesktop, setSiteSubtitleDesktop] = useState('Buscador interactivo de modelos y materiales')
  const [savingSiteInfo, setSavingSiteInfo] = useState(false)
  const [savedSiteInfoFeedback, setSavedSiteInfoFeedback] = useState(false)

  // Estado para WhatsApp y Telegram
  const [whatsappConfig, setWhatsappConfig] = useState({ enabled: false, number: '', message: '' })
  const [telegramConfig, setTelegramConfig] = useState({ enabled: false, username: '', message: '' })
  const [savingContact, setSavingContact] = useState(false)
  const [savedContactFeedback, setSavedContactFeedback] = useState(false)

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

  useEffect(() => {
    loadBackups()
    loadConfig()
    loadContactConfig()
    loadMetaTags()
    loadConfiguratorMessage()
    loadFooterConfig()
    loadSiteInfo()
  }, [])

  const loadBackups = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/backups') + '&' + params.toString())
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
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const loadContactConfig = async () => {
    try {
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/contact') + '&' + params.toString())
      if (response.ok) {
        const data = await response.json()
        setWhatsappConfig(data.whatsapp || { enabled: false, number: '', message: '' })
        setTelegramConfig(data.telegram || { enabled: false, username: '', message: '' })
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const loadMetaTags = async () => {
    try {
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/metatags') + '&' + params.toString())
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/configurator') + '&' + params.toString())
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/footer') + '&' + params.toString())
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/site-info') + '&' + params.toString())
      if (response.ok) {
        const data = await response.json()
        setSiteTitle(data.site_title || 'PEU Cuchillos Artesanales')
        setSiteSubtitleMobile(data.site_subtitle_mobile || 'Buscador interactivo')
        setSiteSubtitleDesktop(data.site_subtitle_desktop || 'Buscador interactivo de modelos y materiales')
      }
    } catch (error) {
      // Error silencioso
    }
  }

  const handleSaveMetaTags = async () => {
    setSavingMetaTags(true)
    try {
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/metatags') + '&' + params.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta_tags: metaTags })
      })

      if (response.ok) {
        setSavedMetaTagsFeedback(true)
        setTimeout(() => setSavedMetaTagsFeedback(false), 2000)
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/configurator') + '&' + params.toString(), {
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/footer') + '&' + params.toString(), {
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

  const handleSaveSiteInfo = async () => {
    setSavingSiteInfo(true)
    try {
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/site-info') + '&' + params.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_title: siteTitle,
          site_subtitle_mobile: siteSubtitleMobile,
          site_subtitle_desktop: siteSubtitleDesktop
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/backups') + '&' + params.toString(), {
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

  const handleDownloadBackup = (filename) => {
    const params = new URLSearchParams(authParams)
    window.location.href = apiUrl(`admin/backups/${filename}`) + '&' + params.toString()
  }

  const handleDeleteBackup = async (filename) => {
    // Activar animación fade out
    setDeletingBackup(filename)
    setBackupToDelete(null)

    // Esperar animación antes de eliminar
    setTimeout(async () => {
      try {
        const params = new URLSearchParams(authParams)
        const response = await fetch(apiUrl(`admin/backups/${filename}`) + '&' + params.toString(), {
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
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/logo') + '&' + params.toString(), {
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

  const handleSaveContactConfig = async () => {
    setSavingContact(true)
    try {
      const params = new URLSearchParams(authParams)
      const response = await fetch(apiUrl('admin/config/contact') + '&' + params.toString(), {
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

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="h-full overflow-y-auto py-6 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Grid de 2 columnas para Logo y Mensaje del Configurador */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sección de Logo y Títulos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Logo y Títulos del Sitio</h2>

            {/* Logo */}
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Sube un logo que se mostrará en el header. Formatos: JPG, PNG, SVG, WEBP (máx 2MB).
              </p>

              {logo ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <img src={logo} alt="Logo" className="h-12 object-contain" />
                    <button
                      onClick={handleDeleteLogo}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900"
                    >
                      Eliminar logo
                    </button>
                  </div>
                  <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                    Cambiar logo
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
                <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
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

            {/* Títulos */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título del sitio
                </label>
                <input
                  type="text"
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder="PEU Cuchillos Artesanales"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subtítulo (móvil)
                </label>
                <input
                  type="text"
                  value={siteSubtitleMobile}
                  onChange={(e) => setSiteSubtitleMobile(e.target.value)}
                  placeholder="Buscador interactivo"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subtítulo (escritorio)
                </label>
                <input
                  type="text"
                  value={siteSubtitleDesktop}
                  onChange={(e) => setSiteSubtitleDesktop(e.target.value)}
                  placeholder="Buscador interactivo de modelos y materiales"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <button
                onClick={handleSaveSiteInfo}
                disabled={savingSiteInfo}
                className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                  savedSiteInfoFeedback
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {savingSiteInfo ? 'Guardando...' : savedSiteInfoFeedback ? '✓ Guardado' : 'Guardar Títulos'}
              </button>
            </div>
          </div>

          {/* Sección de Mensaje del Configurador */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Mensaje del Configurador</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Mensaje que se enviará por WhatsApp/Telegram al compartir una configuración. Usa {'{link}'} donde quieras incluir el enlace.
            </p>

            <textarea
              value={configuratorMessage}
              onChange={(e) => setConfiguratorMessage(e.target.value)}
              placeholder="Hola Pablo, te envío mi página del configurador de cuchillos: {link}"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none mb-4"
            />

            <button
              onClick={handleSaveConfiguratorMessage}
              disabled={savingConfiguratorMessage}
              className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                savedConfiguratorMessageFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingConfiguratorMessage ? 'Guardando...' : savedConfiguratorMessageFeedback ? '✓ Guardado' : 'Guardar Mensaje'}
            </button>
          </div>
        </div>

        {/* Grid de Backups y Contacto */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sección de Backups */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Backups</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Los backups incluyen las carpetas /data y /uploads. Se conservan máximo 5 backups.
            </p>

            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleCreateBackup}
                disabled={creating || backups.length >= 5}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creando...' : 'Crear Backup'}
              </button>
              {backups.length >= 5 && (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Límite alcanzado. Elimina un backup para crear uno nuevo.
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-gray-500">Cargando backups...</p>
            ) : backups.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No hay backups disponibles</p>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => {
                  const wasCreated = createdBackupFeedback === backup.filename
                  const isDeleting = deletingBackup === backup.filename
                  return (
                    <div
                      key={backup.filename}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-400 ${
                        isDeleting
                          ? 'opacity-0 scale-95'
                          : wasCreated
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {backup.filename}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {backup.created_at} • {formatFileSize(backup.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {backupToDelete === backup.filename ? (
                          <>
                            <span className="text-xs text-red-600 dark:text-red-400 mr-2">¿Eliminar?</span>
                            <button
                              onClick={() => handleDeleteBackup(backup.filename)}
                              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setBackupToDelete(null)}
                              className="px-3 py-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
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

          {/* Sección de Contacto - WhatsApp y Telegram */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contacto</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Configura botones flotantes de WhatsApp y Telegram en el sitio público.
            </p>

            {/* WhatsApp */}
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="whatsapp-enabled"
                  checked={whatsappConfig.enabled}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="whatsapp-enabled" className="text-lg font-medium text-gray-900 dark:text-white">
                  WhatsApp
                </label>
              </div>

              {whatsappConfig.enabled && (
                <div className="space-y-3 ml-7">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número de WhatsApp (con código de país, sin +)
                    </label>
                    <input
                      type="text"
                      placeholder="5491112345678"
                      value={whatsappConfig.number}
                      onChange={(e) => setWhatsappConfig({ ...whatsappConfig, number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mensaje predeterminado
                    </label>
                    <textarea
                      placeholder="Hola, me interesan tus productos..."
                      value={whatsappConfig.message}
                      onChange={(e) => setWhatsappConfig({ ...whatsappConfig, message: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Telegram */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="telegram-enabled"
                  checked={telegramConfig.enabled}
                  onChange={(e) => setTelegramConfig({ ...telegramConfig, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="telegram-enabled" className="text-lg font-medium text-gray-900 dark:text-white">
                  Telegram
                </label>
              </div>

              {telegramConfig.enabled && (
                <div className="space-y-3 ml-7">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Usuario de Telegram (sin @)
                    </label>
                    <input
                      type="text"
                      placeholder="miusuario"
                      value={telegramConfig.username}
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mensaje predeterminado
                    </label>
                    <textarea
                      placeholder="Hola, me interesan tus productos..."
                      value={telegramConfig.message}
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, message: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSaveContactConfig}
              disabled={savingContact}
              className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                savedContactFeedback
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {savingContact ? 'Guardando...' : savedContactFeedback ? '✓ Guardado' : 'Guardar Configuración'}
            </button>
          </div>
        </div>

        {/* Sección de Metadatos HTML */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Metadatos HTML</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Etiquetas meta que se inyectarán en el &lt;head&gt; del HTML. Incluye Open Graph, Twitter Cards, etc.
          </p>

          <textarea
            value={metaTags}
            onChange={(e) => setMetaTags(e.target.value)}
            placeholder='<meta name="description" content="...">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="...">
...'
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-none mb-4"
          />

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

        {/* Sección de Footer */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Footer del Sitio</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Configura el footer que aparecerá en todas las páginas del sitio público.
          </p>

          {/* Checkbox para habilitar */}
          <div className="flex items-center gap-3 mb-6">
            <input
              type="checkbox"
              id="footer-enabled"
              checked={footerConfig.enabled}
              onChange={(e) => setFooterConfig({ ...footerConfig, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="footer-enabled" className="text-lg font-medium text-gray-900 dark:text-white">
              Mostrar footer
            </label>
          </div>

          {footerConfig.enabled && (
            <div className="space-y-6 ml-7">
              {/* Link a página web */}
              <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">Enlace a tu sitio web</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Texto del enlace
                    </label>
                    <input
                      type="text"
                      placeholder="Visita mi página web"
                      value={footerConfig.website_text}
                      onChange={(e) => setFooterConfig({ ...footerConfig, website_text: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      URL de tu sitio web
                    </label>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com"
                      value={footerConfig.website_url}
                      onChange={(e) => setFooterConfig({ ...footerConfig, website_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Redes sociales */}
              <div>
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3">Redes Sociales</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Texto introductorio
                    </label>
                    <input
                      type="text"
                      placeholder="Seguime en mis redes sociales"
                      value={footerConfig.social_text}
                      onChange={(e) => setFooterConfig({ ...footerConfig, social_text: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Instagram (usuario sin @)
                      </label>
                      <input
                        type="text"
                        placeholder="miusuario"
                        value={footerConfig.instagram}
                        onChange={(e) => setFooterConfig({ ...footerConfig, instagram: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        X / Twitter (usuario sin @)
                      </label>
                      <input
                        type="text"
                        placeholder="miusuario"
                        value={footerConfig.twitter}
                        onChange={(e) => setFooterConfig({ ...footerConfig, twitter: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Facebook (usuario o página)
                      </label>
                      <input
                        type="text"
                        placeholder="mipagina"
                        value={footerConfig.facebook}
                        onChange={(e) => setFooterConfig({ ...footerConfig, facebook: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Nota: WhatsApp y Telegram usan la configuración de los botones flotantes (sección Contacto)
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSaveFooter}
            disabled={savingFooter}
            className={`px-4 py-2 rounded-lg transition-all duration-300 ${
              savedFooterFeedback
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 ${footerConfig.enabled ? 'ml-7' : ''}`}
          >
            {savingFooter ? 'Guardando...' : savedFooterFeedback ? '✓ Guardado' : 'Guardar Footer'}
          </button>
        </div>
      </div>
    </div>
  )
}
