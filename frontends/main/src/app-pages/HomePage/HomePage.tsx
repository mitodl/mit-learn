"use client"

import React from "react"
import { Container, styled, theme } from "ol-components"
import HeroSearch from "@/page-components/HeroSearch/HeroSearch"
import BrowseTopicsSection from "./BrowseTopicsSection"
import NewsEventsSection from "./NewsEventsSection"
import TestimonialsSection from "./TestimonialsSection"
import ResourceCarousel from "@/page-components/ResourceCarousel/ResourceCarousel"
import PersonalizeSection from "./PersonalizeSection"
import * as carousels from "./carousels"
import dynamic from "next/dynamic"

const FullWidthBackground = styled.div({
  background: "linear-gradient(0deg, #FFF 0%, #E9ECEF 100%);",
  paddingBottom: "80px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "40px",
  },
  [theme.breakpoints.down("sm")]: {
    paddingBottom: "32px",
  },
})

const FeaturedCoursesCarousel = styled(ResourceCarousel)(({ theme }) => ({
  marginTop: "16px",
  [theme.breakpoints.down("sm")]: {
    marginTop: "0px",
  },
}))

const StyledContainer = styled(Container)({
  "@media (max-width: 1365px)": {
    overflow: "hidden",
  },
})

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

const MediaSection = dynamic(() => import("./MediaSection"))

const HomePage: React.FC<{ heroImageIndex: number }> = ({ heroImageIndex }) => {
  return (
    <>
      <LearningResourceDrawer />
      <FullWidthBackground>
        <StyledContainer>
          <HeroSearch imageIndex={heroImageIndex} />
          <section>
            <FeaturedCoursesCarousel
              titleComponent="h2"
              title="Featured Courses"
              config={carousels.FEATURED_RESOURCES_CAROUSEL}
            />
          </section>
        </StyledContainer>
      </FullWidthBackground>
      <PersonalizeSection />
      <MediaSection />
      <BrowseTopicsSection />
      <TestimonialsSection />
      <NewsEventsSection />
    </>
  )
}

export default HomePage
