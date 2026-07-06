'use client'

import React, { useState, useEffect, useRef } from 'react'
import LeafletMapBase from './LeafletMapBase'
import SinyalMarkers, { type SinyalMapItem } from './SinyalMarkers'
import TowerMarkers, { type TowerMapItem } from './TowerMarkers'
import MapLegend from './MapLegend'
import { Signal, TowerControl, Layers, Loader2 } from 'lucide-react'

type ViewMode = 'BOTH' | 'SINYAL' | 'TOWER'

type Props = {
  onSelectSinyalDetail?: (id: string) => void
  onSelectTowerDetail?: (id: string) => void
}

export default function DashboardMap({ onSelectSinyalDetail, onSelectTowerDetail }: Props) {
  const [mode, setMode] = useState<ViewMode>('BOTH')
  const [sinyalData, setSinyalData] = useState<SinyalMapItem[]>([])
  const [towerData, setTowerData] = useState<TowerMapItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // Lazy loading via IntersectionObserver
  useEffect(() => {
    if (hasLoaded) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasLoaded(true)
          fetchData()
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [hasLoaded])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sinyalRes, towerRes] = await Promise.all([
        fetch('/api/sinyal?for_map=true').then((r) => r.json()),
        fetch('/api/tower?for_map=true').then((r) => r.json()),
      ])

      if (sinyalRes.success) setSinyalData(sinyalRes.data)
      if (towerRes.success) setTowerData(towerRes.data)
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }

  const showSinyal = mode === 'BOTH' || mode === 'SINYAL'
  const showTower = mode === 'BOTH' || mode === 'TOWER'

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-[var(--color-primary)]" />
          <h2 className="text-sm font-bold text-foreground tracking-tight">Peta Sebaran Sinyal & Tower</h2>
        </div>

        {/* Toggle Chip */}
        <div className="flex items-center border border-[var(--color-hairline)] rounded-lg p-0.5 bg-[var(--color-surface)] shadow-xs text-xs">
          {[
            { key: 'BOTH', label: 'Semua', icon: Layers },
            { key: 'SINYAL', label: 'Sinyal Saja', icon: Signal },
            { key: 'TOWER', label: 'Tower Saja', icon: TowerControl },
          ].map((item) => {
            const Icon = item.icon
            const isActive = mode === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key as ViewMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-all ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={13} />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-xs z-[500] flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-elevated border border-[var(--color-hairline)]">
              <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
              <span className="text-xs font-medium text-foreground">Memuat data peta...</span>
            </div>
          </div>
        )}

        <LeafletMapBase height="360px">
          {showSinyal && <SinyalMarkers items={sinyalData} onSelectDetail={onSelectSinyalDetail} />}
          {showTower && <TowerMarkers items={towerData} onSelectDetail={onSelectTowerDetail} />}
          <MapLegend showSinyal={showSinyal} showTower={showTower} />
        </LeafletMapBase>
      </div>
    </div>
  )
}
