"use client"

import React from "react"
import { styled } from "ol-components"
import {
  RiTimeLine,
  RiPresentationLine,
  RiStackLine,
  RiMessage2Line,
  RiEarthLine,
} from "@remixicon/react"
import CtaButton from "./CtaButton"
import { Section, SectionInner, SectionEyebrow } from "./SectionLayout"
import { featuredProgram as copy } from "./copy"

const HIGHLIGHT_ICONS = [
  RiTimeLine,
  RiPresentationLine,
  RiStackLine,
  RiMessage2Line,
  RiEarthLine,
]

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "48px",
  [theme.breakpoints.down("lg")]: {
    flexDirection: "column",
    alignItems: "stretch",
  },
}))

const Copy = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  flex: "0 0 608px",
  [theme.breakpoints.down("lg")]: {
    flex: "initial",
  },
}))

const Heading = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const Title = styled.h2(({ theme }) => ({
  ...theme.typography.h1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h2,
  },
}))

const Tagline = styled.p(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h4,
  },
}))

const Body = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const Highlights = styled.ul(({ theme }) => ({
  display: "flex",
  gap: "24px",
  listStyle: "none",
  margin: 0,
  padding: 0,
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    gap: "24px 16px",
  },
}))

const Highlight = styled.li(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  flex: "1 1 0",
  minWidth: 0,
  textAlign: "center",
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  svg: {
    color: theme.custom.colors.red,
    width: "40px",
    height: "40px",
    flexShrink: 0,
  },
  [theme.breakpoints.down("sm")]: {
    flex: "0 0 calc(33.333% - 11px)",
  },
}))

const Actions = styled.div(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("sm")]: {
    button: { width: "100%" },
  },
}))

const Curriculum = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.black,
  borderRadius: "8px",
  padding: "32px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  flex: "1 1 0",
  minWidth: 0,
  [theme.breakpoints.down("md")]: {
    padding: "24px",
  },
}))

const CurriculumEyebrow = styled.p(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayLight,
  margin: 0,
}))

const CurriculumTitle = styled.p(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.white,
  margin: "4px 0 0",
}))

const Group = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const GroupLabel = styled.p(({ theme }) => ({
  ...theme.typography.subtitle4,
  color: theme.custom.colors.silverGrayLight,
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "16px",
  "&::after": {
    content: '""',
    flex: 1,
    borderTop: `1px solid ${theme.custom.colors.darkGray1}`,
  },
}))

const Modules = styled.ul({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  listStyle: "none",
  margin: 0,
  padding: 0,
})

const Module = styled.li(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.white,
  backgroundColor: theme.custom.colors.darkGray1,
  borderRadius: "4px",
  padding: "12px 16px",
}))

const Footnote = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayLight,
  margin: 0,
  textAlign: "center",
}))

const FeaturedProgramSection: React.FC = () => (
  <Band aria-labelledby="featured-program-heading">
    <Inner>
      <Copy>
        <Heading>
          <SectionEyebrow>{copy.eyebrow}</SectionEyebrow>
          <Title id="featured-program-heading">{copy.title}</Title>
          <Tagline>{copy.tagline}</Tagline>
        </Heading>
        <Body>{copy.body}</Body>
        <Highlights>
          {copy.highlights.map((highlight, index) => {
            const Icon = HIGHLIGHT_ICONS[index]
            return (
              <Highlight key={highlight}>
                {Icon ? <Icon aria-hidden /> : null}
                {highlight}
              </Highlight>
            )
          })}
        </Highlights>
        <Actions>
          <CtaButton placement="featuredProgram">{copy.ctaLabel}</CtaButton>
        </Actions>
      </Copy>
      <Curriculum>
        <div>
          <CurriculumEyebrow>{copy.curriculum.eyebrow}</CurriculumEyebrow>
          <CurriculumTitle>{copy.curriculum.title}</CurriculumTitle>
        </div>
        {copy.curriculum.groups.map((group) => (
          <Group key={group.title}>
            <GroupLabel>{group.title}</GroupLabel>
            <Modules>
              {group.modules.map((module) => (
                <Module key={module}>{module}</Module>
              ))}
            </Modules>
          </Group>
        ))}
        <Footnote>{copy.curriculum.footnote}</Footnote>
      </Curriculum>
    </Inner>
  </Band>
)

export default FeaturedProgramSection
