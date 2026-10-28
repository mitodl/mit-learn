"use client"

import React from "react"
import { Button, type ButtonProps } from "@mitodl/smoot-design"
import { scrollToElement } from "ol-utilities"
import { analytics } from "@/common/analytics"
import { ORGANIZATIONAL_LEARNING_FORM_ID } from "@/common/urls"

export type CtaPlacement =
  | "hero"
  | "featuredProgram"
  | "offerings"
  | "deliveryFormats"

type CtaButtonProps = Omit<ButtonProps, "onClick"> & {
  placement: CtaPlacement
}

const CtaButton: React.FC<CtaButtonProps> = ({
  placement,
  children,
  ...others
}) => {
  const handleClick = () => {
    analytics.orgLearningCtaClicked({ placement })
    scrollToElement(ORGANIZATIONAL_LEARNING_FORM_ID)
  }

  return (
    <Button variant="primary" size="large" onClick={handleClick} {...others}>
      {children}
    </Button>
  )
}

export default CtaButton
