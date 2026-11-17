import React from "react"
import { styled } from "ol-components"
import { Section, SectionInner, SectionTitle } from "./SectionLayout"

const Header = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  paddingBottom: "22px",
})

const Description = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const Metrics = styled.dl(({ theme }) => ({
  display: "flex",
  margin: "0 0 16px",
  backgroundColor: theme.custom.colors.lightGray1,
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}))

/** The design's divider is 75px tall, inset from the band's edges. */
const Metric = styled.div(({ theme }) => ({
  position: "relative",
  flex: 1,
  display: "flex",
  flexDirection: "column-reverse",
  justifyContent: "flex-end",
  gap: "4px",
  minHeight: "140px",
  padding: "24px 32px",
  textAlign: "center",
  color: theme.custom.colors.darkGray2,
  "& + &::before": {
    content: '""',
    position: "absolute",
    left: 0,
    top: "26px",
    height: "75px",
    borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
  },
  [theme.breakpoints.down("sm")]: {
    minHeight: 0,
    "& + &::before": {
      top: 0,
      left: "32px",
      right: "32px",
      height: 0,
      borderLeft: "none",
      borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    },
  },
}))

const Value = styled.dd(({ theme }) => ({
  ...theme.typography.h1,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h2,
  },
}))

const Label = styled.dt(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
}))

const METRICS = [
  { value: "12,000+", label: "Free MIT learning resources" },
  { value: "9.3M+", label: "Learners using Open resources" },
]

/** dt must precede dd, so the label comes first and column-reverse lifts the value above it. */
const ImpactMetricsSection: React.FC = () => (
  <Section>
    <SectionInner>
      <Header>
        <SectionTitle>Opening education to the world.</SectionTitle>
        <Description>
          See the reach of MIT Open Learning—and the people and programs behind
          the numbers.
        </Description>
      </Header>
      <Metrics>
        {METRICS.map(({ value, label }) => (
          <Metric key={label}>
            <Label>{label}</Label>
            <Value>{value}</Value>
          </Metric>
        ))}
      </Metrics>
    </SectionInner>
  </Section>
)

export default ImpactMetricsSection
