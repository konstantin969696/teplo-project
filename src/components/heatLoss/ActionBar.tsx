/**
 * Action bar with room management buttons.
 * «Добавить помещение» теперь живёт в футере каждого этажа внутри таблицы,
 * здесь остаётся только копирование этажа и каталог конструкций.
 */

import { useState } from 'react'
import { Copy, ChevronDown, Layers, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { ConstructionCatalogModal } from './ConstructionCatalogModal'

interface ActionBarProps {
  onAddFloor: () => void
  onCopyFloor: () => void
  hasRooms: boolean
}

export function ActionBar({ onAddFloor, onCopyFloor, hasRooms }: ActionBarProps) {
  const [showConstructionCatalog, setShowConstructionCatalog] = useState(false)

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        variant="secondary"
        size="sm"
        onClick={onAddFloor}
        icon={<Plus size={14} aria-hidden="true" />}
      >
        Добавить этаж
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onCopyFloor}
        disabled={!hasRooms}
        icon={<Copy size={14} aria-hidden="true" />}
      >
        Копировать этаж
        <ChevronDown size={12} aria-hidden="true" className="ml-1" />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowConstructionCatalog(true)}
        icon={<Layers size={14} aria-hidden="true" />}
      >
        Конструкции…
      </Button>
      <ConstructionCatalogModal
        open={showConstructionCatalog}
        onClose={() => setShowConstructionCatalog(false)}
      />
    </div>
  )
}
