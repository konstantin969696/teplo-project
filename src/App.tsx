/**
 * Application shell: header, tab bar, content panels, toast provider.
 * Tab 0 (Теплопотери) renders ClimateCard + HeatLossTab; tab 1 (Приборы отопления)
 * renders EquipmentTab; tab 2 (Гидравлика) renders HydraulicsTab;
 * tab 3 (Тёплый пол) renders UfhTab; tab 4 (Сводка) renders SummaryTab.
 */

import { useEffect, useRef } from 'react'
import { toast, Toaster } from 'sonner'
import { AppHeader } from './components/layout/AppHeader'
import { TabBar } from './components/layout/TabBar'
import { ClimateCard } from './components/climate/ClimateCard'
import { HeatLossTab } from './components/heatLoss/HeatLossTab'
import { EquipmentTab } from './components/equipment/EquipmentTab'
import { HydraulicsTab } from './components/hydraulics/HydraulicsTab'
import { UfhTab } from './components/ufh/UfhTab'
import { SummaryTab } from './components/summary/SummaryTab'
import { runV11Migration } from './engine/migration'
import { useProjectStore } from './store/projectStore'
import { useSystemStore } from './store/systemStore'
import { useSegmentStore } from './store/segmentStore'
import { useEquipmentStore } from './store/equipmentStore'
import { useUfhLoopStore } from './store/ufhLoopStore'
import { runRegistryMigration } from './services/projectSnapshot'

const TAB_NAMES = ['Теплопотери', 'Приборы отопления', 'Гидравлика', 'Тёплый пол', 'Сводка'] as const

export function App() {
  const activeTab = useProjectStore(s => s.activeTab)
  const migrationRan = useRef(false)

  useEffect(() => {
    if (migrationRan.current) return
    migrationRan.current = true

    try {
      // Zustand stores implement `getState()` but its return type (e.g. ProjectState)
      // doesn't structurally match migration's internal ProjectStoreState (which has
      // an index signature). Bridge via unknown — runtime shape is compatible.
      const api = {
        projectStore: useProjectStore,
        systemStore: useSystemStore,
        segmentStore: useSegmentStore,
        equipmentStore: useEquipmentStore,
        ufhLoopStore: useUfhLoopStore
      } as unknown as Parameters<typeof runV11Migration>[0]

      const result = runV11Migration(api)

      // B1 revision: clearLegacyV10Fields runs ONLY after real migration/seed
      // (systemId !== null → migrated=true OR seeded=true). On idempotent no-op
      // (already migrated earlier), legacy fields are already cleared.
      if (result.systemId !== null) {
        useProjectStore.getState().clearLegacyV10Fields()
      }

      if (result.migrated) {
        toast.info(
          'Проект обновлён до версии 1.1 — создана «Система 1» с переносом всех данных',
          { duration: 6000 }
        )
      }
      // result.seeded → silent first-run seed

      // Phase 1: register existing data in the projects registry if needed
      runRegistryMigration()
    } catch (err) {
      console.error('[App] runV11Migration failed', err)
      toast.error(
        `Ошибка миграции проекта: ${(err as Error).message}. Экспортируйте старый JSON и создайте issue.`,
        { duration: 10000 }
      )
    }
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <AppHeader />
      <TabBar />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        {TAB_NAMES.map((name, i) => (
          <div
            key={name}
            id={`tabpanel-${i}`}
            role="tabpanel"
            aria-labelledby={`tab-${i}`}
            hidden={activeTab !== i}
          >
            {i === 0 ? (
              <>
                <ClimateCard />
                <HeatLossTab />
              </>
            ) : i === 1 ? (
              <EquipmentTab />
            ) : i === 2 ? (
              <HydraulicsTab />
            ) : i === 3 ? (
              <UfhTab />
            ) : (
              <SummaryTab />
            )}
          </div>
        ))}
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)'
          }
        }}
        richColors
      />
    </div>
  )
}
