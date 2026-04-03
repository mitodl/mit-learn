import React from "react"
import { styled, Typography } from "ol-components"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { programPageView } from "@/common/urls"

const BannerContainer = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  padding: "16px 24px",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "24px",
}))

const BannerContent = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

const BannerLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  fontWeight: 600,
  fontSize: "12px",
  letterSpacing: "1px",
  textTransform: "uppercase",
}))

const BannerTitle = styled(Typography)({
  fontWeight: 700,
})

const BannerLink = styled.a(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 600,
  whiteSpace: "nowrap",
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
}))

const UniversalAIBanner: React.FC = () => {
  const showBanner = useFeatureFlagEnabled(FeatureFlags.UniversalAISearchBanner)

  if (!showBanner) return null

  const UAI_PROGRAM_READABLE_ID = "program-v1:UAI+B2C"
  const ctaHref = programPageView({
    readable_id: UAI_PROGRAM_READABLE_ID,
    display_mode: null,
  })

  return (
    <BannerContainer>
      <BannerContent>
        <BannerLabel>New on MIT Learn</BannerLabel>
        <BannerTitle variant="h5">Universal AI</BannerTitle>
        <Typography variant="body2">
          A self-paced program that takes learners from AI fundamentals to
          practical, industry-relevant applications. No technical background
          required.
        </Typography>
      </BannerContent>
      <BannerLink href={ctaHref}>Learn More</BannerLink>
    </BannerContainer>
  )
}

export default UniversalAIBanner
