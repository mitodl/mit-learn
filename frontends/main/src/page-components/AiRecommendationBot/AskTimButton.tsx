import React, { useState } from "react"
import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import AiRecommendationBotDrawer from "./AiRecommendationBotDrawer"

const StyledButton = styled(Button)(({ theme }) => ({
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
      color: theme.custom.colors.mitRed,
      p: {
        color: theme.custom.colors.mitRed,
      },
    },
  },
}))

const AskTIMButton = () => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <StyledButton
        variant="bordered"
        edge="rounded"
        onClick={() => setOpen(true)}
      >
        <RiSparkling2Line />
        <Typography variant="body1">
          Ask<strong>TIM</strong>
        </Typography>
      </StyledButton>
      <AiRecommendationBotDrawer open={open} setOpen={setOpen} />
    </>
  )
}

export default AskTIMButton
