import * as RadixSlider from '@radix-ui/react-slider'
import clsx from 'clsx'
import NumberRoller from './number-roller'

export interface SliderProps extends RadixSlider.SliderProps {
  formatPrefix?: string
  formatSuffix?: string
  showFloatingNumber?: boolean
  trackClassName?: string
  rangeClassName?: string
  thumbClassName?: string
}

export default function Slider({
  value,
  className,
  formatPrefix = 'US$ ',
  formatSuffix = '',
  showFloatingNumber = true,
  trackClassName,
  rangeClassName,
  thumbClassName,
  ...props
}: SliderProps) {
  const currentVal = value?.[0] ?? 0

  return (
    <RadixSlider.Root
      {...props}
      value={value}
      className={clsx(
        'relative flex h-7 w-full touch-none select-none items-center cursor-pointer',
        className
      )}
    >
      <RadixSlider.Track
        className={clsx(
          'relative h-[6px] grow rounded-full bg-white/20 transition-all overflow-hidden',
          trackClassName
        )}
      >
        <RadixSlider.Range
          className={clsx(
            'absolute h-full rounded-full bg-[#9eea6c] transition-all',
            rangeClassName
          )}
        />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        className={clsx(
          'relative block h-6 w-6 rounded-full bg-[#9eea6c] shadow-[0_0_16px_rgba(158,234,108,0.85)] border-2 border-white ring-2 ring-black/15 focus:outline-none focus:scale-110 hover:scale-110 active:scale-95 transition-transform',
          thumbClassName
        )}
        aria-label="Slider de Consumo"
      >
        {showFloatingNumber && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#163637] text-[#9eea6c] border border-white/20 shadow-lg text-xs font-bold pointer-events-none whitespace-nowrap">
            <NumberRoller
              value={currentVal}
              prefix={formatPrefix}
              suffix={formatSuffix}
              decimals={0}
              duration={0.35}
            />
          </div>
        )}
      </RadixSlider.Thumb>
    </RadixSlider.Root>
  )
}

export { Slider }
