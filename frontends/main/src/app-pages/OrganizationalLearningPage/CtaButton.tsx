"use client"

import React from "react"
import { Button, type ButtonProps } from "@mitodl/smoot-design"
import { usePostHog } from "posthog-js/react"
import { scrollToElement } from "ol-utilities"
import { env } from "@/env"
import { PostHogEvents } from "@/common/constants"
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
  const posthog = usePostHog()

  const handleClick = () => {
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.OrgLearningCtaClicked, { placement })
    }
    scrollToElement(ORGANIZATIONAL_LEARNING_FORM_ID)
  }

  return (
    <Button variant="primary" size="large" onClick={handleClick} {...others}>
      {children}
    </Button>
  )
}

export default CtaButton
