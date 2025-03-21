import React from "react"
import { Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import AiRecommendationBotDrawer from "./AiRecommendationBotDrawer"
import { RECOMMENDER_QUERY_PARAM } from "@/common/urls"

const StyledButton = styled(ButtonLink)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  minWidth: "auto",
  padding: "4px 0",
  color: theme.custom.colors.darkGray2,
  border: "none",
  background: "none",
  svg: {
    fill: theme.custom.colors.lightRed,
    width: "20px",
    height: "20px",
  },
  "&&": {
    ":hover": {
      background: "none",
      color: theme.custom.colors.red,
      p: {
        color: theme.custom.colors.red,
      },
    },
  },
}))

const AskTIMButton = () => {
  return (
    <>
      <StyledButton
        shallow
        variant="bordered"
        edge="rounded"
        href={`?${RECOMMENDER_QUERY_PARAM}`}
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
