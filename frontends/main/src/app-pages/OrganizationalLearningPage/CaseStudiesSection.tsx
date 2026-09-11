"use client"

import React, { useCallback, useRef, useState } from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { CarouselV2 } from "ol-components/CarouselV2"
import { VisuallyHidden } from "@mitodl/smoot-design"
import {
  Section,
  SectionInner,
  SectionEyebrow,
  SectionHeading,
  SectionBody,
  SectionHeader,
} from "./SectionLayout"
import { caseStudies as copy } from "./copy"
import type {
  CaseStudyItem,
  CaseStudyPillarItem,
  CaseStudyQuotePillar,
} from "./copy"

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "48px",
  padding: "96px 24px 40px",
  [theme.breakpoints.down("md")]: {
    gap: "32px",
    padding: "32px 24px 16px",
  },
}))

const CenteredHeader = styled(SectionHeader)({
  textAlign: "center",
  alignItems: "center",
})

const Carousel = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  minWidth: 0,
})

const Nav = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "24px",
})

const ArrowSlot = styled.div({
  display: "contents",
  "& > button:last-of-type": {
    order: 1,
  },
})

const Track = styled(CarouselV2)({
  minWidth: 0,
})

const Slide = styled.div({
  flex: "0 0 100%",
  minWidth: 0,
})

const Counter = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  padding: "40px",
  borderRadius: "4px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.lightGray1,
  [theme.breakpoints.down("md")]: {
    gap: "24px",
    padding: "24px",
  },
}))

const Masthead = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "48px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "24px",
  },
}))

const Logo = styled(Image)(({ theme }) => ({
  flexShrink: 0,
  boxSizing: "border-box",
  width: "200px",
  height: "200px",
  objectFit: "contain",
  borderRadius: "16px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
  [theme.breakpoints.down("md")]: {
    width: "144px",
    height: "144px",
    borderRadius: "12px",
  },
}))

const MastheadText = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  flex: "1 1 0",
  minWidth: 0,
})

const TitleBlock = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const OrgName = styled.h3(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
  },
}))

const Tagline = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const STATS_COLUMNS = 3

const Stats = styled.dl(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: `repeat(${STATS_COLUMNS}, 1fr)`,
  gap: "24px 48px",
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    gap: "16px",
  },
}))

const Stat = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  [`&:not(:nth-of-type(${STATS_COLUMNS}n + 1))`]: {
    paddingLeft: "48px",
    borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
  },
  [theme.breakpoints.down("sm")]: {
    [`&:not(:nth-of-type(${STATS_COLUMNS}n + 1))`]: {
      paddingLeft: 0,
      borderLeft: "none",
    },
  },
}))

const StatValue = styled.dd(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  order: -1,
}))

const StatLabel = styled.dt(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Divider = styled.hr(({ theme }) => ({
  width: "100%",
  height: 0,
  margin: 0,
  border: "none",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const Pillars = styled.ul(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "20px",
  listStyle: "none",
  margin: 0,
  padding: 0,
  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "repeat(2, 1fr)",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}))

const Pillar = styled.li(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  padding: "24px",
  borderRadius: "4px",
  backgroundColor: theme.custom.colors.white,
}))

const PillarTitle = styled.h4(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const PillarBody = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const PillarBullets = styled.ul(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  margin: 0,
  paddingLeft: "21px",
  listStyleType: "disc",
}))

const QuoteMark = styled.span(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.red,
  lineHeight: 1,
}))

const QuoteText = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  marginTop: "-16px",
}))

const QuoteAttribution = styled.div({
  display: "flex",
  flexDirection: "column",
  marginTop: "auto",
})

const QuoteName = styled.p(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const QuoteRole = styled.p(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const Footnote = styled.p(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  textAlign: "center",
}))

const isQuotePillar = (
  pillar: CaseStudyPillarItem,
): pillar is CaseStudyQuotePillar => "quote" in pillar

type CaseStudyPanelProps = {
  study: CaseStudyItem
  /** True once there is more than one study, which makes this panel a slide. */
  isSlide: boolean
}

const CaseStudyPanel: React.FC<CaseStudyPanelProps> = ({ study, isSlide }) => {
  const slideProps = isSlide
    ? {
        role: "group",
        "aria-roledescription": "slide",
        "aria-label": study.org,
      }
    : {}

  return (
    <Card {...slideProps}>
      <Masthead>
        {study.logo ? (
          <Logo
            src={study.logo.src}
            alt=""
            width={study.logo.width}
            height={study.logo.height}
          />
        ) : null}
        <MastheadText>
          <TitleBlock>
            <SectionEyebrow>{study.eyebrow}</SectionEyebrow>
            <OrgName>{study.org}</OrgName>
            <Tagline>{study.tagline}</Tagline>
          </TitleBlock>
          <Stats>
            {study.stats.map((stat) => (
              <Stat key={stat.label}>
                <StatLabel>{stat.label}</StatLabel>
                <StatValue>{stat.value}</StatValue>
              </Stat>
            ))}
          </Stats>
        </MastheadText>
      </Masthead>

      <Divider />

      <Pillars>
        {study.pillars.map((pillar) =>
          isQuotePillar(pillar) ? (
            <Pillar key={pillar.title}>
              <PillarTitle>{pillar.title}</PillarTitle>
              <QuoteMark aria-hidden>“</QuoteMark>
              <QuoteText>{pillar.quote}</QuoteText>
              <QuoteAttribution>
                <QuoteName>{pillar.name}</QuoteName>
                <QuoteRole>{pillar.role}</QuoteRole>
              </QuoteAttribution>
            </Pillar>
          ) : (
            <Pillar key={pillar.title}>
              <PillarTitle>{pillar.title}</PillarTitle>
              <PillarBody>{pillar.body}</PillarBody>
              <PillarBullets>
                {pillar.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </PillarBullets>
            </Pillar>
          ),
        )}
      </Pillars>

      <Footnote>{study.footnote}</Footnote>
    </Card>
  )
}

type CaseStudyCarouselProps = {
  items: CaseStudyItem[]
  label: string
}

/**
 * One panel at a time, paged by the prev/next controls.
 *
 * Slides on Embla via the shared CarouselV2 so the motion matches the Featured
 * Courses carousel on the home page rather than being a second, hand-rolled
 * animation.
 *
 * A single study renders on its own with no navigation rather than shipping
 * dead arrows and a "1 / 1" counter, so this same component covers both the
 * one-study case shipping now and the carousel it becomes later.
 *
 * Activating a control deliberately leaves focus on that control, per the
 * WAI-ARIA carousel pattern — the live region reports the new position instead,
 * so paging repeatedly does not require re-Tabbing. Position is read off the
 * settle event, so the counter and the announcement land with the slide rather
 * than ahead of it.
 */
const CaseStudyCarousel: React.FC<CaseStudyCarouselProps> = ({
  items,
  label,
}) => {
  const [arrows, setArrows] = useState<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const [announcement, setAnnouncement] = useState("")
  const settledIndex = useRef(0)

  const total = items.length
  const isCarousel = total > 1

  const handleSettle = useCallback(
    (slidesInView: number[]) => {
      const next = slidesInView[0]
      if (next === undefined || next === settledIndex.current) {
        return
      }
      settledIndex.current = next
      setIndex(next)
      setAnnouncement(`${next + 1} of ${total}: ${items[next].org}`)
    },
    [items, total],
  )

  const carouselProps = isCarousel
    ? {
        role: "group",
        "aria-roledescription": "carousel",
        "aria-label": label,
      }
    : {}

  return (
    <Carousel {...carouselProps}>
      {isCarousel ? (
        <Nav>
          <ArrowSlot ref={setArrows} />
          <Counter aria-hidden>
            {index + 1} / {total}
          </Counter>
        </Nav>
      ) : null}

      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {announcement}
      </VisuallyHidden>

      {isCarousel ? (
        <Track
          arrowsContainer={arrows}
          prevLabel="Previous case study"
          nextLabel="Next case study"
          mobileBleed="none"
          onSettle={handleSettle}
        >
          {items.map((study) => (
            <Slide key={study.org}>
              <CaseStudyPanel study={study} isSlide />
            </Slide>
          ))}
        </Track>
      ) : (
        <CaseStudyPanel study={items[0]} isSlide={false} />
      )}
    </Carousel>
  )
}

const CaseStudiesSection: React.FC = () => (
  <Band aria-labelledby="case-studies-heading">
    <Inner>
      <CenteredHeader>
        <SectionEyebrow>{copy.eyebrow}</SectionEyebrow>
        <SectionHeading id="case-studies-heading">{copy.title}</SectionHeading>
        <SectionBody>{copy.body}</SectionBody>
      </CenteredHeader>

      <CaseStudyCarousel items={copy.items} label={copy.navLabel} />
    </Inner>
  </Band>
)

export default CaseStudiesSection
export { CaseStudyCarousel }
