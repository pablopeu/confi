import { useState } from 'react'

function PhotoCard({ photo, isSelected, onToggleSelect, onCopyImage, onCopyText, onViewPhoto }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden
        border-2 transition-all duration-200
        ${isSelected
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600'
        }
      `}
    >
      {/* Checkbox de selección */}
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(photo.id)}
          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          aria-label={`Seleccionar ${photo.text || 'foto'}`}
        />
      </div>

      {/* Imagen */}
      <div
        className="aspect-square bg-gray-100 dark:bg-gray-700 cursor-pointer relative overflow-hidden"
        onClick={() => onViewPhoto(photo)}
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
          <img
            src={photo.url}
            alt={photo.text || 'Foto de cuchillo'}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* Info y acciones */}
      <div className="p-3">
        {photo.steel_type && (
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded mb-2">
            {photo.steel_type}
          </span>
        )}

        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 min-h-[2.5rem]">
          {photo.text || 'Sin descripción'}
        </p>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onCopyImage(photo)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            title="Copiar imagen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Imagen
          </button>
          <button
            onClick={() => onCopyText(photo)}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            title="Copiar texto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Texto
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PhotoGrid({
  photos,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onCopyImage,
  onCopyText,
  onCopySelected,
  onViewPhoto,
  loading
}) {
  const hasSelection = selectedIds.length > 0
  const allSelected = photos.length > 0 && selectedIds.length === photos.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-lg font-medium">No hay fotos</p>
        <p className="text-sm">Selecciona una categoría o ajusta los filtros</p>
      </div>
    )
  }

  return (
    <div>
      {/* Barra de acciones de selección */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
          {hasSelection && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedIds.length} seleccionado{selectedIds.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {hasSelection && (
          <div className="flex gap-2">
            <button
              onClick={() => onCopySelected('image')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Copiar imágenes
            </button>
            <button
              onClick={() => onCopySelected('text')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Copiar textos
            </button>
          </div>
        )}
      </div>

      {/* Grid de fotos */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            isSelected={selectedIds.includes(photo.id)}
            onToggleSelect={onToggleSelect}
            onCopyImage={onCopyImage}
            onCopyText={onCopyText}
            onViewPhoto={onViewPhoto}
          />
        ))}
      </div>
    </div>
  )
}
