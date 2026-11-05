import NumberFlow from '@number-flow/react'
import * as RadixSlider from '@radix-ui/react-slider'
import clsx from 'clsx'

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
  formatPrefix = '',
  formatSuffix = '',
  showFloatingNumber = false,
  trackClassName,
  rangeClassName,
  thumbClassName,
  ...props
}: SliderProps) {
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
        {showFloatingNumber && value?.[0] != null && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[#163637] text-[#9eea6c] border border-white/20 shadow-lg text-xs font-bold pointer-events-none whitespace-nowrap">
            {formatPrefix}
            <NumberFlow
              willChange
              value={value[0]}
              isolate
              continuous
              opacityTiming={{
                duration: 250,
                easing: 'ease-out',
              }}
              transformTiming={{
                easing: `linear(0, 0.0033 0.8%, 0.0263 2.39%, 0.0896 4.77%, 0.4676 15.12%, 0.5688, 0.6553, 0.7274, 0.7862, 0.8336 31.04%, 0.8793, 0.9132 38.99%, 0.9421 43.77%, 0.9642 49.34%, 0.9796 55.71%, 0.9893 62.87%, 0.9952 71.62%, 0.9983 82.76%, 0.9996 99.47%)`,
                duration: 500,
              }}
            />
            {formatSuffix}
          </div>
        )}
      </RadixSlider.Thumb>
    </RadixSlider.Root>
  )
}

export { Slider }
