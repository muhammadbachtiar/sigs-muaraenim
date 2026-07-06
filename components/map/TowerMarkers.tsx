'use client'

import React from 'react'
import { Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { MapPin, TowerControl } from 'lucide-react'

export type TowerMapItem = {
  id: string
  namaTower: string
  latitude: number
  longitude: number
  tinggiKategori?: string | null
  kecamatan?: { id: string; nama: string }
  desaKelurahan?: { id: string; nama: string } | null
  towerOperator?: Array<{ operator: { id: string; nama: string } }>
  towerTeknologi?: Array<{ teknologi: { id: string; nama: string } }>
}

type Props = {
  items: TowerMapItem[]
  onSelectDetail?: (id: string) => void
}

function createTowerIcon() {
  return L.divIcon({
    className: 'custom-tower-marker',
    html: `
      <div style="
        background-color: #2a9d99;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        color: #ffffff;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20"/><path d="M7 17l5-5 5 5"/><path d="M4 22h16"/><path d="M9 10l3-3 3 3"/>
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  })
}

export default function TowerMarkers({ items, onSelectDetail }: Props) {
  const towerIcon = createTowerIcon()

  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={45}>
      {items.map((item) => {
        const operators = item.towerOperator?.map(o => o.operator.nama).join(', ')
        const teknologi = item.towerTeknologi?.map(t => t.teknologi.nama).join(', ')

        return (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={towerIcon}
          >
            <Popup className="tower-popup">
              <div className="p-1 space-y-2 min-w-[200px] font-sans">
                <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
                  <TowerControl size={14} className="text-[#2a9d99] shrink-0" />
                  <span className="font-semibold text-xs text-gray-800 line-clamp-1">
                    {item.namaTower}
                  </span>
                </div>

                <div className="text-[11px] space-y-1 text-gray-600">
                  {item.kecamatan?.nama && (
                    <div>
                      <span className="text-gray-400">Lokasi:</span>{' '}
                      <span className="font-medium text-gray-700">
                        {item.desaKelurahan?.nama ? `${item.desaKelurahan.nama}, ` : ''}{item.kecamatan.nama}
                      </span>
                    </div>
                  )}
                  {item.tinggiKategori && (
                    <div>
                      <span className="text-gray-400">Tinggi:</span>{' '}
                      <span className="text-gray-700">{item.tinggiKategori}</span>
                    </div>
                  )}
                  {operators && (
                    <div>
                      <span className="text-gray-400">Operator:</span>{' '}
                      <span className="font-medium text-teal-700">{operators}</span>
                    </div>
                  )}
                  {teknologi && (
                    <div>
                      <span className="text-gray-400">Teknologi:</span>{' '}
                      <span className="text-gray-700">{teknologi}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 font-mono text-[10px] text-gray-500 pt-0.5">
                    <MapPin size={10} />
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </div>
                </div>

                {onSelectDetail && (
                  <div className="pt-1 border-t border-gray-100 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectDetail(item.id)}
                      className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-medium hover:bg-teal-100 text-[11px] transition-colors"
                    >
                      Detail Tower
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MarkerClusterGroup>
  )
}
