import React from "react"
import { styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiHeartFill } from "@remixicon/react"
import { getEducatorShareStoryUrl } from "@/common/config"
import { Section, SectionInner } from "./SectionLayout"
import { OCW_GIVE_URL } from "./links"

const Inner = styled(SectionInner)(({ theme }) => ({
  padding: "80px 0",
  [theme.breakpoints.down("md")]: {
    padding: "40px 0",
  },
}))

const Banner = styled.div(({ theme }) => ({
  display: "flex",
  overflow: "hidden",
  borderRadius: "8px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const Panel = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "24px",
  padding: "40px 56px",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 24px",
  },
}))

const SupportPanel = styled(Panel)(({ theme }) => ({
  flex: "680 1 0",
  backgroundColor: theme.custom.colors.mitRed,
  color: theme.custom.colors.white,
}))

const SharePanel = styled(Panel)(({ theme }) => ({
  flex: "596 1 0",
  color: theme.custom.colors.darkGray2,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderLeft: "none",
  borderRadius: "0 8px 8px 0",
  [theme.breakpoints.down("md")]: {
    borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
  },
}))

const Text = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.h3,
  margin: 0,
}))

const Body = styled.p(({ theme }) => ({
  ...theme.typography.h5,
  margin: 0,
}))

const Heart = styled(RiHeartFill)(({ theme }) => ({
  color: theme.custom.colors.red,
}))

const SupportShareSection: React.FC = () => {
  const shareStoryUrl = getEducatorShareStoryUrl()
  return (
    <Section>
      <Inner>
        <Banner>
          <SupportPanel>
            <Text>
              <Heading>Support the educator community</Heading>
              <Body>Help keep MIT teaching resources free on MIT Learn.</Body>
            </Text>
            <ButtonLink
              variant="bordered"
              size="large"
              href={OCW_GIVE_URL}
              endIcon={<Heart aria-hidden />}
            >
              Give now
            </ButtonLink>
          </SupportPanel>
          {shareStoryUrl ? (
            <SharePanel>
              <Text>
                <Heading>Share your story</Heading>
                <Body>Inspire other educators with your experience.</Body>
              </Text>
              <ButtonLink
                variant="primary"
                size="large"
                href={shareStoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<RiArrowRightLine aria-hidden />}
              >
                Share your story
              </ButtonLink>
            </SharePanel>
          ) : null}
        </Banner>
      </Inner>
    </Section>
  )
}

export default SupportShareSection
