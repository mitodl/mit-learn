import React from "react"
import { Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { programPageView } from "@/common/urls"

const UAI_PROGRAM_READABLE_ID = "program-v1:UAI+B2C"

const UAI_ANNOUNCEMENT_BG: React.CSSProperties = {
  backgroundImage: "url('/images/uai-announcement.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
}

const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  overflow: "hidden",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  marginTop: "32px",
  marginBottom: "112px",
  boxShadow: "2px 2px 50px 0 rgba(3, 21, 45, 0.05)",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    marginTop: "24px",
    marginBottom: "80px",
  },
  [theme.breakpoints.down("sm")]: {
    marginTop: 0,
    marginBottom: "32px",
  },
}))

const ImageSection = styled.div(({ theme }) => ({
  flexShrink: 0,
  width: "328px",
  minHeight: "350px",
  ...UAI_ANNOUNCEMENT_BG,
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "180px",
    minHeight: "unset",
  },
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const MobileImage = styled.div(({ theme }) => ({
  flexShrink: 0,
  width: "80px",
  height: "80px",
  ...UAI_ANNOUNCEMENT_BG,
  borderRadius: "8px",
  display: "none",
  [theme.breakpoints.down("sm")]: {
    display: "block",
  },
}))

const MobileCardHeader = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "12px",
  },
}))

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`
const ContentSection = styled.div(({ theme }) => ({
  padding: "40px 48px 40px 48px",
  display: "flex",
  width: "100%",
  flexDirection: "column",
  gap: "16px",
  justifyContent: "center",
  [theme.breakpoints.down("md")]: {
    padding: "24px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "24px",
  },
}))

const Eyebrow = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body4,
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const Title = styled("h2")(({ theme }) => ({
  margin: 0,
  ...theme.typography.h3,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
    marginTop: "-8px",
  },
}))

const Description = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body1,
  marginTop: "8px",
  lineHeight: "170%",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    lineHeight: "18px",
    marginTop: "0px",
  },
}))

const CheckList = styled.ul(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  gap: "16px",
  listStyle: "none",
  padding: 0,
  margin: 0,
  marginTop: "8px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "0px",
    width: "100%",
  },
}))

const CTA = styled.div(({ theme }) => ({
  marginTop: "24px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "8px",
  },
}))

const CheckItem = styled.li(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body1,
  padding: "4px 8px 4px 0",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    width: "100%",
  },
}))

const CTAButtonWrapper = styled(ButtonLink)(({ theme }) => ({
  ...theme.typography.body1,
  padding: "14px 30px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
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
        <MobileCardHeader>
          <MobileImage aria-hidden="true" />
          <TitleGroup>
            <Eyebrow variant="body2">INTRODUCING UNIVERSAL AI</Eyebrow>
            <Title>Universal AI</Title>
          </TitleGroup>
        </MobileCardHeader>
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
                <CheckIcon size={18} aria-hidden="true" focusable="false" />
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
