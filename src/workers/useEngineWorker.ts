import { wrap } from 'comlink'
import type { EngineWorkerAPI } from './engine.worker'

let _proxy: ReturnType<typeof wrap<EngineWorkerAPI>> | null = null

export function getEngineWorker() {
  if (!_proxy) {
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
    _proxy = wrap<EngineWorkerAPI>(worker)
  }
  return _proxy
}
