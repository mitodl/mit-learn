import { env } from "@/env"
import React, { useMemo } from "react"
import Link from "next/link"
import { styled, Typography } from "ol-components"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { programPageView } from "@/common/urls"
import { PostHogEvents } from "@/common/constants"
import type { RegisteredSearchParams } from "@/common/searchParams"

const BANNER_SEARCH_TERMS = [
  "artificial intelligence",
  "machine learning",
  "data analytics",
  "deep learning",
  "large language models",
  "large language model",
  "llms",
  "llm",
  "optimization",
  "python",
  "computer vision",
]

/**
 * A handle for the column the banner is dropped into, which owns the space
 * around it and may not want the margin the banner carries for the default
 * column's tighter rhythm.
 */
const BANNER_CLASS = "universal-ai-banner"

const BannerContainer = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  padding: "16px 24px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  /* The column it sits in spaces its children 16px apart, which the banner
     needs a little more than. A layout that spaces them further apart has no
     use for it and takes it off again -- see `BANNER_CLASS` below. */
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
})) as typeof Typography

const BannerLink = styled(Link)(({ theme }) => ({
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
  searchParams: RegisteredSearchParams
}

/**
 * Whether the banner will draw anything.
 *
 * Exported because what sits below it needs to know: the banner renders
 * nothing at all unless the flag is on and the search term is one it answers,
 * and nothing takes up no room, so a column that spaced itself from the
 * banner has nothing to space itself from.
 */
const useUniversalAIBannerVisible = (
  searchParams: RegisteredSearchParams,
): boolean => {
  const searchTerm = searchParams.get("q")
  const featureFlagEnabled = useFeatureFlagEnabled(
    FeatureFlags.UniversalAISearchBanner,
  )

  const matchesSearchTerm = useMemo(() => {
    if (!searchTerm) return true // If no search term, show the banner by default
    const normalized = searchTerm.trim().toLowerCase()
    if (/\bai\b/.test(normalized)) return true
    return BANNER_SEARCH_TERMS.includes(normalized)
  }, [searchTerm])

  return !!featureFlagEnabled && matchesSearchTerm
}

const UniversalAIBanner: React.FC<UniversalAIBannerProps> = ({
  searchParams,
}) => {
  const posthog = usePostHog()
  const showBanner = useUniversalAIBannerVisible(searchParams)

  const UAI_PROGRAM_READABLE_ID = "program-v1:UAI+B2C"
  const ctaHref = programPageView({
    readable_id: UAI_PROGRAM_READABLE_ID,
    display_mode: null,
  })

  const handleCTAClick = () => {
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.CallToActionClicked, {
        label: "Learn more about Universal AI",
        readableId: UAI_PROGRAM_READABLE_ID,
      })
    }
  }

  if (!showBanner) return null

  return (
    <BannerContainer className={BANNER_CLASS}>
      <BannerContent>
        <BannerLabel>New on MIT Learn</BannerLabel>
        <BannerTitle component="h2">Universal AI</BannerTitle>
        <BannerDescription>
          A self-paced program that takes learners from AI fundamentals to
          practical, industry-relevant applications. No technical background
          required.
        </BannerDescription>
      </BannerContent>
      <BannerLink
        href={ctaHref}
        aria-label="Learn more about Universal AI"
        onClick={handleCTAClick}
      >
        Learn More
      </BannerLink>
    </BannerContainer>
  )
}

export default UniversalAIBanner
export { useUniversalAIBannerVisible, BANNER_CLASS }
