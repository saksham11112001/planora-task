'use client'

import { useState, useRef, useCallback } from 'react'

export interface DragState {
  draggingId: string | null
  overColId: string | null
}

export interface UseDndReturn {
  dragState: DragState
  getDragProps: (taskId: string) => React.HTMLAttributes<HTMLDivElement>
  getDropProps: (colId: string, disabled?: boolean) => React.HTMLAttributes<HTMLDivElement>
}

/**
 * Minimal native HTML5 drag-and-drop for Kanban columns.
 * No external library — works in all modern browsers.
 */
export function useKanbanDnd(
  onDrop: (taskId: string, targetColId: string) => void
): UseDndReturn {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overColId, setOverColId] = useState<string | null>(null)
  const dragTaskId = useRef<string | null>(null)

  const getDragProps = useCallback((taskId: string): React.HTMLAttributes<HTMLDivElement> => ({
    draggable: true,
    onDragStart: (e) => {
      dragTaskId.current = taskId
      setDraggingId(taskId)
      // Required for Firefox
      e.dataTransfer.setData('text/plain', taskId)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: () => {
      dragTaskId.current = null
      setDraggingId(null)
      setOverColId(null)
    },
  }), [])

  const getDropProps = useCallback((colId: string, disabled = false): React.HTMLAttributes<HTMLDivElement> => {
    if (disabled) return {}
    return {
      onDragOver: (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOverColId(colId)
      },
      onDragEnter: (e) => {
        e.preventDefault()
        setOverColId(colId)
      },
      onDragLeave: (e) => {
        // Only clear if leaving the column entirely (not entering a child)
        const rel = e.relatedTarget as Node | null
        if (rel && (e.currentTarget as HTMLElement).contains(rel)) return
        setOverColId(prev => prev === colId ? null : prev)
      },
      onDrop: (e) => {
        e.preventDefault()
        const id = dragTaskId.current ?? e.dataTransfer.getData('text/plain')
        if (id) onDrop(id, colId)
        setDraggingId(null)
        setOverColId(null)
        dragTaskId.current = null
      },
    }
  }, [onDrop])

  return {
    dragState: { draggingId, overColId },
    getDragProps,
    getDropProps,
  }
}
