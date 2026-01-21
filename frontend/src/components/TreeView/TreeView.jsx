import { useState } from 'react'

function TreeNode({ node, level = 0, selectedId, onSelect }) {
  const [isExpanded, setIsExpanded] = useState(level === 0)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedId === node.id

  const handleToggle = (e) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleSelect = () => {
    onSelect(node)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect()
    }
    if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      setIsExpanded(true)
    }
    if (e.key === 'ArrowLeft' && isExpanded) {
      setIsExpanded(false)
    }
  }

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer
          transition-colors duration-150
          ${isSelected
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5 h-5" />
        )}

        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>

        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {node.name}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TreeView({ categories, selectedId, onSelect, steelTypes, selectedSteel, onSteelSelect }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto" role="tree" aria-label="Categorías">
        {categories.map((category) => (
          <TreeNode
            key={category.id}
            node={category}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {steelTypes && steelTypes.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-2">
            Tipo de Acero
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => onSteelSelect(null)}
              className={`
                w-full text-left px-3 py-1.5 text-sm rounded transition-colors
                ${!selectedSteel
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              Todos
            </button>
            {steelTypes.map((steel) => (
              <button
                key={steel.id}
                onClick={() => onSteelSelect(steel.id)}
                className={`
                  w-full text-left px-3 py-1.5 text-sm rounded transition-colors
                  ${selectedSteel === steel.id
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                {steel.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
