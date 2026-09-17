import React from "react"
import { styled } from "ol-components"

/**
 * The bar itself is decorative: it is always rendered beside the same figure
 * in text, and the cell sits under a "Progress" column header that names what
 * the figure measures. Giving it `role="progressbar"` as well would announce
 * the same number twice, so it is hidden from assistive tech instead and the
 * text is left to carry the value.
 */
const Track = styled.div(({ theme }) => ({
  width: "80px",
  height: "6px",
  flexShrink: 0,
  borderRadius: "3px",
  backgroundColor: theme.custom.colors.lightGray2,
  overflow: "hidden",
}))

const Fill = styled.div<{ $percent: number }>(({ $percent, theme }) => ({
  width: `${$percent}%`,
  height: "100%",
  borderRadius: "3px",
  backgroundColor: theme.custom.colors.darkGray2,
}))

type ProgressBarProps = {
  percent: number
  className?: string
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percent, className }) => {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <Track className={className} aria-hidden="true">
      <Fill $percent={clamped} />
    </Track>
  )
}

export { ProgressBar }
