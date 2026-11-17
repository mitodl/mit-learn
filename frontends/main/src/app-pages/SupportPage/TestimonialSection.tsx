import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiExternalLinkLine } from "@remixicon/react"
import { getSupportShareStoryUrl } from "@/common/config"
import { Section, SectionInner, SectionTitle } from "./SectionLayout"
import { FREESIA_STORY_URL } from "./links"

type Testimonial = {
  quote: string
  name: string
  location: string
  summary: string
  image: string
  imageAlt: string
  storyLabel: string
  storyUrl: string
}

/**
 * The featured learner. The quote is expected to change over time while the
 * layout stays, so swapping it means editing only this object.
 */
export const TESTIMONIAL: Testimonial = {
  quote:
    "The free courses gave me a solid foundation of knowledge and problem-solving abilities. Without these, it wouldn’t be possible to do what I’m doing now.",
  name: "Freesia Gaul",
  location: "Australia",
  summary:
    "Freesia taught herself circuits with free MIT courses, then built a low-cost haptic VR glove that won the People’s Choice award at SXSW Sydney 2025.",
  image: "/images/support/freesia-gaul.jpg",
  imageAlt: "Freesia Gaul wearing her haptic VR glove",
  storyLabel: "Read Freesia’s story",
  storyUrl: FREESIA_STORY_URL,
}

const Inner = styled(SectionInner)({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

const Header = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "16px",
  },
}))

const HeaderText = styled.div(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: theme.custom.colors.darkGray2,
}))

const Description = styled.p(({ theme }) => ({
  ...theme.typography.body1Loose,
  margin: 0,
}))

const Card = styled.div(({ theme }) => ({
  display: "flex",
  gap: "40px",
  padding: "32px",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "24px",
    padding: "16px",
  },
}))

/** 702×439 in the design. */
const Photo = styled.div(({ theme }) => ({
  position: "relative",
  flex: "702 1 0",
  minWidth: 0,
  aspectRatio: "702 / 439",
  img: {
    objectFit: "cover",
  },
  [theme.breakpoints.down("md")]: {
    flex: "none",
  },
}))

const Details = styled.div({
  flex: "470 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const Story = styled.div({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
})

const Quote = styled.blockquote(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h4,
  },
}))

const Attribution = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
  strong: {
    fontWeight: theme.typography.fontWeightBold,
    color: theme.custom.colors.darkGray2,
  },
}))

const Summary = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  lineHeight: theme.typography.pxToRem(24),
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const TextLink = styled.a(({ theme }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightBold,
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: theme.custom.colors.red,
  svg: {
    width: "20px",
    height: "20px",
  },
  "&:hover": {
    textDecoration: "underline",
  },
}))

const Prompt = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const newTab = { target: "_blank", rel: "noopener noreferrer" }

const TestimonialSection: React.FC = () => {
  const shareStoryUrl = getSupportShareStoryUrl()
  const t = TESTIMONIAL
  return (
    <Section shade="gray">
      <Inner>
        <Header>
          <HeaderText>
            <SectionTitle>The impact of open education</SectionTitle>
            <Description>
              See how access to MIT learning experiences is making a difference
              in people's lives and careers.
            </Description>
          </HeaderText>
          {shareStoryUrl ? (
            <ButtonLink
              variant="primary"
              size="medium"
              href={shareStoryUrl}
              endIcon={<RiArrowRightLine aria-hidden />}
              {...newTab}
            >
              Share your story
            </ButtonLink>
          ) : null}
        </Header>
        <Card>
          <Photo>
            <Image
              src={t.image}
              alt={t.imageAlt}
              fill
              sizes="(max-width: 900px) 100vw, 702px"
            />
          </Photo>
          <Details>
            <Story>
              <Quote>“{t.quote}”</Quote>
              <Attribution>
                <strong>{t.name}</strong> · {t.location}
              </Attribution>
              <Summary>{t.summary}</Summary>
            </Story>
            <div>
              <TextLink href={t.storyUrl} {...newTab}>
                {t.storyLabel}
                <RiExternalLinkLine aria-hidden />
              </TextLink>
            </div>
            {shareStoryUrl ? (
              <Prompt>
                Has MIT helped you learn?
                <TextLink href={shareStoryUrl} {...newTab}>
                  Share your story
                  <RiArrowRightLine aria-hidden />
                </TextLink>
              </Prompt>
            ) : null}
          </Details>
        </Card>
      </Inner>
    </Section>
  )
}

export default TestimonialSection
