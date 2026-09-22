"use client"

import React from "react"
import Image from "next/image"
import { styled, pxToRem } from "ol-components"
import CtaButton from "./CtaButton"
import { Section, SectionInner } from "./SectionLayout"
import { hero as copy } from "./copy"

const FIGURE_RADIUS = "8px 80px 8px 50px"
const OUTLINE_RADIUS = "8px 50px 8px 50px"

const HeroBand = styled(Section)(({ theme }) => ({
  backgroundColor: "#EEEFF3",
  backgroundImage:
    "url('/images/organizational_learning/hero-illustration.svg')",
  backgroundSize: "210% auto",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  [theme.breakpoints.down("md")]: {
    backgroundImage: "none",
  },
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "100px",
  padding: "144px 0",
  [theme.breakpoints.down("lg")]: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: "48px",
    padding: "64px 0",
  },
  [theme.breakpoints.down("md")]: {
    padding: "32px 0",
  },
}))

const Copy = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  flex: "0 0 608px",
  [theme.breakpoints.down("lg")]: {
    flex: "initial",
  },
  [theme.breakpoints.down("md")]: {
    gap: "24px",
  },
}))

const Title = styled.h1(({ theme }) => ({
  ...theme.typography.h1,
  fontSize: pxToRem(40),
  lineHeight: pxToRem(48),
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h2,
  },
}))

const Emphasis = styled.span(({ theme }) => ({
  textDecorationLine: "underline",
  textDecorationColor: theme.custom.colors.brightRed,
  textDecorationThickness: "4px",
  textUnderlineOffset: "0",
  textDecorationSkipInk: "none",
  [theme.breakpoints.down("md")]: {
    textDecorationThickness: "3px",
  },
}))

const Body = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  fontWeight: theme.typography.fontWeightRegular,
  lineHeight: "26px",
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Stats = styled.dl({
  display: "flex",
  gap: "16px",
  margin: 0,
})

const Stat = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  flex: "1 1 0",
  minWidth: 0,
})

const StatValue = styled.dd(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  order: -1,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h4,
  },
}))

const StatLabel = styled.dt(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  lineHeight: "18px",
}))

const Actions = styled.div(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("sm")]: {
    button: { width: "100%" },
  },
}))

const Figure = styled.div(({ theme }) => ({
  position: "relative",
  flex: "1 1 0",
  minWidth: 0,
  alignSelf: "stretch",
  minHeight: "458px",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: "-21px 19px 21px -21px",
    border: `1px solid ${theme.custom.colors.red}`,
    borderRadius: OUTLINE_RADIUS,
    zIndex: 1,
  },
  [theme.breakpoints.down("lg")]: {
    minHeight: "320px",
  },
  [theme.breakpoints.down("md")]: {
    minHeight: "254px",
    "&::before": { display: "none" },
  },
}))

const HeroImage = styled(Image)({
  objectFit: "cover",
  borderRadius: FIGURE_RADIUS,
})

const EMPHASIS_PHRASE = "scalable education"

const HeroSection: React.FC = () => {
  const emphasisStart = copy.title.indexOf(EMPHASIS_PHRASE)
  if (emphasisStart === -1) {
    console.warn(
      `HeroSection: EMPHASIS_PHRASE "${EMPHASIS_PHRASE}" not found in copy.title; rendering title without emphasis.`,
    )
  }
  const titleStart =
    emphasisStart === -1 ? copy.title : copy.title.slice(0, emphasisStart)
  const titleEnd =
    emphasisStart === -1
      ? ""
      : copy.title.slice(emphasisStart + EMPHASIS_PHRASE.length)

  return (
    <HeroBand>
      <Inner>
        <Copy>
          <Title>
            {titleStart}
            {emphasisStart !== -1 && <Emphasis>{EMPHASIS_PHRASE}</Emphasis>}
            {titleEnd}
          </Title>
          <Body>{copy.body}</Body>
          <Stats>
            {copy.stats.map((stat) => (
              <Stat key={stat.value}>
                <StatLabel>
                  {stat.label.map((line, index) => (
                    <React.Fragment key={line}>
                      {index > 0 ? <br /> : null}
                      {line}
                    </React.Fragment>
                  ))}
                </StatLabel>
                <StatValue>{stat.value}</StatValue>
              </Stat>
            ))}
          </Stats>
          <Actions>
            <CtaButton placement="hero">{copy.ctaLabel}</CtaButton>
          </Actions>
        </Copy>
        <Figure>
          <HeroImage
            src={copy.image}
            alt={copy.imageAlt}
            fill
            sizes="(max-width: 1280px) 100vw, 568px"
            priority
          />
        </Figure>
      </Inner>
    </HeroBand>
  )
}

export default HeroSection
