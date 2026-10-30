"use client"

import React from "react"
import { styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"

const Wrapper = styled.div(({ theme }) => ({
  whiteSpace: "nowrap",
  width: "100%",
  maxWidth: "96px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
}))

const ContentProgress: React.FC<{
  percent: number
  className?: string
}> = ({ percent, className }) => (
  <Wrapper className={className}>
    <VisuallyHidden>, </VisuallyHidden>
    {percent}%<VisuallyHidden> complete</VisuallyHidden>
  </Wrapper>
)

export { ContentProgress }
