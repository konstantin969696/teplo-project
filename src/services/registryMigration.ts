/**
 * Legacy migration for the projects registry.
 * Separate from projectSnapshot.ts to avoid circular imports:
 *   projectsRegistryStore → projectSnapshot (collect/restore/reset)
 *   registryMigration → projectsRegistryStore + projectSnapshot (no cycle)
 */

import { useProjectStore } from '../store/projectStore'
import { useEnclosureStore } from '../store/enclosureStore'
import { useSystemStore } from '../store/systemStore'
import { useProjectsRegistryStore } from '../store/projectsRegistryStore'

/**
 * If the projects registry is empty but working stores already contain data
 * (project created before the projects manager existed), registers that data
 * as "Проект 1" so it appears in the sidebar.
 * Idempotent — does nothing if registry already has projects.
 */
export function runRegistryMigration(): void {
  const registry = useProjectsRegistryStore.getState()
  if (registry.projectOrder.length > 0) return

  const hasLegacyData =
    Object.keys(useProjectStore.getState().rooms).length > 0 ||
    Object.keys(useEnclosureStore.getState().enclosures).length > 0 ||
    Object.keys(useSystemStore.getState().systems).length > 0

  if (hasLegacyData) {
    registry.createProject('Проект 1')
  }
}
