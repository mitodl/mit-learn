import * as React from "react"
import { Slider } from "ol-components"

const SliderInput: React.FC<{
  currentValue: number
  setSearchParams: (
    name: string,
    fn: (prev: URLSearchParams) => URLSearchParams,
  ) => void
  urlParam: string
  /**
   * Accessible name for the slider. Required: the visible title sits in a
   * sibling element the slider is not associated with, so without this a
   * screen reader announces nothing but "slider" -- and the admin panel stacks
   * several of them.
   */
  label: string
  min: number
  max: number
  step: number
  /**
   * Renders the value where the stored one is not what an admin needs to read
   * -- a fraction shown as its multiplier, say. Drives the accessible value
   * too, since the raw number is the one that means nothing on its own.
   */
  formatValue?: (value: number) => string
}> = ({
  currentValue,
  setSearchParams,
  urlParam,
  label,
  min,
  max,
  step,
  formatValue,
}) => {
  const [sliderDisplayValue, setSliderDisplayValue] =
    React.useState<number>(currentValue)

  const handleChange = (
    event: Event | React.SyntheticEvent,
    newValue: number | number[],
  ) => {
    setSearchParams(urlParam, (prev) => {
      const next = new URLSearchParams(prev)
      next.set(urlParam, newValue.toString())
      return next
    })
  }

  return (
    <div>
      <Slider
        data-testid={`${urlParam}-slider`}
        aria-label={label}
        value={sliderDisplayValue || 0}
        onChange={(event: Event, newValue: number | number[]) => {
          setSliderDisplayValue(newValue as number)
        }}
        onChangeCommitted={handleChange}
        valueLabelDisplay="auto"
        valueLabelFormat={formatValue}
        getAriaValueText={formatValue}
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
}

export default SliderInput
