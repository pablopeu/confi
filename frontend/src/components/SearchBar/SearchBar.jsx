import { useState, useEffect, useRef } from 'react'

export default function SearchBar({ value, onChange, placeholder = 'Buscar...', debounceMs = 300, collapsed = false }) {
  const [localValue, setLocalValue] = useState(value)
  const [isExpanded, setIsExpanded] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  const handleChange = (e) => {
    const newValue = e.target.value
    setLocalValue(newValue)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      onChange(newValue)
    }, debounceMs)
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (localValue) {
        handleClear()
      } else if (isExpanded) {
        setIsExpanded(false)
      }
    }
  }

  const handleIconClick = () => {
    if (isExpanded && !localValue) {
      setIsExpanded(false)
    } else {
      setIsExpanded(true)
    }
  }

  // Versión colapsada: solo muestra el icono
  if (collapsed && !isExpanded && !localValue) {
    return (
      <button
        onClick={handleIconClick}
        className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label={placeholder}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    )
  }

  // Versión expandida: muestra el input completo
  return (
    <div className={`relative transition-all duration-300 ${collapsed && isExpanded ? 'w-64' : 'w-full'}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!localValue && collapsed) {
            setTimeout(() => setIsExpanded(false), 200)
          }
        }}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-2.5
          bg-white dark:bg-gray-800
          border border-gray-300 dark:border-gray-600
          rounded-lg
          text-gray-900 dark:text-gray-100
          placeholder-gray-500 dark:placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          transition-colors
        "
        aria-label={placeholder}
      />

      <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
        {localValue && (
          <button
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Limpiar búsqueda"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Cerrar búsqueda"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
