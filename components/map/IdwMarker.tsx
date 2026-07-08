'use client'

import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getSignalColor } from '@/lib/constants'
import { Brain, MapPin } from 'lucide-react'
import SignalBadge from '@/components/common/SignalBadge'

export type IdwPredictionPoint = {
  latitude: number
  longitude: number
  rsrp: number | null
  rssi: number | null
  rsrq: number | null
  snr: number | null
  neighborsUsed: number
  warning: string | null
  params: { p: number; n: number; radius: number }
}

type Props = {
  point: IdwPredictionPoint
  onSave?: () => void
}

function createIdwIcon(rsrp: number | null) {
  const { color } = getSignalColor(rsrp)
  return L.divIcon({
    className: 'idw-prediction-marker',
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
      ">
        <!-- Diamond shape -->
        <div style="
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: ${color};
          transform: rotate(45deg);
          border: 2.5px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          border-radius: 3px;
        "></div>
        <!-- IDW label -->
        <div style="
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.5px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          z-index: 1;
        ">IDW</div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  })
}

export default function IdwMarker({ point, onSave }: Props) {
  const icon = createIdwIcon(point.rsrp)
  const { label: signalLabel } = getSignalColor(point.rsrp)

  const formatVal = (v: number | null, unit: string) =>
    v !== null ? `${Math.round(v * 10) / 10} ${unit}` : '—'

  return (
    <Marker position={[point.latitude, point.longitude]} icon={icon} zIndexOffset={1000}>
      <Popup className="idw-popup" maxWidth={280}>
        <div className="p-1.5 space-y-2 font-sans min-w-[240px]">
          {/* Header */}
          <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Brain size={14} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800 leading-none">Prediksi IDW</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Estimasi kekuatan sinyal</p>
            </div>
            <div className="ml-auto">
              <SignalBadge rsrp={point.rsrp} size="sm" />
            </div>
          </div>

          {/* Nilai Prediksi */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {[
              { label: 'RSRP', value: formatVal(point.rsrp, 'dBm') },
              { label: 'RSSI', value: formatVal(point.rssi, 'dBm') },
              { label: 'RSRQ', value: formatVal(point.rsrq, 'dBm') },
              { label: 'SNR', value: formatVal(point.snr, 'dB') },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-md px-2 py-1.5">
                <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wide">{label}</p>
                <p className="font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Info Parameter */}
          <div className="bg-purple-50 rounded-lg px-2.5 py-2 text-[10px] text-purple-700 space-y-0.5">
            <p className="font-semibold text-purple-600 mb-1">Parameter Kalkulasi IDW</p>
            <div className="flex justify-between">
              <span className="text-purple-500">Power (p)</span>
              <span className="font-mono font-bold">{point.params.p}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-500">Tetangga (N)</span>
              <span className="font-mono font-bold">{point.neighborsUsed} titik</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-500">Radius cari</span>
              <span className="font-mono font-bold">{point.params.radius} km</span>
            </div>
          </div>

          {/* Warning jika ada */}
          {point.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[10px] text-amber-700">
              ⚠️ {point.warning}
            </div>
          )}

          {/* Koordinat */}
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
            <MapPin size={10} />
            {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
          </div>

          {/* Tombol Simpan */}
          {onSave && (
            <button
              onClick={onSave}
              className="w-full mt-1 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors"
            >
              Simpan ke Riwayat Sinyal
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  )
}
