/**
 * Export/Import buttons for project JSON data.
 * Export: instant download.
 * Import: file picker → mode dialog (new project | replace active) → optional confirm → apply.
 */

import { useRef, useState, useCallback } from 'react'
import { Download, Upload } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useProjectStore } from '../../store/projectStore'
import { useProjectsRegistryStore } from '../../store/projectsRegistryStore'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Import mode dialog: "Создать новый" | "Заменить активный" | "Отмена"
// ---------------------------------------------------------------------------

interface ImportModeDialogProps {
  open: boolean
  fileName: string
  onNew: () => void
  onReplace: () => void
  onCancel: () => void
}

function ImportModeDialog({ open, fileName, onNew, onReplace, onCancel }: ImportModeDialogProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Выбор режима импорта"
      data-testid="import-mode-dialog"
    >
      <div
        className="max-w-sm w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
          Импорт проекта
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4 truncate" title={fileName}>
          {fileName}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onNew}
            data-testid="import-mode-new"
          >
            Создать новый проект
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onReplace}
            data-testid="import-mode-replace"
          >
            Заменить активный
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            Отмена
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExportDropdown
// ---------------------------------------------------------------------------

export function ExportDropdown() {
  const exportJSON = useProjectStore(s => s.exportJSON)
  const importJSON = useProjectStore(s => s.importJSON)
  const { createProject, activeId } = useProjectsRegistryStore(
    useShallow(s => ({ createProject: s.createProject, activeId: s.activeId }))
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingData, setPendingData] = useState<unknown>(null)
  const [pendingFileName, setPendingFileName] = useState('')
  const [modeDialogOpen, setModeDialogOpen] = useState(false)
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false)

  const resetState = useCallback(() => {
    setPendingData(null)
    setPendingFileName('')
    setModeDialogOpen(false)
    setReplaceConfirmOpen(false)
  }, [])

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileName = file.name.replace(/\.json$/i, '')
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        setPendingData(parsed)
        setPendingFileName(fileName)

        if (activeId === null) {
          // No active project — create new immediately without dialog
          createProject(fileName)
          importJSON(parsed)
          toast.success(`Проект импортирован: «${fileName}»`)
        } else {
          setModeDialogOpen(true)
        }
      } catch {
        toast.error('Ошибка импорта: файл повреждён или имеет неверный формат')
      }
    }
    reader.onerror = () => {
      toast.error('Ошибка импорта: файл повреждён или имеет неверный формат')
    }
    reader.readAsText(file)

    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [activeId, createProject, importJSON])

  const handleModeNew = useCallback(() => {
    if (pendingData === null) return
    createProject(pendingFileName)
    importJSON(pendingData)
    toast.success(`Проект импортирован как новый: «${pendingFileName}»`)
    resetState()
  }, [pendingData, pendingFileName, createProject, importJSON, resetState])

  const handleModeReplace = useCallback(() => {
    setModeDialogOpen(false)
    setReplaceConfirmOpen(true)
  }, [])

  const handleReplaceConfirm = useCallback(() => {
    if (pendingData !== null) {
      importJSON(pendingData)
      toast.success('Проект загружен')
    }
    resetState()
  }, [pendingData, importJSON, resetState])

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={exportJSON}
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
          data-testid="import-file-input"
        />
      </div>

      <ImportModeDialog
        open={modeDialogOpen}
        fileName={pendingFileName}
        onNew={handleModeNew}
        onReplace={handleModeReplace}
        onCancel={resetState}
      />

      <ConfirmDialog
        open={replaceConfirmOpen}
        title="Заменить активный проект"
        message="Данные текущего проекта будут перезаписаны. Продолжить?"
        confirmLabel="Заменить"
        cancelLabel="Отмена"
        variant="destructive"
        onConfirm={handleReplaceConfirm}
        onCancel={resetState}
      />
    </>
  )
}
