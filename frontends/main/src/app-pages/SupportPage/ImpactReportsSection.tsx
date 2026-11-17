import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { RiArrowRightLine } from "@remixicon/react"
import { Section, SectionInner, SectionTitle } from "./SectionLayout"
import { IMPACT_REPORT_URLS } from "./links"

const Inner = styled(SectionInner)({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

const Header = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: theme.custom.colors.darkGray2,
}))

const Description = styled.p(({ theme }) => ({
  ...theme.typography.body1Loose,
  margin: 0,
}))

const Cards = styled.div(({ theme }) => ({
  display: "flex",
  gap: "40px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "16px",
  },
}))

const Others = styled.div({
  flex: "556 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

/** The whole card is the link; its title names the report. */
const Card = styled.a(({ theme }) => ({
  display: "flex",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  color: theme.custom.colors.darkGray2,
  "&:hover .view-report": {
    textDecoration: "underline",
  },
}))

const FeaturedCard = styled(Card)(({ theme }) => ({
  flex: "680 1 0",
  minWidth: 0,
  flexDirection: "column",
  [theme.breakpoints.down("md")]: {
    flex: "none",
  },
}))

/** Fills the featured card above its title; crops the cover like the design. */
const FeaturedCover = styled.div(({ theme }) => ({
  position: "relative",
  flex: 1,
  minHeight: "370px",
  img: {
    objectFit: "cover",
    objectPosition: "center 70%",
  },
  [theme.breakpoints.down("sm")]: {
    minHeight: "220px",
  },
}))

const CompactCover = styled.div(({ theme }) => ({
  position: "relative",
  flexShrink: 0,
  width: "350px",
  height: "234px",
  img: {
    objectFit: "cover",
    objectPosition: "top",
  },
  [theme.breakpoints.down("sm")]: {
    width: "45%",
    height: "auto",
    aspectRatio: "350 / 234",
  },
}))

const FeaturedText = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "24px 32px",
})

const CompactText = styled.div({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px 24px",
})

const FeaturedTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  margin: 0,
}))

const CompactTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.black,
  margin: 0,
}))

const ViewReport = styled("span", {
  shouldForwardProp: (prop) => prop !== "size",
})<{ size: "large" | "small" }>(({ theme, size }) => ({
  ...(size === "large" ? theme.typography.body1 : theme.typography.body2),
  gap: size === "large" ? "10px" : "4px",
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  color: theme.custom.colors.red,
  svg: {
    width: "20px",
    height: "20px",
  },
}))

const REPORTS = ([2026, 2025, 2024] as const).map((year) => ({
  title: `MIT Open Learning Impact Report - ${year}`,
  href: IMPACT_REPORT_URLS[year],
  cover: `/images/support/report-${year}.jpg`,
}))

const newTab = { target: "_blank", rel: "noopener noreferrer" }

const ImpactReportsSection: React.FC = () => {
  const [featured, ...others] = REPORTS
  return (
    <Section shade="gray">
      <Inner>
        <Header>
          <SectionTitle>Explore Open Learning's impact reports</SectionTitle>
          <Description>
            Selected recent editions, showing the people, programs, and
            initiatives expanding access to MIT education.
          </Description>
        </Header>
        <Cards>
          <FeaturedCard href={featured.href} {...newTab}>
            <FeaturedCover>
              <Image
                src={featured.cover}
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 680px"
              />
            </FeaturedCover>
            <FeaturedText>
              <FeaturedTitle>{featured.title}</FeaturedTitle>
              <ViewReport className="view-report" size="large">
                View Impact Report
                <RiArrowRightLine aria-hidden />
              </ViewReport>
            </FeaturedText>
          </FeaturedCard>
          <Others>
            {others.map((report) => (
              <Card key={report.href} href={report.href} {...newTab}>
                <CompactCover>
                  <Image src={report.cover} alt="" fill sizes="350px" />
                </CompactCover>
                <CompactText>
                  <CompactTitle>{report.title}</CompactTitle>
                  <ViewReport className="view-report" size="small">
                    View Impact Report
                    <RiArrowRightLine aria-hidden />
                  </ViewReport>
                </CompactText>
              </Card>
            ))}
          </Others>
        </Cards>
      </Inner>
    </Section>
  )
}

export default ImpactReportsSection
