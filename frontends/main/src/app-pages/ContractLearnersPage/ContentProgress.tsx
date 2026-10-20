"use client"

import React from "react"
import { styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"

const Wrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  width: "100%",
  maxWidth: "96px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
}))

const Label = styled.div({
  display: "flex",
  alignItems: "baseline",
  gap: "8px",
  whiteSpace: "nowrap",
})

const Track = styled.div(({ theme }) => ({
  height: "4px",
  borderRadius: "2px",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.lightGray2,
}))

const Fill = styled.div(({ theme }) => ({
  height: "100%",
  backgroundColor: theme.custom.colors.darkBlue,
}))

/**
 * The bar is decorative: the visible percent carries the value, so assistive
 * tech hears ", 45% complete" without a progressbar role in every table cell.
 */
const ContentProgress: React.FC<{
  percent: number
  className?: string
  /** Shown on the percent's line, after it. */
  children?: React.ReactNode
}> = ({ percent, className, children }) => (
  <Wrapper className={className}>
    <Label>
      <span>
        <VisuallyHidden>, </VisuallyHidden>
        {percent}%<VisuallyHidden> complete</VisuallyHidden>
      </span>
      {children}
    </Label>
    <Track aria-hidden="true">
      <Fill style={{ width: `${percent}%` }} />
    </Track>
  </Wrapper>
)

export { ContentProgress }
