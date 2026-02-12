'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button, Input } from '@heroui/react'

interface Column {
  id: string
  name: string
  width: number
}

interface Row {
  id: string
  cells: { [columnId: string]: string }
}

interface SpreadsheetData {
  columns: Column[]
  rows: Row[]
}

interface SpreadsheetGridProps {
  data: SpreadsheetData
  onChange: (data: SpreadsheetData) => void
  readOnly?: boolean
}

export default function SpreadsheetGrid({ data, onChange, readOnly = false }: SpreadsheetGridProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingColumn, setEditingColumn] = useState<string | null>(null)
  const [columnEditValue, setColumnEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editingCell])

  const handleCellClick = (rowId: string, colId: string) => {
    if (readOnly) return
    const row = data.rows.find(r => r.id === rowId)
    const value = row?.cells[colId] || ''
    setEditingCell({ rowId, colId })
    setEditValue(value)
  }

  const handleCellSave = useCallback(() => {
    if (!editingCell) return
    
    const newRows = data.rows.map(row => {
      if (row.id === editingCell.rowId) {
        return {
          ...row,
          cells: {
            ...row.cells,
            [editingCell.colId]: editValue
          }
        }
      }
      return row
    })
    
    onChange({ ...data, rows: newRows })
    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue, data, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleCellSave()
      // Move to next cell
      if (editingCell) {
        const colIndex = data.columns.findIndex(c => c.id === editingCell.colId)
        const rowIndex = data.rows.findIndex(r => r.id === editingCell.rowId)
        
        if (colIndex < data.columns.length - 1) {
          handleCellClick(editingCell.rowId, data.columns[colIndex + 1].id)
        } else if (rowIndex < data.rows.length - 1) {
          handleCellClick(data.rows[rowIndex + 1].id, data.columns[0].id)
        }
      }
    }
  }

  // Handle paste - split multi-line content into separate rows (like Google Sheets)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!editingCell || readOnly) return
    
    const pasteData = e.clipboardData.getData('text')
    const lines = pasteData.split(/\r?\n/).filter(line => line.trim() !== '')
    
    // If only one line, let default paste behavior handle it
    if (lines.length <= 1) return
    
    e.preventDefault()
    
    const rowIndex = data.rows.findIndex(r => r.id === editingCell.rowId)
    const colId = editingCell.colId
    
    // Calculate how many new rows we need
    const rowsNeeded = rowIndex + lines.length - data.rows.length
    
    let newRows = [...data.rows]
    
    // Add new rows if needed
    for (let i = 0; i < rowsNeeded; i++) {
      newRows.push({
        id: String(newRows.length + 1),
        cells: {}
      })
    }
    
    // Fill in the pasted values
    lines.forEach((line, i) => {
      const targetRowIndex = rowIndex + i
      if (targetRowIndex < newRows.length) {
        newRows[targetRowIndex] = {
          ...newRows[targetRowIndex],
          cells: {
            ...newRows[targetRowIndex].cells,
            [colId]: line.trim()
          }
        }
      }
    })
    
    onChange({ ...data, rows: newRows })
    setEditingCell(null)
    setEditValue('')
  }, [editingCell, readOnly, data, onChange])

  const handleColumnHeaderClick = (colId: string) => {
    if (readOnly) return
    const col = data.columns.find(c => c.id === colId)
    if (col) {
      setEditingColumn(colId)
      setColumnEditValue(col.name)
    }
  }

  const handleColumnSave = () => {
    if (!editingColumn) return
    
    const newColumns = data.columns.map(col => {
      if (col.id === editingColumn) {
        return { ...col, name: columnEditValue || col.id }
      }
      return col
    })
    
    onChange({ ...data, columns: newColumns })
    setEditingColumn(null)
    setColumnEditValue('')
  }

  const addColumn = () => {
    const nextLetter = String.fromCharCode(65 + data.columns.length) // A=65
    const newCol: Column = {
      id: nextLetter,
      name: nextLetter,
      width: 120
    }
    onChange({ ...data, columns: [...data.columns, newCol] })
  }

  const addRow = () => {
    const newRow: Row = {
      id: String(data.rows.length + 1),
      cells: {}
    }
    onChange({ ...data, rows: [...data.rows, newRow] })
  }

  const deleteRow = (rowId: string) => {
    if (data.rows.length <= 1) return
    onChange({ ...data, rows: data.rows.filter(r => r.id !== rowId) })
  }

  const deleteColumn = (colId: string) => {
    if (data.columns.length <= 1) return
    const newColumns = data.columns.filter(c => c.id !== colId)
    const newRows = data.rows.map(row => {
      const { [colId]: _, ...remainingCells } = row.cells
      return { ...row, cells: remainingCells }
    })
    onChange({ columns: newColumns, rows: newRows })
  }

  return (
    <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {/* Row number header */}
            <th className="w-12 min-w-[48px] bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-2 text-xs text-slate-500">
              #
            </th>
            {/* Column headers */}
            {data.columns.map((col, idx) => (
              <th
                key={col.id}
                className="bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 p-0 text-sm font-medium text-slate-700 dark:text-slate-300 relative group"
                style={{ minWidth: col.width }}
              >
                {editingColumn === col.id ? (
                  <input
                    type="text"
                    value={columnEditValue}
                    onChange={(e) => setColumnEditValue(e.target.value)}
                    onBlur={handleColumnSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleColumnSave()
                      if (e.key === 'Escape') {
                        setEditingColumn(null)
                        setColumnEditValue('')
                      }
                    }}
                    className="w-full h-full px-3 py-2 bg-white dark:bg-slate-700 border-2 border-violet-500 outline-none text-center"
                    autoFocus
                  />
                ) : (
                  <div
                    onClick={() => handleColumnHeaderClick(col.id)}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {col.name}
                  </div>
                )}
                {!readOnly && (
                  <button
                    onClick={() => deleteColumn(col.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    title="Delete column"
                  >
                    ×
                  </button>
                )}
              </th>
            ))}
            {/* Add column button */}
            {!readOnly && (
              <th className="w-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <button
                  onClick={addColumn}
                  className="w-full h-full p-2 text-slate-400 hover:text-violet-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Add column"
                >
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr key={row.id} className="group/row">
              {/* Row number */}
              <td className="bg-slate-50 dark:bg-slate-800/50 border-b border-r border-slate-200 dark:border-slate-700 p-2 text-xs text-slate-500 text-center relative">
                {row.id}
                {!readOnly && data.rows.length > 1 && (
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    title="Delete row"
                  >
                    ×
                  </button>
                )}
              </td>
              {/* Cells */}
              {data.columns.map((col) => {
                const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id
                const value = row.cells[col.id] || ''
                
                return (
                  <td
                    key={col.id}
                    className="border-b border-r border-slate-200 dark:border-slate-700 p-0"
                    style={{ minWidth: col.width }}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellSave}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        className="w-full h-full px-3 py-2 bg-white dark:bg-slate-700 border-2 border-violet-500 outline-none"
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(row.id, col.id)}
                        className="w-full h-full min-h-[40px] px-3 py-2 cursor-cell hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm text-slate-800 dark:text-slate-200"
                      >
                        {value}
                      </div>
                    )}
                  </td>
                )
              })}
              {!readOnly && <td className="border-b border-slate-200 dark:border-slate-700" />}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Add row button */}
      {!readOnly && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={addRow}
            className="w-full p-2 text-slate-400 hover:text-violet-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add row
          </button>
        </div>
      )}
    </div>
  )
}
