'use client'

import React from 'react'
import { SIGNAL_COLORS } from '@/lib/constants'

type Props = {
  showSinyal?: boolean
  showTower?: boolean
}

export default function MapLegend({ showSinyal = true, showTower = true }: Props) {
  return (
    <div className="absolute bottom-3 right-3 z-[400] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-2.5 rounded-lg border border-[var(--color-hairline)] shadow-elevated text-xs space-y-1.5 min-w-[130px]">
      <p className="font-semibold text-[10px] text-gray-500 uppercase tracking-wider mb-1">Legenda Peta</p>

      {showSinyal && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SIGNAL_COLORS.GOOD.color }} />
            <span className="text-gray-700 dark:text-gray-200">Sinyal Baik (&gt; -85)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SIGNAL_COLORS.FAIR.color }} />
            <span className="text-gray-700 dark:text-gray-200">Sinyal Sedang (-85 s/d -99)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SIGNAL_COLORS.POOR.color }} />
            <span className="text-gray-700 dark:text-gray-200">Sinyal Buruk (&lt; -99)</span>
          </div>
        </div>
      )}

      {showTower && (
        <div className="pt-1 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#2a9d99] flex items-center justify-center text-white text-[8px] font-bold shrink-0">
            T
          </span>
          <span className="text-gray-700 dark:text-gray-200 font-medium">Tower Telepon</span>
        </div>
      )}
    </div>
  )
}
