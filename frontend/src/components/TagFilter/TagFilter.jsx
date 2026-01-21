import { useState } from 'react'

export default function TagFilter({ tagGroups, selectedTags, onTagToggle, onClearAll }) {
  const [collapsedGroups, setCollapsedGroups] = useState({})

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  const hasSelectedTags = selectedTags.length > 0

  return (
    <div className="space-y-4">
      {/* Header con botón limpiar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Filtros
        </h2>
        {hasSelectedTags && (
          <button
            onClick={onClearAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Limpiar ({selectedTags.length})
          </button>
        )}
      </div>

      {/* Grupos de tags */}
      {tagGroups.map((group) => {
        const isCollapsed = collapsedGroups[group.id]
        const groupSelectedCount = group.tags.filter(t => selectedTags.includes(t.id)).length

        // No mostrar grupos vacíos
        if (group.tags.length === 0) return null

        return (
          <div key={group.id} className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <button
              onClick={() => toggleGroup(group.id)}
              className="flex items-center justify-between w-full text-left py-1"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {group.name}
                {groupSelectedCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                    {groupSelectedCount}
                  </span>
                )}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {!isCollapsed && (
              <div className="mt-2 space-y-1">
                {group.tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id)
                  return (
                    <label
                      key={tag.id}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors
                        ${isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onTagToggle(tag.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                        {tag.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Tags seleccionados como chips */}
      {hasSelectedTags && (
        <div className="pt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Seleccionados:</p>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map((tagId) => {
              // Buscar el nombre del tag
              let tagName = tagId
              for (const group of tagGroups) {
                const found = group.tags.find(t => t.id === tagId)
                if (found) {
                  tagName = found.name
                  break
                }
              }

              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                >
                  {tagName}
                  <button
                    onClick={() => onTagToggle(tagId)}
                    className="hover:text-blue-600 dark:hover:text-blue-100"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
