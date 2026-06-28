'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Radio, Cpu, Cable, MapPin, Building2, Loader2 } from 'lucide-react'
import MasterPanel from '@/components/dashboard/MasterPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type ActionResult } from '@/lib/actions/master'

type MasterItem = { id: number; nama: string }
type PaginationMeta = { total: number; page: number; page_size: number; total_pages: number }

type TabState = {
  items: MasterItem[]
  meta: PaginationMeta | null
  loading: boolean
  search: string
  page: number
}

const defaultTabState: TabState = {
  items: [], meta: null, loading: true, search: '', page: 1,
}

export default function MasterPage() {
  const [operator, setOperator] = useState<TabState>({ ...defaultTabState })
  const [teknologi, setTeknologi] = useState<TabState>({ ...defaultTabState })
  const [media, setMedia] = useState<TabState>({ ...defaultTabState })
  const [kecamatan, setKecamatan] = useState<TabState>({ ...defaultTabState })
  const [desa, setDesa] = useState<TabState>({ ...defaultTabState })

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Generic fetch function for any master data tab
  const fetchTab = useCallback(async (
    endpoint: string,
    search: string,
    page: number,
    setter: React.Dispatch<React.SetStateAction<TabState>>,
    extraParams?: Record<string, string>,
  ) => {
    setter(prev => ({ ...prev, loading: true }))
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '10' })
      if (search) params.set('search', search)
      if (extraParams) Object.entries(extraParams).forEach(([k, v]) => params.set(k, v))

      const res = await fetch(`/api/master/${endpoint}?${params}`).then(r => r.json())
      if (res.success) {
        setter(prev => ({ ...prev, items: res.data, meta: res.meta, loading: false }))
      } else {
        setter(prev => ({ ...prev, loading: false }))
      }
    } catch {
      setter(prev => ({ ...prev, loading: false }))
    }
  }, [])

  // Initial fetches
  useEffect(() => {
    fetchTab('operator', '', 1, setOperator)
    fetchTab('teknologi', '', 1, setTeknologi)
    fetchTab('media', '', 1, setMedia)
    fetchTab('kecamatan', '', 1, setKecamatan)
    fetchTab('desa', '', 1, setDesa)
  }, [fetchTab])

  // Create debounced search handler
  const makeSearchHandler = (
    tabKey: string,
    endpoint: string,
    setter: React.Dispatch<React.SetStateAction<TabState>>,
  ) => (val: string) => {
    setter(prev => ({ ...prev, search: val, page: 1 }))
    clearTimeout(debounceTimers.current[tabKey])
    debounceTimers.current[tabKey] = setTimeout(() => {
      fetchTab(endpoint, val, 1, setter)
    }, 350)
  }

  // Create page handler
  const makePageHandler = (
    endpoint: string,
    state: TabState,
    setter: React.Dispatch<React.SetStateAction<TabState>>,
  ) => (page: number) => {
    setter(prev => ({ ...prev, page }))
    fetchTab(endpoint, state.search, page, setter)
  }

  // Wrap API action: POST/PUT/DELETE via API, then refetch
  const wrapApiAction = (
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE',
    state: TabState,
    setter: React.Dispatch<React.SetStateAction<TabState>>,
  ) => {
    return async (...args: any[]): Promise<ActionResult> => {
      try {
        let url = `/api/master/${endpoint}`
        let body: any = undefined

        if (method === 'POST') {
          body = JSON.stringify({ nama: args[0] })
        } else if (method === 'PUT') {
          url += `/${args[0]}`
          body = JSON.stringify({ nama: args[1] })
        } else if (method === 'DELETE') {
          url += `/${args[0]}`
        }

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body,
        }).then(r => r.json())

        if (res.success) {
          // Refetch current view
          fetchTab(endpoint, state.search, state.page, setter)
        }
        return { success: res.success, message: res.message }
      } catch {
        return { success: false, message: 'Terjadi kesalahan jaringan' }
      }
    }
  }

  const tabs = [
    {
      value: 'operator',
      label: 'Operator',
      icon: Radio,
      state: operator,
      setter: setOperator,
      endpoint: 'operator',
    },
    {
      value: 'teknologi',
      label: 'Teknologi',
      icon: Cpu,
      state: teknologi,
      setter: setTeknologi,
      endpoint: 'teknologi',
    },
    {
      value: 'media',
      label: 'Media Transmisi',
      icon: Cable,
      state: media,
      setter: setMedia,
      endpoint: 'media',
    },
    {
      value: 'kecamatan',
      label: 'Kecamatan',
      icon: MapPin,
      state: kecamatan,
      setter: setKecamatan,
      endpoint: 'kecamatan',
    },
    {
      value: 'desa',
      label: 'Desa/Kel',
      icon: Building2,
      state: desa,
      setter: setDesa,
      endpoint: 'desa',
    },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Master Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola data referensi sistem — Operator, Teknologi, Media Transmisi, Kecamatan, dan Desa/Kelurahan
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="operator" className="w-full">
        <TabsList className="mb-5 flex-wrap h-auto gap-1 bg-[var(--color-canvas-soft)] p-1 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5"
              >
                <Icon size={15} />
                <span className="hidden xs:inline">{tab.label}</span>
                <span className="xs:hidden">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0 outline-none">
            <MasterPanel
              title={tab.label}
              items={tab.state.items}
              loading={tab.state.loading}
              meta={tab.state.meta}
              searchValue={tab.state.search}
              onSearchChange={makeSearchHandler(tab.value, tab.endpoint, tab.setter)}
              onPageChange={makePageHandler(tab.endpoint, tab.state, tab.setter)}
              onAdd={wrapApiAction(tab.endpoint, 'POST', tab.state, tab.setter)}
              onEdit={wrapApiAction(tab.endpoint, 'PUT', tab.state, tab.setter)}
              onDelete={wrapApiAction(tab.endpoint, 'DELETE', tab.state, tab.setter)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
