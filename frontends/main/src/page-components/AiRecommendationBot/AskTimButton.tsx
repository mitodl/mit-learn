import React from "react"
import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"

const StyledButton = styled(Button)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  minWidth: "auto",
  paddingLeft: "16px",
  paddingRight: "24px",
  color: theme.custom.colors.darkGray2,
  borderColor: theme.custom.colors.lightGray2,
  svg: {
    fill: theme.custom.colors.red,
    width: "20px",
    height: "20px",
  },
  "&&": {
    ":hover": {
      borderColor: "transparent",
      color: theme.custom.colors.white,
      backgroundColor: theme.custom.colors.darkGray2,
      p: {
        color: theme.custom.colors.white,
      },
      svg: {
        fill: theme.custom.colors.white,
      },
    },
  },
}))

const AskTIMButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <StyledButton variant="bordered" edge="rounded" onClick={onClick}>
      <RiSparkling2Line />
      <Typography variant="body1">
        Ask<strong>TIM</strong>
      </Typography>
    </StyledButton>
  )
}

export default AskTIMButton
