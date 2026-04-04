import React, { useMemo } from "react"
import { styled, Typography } from "ol-components"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { programPageView } from "@/common/urls"

const BANNER_SEARCH_TERMS_PATTERN =
  /^(universal ai|ai|ai basics|ai intro|ai introduction|ai fundamentals|ai foundations|artificial intelligence|machine learning|data analytics|deep learning|prescriptive ai|predictive ai|multimodal ai|large language models|large language model|llms|llm|generative ai|gen ai|ai ethics|optimization|python|computer vision|ai framework|ai models|ai agents|agentic ai|ai and sustainability|ai and health|ai and healthcare|ai and medicine|ai and entrepreneurship)$/i

const BannerContainer = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  padding: "16px 24px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
  [theme.breakpoints.up("md")]: {
    marginTop: "48px",
  },
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    marginTop: "10px",
  },
}))

const BannerContent = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "12px",
  lineHeight: "16px",
})

const BannerLabel = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  textTransform: "uppercase",
  fontSize: "10px",
  lineHeight: "14px",
  fontWeight: theme.typography.fontWeightMedium,
}))

const BannerTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  fontSize: "16px",
  lineHeight: "20px",
}))

const BannerLink = styled.a(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: "12px",
  whiteSpace: "nowrap",
  textDecoration: "none",
  padding: "8px 16px",
  borderRadius: "4px",
  marginRight: "-16px",
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const BannerDescription = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  fontSize: "12px",
  lineHeight: "16px",
}))

interface UniversalAIBannerProps {
  searchParams: URLSearchParams
}

const UniversalAIBanner: React.FC<UniversalAIBannerProps> = ({
  searchParams,
}) => {
  const searchTerm = searchParams.get("q")
  const featureFlagEnabled = useFeatureFlagEnabled(
    FeatureFlags.UniversalAISearchBanner,
  )

  const matchesSearchTerm = useMemo(() => {
    if (!searchTerm) return true // If no search term, show the banner by default
    return BANNER_SEARCH_TERMS_PATTERN.test(searchTerm.trim())
  }, [searchTerm])

  const showBanner = featureFlagEnabled && matchesSearchTerm

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
        <BannerTitle>Universal AI</BannerTitle>
        <BannerDescription>
          A self-paced program that takes learners from AI fundamentals to
          practical, industry-relevant applications. No technical background
          required.
        </BannerDescription>
      </BannerContent>
      <BannerLink href={ctaHref}>Learn More</BannerLink>
    </BannerContainer>
  )
}

export default UniversalAIBanner
