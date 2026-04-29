/**
 * Application shell: sidebar, header, tab bar, content panels, toast provider.
 * Layout: flex row — ProjectSidebar (left) + content column (right).
 * Tab 0 (Теплопотери) renders ClimateCard + HeatLossTab; tab 1 (Приборы отопления)
 * renders EquipmentTab; tab 2 (Гидравлика) renders HydraulicsTab;
 * tab 3 (Тёплый пол) renders UfhTab; tab 4 (Сводка) renders SummaryTab.
 */

import { useEffect, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { AppHeader } from './components/layout/AppHeader'
import { ProjectSidebar } from './components/layout/ProjectSidebar'
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
import { runRegistryMigration } from './services/registryMigration'
import { useAutoUpdater } from './hooks/useAutoUpdater'

const TAB_NAMES = ['Теплопотери', 'Приборы отопления', 'Гидравлика', 'Тёплый пол', 'Сводка'] as const

export function App() {
  useAutoUpdater()
  const activeTab = useProjectStore(s => s.activeTab)
  const migrationRan = useRef(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (migrationRan.current) return
    migrationRan.current = true

    try {
      const api = {
        projectStore: useProjectStore,
        systemStore: useSystemStore,
        segmentStore: useSegmentStore,
        equipmentStore: useEquipmentStore,
        ufhLoopStore: useUfhLoopStore
      } as unknown as Parameters<typeof runV11Migration>[0]

      const result = runV11Migration(api)

      if (result.systemId !== null) {
        useProjectStore.getState().clearLegacyV10Fields()
      }

      if (result.migrated) {
        toast.info(
          'Проект обновлён до версии 1.1 — создана «Система 1» с переносом всех данных',
          { duration: 6000 }
        )
      }

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
    <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <ProjectSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader onMenuClick={() => setSidebarOpen(v => !v)} />
        <TabBar />
        <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-4">
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
      </div>

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
