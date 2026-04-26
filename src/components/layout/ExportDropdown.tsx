/**
 * Export/Import buttons for project JSON data.
 * Export: instant download. Import: file picker + validation + confirm dialog.
 */

import { useRef, useState, useCallback } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useProjectStore } from '../../store/projectStore'
import { toast } from 'sonner'

export function ExportDropdown() {
  const exportJSON = useProjectStore(s => s.exportJSON)
  const importJSON = useProjectStore(s => s.importJSON)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingData, setPendingData] = useState<unknown>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const handleExport = () => {
    exportJSON()
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        setPendingData(parsed)
        setIsConfirmOpen(true)
      } catch {
        toast.error('Ошибка импорта: файл повреждён или имеет неверный формат')
      }
    }
    reader.onerror = () => {
      toast.error('Ошибка импорта: файл повреждён или имеет неверный формат')
    }
    reader.readAsText(file)

    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [])

  const handleConfirm = useCallback(() => {
    if (pendingData !== null) {
      importJSON(pendingData)
    }
    setPendingData(null)
    setIsConfirmOpen(false)
  }, [pendingData, importJSON])

  const handleCancel = useCallback(() => {
    setPendingData(null)
    setIsConfirmOpen(false)
  }, [])

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={handleExport}
        >
          <span className="hidden sm:inline">Экспорт JSON</span>
          <span className="sm:hidden">
            <Download size={16} />
          </span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload size={14} />}
          onClick={handleImportClick}
        >
          <span className="hidden sm:inline">Импорт JSON</span>
          <span className="sm:hidden">
            <Upload size={16} />
          </span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        title="Импорт проекта"
        message="Импорт заменит текущий проект. Продолжить?"
        confirmLabel="Импортировать"
        cancelLabel="Отмена"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}
