"use client"
import React from "react"
import { Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine } from "@remixicon/react"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { programPageView } from "@/common/urls"
import { PostHogEvents } from "@/common/constants"

const UAI_PROGRAM_READABLE_ID = "program-v1:UAI+B2C"

const FEATURES = [
  {
    title: "AI Foundations",
    description: "Core concepts and methods behind how AI works.",
  },
  {
    title: "MIT Expertise",
    description:
      "Practical use of AI across real-world contexts and industries.",
  },
  {
    title: "Applied Learning",
    description: "Developed by more than 30 MIT experts.",
  },
  {
    title: "Stackable Credentials",
    description:
      "Learners earn MIT Open Learning certificates as they progress.",
  },
]

const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderTop: `2px solid ${theme.custom.colors.red}`,
  overflow: "hidden",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "2px 2px 50px 0 rgba(3, 21, 45, 0.05)",
  marginTop: "32px",
  marginBottom: "80px",
  [theme.breakpoints.down("md")]: {
    marginTop: "24px",
    marginBottom: "80px",
  },
  [theme.breakpoints.down("sm")]: {
    marginTop: 0,
    marginBottom: "32px",
  },
}))

const CardHeader = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 40px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("md")]: {
    padding: "16px 40px",
  },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "16px",
  },
}))

const HeaderEyebrow = styled.span(({ theme }) => ({
  ...theme.typography.body4,
  color: theme.custom.colors.red,
  fontWeight: theme.typography.fontWeightBold,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}))

const HeaderMeta = styled.span(({ theme }) => ({
  ...theme.typography.body4,
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}))

const HeaderMetaDash = styled.span(({ theme }) => ({
  color: theme.custom.colors.black,
  padding: "0 16px 0 16px",
}))

const CardBody = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const LeftSection = styled.div(({ theme }) => ({
  flex: "0 0 55%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "16px",
  padding: "40px 56px",
  borderRight: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("md")]: {
    flex: "none",
    borderRight: "none",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    padding: "40px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
    gap: "8px",
  },
}))

const Title = styled("h2")(({ theme }) => ({
  margin: 0,
  ...theme.typography.h3,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const Description = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  lineHeight: "160%",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    lineHeight: "160%",
    fontWeight: theme.typography.fontWeightMedium,
  },
}))

/** CTA rendered inside the left column — desktop only */
const DesktopCTA = styled.div(({ theme }) => ({
  marginTop: "40px",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const RightSection = styled.ul(({ theme }) => ({
  flex: 1,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  padding: "40px",
  margin: 0,
  listStyle: "none",
  backgroundColor: "rgba(40, 39, 72, 0.02)",
  [theme.breakpoints.down("md")]: {
    padding: "0px 40px 40px 40px",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    padding: "0 0 0 0",
  },
}))

const FeatureItem = styled.li(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  justifyContent: "flex-start",
  padding: "32px 0px",
  "&:nth-of-type(odd)": {
    paddingRight: "32px",
  },
  "&:nth-of-type(even)": {
    paddingLeft: "40px",
  },
  // 2-column grid borders (tablet + desktop)
  [theme.breakpoints.up("sm")]: {
    "&:nth-of-type(odd)": {
      borderRight: `1px solid ${theme.custom.colors.lightGray2}`,
    },
    "&:nth-of-type(-n+2)": {
      borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    },
  },
  // Bottom-row padding on tablet only
  [theme.breakpoints.between("sm", "md")]: {
    padding: "0",
    "&:nth-of-type(-n+2)": {
      paddingTop: "32px",
      paddingBottom: "32px",
    },
    "&:nth-of-type(n+3)": {
      paddingTop: "32px",
    },
  },
  // Single-column borders (mobile)
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
    "&:nth-of-type(even)": {
      paddingLeft: "16px",
    },
    "&:not(:last-of-type)": {
      borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    },
  },
}))

const FeatureTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.custom.colors.darkGray2,
  display: "block",
}))

const FeatureDescription = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.silverGray,
  display: "block",
}))

/** CTA rendered below the features grid — tablet + mobile only */
const BottomCTA = styled.div(({ theme }) => ({
  display: "none",
  [theme.breakpoints.between("sm", "md")]: {
    display: "flex",
    justifyContent: "center",
    padding: "24px",
  },
  [theme.breakpoints.down("sm")]: {
    display: "block",
    padding: "24px 16px",
  },
}))

const CTAButton = styled(ButtonLink)(({ theme }) => ({
  ...theme.typography.body1,
  padding: "12px 30px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const UAIAnnouncementCard: React.FC = () => {
  const showUAICard = useFeatureFlagEnabled(FeatureFlags.UniversalAI)
  const posthog = usePostHog()

  const ctaHref = programPageView({
    readable_id: UAI_PROGRAM_READABLE_ID,
    display_mode: null,
  })

  const handleCTAClick = () => {
    if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
      posthog.capture(PostHogEvents.CallToActionClicked, {
        label: "Learn about Universal AI",
        readableId: UAI_PROGRAM_READABLE_ID,
        resourceType: "program",
      })
    }
  }

  if (!showUAICard) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <HeaderEyebrow>New on MIT Learn</HeaderEyebrow>
        <HeaderMeta>
          Self-Paced <HeaderMetaDash aria-hidden>—</HeaderMetaDash> Certificate
          Available
        </HeaderMeta>
      </CardHeader>
      <CardBody>
        <LeftSection>
          <Title>Universal AI</Title>
          <Description variant="body1">
            A self-paced online program that takes learners from AI fundamentals
            to practical, industry-relevant applications. Designed by more than
            30 MIT experts for learners from a wide range of backgrounds. No
            technical background required.
          </Description>
          <DesktopCTA>
            <CTAButton
              variant="primary"
              href={ctaHref}
              endIcon={<RiArrowRightLine />}
              onClick={handleCTAClick}
            >
              Learn about Universal AI
            </CTAButton>
          </DesktopCTA>
        </LeftSection>
        <RightSection>
          {FEATURES.map(({ title, description }) => (
            <FeatureItem key={title}>
              <FeatureTitle>{title}</FeatureTitle>
              <FeatureDescription>{description}</FeatureDescription>
            </FeatureItem>
          ))}
        </RightSection>
      </CardBody>
      <BottomCTA>
        <CTAButton
          variant="primary"
          href={ctaHref}
          endIcon={<RiArrowRightLine />}
          onClick={handleCTAClick}
        >
          Learn about Universal AI
        </CTAButton>
      </BottomCTA>
    </Card>
  )
}

export default UAIAnnouncementCard
