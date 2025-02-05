import React, { useState } from "react"
import {
  Typography,
  styled,
  Drawer,
  Input,
  AdornmentButton,
} from "ol-components"
// import { FeatureFlags } from "@/common/feature_flags"
// import { useFeatureFlagEnabled } from "posthog-js/react"
import AskTIMButton from "./AskTimButton"
import AiRecommendationBot, { STARTERS } from "./AiRecommendationBot"
import Image from "next/image"
import timLogo from "@/public/images/icons/tim.svg"
import askTimIcon from "@/public/images/icons/ask-tim.svg"
import { RiSendPlaneFill } from "@remixicon/react"

const StripContainer = styled.div({
  padding: "16px 0",
  marginTop: "24px",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "24px",
  width: "100%",
  whiteSpace: "nowrap",
})

const DecorativeLine = styled.div(({ theme }) => ({
  width: "100%",
  height: "1px",
  backgroundColor: theme.custom.colors.lightGray2,
  marginTop: "4px",
}))

const LeadingText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

const EntryScreen = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "104px 32px",
})

const TimLogoBox = styled.div(({ theme }) => ({
  position: "relative",
  padding: "16px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
}))

const TimLogo = styled(Image)({
  display: "block",
})

const AskTimIcon = styled(Image)({
  position: "absolute",
  top: "-10px",
  left: "-10px",
})

const StyledInput = styled(Input)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: "24px 0",
  width: "700px",
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
}))

const StyledSendButton = styled(RiSendPlaneFill)(({ theme }) => ({
  fill: theme.custom.colors.red,
}))

const Starters = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  maxWidth: "836px",
  marginTop: "12px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const Starter = styled.div(({ theme }) => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  padding: "12px 16px",
  color: theme.custom.colors.darkGray2,
  [theme.breakpoints.down("md")]: {
    textAlign: "center",
    padding: "12px 36px",
  },
}))

const AiRecommendationBotDrawerStrip = () => {
  const [open, setOpen] = useState(false)
  const [showEntryScreen, setShowEntryScreen] = useState(true)
  // const recommendationBotEnabled = useFeatureFlagEnabled(
  //   FeatureFlags.RecommendationBot,
  // )
  // if (!recommendationBotEnabled) {
  //   return null
  // }

  return (
    <StripContainer>
      <DecorativeLine />
      <LeadingText>Do you require assistance?</LeadingText>
      <AskTIMButton onClick={() => setOpen(true)} />
      <Drawer open={open} anchor="right" onClose={() => setOpen(false)}>
        {showEntryScreen ? (
          <EntryScreen>
            <TimLogoBox>
              <AskTimIcon src={askTimIcon.src} alt="" width={24} height={24} />
              <TimLogo src={timLogo.src} alt="" width={40} height={40} />
            </TimLogoBox>
            <Typography variant="h4">Welcome! I am TIM the Beaver.</Typography>
            <Typography>Need assistance getting started?</Typography>
            <StyledInput
              fullWidth
              size="large"
              // inputProps={muiInputProps}
              // autoFocus
              // className={className}
              // placeholder={ }
              // value={value}
              // onChange={onChange}
              // onKeyDown={onInputKeyDown}
              endAdornment={
                <AdornmentButton
                  aria-label="Send"
                  onClick={() => setShowEntryScreen(false)}
                >
                  <StyledSendButton />
                </AdornmentButton>
              }
              responsive
            />
            <Typography variant="h5">Let me know how I can help.</Typography>
            <Starters>
              {STARTERS.map(({ content }, index) => (
                <Starter key={index}>
                  <Typography variant="body2">{content}</Typography>
                </Starter>
              ))}
            </Starters>
          </EntryScreen>
        ) : (
          <AiRecommendationBot />
        )}
      </Drawer>
    </StripContainer>
  )
}

export default AiRecommendationBotDrawerStrip
