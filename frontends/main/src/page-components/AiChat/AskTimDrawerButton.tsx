"use client"

import React from "react"
import { Typography, styled, LinkAdapter } from "ol-components"
import { RiSparkling2Line } from "@remixicon/react"
import { usePostHog } from "posthog-js/react"
import AiRecommendationBotDrawer from "./AiRecommendationBotDrawer"
import { RECOMMENDER_QUERY_PARAM } from "@/common/urls"
import { PostHogEvents } from "@/common/constants"

const StyledButton = styled(LinkAdapter)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  padding: "4px 0",
  color: theme.custom.colors.darkGray2,
  svg: {
    fill: theme.custom.colors.lightRed,
    width: "20px",
    height: "20px",
  },
  "&:hover": {
    color: theme.custom.colors.red,
  },
}))

const AskTIMButton = () => {
  const posthog = usePostHog()

  return (
    <>
      <StyledButton
        shallow
        href={`?${RECOMMENDER_QUERY_PARAM}`}
        onClick={() => {
          if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
            posthog.capture(PostHogEvents.AskTimClicked, {
              type: "recommendation_bot",
            })
          }
        }}
      >
        <RiSparkling2Line />
        <Typography variant="body1">
          Ask<strong>TIM</strong>
        </Typography>
      </StyledButton>
      <AiRecommendationBotDrawer />
    </>
  )
}

export default AskTIMButton
