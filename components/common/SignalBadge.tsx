import { getSignalColor } from '@/lib/constants'

type Props = {
  rsrp: number | null
  showValue?: boolean
  size?: 'sm' | 'md'
}

export default function SignalBadge({ rsrp, showValue = true, size = 'md' }: Props) {
  const { label, color } = getSignalColor(rsrp)

  const bg = color + '1a'
  const fontSize = size === 'sm' ? '0.6875rem' : '0.75rem'
  const padding = size === 'sm' ? '2px 6px' : '3px 8px'

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap"
      style={{ backgroundColor: bg, color, fontSize, padding }}
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{ width: size === 'sm' ? 5 : 6, height: size === 'sm' ? 5 : 6, backgroundColor: color }}
      />
      {showValue && rsrp !== null ? `${rsrp} dBm` : label}
    </span>
  )
}
