import React from "react"
import Image from "next/image"
import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import askIcon from "@/public/images/icons/ask-icon.svg"
import askIconWhite from "@/public/images/icons/ask-icon-white.svg"

const StyledButton = styled(Button)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  minWidth: "auto",
  paddingLeft: "16px",
  paddingRight: "24px",
  color: theme.custom.colors.darkGray2,
  borderColor: theme.custom.colors.lightGray2,
  "&&": {
    ":hover": {
      borderColor: "transparent",
      color: theme.custom.colors.white,
      backgroundColor: theme.custom.colors.darkGray2,
      p: {
        color: theme.custom.colors.white,
      },
      img: {
        content: `url(${askIconWhite.src})`,
      },
    },
  },
}))

const AskTIMButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <StyledButton variant="bordered" edge="rounded" onClick={onClick}>
      <Image src={askIcon.src} alt="" width={20} height={20} />
      <Typography variant="body1">
        Ask<strong>TIM</strong>
      </Typography>
    </StyledButton>
  )
}

export default AskTIMButton
