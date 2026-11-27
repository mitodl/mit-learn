import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { RiArrowRightLine } from "@remixicon/react"
import { Section, SectionInner, SectionTitle } from "./SectionLayout"
import { IMPACT_REPORT_URLS } from "./links"

const REPORT_COVER_MOBILE_RATIO = "368 / 210"
const COMPACT_TEXT_MIN_WIDTH = "200px"

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
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
  },
}))

const Others = styled.div(({ theme }) => ({
  flex: "556 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
  },
}))

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
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
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
/**
 * The covers are 4:3 with text near their top and bottom, so a box much wider
 * than the design's crops the text off. Where the box's height doesn't come
 * from the row beside it, it keeps the design's proportions instead of a
 * fixed height: 679×372 on desktop, 368×210 on phones.
 */
const FeaturedCover = styled.div(({ theme }) => ({
  position: "relative",
  flex: 1,
  minHeight: "370px",
  img: {
    objectFit: "cover",
    objectPosition: "center 70%",
  },
  // Stacked above the other reports, at full width.
  [theme.breakpoints.down("md")]: {
    flex: "none",
    minHeight: 0,
    aspectRatio: "679 / 372",
  },
  [theme.breakpoints.down("sm")]: {
    aspectRatio: REPORT_COVER_MOBILE_RATIO,
    img: {
      objectPosition: "center",
    },
  },
}))

/**
 * 350×234 at the design width. Narrower cards shrink the cover rather than
 * the text, which keeps at least COMPACT_TEXT_MIN_WIDTH.
 */
const CompactCover = styled.div(({ theme }) => ({
  position: "relative",
  flex: "0 1 350px",
  minWidth: 0,
  alignSelf: "flex-start",
  aspectRatio: "350 / 234",
  img: {
    objectFit: "cover",
    objectPosition: "top",
  },
  [theme.breakpoints.down("sm")]: {
    flex: "none",
    alignSelf: "stretch",
    aspectRatio: REPORT_COVER_MOBILE_RATIO,
    img: {
      objectPosition: "center",
    },
  },
}))

const FeaturedText = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "24px 32px",
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

const CompactText = styled.div(({ theme }) => ({
  flex: `1 0 ${COMPACT_TEXT_MIN_WIDTH}`,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "16px",
  padding: "16px 24px",
  [theme.breakpoints.down("sm")]: {
    flex: "none",
    justifyContent: "flex-start",
    padding: "16px",
  },
}))

const FeaturedTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
  },
}))

const CompactTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.black,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    color: theme.custom.colors.darkGray2,
  },
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
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    gap: "4px",
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
