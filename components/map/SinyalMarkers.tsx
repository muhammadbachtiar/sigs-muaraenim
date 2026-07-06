'use client'

import React from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import SignalBadge from '@/components/common/SignalBadge'
import { getSignalColor } from '@/lib/constants'
import { ExternalLink, MapPin } from 'lucide-react'

export type SinyalMapItem = {
  id: string
  latitude: number
  longitude: number
  rsrp: number | null
  tanggalPengukuran?: string
  operator?: { id: string; nama: string }
  teknologi?: { id: string; nama: string }
  desaKelurahan?: { id: string; nama: string }
}

type Props = {
  items: SinyalMapItem[]
  onSelectDetail?: (id: string) => void
}

export default function SinyalMarkers({ items, onSelectDetail }: Props) {
  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={45}>
      {items.map((item) => {
        const { color } = getSignalColor(item.rsrp)
        const dateStr = item.tanggalPengukuran
          ? new Date(item.tanggalPengukuran).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : null

        return (
          <CircleMarker
            key={item.id}
            center={[item.latitude, item.longitude]}
            radius={8}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.85,
              color: '#ffffff',
              weight: 1.5,
            }}
          >
            <Popup className="sinyal-popup">
              <div className="p-1 space-y-2 min-w-[190px] font-sans">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                  <span className="font-semibold text-xs text-gray-800">
                    {item.operator?.nama ?? 'Operator'}
                  </span>
                  <SignalBadge rsrp={item.rsrp} size="sm" />
                </div>

                <div className="text-[11px] space-y-1 text-gray-600">
                  {item.teknologi?.nama && (
                    <div>
                      <span className="text-gray-400">Teknologi:</span>{' '}
                      <span className="font-medium text-gray-700">{item.teknologi.nama}</span>
                    </div>
                  )}
                  {item.desaKelurahan?.nama && (
                    <div>
                      <span className="text-gray-400">Desa:</span>{' '}
                      <span className="font-medium text-gray-700">{item.desaKelurahan.nama}</span>
                    </div>
                  )}
                  {dateStr && (
                    <div>
                      <span className="text-gray-400">Tanggal:</span> {dateStr}
                    </div>
                  )}
                  <div className="flex items-center gap-1 font-mono text-[10px] text-gray-500 pt-0.5">
                    <MapPin size={10} />
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[11px]">
                  <a
                    href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                  >
                    Maps <ExternalLink size={10} />
                  </a>
                  {onSelectDetail && (
                    <button
                      type="button"
                      onClick={() => onSelectDetail(item.id)}
                      className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition-colors"
                    >
                      Detail
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MarkerClusterGroup>
  )
}
