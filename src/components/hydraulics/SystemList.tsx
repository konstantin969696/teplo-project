/**
 * SystemList — root orchestrator таба «Гидравлика» (или «Тёплый пол», variant="ufh").
 * Рендерит список SystemAccordion + кнопку "+ Добавить систему".
 *
 * I1 revision: handleAdd инкрементирует N до уникального имени "Система {N}".
 */

import { Database, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSystemStore, selectOrderedSystems } from '../../store/systemStore'
import { DEFAULT_SYSTEM } from '../../types/system'
import { Button } from '../ui/Button'
import { SystemAccordion } from './SystemAccordion'

interface Props {
  readonly variant: 'hydraulics' | 'ufh'
}

export function SystemList({ variant }: Props) {
  const orderedSystems = useSystemStore(useShallow(selectOrderedSystems))
  const addSystem = useSystemStore(s => s.addSystem)

  const handleAdd = () => {
    // I1: unique name suffix. Если "Система N" уже занято — инкрементируем до уникального.
    const existingNames = new Set(orderedSystems.map(s => s.name))
    let n = orderedSystems.length + 1
    let candidate = `Система ${n}`
    while (existingNames.has(candidate)) {
      n += 1
      candidate = `Система ${n}`
    }
    addSystem({ name: candidate, ...DEFAULT_SYSTEM })
  }

  if (orderedSystems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Database
          size={48}
          aria-hidden="true"
          className="text-[var(--color-text-secondary)]"
        />
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          Нет систем отопления
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] text-center max-w-md">
          Нажмите «+ Добавить систему» чтобы начать
        </p>
        <Button
          variant="primary"
          size="md"
          icon={<Plus size={14} />}
          onClick={handleAdd}
        >
          Добавить систему
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      {orderedSystems.map(sys => (
        <SystemAccordion key={sys.id} systemId={sys.id} variant={variant} />
      ))}
      <Button
        variant="secondary"
        size="md"
        icon={<Plus size={14} />}
        onClick={handleAdd}
        className="self-start mt-2"
      >
        + Добавить систему
      </Button>
    </div>
  )
}
