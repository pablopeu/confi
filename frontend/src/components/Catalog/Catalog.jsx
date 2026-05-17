import { useState, useCallback, useMemo, useEffect } from 'react'
import { TREE, photosMap } from '../../data/catalogTree'

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

  const getTipos = useCallback(() => {
    return Object.entries(TREE).map(([k, v]) => {
      const ids = new Set(); collectIds(v, ids)
      return { key: k, label: k, count: ids.size }
    }).sort((a, b) => b.count - a.count)
  }, [])

  const getEstilos = useCallback(() => {
    if (!state.tipo || !TREE[state.tipo]) return []
    const n = TREE[state.tipo]
    return Object.entries(n).map(([k, v]) => {
      const ids = new Set(); collectIds(v, ids)
      return { key: k, label: k, count: ids.size }
    }).sort((a, b) => {
      if (a.key === 'Vaina Cincelada') return 1
      if (b.key === 'Vaina Cincelada') return -1
      return b.count - a.count
    })
  }, [state.tipo])

  const getAceroGrupos = useCallback(() => {
    if (!state.estilo || !TREE[state.tipo]?.[state.estilo]) return []
    const n = TREE[state.tipo][state.estilo]
    return Object.entries(n).map(([k, v]) => {
      const ids = new Set(); collectIds(v, ids)
      return { key: k, label: k, count: ids.size }
    }).sort((a, b) => (STEEL_ORDER[a.key] || 99) - (STEEL_ORDER[b.key] || 99))
  }, [state.tipo, state.estilo])

  const getAceros = useCallback(() => {
    if (!state.ag || !TREE[state.tipo]?.[state.estilo]?.[state.ag]) return []
    const n = TREE[state.tipo][state.estilo][state.ag]
    return Object.entries(n).map(([k, v]) => ({
      key: k, label: k, count: Object.keys(v || {}).length
    })).sort((a, b) => b.count - a.count)
  }, [state.tipo, state.estilo, state.ag])

  const getEncabados = useCallback(() => {
    if (!state.acero || !TREE[state.tipo]?.[state.estilo]?.[state.ag]?.[state.acero]) return []
    const n = TREE[state.tipo][state.estilo][state.ag][state.acero]
    return Object.entries(n).map(([k, v]) => ({
      key: k, label: k, count: v.length
    })).sort((a, b) => b.count - a.count)
  }, [state.tipo, state.estilo, state.ag, state.acero])

  // Auto-open initial photo from URL param
  useEffect(() => {
    if (initialPhotoId && photosMap[initialPhotoId]) {
      const url = `https://peu.net/confi/${photosMap[initialPhotoId].url}`
      setFullImg(url)
      if (onPhotoOpen) onPhotoOpen(initialPhotoId)
    }
  }, [initialPhotoId])

  const matching = useMemo(() => {
    let n = TREE
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
  }, [state])

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
    let found = false
    const next = { ...state }
    for (const k of ks) {
      if (k === levelKey) { found = true; next[k] = null; continue }
      if (found) next[k] = null
    }
    if (levelKey === 'tipo') setState({ tipo: null, estilo: null, ag: null, acero: null, encabado: null })
    else setState(next)
  }

  // Build breadcrumb items
  const crumbItems = []
  for (let i = 0; i < LEVELS.length; i++) {
    const v = state[LEVELS[i].key]
    if (!v) break
    crumbItems.push({ label: LEVELS[i].label || v, val: v, key: LEVELS[i].key, last: i === showLevel - 1 })
  }

  const handleCardClick = (url, id) => {
    setFullImg(url)
    if (onCopyImage) onCopyImage(url)
    if (onPhotoOpen) onPhotoOpen(id)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 lg:px-4 lg:py-3">
        {/* Breadcrumb line */}
        {crumbItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2 leading-relaxed">
            {crumbItems.map((it, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 dark:text-gray-600 mx-0.5">/</span>}
                {it.last ? (
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

        {/* Chip section for current level */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
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
        {state.tipo && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {matching.length} cuchillos
          </div>
        )}

        {/* Photo grid or empty state */}
        {!state.tipo ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Seleccioná un tipo de cuchillo para empezar</p>
          </div>
        ) : matching.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-sm">No hay cuchillos con esa combinación</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {matching.map(id => {
              const p = photosMap[id]
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
                    {(p.tags || []).slice(0, 12).map((t, i) => (
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
              className="sm:hidden mt-3 max-w-[85vw] bg-gray-900/95 text-white text-[11px] px-4 py-3 rounded-lg shadow-lg pointer-events-none leading-relaxed text-center"
            >
              Si apretás el botón de WhatsApp o Telegram acá al costado le mando el link de esta foto a Pablo
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
