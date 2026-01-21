import { useState, useEffect, useRef, useCallback } from 'react'
import SearchBar from './components/SearchBar'
import {
  getCategories,
  getPhotos,
  copyImageToClipboard
} from './services/api'

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

// Tabs de tipos principales
const TIPO_TABS = [
  { id: 'cocina', label: 'Cocina' },
  { id: 'asado', label: 'Asado' },
  { id: 'japones', label: 'Japonés' },
  { id: 'otros', label: 'Otros' }
]

// IDs que se consideran "Otros"
const OTROS_TIPOS = ['outdoor', 'camping', 'caza']

function App() {
  const [tagGroups, setTagGroups] = useState([])
  const [photos, setPhotos] = useState([])
  const [filteredPhotos, setFilteredPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [logo, setLogo] = useState(null)
  const [whatsappConfig, setWhatsappConfig] = useState(null)
  const [telegramConfig, setTelegramConfig] = useState(null)
  const [footerConfig, setFooterConfig] = useState(null)
  const [siteTitle, setSiteTitle] = useState('PEU Cuchillos Artesanales')
  const [siteSubtitleMobile, setSiteSubtitleMobile] = useState('Buscador interactivo')
  const [siteSubtitleDesktop, setSiteSubtitleDesktop] = useState('Buscador interactivo de modelos y materiales')
  const [showConfigurador, setShowConfigurador] = useState(false)

  // Filtros
  const [activeTab, setActiveTab] = useState(null) // null = todos, o un id de tab
  const [selectedEncabado, setSelectedEncabado] = useState([])
  const [selectedAcero, setSelectedAcero] = useState([])
  const [selectedExtras, setSelectedExtras] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  // Sistema de buckets para configurador (persisten en cookies)
  const [activeBucket, setActiveBucket] = useState(() => {
    const saved = document.cookie
      .split('; ')
      .find(row => row.startsWith('activeBucket='))
    if (saved) {
      try {
        return parseInt(saved.split('=')[1]) || 0
      } catch {
        return 0
      }
    }
    return 0
  })

  const [buckets, setBuckets] = useState(() => {
    const saved = document.cookie
      .split('; ')
      .find(row => row.startsWith('buckets='))
    if (saved) {
      try {
        return JSON.parse(decodeURIComponent(saved.split('=')[1]))
      } catch {
        return Array(5).fill(null).map(() => ({
          selectedPhotos: [],
          photoConfigs: {}
        }))
      }
    }
    return Array(5).fill(null).map(() => ({
      selectedPhotos: [],
      photoConfigs: {}
    }))
  })

  const [showBucketDelete, setShowBucketDelete] = useState(null)
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  // Estado global para savedCode (compartido entre página principal y configurador)
  const [savedCode, setSavedCode] = useState(() => {
    const saved = document.cookie
      .split('; ')
      .find(row => row.startsWith('savedCode='))
    if (saved) {
      return saved.split('=')[1] || null
    }
    return null
  })

  // Cerrar confirmación con Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showBucketDelete !== null) {
          setShowBucketDelete(null)
        }
        if (showMobileSearch) {
          setShowMobileSearch(false)
        }
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showBucketDelete, showMobileSearch])

  // Guardar buckets en cookies cuando cambien
  useEffect(() => {
    const expires = new Date()
    expires.setDate(expires.getDate() + 365)
    document.cookie = `buckets=${encodeURIComponent(JSON.stringify(buckets))}; expires=${expires.toUTCString()}; path=/`
  }, [buckets])

  // Guardar activeBucket en cookies cuando cambie
  useEffect(() => {
    const expires = new Date()
    expires.setDate(expires.getDate() + 365)
    document.cookie = `activeBucket=${activeBucket}; expires=${expires.toUTCString()}; path=/`
  }, [activeBucket])

  // Guardar savedCode en cookies cuando cambie
  useEffect(() => {
    if (savedCode) {
      const expires = new Date()
      expires.setDate(expires.getDate() + 365)
      document.cookie = `savedCode=${savedCode}; expires=${expires.toUTCString()}; path=/`
    } else {
      // Borrar cookie si no hay savedCode
      document.cookie = `savedCode=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
    }
  }, [savedCode])

  // Fotos seleccionadas del bucket activo (para compatibilidad)
  const selectedPhotos = buckets[activeBucket]?.selectedPhotos || []

  // Cargar configuración (logo, whatsapp, telegram) y detectar ?config= en URL
  useEffect(() => {
    async function loadConfig() {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'
        const response = await fetch(`${API_BASE}?route=config`)
        if (response.ok) {
          const data = await response.json()
          setLogo(data.logo || null)
          setWhatsappConfig(data.whatsapp || null)
          setTelegramConfig(data.telegram || null)
          setFooterConfig(data.footer || null)
          setSiteTitle(data.site_title || 'PEU Cuchillos Artesanales')
          setSiteSubtitleMobile(data.site_subtitle_mobile || 'Buscador interactivo')
          setSiteSubtitleDesktop(data.site_subtitle_desktop || 'Buscador interactivo de modelos y materiales')
        }
      } catch (error) {
        // Error silencioso - no afecta funcionalidad principal
      }
    }
    loadConfig()

    // Si la URL tiene ?config=, abrir el configurador automáticamente
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('config')) {
      setShowConfigurador(true)
    }
  }, [])

  // Cargar datos iniciales
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [catData, photoData] = await Promise.all([
          getCategories(),
          getPhotos()
        ])
        setTagGroups(catData?.tag_groups || [])
        setPhotos(photoData?.photos || [])
        setFilteredPhotos(photoData?.photos || [])
      } catch (error) {
        // Error silencioso - se muestra UI vacía
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Obtener tags por grupo
  const getTagsByGroup = (groupId) => {
    const group = tagGroups.find(g => g.id === groupId)
    return group?.tags || []
  }

  // Filtrar fotos cuando cambian los filtros
  useEffect(() => {
    let result = [...photos]

    // Filtrar por tab de tipo
    if (activeTab) {
      if (activeTab === 'otros') {
        // Filtrar fotos que tengan algún tag de "otros" tipos
        result = result.filter(photo => {
          const photoTags = photo.tags || []
          return OTROS_TIPOS.some(tipo => photoTags.includes(tipo))
        })
      } else {
        result = result.filter(photo => {
          const photoTags = photo.tags || []
          return photoTags.includes(activeTab)
        })
      }
    }

    // Filtrar por encabado (OR dentro del grupo)
    if (selectedEncabado.length > 0) {
      result = result.filter(photo => {
        const photoTags = photo.tags || []
        return selectedEncabado.some(tag => photoTags.includes(tag))
      })
    }

    // Filtrar por acero (OR dentro del grupo)
    if (selectedAcero.length > 0) {
      result = result.filter(photo => {
        const photoTags = photo.tags || []
        return selectedAcero.some(tag => photoTags.includes(tag))
      })
    }

    // Filtrar por extras (OR dentro del grupo)
    if (selectedExtras.length > 0) {
      result = result.filter(photo => {
        const photoTags = photo.tags || []
        return selectedExtras.some(tag => photoTags.includes(tag))
      })
    }

    // Filtrar por búsqueda de texto y tags (ignorando acentos)
    if (searchQuery) {
      const normalizedQuery = normalizeText(searchQuery.trim())

      result = result.filter(photo => {
        // Buscar en el texto de descripción
        if (normalizeText(photo.text || '').includes(normalizedQuery)) {
          return true
        }

        // Buscar en los tags de la foto
        const photoTags = photo.tags || []
        for (const group of tagGroups) {
          for (const tag of group.tags) {
            if (photoTags.includes(tag.id)) {
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

    setFilteredPhotos(result)
  }, [photos, activeTab, selectedEncabado, selectedAcero, selectedExtras, searchQuery, tagGroups])

  // Handlers
  const handleResetFilters = useCallback(() => {
    setActiveTab(null)
    setSelectedEncabado([])
    setSelectedAcero([])
    setSelectedExtras([])
    setSearchQuery('')
  }, [])

  const hasActiveFilters = activeTab !== null || selectedEncabado.length > 0 || selectedAcero.length > 0 || selectedExtras.length > 0 || searchQuery

  // Manejar selección de fotos para configurador
  const togglePhotoSelection = useCallback((photoId) => {
    setBuckets(prev => {
      const newBuckets = [...prev]
      const currentSelected = newBuckets[activeBucket].selectedPhotos

      if (currentSelected.includes(photoId)) {
        // Deseleccionar
        newBuckets[activeBucket] = {
          ...newBuckets[activeBucket],
          selectedPhotos: currentSelected.filter(id => id !== photoId)
        }
        // Eliminar también la configuración de esa foto
        const newConfigs = { ...newBuckets[activeBucket].photoConfigs }
        delete newConfigs[photoId]
        newBuckets[activeBucket].photoConfigs = newConfigs
      } else {
        // Verificar límite de 6
        if (currentSelected.length >= 6) {
          return prev // No agregar más de 6
        }
        // Seleccionar
        newBuckets[activeBucket] = {
          ...newBuckets[activeBucket],
          selectedPhotos: [...currentSelected, photoId],
          photoConfigs: {
            ...newBuckets[activeBucket].photoConfigs,
            [photoId]: {
              forma: false,
              acero: false,
              encabado: false,
              detalle1: false,
              detalle2: false,
              detalle3: false,
              comentarios: ''
            }
          }
        }
      }

      return newBuckets
    })
  }, [activeBucket])

  const isPhotoSelected = useCallback((photoId) => {
    return selectedPhotos.includes(photoId)
  }, [selectedPhotos])

  const handleDeleteBucket = useCallback(async (bucketIndex) => {
    const newBuckets = [...buckets]
    newBuckets[bucketIndex] = {
      selectedPhotos: [],
      photoConfigs: {}
    }

    setBuckets(newBuckets)
    setShowBucketDelete(null)

    // Si estamos en el bucket eliminado, cambiar al 0
    if (activeBucket === bucketIndex) {
      setActiveBucket(0)
    }

    // Si existe un savedCode, actualizar automáticamente en el servidor
    if (savedCode) {
      setTimeout(async () => {
        try {
          const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'
          await fetch(`${API_BASE}?route=configurator/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buckets: newBuckets,
              code: savedCode
            })
          })
        } catch (error) {
          console.error('Error al auto-guardar configuración:', error)
        }
      }, 100)
    }
  }, [activeBucket, savedCode, buckets])

  // Si estamos en el configurador, mostrar esa vista
  if (showConfigurador) {
    return <Configurador
      buckets={buckets}
      setBuckets={setBuckets}
      activeBucket={activeBucket}
      setActiveBucket={setActiveBucket}
      allPhotos={photos}
      onClose={() => setShowConfigurador(false)}
      logo={logo}
      tagGroups={tagGroups}
      showBucketDelete={showBucketDelete}
      setShowBucketDelete={setShowBucketDelete}
      handleDeleteBucket={handleDeleteBucket}
      savedCode={savedCode}
      setSavedCode={setSavedCode}
      footerConfig={footerConfig}
    />
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header unificado */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
        <div className="px-4 py-2">
          {/* Mobile: Layout vertical con headers fijos */}
          <div className="lg:hidden">
            {/* Header principal: Logo, título y buscador */}
            <div className="flex items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {logo && (
                  <img src={logo} alt="Logo" className="h-8 object-contain flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {siteTitle}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {siteSubtitleMobile}
                  </p>
                </div>
              </div>
              {/* Icono de búsqueda */}
              <button
                onClick={() => setShowMobileSearch(!showMobileSearch)}
                className="flex-shrink-0 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Buscar"
              >
                {showMobileSearch ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Buscador expandible */}
            {showMobileSearch && (
              <div className="py-1">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Buscar..."
                />
              </div>
            )}

            {/* Subheader1: Tabs de tipo - TODO EN UN RENGLÓN */}
            <div className="flex items-center gap-1 py-1 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab(null)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors flex-1 ${
                  activeTab === null
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Todos
              </button>
              {TIPO_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors flex-1 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Subheader2: Selectores - TODO EN UN RENGLÓN */}
            <div className="flex items-center gap-1 py-1 border-t border-gray-200 dark:border-gray-700">
              <MultiSelect
                label="Encabado"
                options={getTagsByGroup('encabado')}
                selected={selectedEncabado}
                onChange={setSelectedEncabado}
                groupId="encabado"
              />
              <MultiSelect
                label="Acero"
                options={getTagsByGroup('acero')}
                selected={selectedAcero}
                onChange={setSelectedAcero}
                groupId="acero"
              />
              <MultiSelect
                label="Tipo de Cuchillo"
                options={getTagsByGroup('extras')}
                selected={selectedExtras}
                onChange={setSelectedExtras}
                groupId="extras"
              />
            </div>

            {/* Subheader3: Configurador y Reset - TODO EN UN RENGLÓN */}
            <div className="flex items-center justify-between gap-2 py-1 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowConfigurador(true)}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                Configurador
                {selectedPhotos.length > 0 && (
                  <span className="bg-white text-green-600 rounded-full px-1.5 py-0.5 text-xs font-bold">
                    {selectedPhotos.length}
                  </span>
                )}
              </button>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  Reset selectores
                </button>
              )}
            </div>

            {/* Subheader4: Buckets - TODO EN UN RENGLÓN, SIN CONTADOR */}
            <div className="flex items-center gap-1 py-1 border-t border-gray-200 dark:border-gray-700">
              {buckets.map((bucket, index) => (
                <div key={index} className="relative flex-1">
                  <button
                    onClick={() => setActiveBucket(index)}
                    className={`w-full px-1 py-1 text-xs rounded transition-colors ${
                      activeBucket === index
                        ? 'bg-blue-600 text-white'
                        : bucket.selectedPhotos.length > 0
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Cuchillo {index + 1}
                  </button>
                  {bucket.selectedPhotos.length > 0 && (
                    <button
                      onClick={() => setShowBucketDelete(index)}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 text-xs"
                    >
                      ×
                    </button>
                  )}
                  {/* Confirmación de eliminación inline */}
                  {showBucketDelete === index && (
                    <>
                      {/* Overlay invisible para cerrar al hacer click fuera */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowBucketDelete(null)}
                      />
                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50 whitespace-nowrap">
                        <p className="text-xs text-gray-900 dark:text-white mb-2">¿Eliminar?</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDeleteBucket(index)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setShowBucketDelete(null)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: Layout horizontal en una línea */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Logo y Título */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {logo && (
                <img src={logo} alt="Logo" className="h-12 object-contain" />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {siteTitle}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {siteSubtitleDesktop}
                </p>
              </div>
            </div>

            {/* Tabs de tipo */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setActiveTab(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === null
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Todos
              </button>
              {TIPO_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selectboxes */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <MultiSelect
                label="Encabado"
                options={getTagsByGroup('encabado')}
                selected={selectedEncabado}
                onChange={setSelectedEncabado}
                groupId="encabado"
              />
              <MultiSelect
                label="Acero"
                options={getTagsByGroup('acero')}
                selected={selectedAcero}
                onChange={setSelectedAcero}
                groupId="acero"
              />
              <MultiSelect
                label="Tipo de Cuchillo"
                options={getTagsByGroup('extras')}
                selected={selectedExtras}
                onChange={setSelectedExtras}
                groupId="extras"
              />
            </div>

            {/* Botón resetear */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
              >
                Resetear filtros
              </button>
            )}

            {/* Botón Configurador */}
            <button
              onClick={() => setShowConfigurador(true)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 flex-shrink-0"
            >
              Configurador
              {selectedPhotos.length > 0 && (
                <span className="bg-white text-green-600 rounded-full px-1.5 py-0.5 text-xs font-bold">
                  {selectedPhotos.length}
                </span>
              )}
            </button>

            {/* Buscador al final */}
            <div className="w-48 ml-auto">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Buscar..."
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Info de resultados y buckets - SOLO DESKTOP */}
          <div className="hidden lg:flex mb-4 items-center justify-between gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filteredPhotos.length} foto{filteredPhotos.length !== 1 ? 's' : ''} encontrada{filteredPhotos.length !== 1 ? 's' : ''}
            </div>

            {/* Buckets */}
            <div className="flex items-center gap-1">
              {buckets.map((bucket, index) => (
                <div key={index} className="relative">
                  <button
                    onClick={() => setActiveBucket(index)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      activeBucket === index
                        ? 'bg-blue-600 text-white'
                        : bucket.selectedPhotos.length > 0
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Cuchillo {index + 1}
                  </button>
                  {bucket.selectedPhotos.length > 0 && (
                    <button
                      onClick={() => setShowBucketDelete(index)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 text-xs"
                    >
                      ×
                    </button>
                  )}
                  {/* Confirmación de eliminación inline */}
                  {showBucketDelete === index && (
                    <>
                      {/* Overlay invisible para cerrar al hacer click fuera */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowBucketDelete(null)}
                      />
                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50 whitespace-nowrap">
                        <p className="text-xs text-gray-900 dark:text-white mb-2">¿Eliminar?</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDeleteBucket(index)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setShowBucketDelete(null)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Grid de fotos */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">No hay fotos</p>
              <p className="text-sm">Ajusta los filtros para ver resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPhotos.map(photo => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  tagGroups={tagGroups}
                  isSelected={isPhotoSelected(photo.id)}
                  onToggleSelection={togglePhotoSelection}
                  selectedCount={selectedPhotos.length}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer footerConfig={footerConfig} whatsappConfig={whatsappConfig} telegramConfig={telegramConfig} />

      {/* Botones flotantes de contacto */}
      {(whatsappConfig?.enabled || telegramConfig?.enabled) && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
          {/* Telegram - arriba */}
          {telegramConfig?.enabled && telegramConfig.username && (
            <a
              href={`https://t.me/${telegramConfig.username}?text=${encodeURIComponent(telegramConfig.message || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 rounded-full bg-[#0088cc] hover:bg-[#0077b3] text-white flex items-center justify-center shadow-lg transition-all hover:scale-110"
              title="Contactar por Telegram"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
              </svg>
            </a>
          )}

          {/* WhatsApp - abajo */}
          {whatsappConfig?.enabled && whatsappConfig.number && (
            <a
              href={`https://wa.me/${whatsappConfig.number}?text=${encodeURIComponent(whatsappConfig.message || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20BA5A] text-white flex items-center justify-center shadow-lg transition-all hover:scale-110"
              title="Contactar por WhatsApp"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// Componente MultiSelect para filtros
function MultiSelect({ label, options, selected, onChange, groupId }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleToggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const selectedCount = selected.length

  // Obtener colores según el grupo (sin selección - más tenue)
  const getGroupColorEmpty = () => {
    const colors = {
      encabado: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
      acero: 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300',
      extras: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
    }
    return colors[groupId] || 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300'
  }

  // Obtener colores según el grupo (con selección - más intenso)
  const getGroupColorSelected = () => {
    const colors = {
      encabado: 'border-amber-400 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      acero: 'border-gray-400 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
      extras: 'border-green-400 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
    }
    return colors[groupId] || 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  }

  return (
    <div className="relative flex-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all ${
          selectedCount > 0
            ? `${getGroupColorSelected()} border-2 lg:border animate-pulse lg:animate-none`
            : `${getGroupColorEmpty()} border`
        }`}
      >
        <span className="truncate">{label}</span>
        {/* Contador solo en desktop */}
        {selectedCount > 0 && (
          <span className="hidden lg:inline-block px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full flex-shrink-0">
            {selectedCount}
          </span>
        )}
        <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 min-w-[180px] max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500 italic">Sin opciones</p>
            ) : (
              [...options].sort((a, b) => a.name.localeCompare(b.name)).map(option => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.id)}
                    onChange={() => handleToggle(option.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{capitalize(option.name)}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Componente PhotoCard con zoom y tags
function PhotoCard({ photo, tagGroups, isSelected, onToggleSelection, selectedCount }) {
  const containerRef = useRef(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageCopied, setImageCopied] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showTooltip, setShowTooltip] = useState(false)
  const [showLimitMessage, setShowLimitMessage] = useState(false)
  const [limitMessagePos, setLimitMessagePos] = useState({ x: 0, y: 0 })

  // Resetear zoom cuando cambia la foto
  useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [photo.url])

  // Event listener para wheel con { passive: false }
  // Solo hace zoom con Ctrl + Scroll, sino scrollea la página
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e) => {
      // Solo hacer zoom si se presiona Ctrl o Cmd (Mac)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.15 : 0.15
        setScale(prev => Math.min(Math.max(prev + delta, 1), 5))
      }
      // Sin Ctrl, dejar que el scroll de página funcione normalmente
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Resetear zoom cuando se hace scroll en la página
  useEffect(() => {
    const handlePageScroll = () => {
      if (scale > 1) {
        setScale(1)
        setPosition({ x: 0, y: 0 })
      }
    }

    window.addEventListener('scroll', handlePageScroll, { passive: true })
    return () => window.removeEventListener('scroll', handlePageScroll)
  }, [scale])

  const handleMouseDown = (e) => {
    if (scale > 1) {
      e.preventDefault()
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

  const handleClick = async (e) => {
    // Solo copiar si no está zoomizado
    if (scale === 1) {
      // Copiar imagen al clipboard
      const result = await copyImageToClipboard(photo.url)
      if (result.success) {
        setImageCopied(true)
        setTimeout(() => setImageCopied(false), 1500)
      }

      // Manejar selección para configurador
      if (!isSelected && selectedCount >= 6) {
        // Mostrar mensaje flotante en la posición del click
        setLimitMessagePos({ x: e.clientX, y: e.clientY })
        setShowLimitMessage(true)
        setTimeout(() => setShowLimitMessage(false), 2000)
      } else {
        onToggleSelection(photo.id)
      }
    }
  }

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    } else {
      setScale(2.5)
    }
  }

  // Obtener nombres de tags de la foto
  const getPhotoTags = () => {
    const photoTags = photo.tags || []
    const tagNames = []
    const foundTagIds = new Set()

    // Primero buscar tags que existen en tagGroups
    for (const group of tagGroups) {
      for (const tag of group.tags) {
        if (photoTags.includes(tag.id)) {
          tagNames.push({ name: capitalize(tag.name), groupId: group.id })
          foundTagIds.add(tag.id)
        }
      }
    }

    // Agregar tags que no están en tagGroups (huérfanos)
    for (const tagId of photoTags) {
      if (!foundTagIds.has(tagId)) {
        tagNames.push({ name: capitalize(tagId), groupId: 'unknown' })
      }
    }

    return tagNames
  }

  const photoTagsList = getPhotoTags()

  // Colores por grupo
  const getTagColor = (groupId) => {
    const colors = {
      tipo: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      encabado: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
      acero: 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200',
      extras: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
      unknown: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300'
    }
    return colors[groupId] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Imagen con zoom */}
      <div
        ref={containerRef}
        className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => {
          handleMouseUp()
          setShowTooltip(false)
        }}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
      >
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <>
            <img
              src={photo.url}
              alt={photo.text || 'Foto de cuchillo'}
              className={`w-full h-full object-cover select-none ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              style={{
                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
              }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              draggable={false}
            />
            {/* Overlay de feedback */}
            {scale === 1 && (
              <div className={`absolute inset-0 transition-colors flex items-center justify-center pointer-events-none ${
                imageCopied ? 'bg-green-500/40' : ''
              }`}>
                {imageCopied && (
                  <span className="text-white text-sm font-medium px-3 py-1 rounded bg-green-600">
                    Imagen copiada
                  </span>
                )}
              </div>
            )}
            {/* Indicador de zoom */}
            {scale > 1 && (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
                {Math.round(scale * 100)}%
              </div>
            )}
            {/* Tooltip de Ctrl + Scroll */}
            {scale === 1 && showTooltip && (
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded transition-opacity pointer-events-none">
                Ctrl + Scroll para zoom
              </div>
            )}
            {/* Checkmark de selección */}
            {isSelected && (
              <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full p-1.5 shadow-lg pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mensaje flotante de límite alcanzado */}
      {showLimitMessage && (
        <div
          className="fixed bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse"
          style={{
            left: `${limitMessagePos.x}px`,
            top: `${limitMessagePos.y}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          Máximo 6 fotos
        </div>
      )}

      {/* Tags de la foto */}
      <div className="p-2">
        {photoTagsList.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {photoTagsList.map((tag, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 text-xs rounded-full ${getTagColor(tag.groupId)}`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Sin tags</p>
        )}
      </div>
    </div>
  )
}

// Componente Configurador
function Configurador({
  buckets,
  setBuckets,
  activeBucket,
  setActiveBucket,
  allPhotos,
  onClose,
  logo,
  tagGroups,
  showBucketDelete,
  setShowBucketDelete,
  handleDeleteBucket,
  savedCode,
  setSavedCode,
  footerConfig
}) {
  const [saving, setSaving] = useState(false)
  const [showShareButtons, setShowShareButtons] = useState(false)
  const [whatsappConfig, setWhatsappConfig] = useState(null)
  const [telegramConfig, setTelegramConfig] = useState(null)
  const [configuratorMessage, setConfiguratorMessage] = useState('')

  // Cerrar confirmación con Escape (en Configurador)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showBucketDelete !== null) {
        setShowBucketDelete(null)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showBucketDelete, setShowBucketDelete])

  // Cargar configuración inicial desde URL si existe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('config')

    if (code) {
      loadConfiguration(code)
    }

    loadContactConfig()
    loadConfiguratorMessage()
  }, [])

  const loadConfiguration = async (code) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'
      const response = await fetch(`${API_BASE}?route=configurator/${code}`)
      if (response.ok) {
        const data = await response.json()
        setBuckets(data.buckets || buckets)
        setSavedCode(code)
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error)
    }
  }

  const loadContactConfig = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'
      const response = await fetch(`${API_BASE}?route=config`)
      if (response.ok) {
        const data = await response.json()
        setWhatsappConfig(data.whatsapp || null)
        setTelegramConfig(data.telegram || null)
      }
    } catch (error) {
      console.error('Error al cargar config de contacto:', error)
    }
  }

  const loadConfiguratorMessage = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'
      const response = await fetch(`${API_BASE}?route=config`)
      if (response.ok) {
        const data = await response.json()
        setConfiguratorMessage(data.configurator_message || 'Hola Pablo, te envío mi página del configurador de cuchillos: {link}')
      }
    } catch (error) {
      console.error('Error al cargar mensaje del configurador:', error)
    }
  }

  // Estado para guardar la configuración de cada foto del bucket activo
  const currentBucket = buckets[activeBucket]
  const photoConfigs = currentBucket.photoConfigs

  const handleCheckboxChange = (photoId, field) => {
    setBuckets(prev => {
      const newBuckets = [...prev]
      newBuckets[activeBucket] = {
        ...newBuckets[activeBucket],
        photoConfigs: {
          ...newBuckets[activeBucket].photoConfigs,
          [photoId]: {
            ...newBuckets[activeBucket].photoConfigs[photoId],
            [field]: !newBuckets[activeBucket].photoConfigs[photoId][field]
          }
        }
      }
      return newBuckets
    })
  }

  const handleComentarioChange = (photoId, value) => {
    setBuckets(prev => {
      const newBuckets = [...prev]
      newBuckets[activeBucket] = {
        ...newBuckets[activeBucket],
        photoConfigs: {
          ...newBuckets[activeBucket].photoConfigs,
          [photoId]: {
            ...newBuckets[activeBucket].photoConfigs[photoId],
            comentarios: value
          }
        }
      }
      return newBuckets
    })
  }

  const handleSaveConfiguration = async () => {
    setSaving(true)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || './api/index.php'
      const response = await fetch(`${API_BASE}?route=configurator/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buckets,
          code: savedCode // Si ya existe un código, sobrescribirlo
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSavedCode(data.code)

        // Actualizar URL sin recargar (solo si no estaba ya)
        if (!savedCode) {
          window.history.pushState({}, '', `?config=${data.code}`)
        }

        // Mostrar botones de compartir por 5 segundos
        setShowShareButtons(true)
        setTimeout(() => {
          setShowShareButtons(false)
        }, 5000)
      }
    } catch (error) {
      console.error('Error al guardar configuración:', error)
    } finally {
      setSaving(false)
    }
  }

  const getShareLink = () => {
    if (!savedCode) return ''
    return `${window.location.origin}${window.location.pathname}?config=${savedCode}`
  }

  const getShareMessage = () => {
    const link = getShareLink()
    return configuratorMessage.replace('{link}', link)
  }

  const getPhotoTags = (photo) => {
    const photoTags = photo.tags || []
    const tagNames = []
    for (const group of tagGroups) {
      for (const tag of group.tags) {
        if (photoTags.includes(tag.id)) {
          tagNames.push(capitalize(tag.name))
        }
      }
    }
    return tagNames
  }

  // Obtener fotos del bucket activo
  const currentPhotos = currentBucket.selectedPhotos
    .map(id => allPhotos.find(p => p.id === id))
    .filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
        <div className="px-4 py-2">
          {/* Mobile: Layout vertical */}
          <div className="lg:hidden">
            {/* Header principal: Logo, título Configurador y botón guardar */}
            <div className="flex items-center justify-between gap-2 py-1">
              <div
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={onClose}
              >
                {logo && (
                  <img src={logo} alt="Logo" className="h-8 object-contain flex-shrink-0" />
                )}
                <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">
                  Configurador
                </h1>
              </div>

              {/* Botón de guardar o botones de compartir */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handleSaveConfiguration}
                  disabled={saving || showShareButtons}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : showShareButtons ? 'Datos guardados' : savedCode ? 'Guardar configuración' : 'Enviar configuración'}
                </button>

                {/* Botones de compartir (visibles por 5 segundos después de guardar) */}
                {showShareButtons && savedCode && (
                  <>
                    {whatsappConfig?.enabled && whatsappConfig.number && (
                      <a
                        href={`https://wa.me/${whatsappConfig.number}?text=${encodeURIComponent(getShareMessage())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs bg-[#25D366] text-white rounded hover:bg-[#20BA5A] transition-colors"
                      >
                        WhatsApp
                      </a>
                    )}
                    {telegramConfig?.enabled && telegramConfig.username && (
                      <a
                        href={`https://t.me/${telegramConfig.username}?text=${encodeURIComponent(getShareMessage())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs bg-[#0088cc] text-white rounded hover:bg-[#0077b3] transition-colors"
                      >
                        Telegram
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Subheader1: Buckets - TODO EN UN RENGLÓN */}
            <div className="flex items-center gap-1 py-1 border-t border-gray-200 dark:border-gray-700">
              {buckets.map((bucket, index) => (
                <div key={index} className="relative flex-1">
                  <button
                    onClick={() => setActiveBucket(index)}
                    className={`w-full px-1 py-1 text-xs rounded transition-colors ${
                      activeBucket === index
                        ? 'bg-blue-600 text-white'
                        : bucket.selectedPhotos.length > 0
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Cuchillo {index + 1}
                  </button>
                  {bucket.selectedPhotos.length > 0 && (
                    <button
                      onClick={() => setShowBucketDelete(index)}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 text-xs"
                    >
                      ×
                    </button>
                  )}
                  {/* Confirmación de eliminación inline */}
                  {showBucketDelete === index && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowBucketDelete(null)}
                      />
                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50 whitespace-nowrap">
                        <p className="text-xs text-gray-900 dark:text-white mb-2">¿Eliminar?</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDeleteBucket(index)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setShowBucketDelete(null)}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: Layout horizontal (sin cambios) */}
          <div className="hidden lg:flex items-center gap-4 justify-between">
            {/* Logo y nombre del sitio (clickeable) */}
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
              onClick={onClose}
            >
              {logo && (
                <img src={logo} alt="Logo" className="h-10 object-contain" />
              )}
              <div>
                <h1 className="text-base font-bold text-gray-900 dark:text-white">
                  {siteTitle}
                </h1>
              </div>
            </div>

            {/* Título del configurador con buckets */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Configurador
              </h2>
              {/* Buckets */}
              <div className="flex items-center gap-1">
                {buckets.map((bucket, index) => (
                  <div key={index} className="relative">
                    <button
                      onClick={() => setActiveBucket(index)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        activeBucket === index
                          ? 'bg-blue-600 text-white'
                          : bucket.selectedPhotos.length > 0
                          ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Cuchillo {index + 1}
                    </button>
                    {bucket.selectedPhotos.length > 0 && (
                      <button
                        onClick={() => setShowBucketDelete(index)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 text-xs"
                      >
                        ×
                      </button>
                    )}
                    {/* Confirmación de eliminación inline */}
                    {showBucketDelete === index && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowBucketDelete(null)}
                        />
                        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 z-50 whitespace-nowrap">
                          <p className="text-xs text-gray-900 dark:text-white mb-2">¿Eliminar?</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDeleteBucket(index)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setShowBucketDelete(null)}
                              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Volver
              </button>

              {/* Botón de guardar (siempre visible) */}
              <button
                onClick={handleSaveConfiguration}
                disabled={saving || showShareButtons}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : showShareButtons ? 'Datos guardados' : savedCode ? 'Guardar configuración' : 'Enviar configuración'}
              </button>

              {/* Botones de compartir (visibles por 5 segundos después de guardar) */}
              {showShareButtons && savedCode && (
                <>
                  {whatsappConfig?.enabled && whatsappConfig.number && (
                    <a
                      href={`https://wa.me/${whatsappConfig.number}?text=${encodeURIComponent(getShareMessage())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-xs bg-[#25D366] text-white rounded hover:bg-[#20BA5A] transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                  {telegramConfig?.enabled && telegramConfig.username && (
                    <a
                      href={`https://t.me/${telegramConfig.username}?text=${encodeURIComponent(getShareMessage())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-xs bg-[#0088cc] text-white rounded hover:bg-[#0077b3] transition-colors"
                    >
                      Telegram
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-7xl mx-auto">
          {currentPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">No hay fotos en este bucket</p>
              <p className="text-sm mb-4">Selecciona hasta 6 fotos desde el catálogo</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir al catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {currentPhotos.map(photo => (
                <div
                  key={photo.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Layout de la tarjeta: foto arriba, form abajo en mobile; lado a lado en desktop */}
                  <div className="flex flex-col">
                    {/* Foto */}
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative flex-shrink-0">
                      <img
                        src={photo.url}
                        alt={photo.text || 'Cuchillo'}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Tags de la foto */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex flex-wrap gap-1">
                        {getPhotoTags(photo).length > 0 ? (
                          getPhotoTags(photo).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sin tags</span>
                        )}
                      </div>
                    </div>

                    {/* Formulario */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {/* Columna izquierda */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoConfigs[photo.id]?.forma || false}
                              onChange={() => handleCheckboxChange(photo.id, 'forma')}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Forma</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoConfigs[photo.id]?.acero || false}
                              onChange={() => handleCheckboxChange(photo.id, 'acero')}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Acero</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoConfigs[photo.id]?.encabado || false}
                              onChange={() => handleCheckboxChange(photo.id, 'encabado')}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Encabado</span>
                          </label>
                        </div>

                        {/* Columna derecha */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoConfigs[photo.id]?.detalle1 || false}
                              onChange={() => handleCheckboxChange(photo.id, 'detalle1')}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Detalle 1</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoConfigs[photo.id]?.detalle2 || false}
                              onChange={() => handleCheckboxChange(photo.id, 'detalle2')}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Detalle 2</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={photoConfigs[photo.id]?.detalle3 || false}
                              onChange={() => handleCheckboxChange(photo.id, 'detalle3')}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Detalle 3</span>
                          </label>
                        </div>
                      </div>

                      {/* Campo de comentarios */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Comentarios
                        </label>
                        <textarea
                          value={photoConfigs[photo.id]?.comentarios || ''}
                          onChange={(e) => handleComentarioChange(photo.id, e.target.value)}
                          placeholder="Agrega comentarios o instrucciones especiales..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer footerConfig={footerConfig} whatsappConfig={whatsappConfig} telegramConfig={telegramConfig} />
    </div>
  )
}

// Componente Footer
function Footer({ footerConfig, whatsappConfig, telegramConfig }) {
  if (!footerConfig?.enabled) return null

  const socialLinks = [
    {
      name: 'Instagram',
      url: footerConfig.instagram ? `https://instagram.com/${footerConfig.instagram}` : null,
      color: 'text-pink-600 dark:text-pink-500',
      hoverColor: 'hover:text-pink-700 dark:hover:text-pink-400',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      )
    },
    {
      name: 'X',
      url: footerConfig.twitter ? `https://x.com/${footerConfig.twitter}` : null,
      color: 'text-black dark:text-white',
      hoverColor: 'hover:text-gray-700 dark:hover:text-gray-300',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      name: 'Facebook',
      url: footerConfig.facebook ? `https://facebook.com/${footerConfig.facebook}` : null,
      color: 'text-blue-600 dark:text-blue-500',
      hoverColor: 'hover:text-blue-700 dark:hover:text-blue-400',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    },
    {
      name: 'WhatsApp',
      url: whatsappConfig?.enabled && whatsappConfig.number ? `https://wa.me/${whatsappConfig.number}` : null,
      color: 'text-green-600 dark:text-green-500',
      hoverColor: 'hover:text-green-700 dark:hover:text-green-400',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      )
    },
    {
      name: 'Telegram',
      url: telegramConfig?.enabled && telegramConfig.username ? `https://t.me/${telegramConfig.username}` : null,
      color: 'text-blue-500 dark:text-blue-400',
      hoverColor: 'hover:text-blue-600 dark:hover:text-blue-300',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      )
    }
  ].filter(social => social.url) // Solo mostrar los que tienen URL configurada

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3 lg:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-4">
          {/* Redes sociales */}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                {footerConfig.social_text || 'Seguime en mis redes sociales'}
              </span>
              <div className="flex items-center gap-3">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${social.color} ${social.hoverColor} transition-all transform hover:scale-110`}
                    aria-label={social.name}
                    title={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Link al sitio web */}
          {footerConfig.website_url && (
            <div className="flex items-center gap-2">
              <a
                href={footerConfig.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors"
              >
                {footerConfig.website_text || 'Visita mi página web'}
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

export default App
