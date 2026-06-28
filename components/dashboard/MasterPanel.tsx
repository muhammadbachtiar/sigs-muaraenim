'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Package, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { type ActionResult } from '@/lib/actions/master'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type MasterItem = { id: number; nama: string }

interface PaginationMeta {
  total: number
  page: number
  page_size: number
  total_pages: number
}

interface MasterPanelProps {
  title: string
  items: MasterItem[]
  loading: boolean
  meta: PaginationMeta | null
  searchValue: string
  onSearchChange: (val: string) => void
  onPageChange: (page: number) => void
  onAdd: (nama: string) => Promise<ActionResult>
  onEdit: (id: number, nama: string) => Promise<ActionResult>
  onDelete: (id: number) => Promise<ActionResult>
}

export default function MasterPanel({
  title, items, loading, meta, searchValue, onSearchChange, onPageChange, onAdd, onEdit, onDelete,
}: MasterPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState<MasterItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<MasterItem | null>(null)
  const [formValue, setFormValue] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async () => {
    if (!formValue.trim()) return
    setFormError('')
    setSubmitting(true)
    const result = await onAdd(formValue)
    setSubmitting(false)
    if (result.success) {
      setShowAddModal(false)
      setFormValue('')
      toast.success(result.message)
    } else {
      setFormError(result.message)
    }
  }

  const handleEdit = async () => {
    if (!editItem || !formValue.trim()) return
    setFormError('')
    setSubmitting(true)
    const result = await onEdit(editItem.id, formValue)
    setSubmitting(false)
    if (result.success) {
      setEditItem(null)
      setFormValue('')
      toast.success(result.message)
    } else {
      setFormError(result.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setSubmitting(true)
    const result = await onDelete(deleteItem.id)
    setSubmitting(false)
    if (result.success) {
      setDeleteItem(null)
      toast.success(result.message)
    } else {
      setDeleteItem(null)
      toast.error(result.message)
    }
  }

  const currentPage = meta?.page ?? 1
  const totalPages = meta?.total_pages ?? 1
  const total = meta?.total ?? items.length
  const pageSize = meta?.page_size ?? 10

  // Calculate row number offset for current page
  const rowOffset = (currentPage - 1) * pageSize

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Toolbar: search + add button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Cari ${title.toLowerCase()}...`}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-muted-foreground">{total} data</span>
          <Button
            size="sm"
            onClick={() => { setFormValue(''); setFormError(''); setShowAddModal(true) }}
            className="h-9 px-4"
          >
            <Plus size={16} className="mr-1.5" />
            Tambah {title}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-hairline rounded-xl overflow-hidden bg-[var(--color-surface)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-hairline border-t-primary rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Package size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Belum ada data</p>
            <p className="text-xs mt-1">Klik "Tambah" untuk menambahkan data baru</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-[var(--color-canvas-soft)]">
                <TableHead className="w-[56px] text-xs tracking-wider uppercase font-semibold pl-4">No</TableHead>
                <TableHead className="text-xs tracking-wider uppercase font-semibold">Nama</TableHead>
                <TableHead className="w-[100px] text-right text-xs tracking-wider uppercase font-semibold pr-4">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id} className="transition-colors hover:bg-[var(--color-canvas-soft)]/50">
                  <TableCell className="text-muted-foreground font-mono text-sm pl-4">{rowOffset + index + 1}</TableCell>
                  <TableCell className="font-medium text-foreground text-sm">{item.nama}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Edit"
                        onClick={() => { setEditItem(item); setFormValue(item.nama); setFormError('') }}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Hapus"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Menampilkan {rowOffset + 1}–{Math.min(rowOffset + pageSize, total)} dari {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('dots')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) => p === 'dots' ? (
                <span key={`dots-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === currentPage ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Tambah {title}</DialogTitle>
            <DialogDescription>Masukkan data baru untuk {title.toLowerCase()}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-nama">Nama</Label>
              <Input
                id="add-nama"
                autoFocus
                placeholder={`Masukkan nama ${title.toLowerCase()}`}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className={formError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {formError && <p className="text-xs text-destructive">{formError}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={submitting || !formValue.trim()}>
              {submitting && <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit {title}</DialogTitle>
            <DialogDescription>Ubah data untuk {title.toLowerCase()} ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-nama">Nama</Label>
              <Input
                id="edit-nama"
                autoFocus
                placeholder={`Masukkan nama ${title.toLowerCase()}`}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                className={formError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {formError && <p className="text-xs text-destructive">{formError}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Batal</Button>
            <Button onClick={handleEdit} disabled={submitting || !formValue.trim()}>
              {submitting && <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
              Perbarui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader className="items-center sm:text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle size={24} className="text-destructive" />
            </div>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
            <DialogDescription className="text-center">
              Apakah Anda yakin ingin menghapus <strong>{deleteItem?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={submitting}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting && <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
