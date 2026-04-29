import { useEffect } from 'react'
import { toast } from 'sonner'

export function useAutoUpdater() {
  useEffect(() => {
    // Запускаем только в Tauri-окружении
    if (!window.__TAURI_INTERNALS__) return

    let cancelled = false

    async function checkForUpdate() {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const { relaunch } = await import('@tauri-apps/plugin-process')
        const update = await check()

        if (cancelled || !update) return

        toast.info(`Доступна версия ${update.version}`, {
          description: 'Новая версия Теплопроекта готова к установке.',
          duration: Infinity,
          action: {
            label: 'Обновить и перезапустить',
            onClick: async () => {
              await update.downloadAndInstall()
              await relaunch()
            },
          },
        })
      } catch {
        // Сеть недоступна или сервер не ответил — молча игнорируем
      }
    }

    checkForUpdate()
    return () => { cancelled = true }
  }, [])
}
