"use client"

import React, { useState } from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { ActionButton, VisuallyHidden } from "@mitodl/smoot-design"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import {
  Section,
  SectionInner,
  SectionEyebrow,
  SectionHeading,
  SectionBody,
  SectionHeader,
} from "./SectionLayout"
import { caseStudies as copy } from "./copy"
import type { CaseStudyItem } from "./copy"

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "48px",
  [theme.breakpoints.down("md")]: {
    gap: "32px",
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
})

const Nav = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "24px",
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

const LogoFrame = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxSizing: "border-box",
  width: "200px",
  height: "200px",
  padding: "24px",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  img: {
    maxWidth: "100%",
    maxHeight: "100%",
    width: "auto",
    height: "auto",
  },
  [theme.breakpoints.down("md")]: {
    width: "144px",
    height: "144px",
    padding: "16px",
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

const Stats = styled.dl(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "24px 48px",
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    gap: "16px",
  },
}))

const Stat = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  "&:not(:first-of-type)": {
    paddingLeft: "48px",
    borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
  },
  [theme.breakpoints.down("sm")]: {
    "&:not(:first-of-type)": {
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
}))

type CaseStudyPanelProps = {
  study: CaseStudyItem
  /** True once there is more than one study, which makes this panel a slide. */
  isSlide: boolean
}

const CaseStudyPanel = ({ study, isSlide }: CaseStudyPanelProps) => {
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
          <LogoFrame>
            <Image
              src={study.logo.src}
              alt=""
              width={study.logo.width}
              height={study.logo.height}
            />
          </LogoFrame>
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
        {study.pillars.map((pillar) => (
          <Pillar key={pillar.title}>
            <PillarTitle>{pillar.title}</PillarTitle>
            <PillarBody>{pillar.body}</PillarBody>
            <PillarBullets>
              {pillar.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </PillarBullets>
          </Pillar>
        ))}
      </Pillars>
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
 * A single study renders on its own with no navigation rather than shipping
 * dead arrows and a "1 / 1" counter, so this same component covers both the
 * one-study case shipping now and the carousel it becomes later.
 *
 * Activating a control deliberately leaves focus on that control, per the
 * WAI-ARIA carousel pattern — the live region reports the new position instead,
 * so paging repeatedly does not require re-Tabbing.
 */
const CaseStudyCarousel = ({ items, label }: CaseStudyCarouselProps) => {
  const [index, setIndex] = useState(0)
  const [announcement, setAnnouncement] = useState("")

  const total = items.length
  const isCarousel = total > 1

  const goTo = (next: number) => {
    setIndex(next)
    setAnnouncement(`${next + 1} of ${total}: ${items[next].org}`)
  }

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
          <ActionButton
            size="small"
            edge="rounded"
            variant="tertiary"
            aria-label="Previous case study"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            <RiArrowLeftLine aria-hidden />
          </ActionButton>
          <Counter aria-hidden>
            {index + 1} / {total}
          </Counter>
          <ActionButton
            size="small"
            edge="rounded"
            variant="tertiary"
            aria-label="Next case study"
            disabled={index === total - 1}
            onClick={() => goTo(index + 1)}
          >
            <RiArrowRightLine aria-hidden />
          </ActionButton>
        </Nav>
      ) : null}

      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {announcement}
      </VisuallyHidden>

      <CaseStudyPanel study={items[index]} isSlide={isCarousel} />
    </Carousel>
  )
}

const CaseStudiesSection = () => (
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
