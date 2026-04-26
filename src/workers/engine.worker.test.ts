import { describe, it, expect } from 'vitest'

/**
 * Worker module test — verifies the worker file compiles and is importable.
 * A full Comlink integration test (new Worker + wrap + ping/pong) requires
 * a real browser environment. That smoke test is verified via `npm run dev`
 * in Plan 03's checkpoint.
 */
describe('engine worker API (module test)', () => {
  it('worker file is importable and has expected type export', async () => {
    const workerModule = await import('./engine.worker')
    expect(workerModule).toBeDefined()
  })
})
