import { useState, useCallback, useMemo, useEffect } from 'react'
import { getCatalogTree } from '../../services/api'

function collectIds(node, ids) {
  if (Array.isArray(node)) { node.forEach(id => ids.add(id)); return }
  Object.values(node).forEach(v => collectIds(v, ids))
}

const LEVELS = [
  { key: 'tipo',      label: 'Tipo',     fn: 'getTipos' },
  { key: 'estilo',    label: 'Estilo',   fn: 'getEstilos' },
  { key: 'ag',        label: 'Acero',    fn: 'getAceroGrupos' },
  { key: 'acero',     label: '',         fn: 'getAceros' },
  { key: 'encabado',  label: 'Encabado', fn: 'getEncabados' },
]

const STEEL_ORDER = { 'Acero inoxidable': 1, 'Acero carbono': 2, 'Acero damasco': 3, 'Otros': 4 }

export default function Catalog({ onCopyImage, darkMode, onPhotoOpen, initialPhotoId }) {
  const [state, setState] = useState({ tipo: null, estilo: null, ag: null, acero: null, encabado: null })
  const [fullImg, setFullImg] = useState(null)
  const [catalogData, setCatalogData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await getCatalogTree()
        if (!cancelled) setCatalogData(data)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar el catálogo')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const getTipos = useCallback(() => {
    if (!catalogData?.tree) return []
    return Object.entries(catalogData.tree).map(([k, v]) => {
      const ids = new Set(); collectIds(v, ids)
      return { key: k, label: k, count: ids.size }
    }).sort((a, b) => b.count - a.count)
  }, [catalogData])

  const getEstilos = useCallback(() => {
    if (!state.tipo || !catalogData?.tree?.[state.tipo]) return []
    const n = catalogData.tree[state.tipo]
    return Object.entries(n).map(([k, v]) => {
      const ids = new Set(); collectIds(v, ids)
      return { key: k, label: k, count: ids.size }
    }).sort((a, b) => {
      if (a.key === 'Vaina Cincelada') return 1
      if (b.key === 'Vaina Cincelada') return -1
      return b.count - a.count
    })
  }, [state.tipo, catalogData])

  const getAceroGrupos = useCallback(() => {
    if (!state.estilo || !catalogData?.tree?.[state.tipo]?.[state.estilo]) return []
    const n = catalogData.tree[state.tipo][state.estilo]
    return Object.entries(n).map(([k, v]) => {
      const ids = new Set(); collectIds(v, ids)
      return { key: k, label: k, count: ids.size }
    }).sort((a, b) => (STEEL_ORDER[a.key] || 99) - (STEEL_ORDER[b.key] || 99))
  }, [state.tipo, state.estilo, catalogData])

  const getAceros = useCallback(() => {
    if (!state.ag || !catalogData?.tree?.[state.tipo]?.[state.estilo]?.[state.ag]) return []
    const n = catalogData.tree[state.tipo][state.estilo][state.ag]
    return Object.entries(n).map(([k, v]) => ({
      key: k, label: k, count: Object.keys(v || {}).length
    })).sort((a, b) => b.count - a.count)
  }, [state.tipo, state.estilo, state.ag, catalogData])

  const getEncabados = useCallback(() => {
    if (!state.acero || !catalogData?.tree?.[state.tipo]?.[state.estilo]?.[state.ag]?.[state.acero]) return []
    const n = catalogData.tree[state.tipo][state.estilo][state.ag][state.acero]
    return Object.entries(n).map(([k, v]) => ({
      key: k, label: k, count: v.length
    })).sort((a, b) => b.count - a.count)
  }, [state.tipo, state.estilo, state.ag, state.acero, catalogData])

  // Auto-open initial photo from URL param
  useEffect(() => {
    if (initialPhotoId && catalogData?.photosMap?.[initialPhotoId]) {
      const url = `https://peu.net/confi/${catalogData.photosMap[initialPhotoId].url}`
      setFullImg(url)
      if (onPhotoOpen) onPhotoOpen(initialPhotoId)
    }
  }, [initialPhotoId, catalogData])

  const matching = useMemo(() => {
    if (!catalogData?.tree) return []
    let n = catalogData.tree
    if (!state.tipo || !n[state.tipo]) return []
    n = n[state.tipo]
    if (!state.estilo) { const ids = new Set(); collectIds(n, ids); return [...ids] }
    if (!n[state.estilo]) return []
    n = n[state.estilo]
    if (!state.ag) { const ids = new Set(); collectIds(n, ids); return [...ids] }
    if (!n[state.ag]) return []
    n = n[state.ag]
    if (!state.acero) { const ids = new Set(); collectIds(n, ids); return [...ids] }
    if (!n[state.acero]) return []
    n = n[state.acero]
    if (!state.encabado) { const ids = new Set(); collectIds(n, ids); return [...ids] }
    return n[state.encabado] || []
  }, [state, catalogData])

  const showLevel = useMemo(() => {
    if (!state.tipo) return 0
    if (!state.estilo) return 1
    if (!state.ag) return 2
    if (!state.acero) return 3
    return 4
  }, [state])

  const getters = [getTipos, getEstilos, getAceroGrupos, getAceros, getEncabados]
  const items = getters[showLevel]()
  const selKey = [state.tipo, state.estilo, state.ag, state.acero, state.encabado][showLevel]

  const pick = (key) => {
    const ks = ['tipo', 'estilo', 'ag', 'acero', 'encabado']
    if (showLevel === 0) {
      if (state.tipo === key) setState({ tipo: null, estilo: null, ag: null, acero: null, encabado: null })
      else setState({ tipo: key, estilo: null, ag: null, acero: null, encabado: null })
    } else {
      const k = ks[showLevel]
      const next = { ...state }
      if (state[k] === key) {
        next[k] = null
        for (let i = showLevel + 1; i < ks.length; i++) next[ks[i]] = null
      } else {
        next[k] = key
        for (let i = showLevel + 1; i < ks.length; i++) next[ks[i]] = null
      }
      setState(next)
    }
  }

  const resetTo = (levelKey) => {
    const ks = ['tipo', 'estilo', 'ag', 'acero', 'encabado']
    const next = { ...state }
    let clear = false
    for (const k of ks) {
      if (k === levelKey) { clear = true; continue }
      if (clear) next[k] = null
    }
    setState(next)
  }

  // Build breadcrumb items
  const crumbItems = []
  for (let i = 0; i < LEVELS.length; i++) {
    const v = state[LEVELS[i].key]
    if (!v) break
    crumbItems.push({ label: LEVELS[i].label || v, val: v, key: LEVELS[i].key, last: i === showLevel - 1 })
  }
  if (crumbItems.length > 0) {
    crumbItems.unshift({ label: 'Inicio', val: '', key: 'tipo', last: false, isInicio: true })
  }

  const handleCardClick = (url, id) => {
    setFullImg(url)
    if (onCopyImage) onCopyImage(url)
    if (onPhotoOpen) onPhotoOpen(id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 dark:text-gray-500 text-sm animate-pulse">Cargando catálogo...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 dark:text-red-400 text-sm">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 lg:px-4 lg:py-3">
        {/* Breadcrumb line */}
        {crumbItems.length > 0 && (
          <div className="flex flex-wrap items-center justify-start lg:justify-center gap-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">
            {crumbItems.map((it, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 dark:text-gray-600 mx-0.5">/</span>}
                {it.isInicio ? (
                  <button
                    onClick={() => setState({ tipo: null, estilo: null, ag: null, acero: null, encabado: null })}
                    className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                  >
                    Inicio
                  </button>
                ) : it.last ? (
                  <span className="text-gray-900 dark:text-white font-medium">{it.val}</span>
                ) : (
                  <button
                    onClick={() => resetTo(it.key)}
                    className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
                  >
                    {it.label}: {it.val}<span className="text-[10px] ml-0.5 opacity-50">×</span>
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Inicio: tarjetas de tipos (solo cuando no hay tipo seleccionado) */}
        {!state.tipo ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto mt-4">
            {getTipos().map(it => {
              const colors = {
                'Cocina':     { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-700', text: 'text-amber-800 dark:text-amber-200', badge: 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300', icon: 'M3 2v4a2 2 0 002 2h2v2H5a4 4 0 01-4-4V2h2zm4 14h2v2a2 2 0 01-2 2H5v-2h2v-2zm4-14h10v2H11V2zm0 6h10v2H11V8zm0 6h7v2h-7v-2z' },
                'Asado':      { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-700', text: 'text-red-800 dark:text-red-200', badge: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300', icon: 'M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z' },
                'Orientales': { bg: 'bg-teal-50 dark:bg-teal-900/30', border: 'border-teal-200 dark:border-teal-700', text: 'text-teal-800 dark:text-teal-200', badge: 'bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-12h2v8h-2V5z' },
                'Otros':      { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-600', text: 'text-gray-700 dark:text-gray-300', badge: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-12h2v8h-2V5z' },
              }
              const c = colors[it.key] || colors['Otros']
              return (
                <button
                  key={it.key}
                  onClick={() => pick(it.key)}
                  className={`${c.bg} ${c.border} border-2 rounded-xl overflow-hidden text-left hover:shadow-md transition-all cursor-pointer flex flex-col`}
                >
                  {catalogData?.covers?.[it.key] ? (
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      <img
                        src={`https://peu.net/confi/${catalogData.covers[it.key].url}`}
                        alt={it.label}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="p-4 sm:p-6 pb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </div>
                  )}
                  <div className="p-3 sm:p-4 pt-0 flex items-center justify-between">
                    <span className={`text-sm sm:text-base font-semibold ${c.text}`}>{it.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                      {it.count} cuchillos
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <>
            {/* Chip section for current level (after tipo selected) */}
            {items.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                {items.map(it => {
                  const sel = it.key === selKey
                  return (
                    <button
                      key={it.key}
                      onClick={() => pick(it.key)}
                      className={`px-2.5 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1.5 ${
                        sel
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300 font-medium'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-white dark:hover:bg-gray-600'
                      }`}
                    >
                      {it.label}
                      <span className={`text-[11px] rounded-full px-1.5 py-px border ${
                        sel
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-300 border-blue-400 dark:border-blue-600'
                          : 'bg-white dark:bg-gray-600 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-500'
                      }`}>
                        {it.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Status bar */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {matching.length} cuchillos
            </div>
          </>
        )}

        {/* Photo grid or empty state */}
        {!state.tipo ? null : matching.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-sm">No hay cuchillos con esa combinación</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {matching.map(id => {
              const p = catalogData?.photosMap?.[id]
              if (!p) return null
              const url = `https://peu.net/confi/${p.url}`
              return (
                <div
                  key={id}
                  onClick={() => handleCardClick(url, id)}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    <img src={url} alt="" loading="lazy" className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span class="text-xs text-gray-400 uppercase tracking-wider">Sin imagen</span>' }}
                    />
                  </div>
                  <div className="p-2.5 flex flex-wrap gap-1">
                    {(p.tags || []).filter(t => t.toLowerCase() !== 'cover').slice(0, 12).map((t, i) => (
                      <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fullsize modal */}
      {fullImg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer"
          style={{ background: darkMode ? 'rgba(0,0,0,0.86)' : 'rgba(255,255,255,0.86)' }}
          onClick={() => { setFullImg(null); if (onPhotoOpen) onPhotoOpen(null) }}
        >
          <div className="flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="relative inline-block">
              <img
                src={fullImg}
                alt=""
                className="max-w-[90vw] max-h-[75vh] sm:max-h-[90vh] object-contain rounded-md border-4 border-white dark:border-gray-800 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_20px_60px_rgba(0,0,0,0.3)]"
              />
              <div
                className="hidden sm:block absolute bottom-4 right-4 max-w-[260px] bg-gray-900/95 text-white text-[11px] px-4 py-3 rounded-lg shadow-lg pointer-events-none leading-relaxed"
              >
                Si apretás el botón de WhatsApp o Telegram acá al costado le mando el link de esta foto a Pablo
              </div>
            </div>
            <div
              className="sm:hidden mt-3 ml-3 max-w-[55vw] bg-gray-900/95 text-white text-[11px] px-3 py-4 rounded-lg shadow-lg pointer-events-none leading-relaxed relative"
            >
              Si apretás el botón de WhatsApp o Telegram acá al costado le mando el link de esta foto a Pablo
              <div className="absolute -right-3 bottom-3 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
