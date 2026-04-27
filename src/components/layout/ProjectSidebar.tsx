/**
 * Project sidebar — collapsible on desktop, drawer on mobile.
 * Desktop: 240px wide, sticky top-0, collapses to 56px icon-only mode.
 * Mobile (<md): fixed drawer with overlay, toggled by hamburger in AppHeader.
 */

import { useState, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Plus, ChevronLeft, ChevronRight,
  MoreHorizontal, Pencil, Copy, Download, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useProjectsRegistryStore } from '../../store/projectsRegistryStore'
import { useProjectStore } from '../../store/projectStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { relativeDate } from '../../lib/relativeDate'
import type { ProjectMeta } from '../../types/project'

interface ProjectSidebarProps {
  readonly open: boolean    // mobile drawer open/close
  readonly onClose: () => void
}

// ---------------------------------------------------------------------------
// New-project dialog
// ---------------------------------------------------------------------------

function NewProjectDialog({
  open, defaultName, onSubmit, onCancel,
}: {
  open: boolean
  defaultName: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
    }
  }, [open, defaultName])

  if (!open) return null

  const submit = () => {
    const t = name.trim()
    if (t) onSubmit(t)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Новый проект"
    >
      <div
        className="max-w-sm w-full mx-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Новый проект
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder={defaultName}
          className="w-full px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          aria-label="Название проекта"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            aria-label="Создать проект"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single project row
// ---------------------------------------------------------------------------

interface ProjectRowProps {
  project: ProjectMeta
  isActive: boolean
  collapsed: boolean
  onActivate: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

function ProjectRow({
  project, isActive, collapsed,
  onActivate, onRename, onDuplicate, onExport, onDelete,
}: ProjectRowProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(project.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const startEdit = () => {
    setEditValue(project.name)
    setEditing(true)
    setMenuOpen(false)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
  }

  const commitEdit = () => {
    const t = editValue.trim()
    if (t && t !== project.name) onRename(t)
    setEditing(false)
  }

  const cancelEdit = () => {
    setEditValue(project.name)
    setEditing(false)
  }

  const activeClass = isActive
    ? 'bg-[var(--color-surface)] border-l-[3px] border-l-[var(--color-accent)]'
    : 'border-l-[3px] border-l-transparent hover:bg-[var(--color-surface)]'

  // Collapsed mode: show circle badge with first letter
  if (collapsed) {
    return (
      <li>
        <button
          type="button"
          title={project.name}
          onClick={onActivate}
          aria-pressed={isActive}
          className={`w-full flex justify-center py-2 ${activeClass}`}
        >
          <span className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
            ${isActive
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
            }
          `}>
            {project.name.charAt(0).toUpperCase()}
          </span>
        </button>
      </li>
    )
  }

  return (
    <li className="relative group" data-testid={`project-item-${project.id}`}>
      <div
        className={`flex items-start gap-1 px-2 py-2 cursor-pointer text-sm transition-colors ${activeClass}`}
        onClick={onActivate}
        onDoubleClick={startEdit}
        role="button"
        aria-pressed={isActive}
        data-testid={isActive ? 'project-item-active' : undefined}
      >
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              onClick={e => e.stopPropagation()}
              className="w-full text-sm border border-[var(--color-accent)] rounded px-1 py-0 bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none"
              aria-label="Переименовать проект"
              data-testid="rename-input"
            />
          ) : (
            <span
              className="block truncate text-sm text-[var(--color-text-primary)]"
              title={project.name}
            >
              {project.name}
            </span>
          )}
          <span className="block text-[10px] text-[var(--color-text-secondary)] mt-0.5">
            {relativeDate(project.updatedAt)}
          </span>
        </div>

        {/* "..." menu button — visible on row hover */}
        <button
          type="button"
          aria-label={`Меню проекта ${project.name}`}
          data-testid={`menu-btn-${project.id}`}
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 p-0.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Dropdown */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 top-9 z-50 min-w-[156px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md shadow-lg py-1"
          role="menu"
          data-testid="project-menu"
        >
          {[
            { label: 'Переименовать', icon: <Pencil size={12} />, action: startEdit },
            { label: 'Дублировать', icon: <Copy size={12} />, action: () => { setMenuOpen(false); onDuplicate() } },
            { label: 'Экспорт JSON', icon: <Download size={12} />, action: () => { setMenuOpen(false); onExport() } },
          ].map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={item.action}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setMenuOpen(false); onDelete() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-destructive)] hover:bg-[var(--color-surface)]"
            data-testid="menu-delete"
          >
            <Trash2 size={12} /> Удалить
          </button>
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

export function ProjectSidebar({ open, onClose }: ProjectSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { projects, projectOrder, activeId } = useProjectsRegistryStore(
    useShallow(s => ({ projects: s.projects, projectOrder: s.projectOrder, activeId: s.activeId }))
  )
  const createProject = useProjectsRegistryStore(s => s.createProject)
  const switchProject = useProjectsRegistryStore(s => s.switchProject)
  const renameProject = useProjectsRegistryStore(s => s.renameProject)
  const duplicateProject = useProjectsRegistryStore(s => s.duplicateProject)
  const deleteProject = useProjectsRegistryStore(s => s.deleteProject)
  const exportJSON = useProjectStore(s => s.exportJSON)

  const defaultName = `Проект ${projectOrder.length + 1}`

  const handleCreate = (name: string) => {
    createProject(name)
    setNewDialogOpen(false)
  }

  const handleExport = (id: string) => {
    if (id !== activeId) {
      toast.info('Сначала переключитесь на проект')
      return
    }
    exportJSON()
  }

  const confirmDelete = () => {
    if (confirmDeleteId) {
      deleteProject(confirmDeleteId)
      setConfirmDeleteId(null)
    }
  }

  const sidebarWidthClass = collapsed ? 'w-14' : 'w-60'

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed md:sticky md:top-0 md:h-screen',
          'inset-y-0 left-0',
          'z-40 md:z-auto',
          'flex flex-col flex-shrink-0',
          sidebarWidthClass,
          'bg-[var(--color-surface)] border-r border-[var(--color-border)]',
          'transition-all duration-200',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label="Панель проектов"
        data-testid="project-sidebar"
      >
        {/* Top bar: label + collapse toggle */}
        <div className={`flex items-center h-12 border-b border-[var(--color-border)] flex-shrink-0 ${collapsed ? 'justify-center px-1' : 'justify-between px-3'}`}>
          {!collapsed && (
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide select-none">
              Проекты
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(v => !v)}
            aria-label={collapsed ? 'Развернуть панель проектов' : 'Свернуть панель проектов'}
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
            data-testid="collapse-btn"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* New project button */}
        <div className={`border-b border-[var(--color-border)] flex-shrink-0 ${collapsed ? 'px-1 py-2 flex justify-center' : 'px-3 py-2'}`}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setNewDialogOpen(true)}
              aria-label="Новый проект"
              className="p-1.5 rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
            >
              <Plus size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setNewDialogOpen(true)}
              aria-label="Новый проект"
              data-testid="new-project-btn"
              className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              <Plus size={14} /> Новый проект
            </button>
          )}
        </div>

        {/* Project list */}
        <nav className="flex-1 overflow-y-auto" aria-label="Список проектов">
          <ul data-testid="project-list">
            {projectOrder.map(id => {
              const project = projects[id]
              if (!project) return null
              return (
                <ProjectRow
                  key={id}
                  project={project}
                  isActive={id === activeId}
                  collapsed={collapsed}
                  onActivate={() => { switchProject(id); onClose() }}
                  onRename={name => renameProject(id, name)}
                  onDuplicate={() => duplicateProject(id)}
                  onExport={() => handleExport(id)}
                  onDelete={() => setConfirmDeleteId(id)}
                />
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Dialogs */}
      <NewProjectDialog
        open={newDialogOpen}
        defaultName={defaultName}
        onSubmit={handleCreate}
        onCancel={() => setNewDialogOpen(false)}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Удалить проект"
        message={
          confirmDeleteId
            ? `Удалить проект «${projects[confirmDeleteId]?.name ?? ''}»? Это нельзя отменить.`
            : ''
        }
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  )
}
