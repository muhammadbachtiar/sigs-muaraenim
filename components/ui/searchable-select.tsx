'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export type SelectOption = {
  value: string
  label: string
}

type Props = {
  id?: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  emptyText?: string
  searchPlaceholder?: string
}

export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = '— Pilih —',
  disabled = false,
  className = '',
  emptyText = 'Tidak ada pilihan ditemukan',
  searchPlaceholder = 'Cari...',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const uid = useId()
  const inputId = id ?? uid
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [highlightIdx, setHighlightIdx] = useState(0)

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const selectedLabel = options.find(o => o.value === value)?.label

  const openDropdown = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setHighlightIdx(0)
  }

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const select = (val: string) => {
    onChange(val)
    closeDropdown()
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [closeDropdown])

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 10)
    }
  }, [open])

  // Scroll highlighted option into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const item = listRef.current.children[highlightIdx] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        openDropdown()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightIdx]) select(filtered[highlightIdx].value)
        break
      case 'Escape':
        closeDropdown()
        break
    }
  }

  const triggerClass = [
    'relative flex h-9 w-full items-center justify-between rounded-md border px-3 py-1.5 text-sm transition-all cursor-pointer select-none outline-none',
    disabled
      ? 'bg-[var(--color-canvas-soft)] border-hairline text-muted-foreground cursor-not-allowed opacity-60'
      : 'bg-[var(--color-surface)] border-hairline hover:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:border-primary',
    open ? 'ring-2 ring-primary/20 border-primary' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <div
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        className={triggerClass}
        onClick={openDropdown}
      >
        <span className={selectedLabel ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
          {selectedLabel ?? placeholder}
        </span>
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {value && !disabled && (
            <button
              type="button"
              aria-label="Hapus pilihan"
              onClick={clear}
              className="p-0.5 rounded hover:bg-muted-foreground/15 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[600] mt-1 w-full min-w-[160px] rounded-lg border border-hairline bg-[var(--color-surface)] shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Search bar */}
          <div className="flex items-center gap-2 border-b border-hairline px-2.5 py-2">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlightIdx(0) }}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setHighlightIdx(0) }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-52 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-muted-foreground text-center">{emptyText}</li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value
                const isHighlighted = idx === highlightIdx
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => select(opt.value)}
                    className={[
                      'flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer transition-colors',
                      isHighlighted ? 'bg-primary/8 text-foreground' : 'text-foreground',
                      isSelected ? 'font-semibold' : 'font-normal',
                    ].join(' ')}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check size={12} className="text-primary shrink-0" />}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
