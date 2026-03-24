import React from "react"
import { Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { programPageView } from "@/common/urls"

const UAI_PROGRAM_READABLE_ID = "program-v1:UAI+B2C"

const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  overflow: "hidden",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  marginTop: "32px",
  marginBottom: "112px",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    marginTop: "24px",
    marginBottom: "80px",
  },
  [theme.breakpoints.down("sm")]: {
    marginTop: "16px",
    marginBottom: "40px",
  },
}))

const ImageSection = styled.div(({ theme }) => ({
  flexShrink: 0,
  width: "270px",
  minHeight: "280px",
  backgroundImage: "url('/images/uai-announcement.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  aspectRatio: "32/55",
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "200px",
    minHeight: "unset",
  },
}))

const ContentSection = styled.div(({ theme }) => ({
  padding: "0 80px 0 60px",
  display: "flex",
  width: "100%",
  flexDirection: "column",
  gap: "16px",
  justifyContent: "center",
  [theme.breakpoints.down("md")]: {
    padding: "24px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

const Eyebrow = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  ...theme.typography.body3,
}))

const Title = styled("h2")({
  margin: 0,
})

const Description = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body1,
  marginTop: "16px",
}))

const CheckList = styled.ul({
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  gap: "16px",
  listStyle: "none",
  padding: 0,
  margin: 0,
})

const CTA = styled.div({
  marginTop: "24px",
})

const CheckItem = styled.li(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  color: theme.custom.colors.black,
  ...theme.typography.body1,
  padding: "4px 16px 4px 0",
}))

const CTAButtonWrapper = styled(ButtonLink)(({ theme }) => ({
  ...theme.typography.body1,
  padding: "14px 24px",
}))

const CheckIcon = styled(RiCheckLine)(({ theme }) => ({
  color: theme.custom.colors.green,
  flexShrink: 0,
}))

const UAIAnnouncementCard: React.FC = () => {
  const showUAICard = useFeatureFlagEnabled(FeatureFlags.UniversalAI)
  if (!showUAICard) {
    return null
  }
  return (
    <Card>
      <ImageSection aria-hidden="true" />
      <ContentSection>
        <Eyebrow variant="body2">Introducing Universal AI</Eyebrow>
        <Title>Universal AI</Title>
        <Description variant="body1">
          A self-paced program covering foundational concepts in artificial
          intelligence and their application across domains. The curriculum
          includes foundational study, applied learning, and industry pathways
          leading to MIT certificates.
        </Description>
        <CheckList>
          {["AI Foundations", "Applied learning", "Industry pathways"].map(
            (item) => (
              <CheckItem key={item}>
                <CheckIcon size={16} aria-hidden="true" focusable="false" />
                {item}
              </CheckItem>
            ),
          )}
        </CheckList>
        <CTA>
          <CTAButtonWrapper
            variant="primary"
            href={programPageView({
              readable_id: UAI_PROGRAM_READABLE_ID,
              display_mode: null,
            })}
          >
            Learn about Universal AI
          </CTAButtonWrapper>
        </CTA>
      </ContentSection>
    </Card>
  )
}

export default UAIAnnouncementCard
