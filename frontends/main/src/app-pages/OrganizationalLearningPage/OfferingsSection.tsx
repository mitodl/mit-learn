"use client"

import React from "react"
import { styled } from "ol-components"
import { RiTeamLine, RiBrain3Line, RiCodeBlock } from "@remixicon/react"
import CtaButton from "./CtaButton"
import {
  Section,
  SectionInner,
  SectionEyebrow,
  SectionHeading,
  SectionHeader,
} from "./SectionLayout"
import { offerings as copy } from "./copy"

const CARD_ICONS = [RiTeamLine, RiBrain3Line, RiCodeBlock]

const Band = styled(Section)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  background: `linear-gradient(180deg, ${theme.custom.colors.lightGray1} 0%, ${theme.custom.colors.white} 100%)`,
}))

const Waves = styled.div(({ theme }) => ({
  position: "absolute",
  zIndex: 0,
  top: 0,
  left: "71.93%",
  width: "49.05%",
  aspectRatio: "822.02 / 1064.78",
  backgroundImage: "url('/images/organizational_learning/offerings-waves.svg')",
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  pointerEvents: "none",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const Inner = styled(SectionInner)({
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "72px",
})

const CenteredHeader = styled(SectionHeader)({
  textAlign: "center",
  alignItems: "center",
})

const Intro = styled.p(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Cards = styled.ul(({ theme }) => ({
  display: "flex",
  listStyle: "none",
  margin: 0,
  padding: 0,
  alignItems: "stretch",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const Card = styled.li(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  padding: "40px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  flex: "1 1 0",
  minWidth: 0,
  overflow: "hidden",
  svg: {
    color: theme.custom.colors.lightRed,
    width: "64px",
    height: "64px",
    flexShrink: 0,
  },
  [theme.breakpoints.down("md")]: {
    flex: "1 1 auto",
    padding: "24px",
  },
}))

const CardHeader = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const CardText = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const CardTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const CardTagline = styled.p(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.red,
  margin: 0,
}))

const CardBody = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  flex: 1,
}))

const BestFor = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

const BestForLabel = styled.p(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Audiences = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
  listStyle: "none",
  margin: 0,
  padding: 0,
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  "li + li::before": {
    content: '"•"',
    marginRight: "8px",
  },
}))

const FlexibleSolutions = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  display: "flex",
  flexDirection: "column",
}))

const FlexibleTitleBlock = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignItems: "center",
  textAlign: "center",
  padding: "24px",
})

const FlexibleTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const FlexibleBody = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Pills = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  gap: "16px",
  listStyle: "none",
  margin: 0,
  padding: "16px 24px",
  backgroundColor: theme.custom.colors.lightGray1,
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  "li + li::before": {
    content: '"•"',
    marginRight: "16px",
  },
}))

const Actions = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  [theme.breakpoints.down("sm")]: {
    button: { width: "100%" },
  },
}))

const Offers = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "80px",
})

const OfferingsSection: React.FC = () => (
  <Band aria-labelledby="offerings-heading">
    <Waves aria-hidden />
    <Inner>
      <CenteredHeader>
        <SectionEyebrow>{copy.eyebrow}</SectionEyebrow>
        <SectionHeading id="offerings-heading">{copy.title}</SectionHeading>
        <Intro>{copy.body}</Intro>
      </CenteredHeader>

      <Offers>
        <div>
          <Cards>
            {copy.cards.map((card, index) => {
              const Icon = CARD_ICONS[index]
              return (
                <Card key={card.title}>
                  <CardHeader>
                    {Icon ? <Icon aria-hidden /> : null}
                    <CardText>
                      <CardTitle>{card.title}</CardTitle>
                      <CardTagline>{card.tagline}</CardTagline>
                    </CardText>
                  </CardHeader>
                  <CardBody>{card.body}</CardBody>
                  <BestFor>
                    <BestForLabel>{card.bestForLabel}</BestForLabel>
                    <Audiences>
                      {card.bestFor.map((audience) => (
                        <li key={audience}>{audience}</li>
                      ))}
                    </Audiences>
                  </BestFor>
                </Card>
              )
            })}
          </Cards>
          <FlexibleSolutions>
            <FlexibleTitleBlock>
              <FlexibleTitle>{copy.flexibleSolutions.title}</FlexibleTitle>
              <FlexibleBody>{copy.flexibleSolutions.body}</FlexibleBody>
            </FlexibleTitleBlock>
            <Pills>
              {copy.flexibleSolutions.pills.map((pill) => (
                <li key={pill}>{pill}</li>
              ))}
            </Pills>
          </FlexibleSolutions>
        </div>

        <Actions>
          <CtaButton placement="offerings">{copy.ctaLabel}</CtaButton>
        </Actions>
      </Offers>
    </Inner>
  </Band>
)

export default OfferingsSection
