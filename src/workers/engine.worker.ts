import { expose } from 'comlink'

const api = {
  ping: () => 'pong' as const,
}

expose(api)

export type EngineWorkerAPI = typeof api
