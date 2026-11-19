import React from "react"
import Image from "next/image"
import { Skeleton, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiExternalLinkLine } from "@remixicon/react"
import { useTestimonialList } from "api/hooks/testimonials"
import type { Attestation } from "api/v0"
import { getSupportShareStoryUrl } from "@/common/config"
import { env } from "@/env"
import { Section, SectionInner, SectionTitle } from "./SectionLayout"
import { FREESIA_STORY_URL } from "./links"

/** The featured testimonial is the first published one at this position. */
export const TESTIMONIAL_POSITION = 1

type TestimonialExtras = {
  location: string
  summary: string
  imageAlt: string
  storyLabel: string
  storyUrl: string
}

/**
 * Details the design shows that the Attestation model doesn't have yet,
 * keyed by attestant name so they never appear beside someone else's quote.
 * TODO: move these onto the model and delete this map.
 */
export const TESTIMONIAL_EXTRAS: Record<string, TestimonialExtras> = {
  "Freesia Gaul": {
    location: "Australia",
    summary:
      "Freesia taught herself circuits with free MIT courses, then built a low-cost haptic VR glove that won the People’s Choice award at SXSW Sydney 2025.",
    imageAlt: "Freesia Gaul wearing her haptic VR glove",
    storyLabel: "Read Freesia’s story",
    storyUrl: FREESIA_STORY_URL,
  },
}

/**
 * Locally, media URLs are paths on the API host ("/media/..."); with S3 they
 * are already absolute. Resolve both against the API.
 */
const mediaUrl = (url: string) =>
  new URL(url, env("NEXT_PUBLIC_MITOL_API_BASE_URL")).toString()

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
  },
}))

const Header = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
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
    ...theme.typography.h5,
    fontSize: theme.typography.pxToRem(20),
    lineHeight: theme.typography.pxToRem(28),
    // 16px to the attribution, against the story's 12px gap.
    marginBottom: "4px",
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
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
  },
}))

const Summary = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  lineHeight: theme.typography.pxToRem(24),
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
  },
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
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    fontWeight: theme.typography.fontWeightBold,
    gap: "4px",
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
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    columnGap: "16px",
  },
}))

/** Roughly the loaded card's height, so the page doesn't jump. */
const CardSkeleton = styled(Skeleton)(({ theme }) => ({
  height: "503px",
  [theme.breakpoints.down("sm")]: {
    height: "600px",
  },
}))

const newTab = { target: "_blank", rel: "noopener noreferrer" }

const TestimonialCard: React.FC<{
  attestation: Attestation
  shareStoryUrl?: string
}> = ({ attestation, shareStoryUrl }) => {
  const extras = TESTIMONIAL_EXTRAS[attestation.attestant_name]
  return (
    <Card>
      {attestation.cover ? (
        <Photo>
          <Image
            src={mediaUrl(attestation.cover)}
            alt={extras?.imageAlt ?? ""}
            fill
            sizes="(max-width: 900px) 100vw, 702px"
          />
        </Photo>
      ) : null}
      <Details>
        <Story>
          <Quote>“{attestation.quote}”</Quote>
          <Attribution>
            <strong>{attestation.attestant_name}</strong>
            {extras ? ` · ${extras.location}` : null}
          </Attribution>
          {extras ? <Summary>{extras.summary}</Summary> : null}
        </Story>
        {extras ? (
          <div>
            <TextLink href={extras.storyUrl} {...newTab}>
              {extras.storyLabel}
              <RiExternalLinkLine aria-hidden />
            </TextLink>
          </div>
        ) : null}
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
  )
}

const TestimonialSection: React.FC = () => {
  const shareStoryUrl = getSupportShareStoryUrl()
  const { data, isLoading } = useTestimonialList({
    position: TESTIMONIAL_POSITION,
  })
  const attestation = data?.results[0]

  // Nothing to feature: leave the section out rather than show an empty card.
  if (!isLoading && !attestation) return null

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
        {attestation ? (
          <TestimonialCard
            attestation={attestation}
            shareStoryUrl={shareStoryUrl}
          />
        ) : (
          <CardSkeleton
            variant="rectangular"
            data-testid="testimonial-skeleton"
          />
        )}
      </Inner>
    </Section>
  )
}

export default TestimonialSection
