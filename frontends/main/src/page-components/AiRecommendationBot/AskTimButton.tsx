import React from "react"
import Image from "next/image"
import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import askTimIcon from "@/public/images/icons/ask-tim.svg"

const StyledButton = styled(Button)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  minWidth: "auto",
  paddingLeft: "16px",
  paddingRight: "24px",
  borderColor: theme.custom.colors.lightGray2,
}))

const AskTim = styled.div({
  display: "flex",
  alignItems: "baseline",
})

const Ask = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
}))

const Tim = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  textTransform: "uppercase",
  // eslint-disable-next-line no-restricted-syntax
  fontWeight: 900,
}))

const AskTIMButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <StyledButton
      variant="bordered"
      edge="rounded"
      startIcon={<Image src={askTimIcon.src} alt="" width={20} height={20} />}
      onClick={onClick}
    >
      <AskTim>
        <Ask>Ask</Ask> <Tim>Tim</Tim>
      </AskTim>
    </StyledButton>
  )
}

export default AskTIMButton
