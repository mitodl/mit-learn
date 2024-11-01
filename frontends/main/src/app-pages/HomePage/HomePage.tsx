"use client"

import React, { Suspense } from "react"
import { Container, styled, theme } from "ol-components"
import HeroSearch from "@/page-components/HeroSearch/HeroSearch"
import BrowseTopicsSection from "./BrowseTopicsSection"
import NewsEventsSection from "./NewsEventsSection"
import TestimonialsSection from "./TestimonialsSection"
import ResourceCarousel from "@/page-components/ResourceCarousel/ResourceCarousel"
import PersonalizeSection from "./PersonalizeSection"
import * as carousels from "./carousels"
import LearningResourceDrawer from "@/page-components/LearningResourceDrawer/LearningResourceDrawer"

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

const MediaCarousel = styled(ResourceCarousel)(({ theme }) => ({
  margin: "80px 0",
  minHeight: "388px",
  [theme.breakpoints.down("md")]: {
    margin: "40px 0",
    minHeight: "418px",
  },
}))

const StyledContainer = styled(Container)({
  "@media (max-width: 1365px)": {
    overflow: "hidden",
  },
})

const HomePage: React.FC = () => {
  return (
    <>
      <LearningResourceDrawer />
      <FullWidthBackground>
        <StyledContainer>
          <HeroSearch />
          <section>
            <Suspense>
              <FeaturedCoursesCarousel
                titleComponent="h2"
                title="Featured Courses"
                config={carousels.FEATURED_RESOURCES_CAROUSEL}
              />
            </Suspense>
          </section>
        </StyledContainer>
      </FullWidthBackground>
      <PersonalizeSection />
      <Container component="section">
        <Suspense>
          <MediaCarousel
            titleComponent="h2"
            title="Media"
            config={carousels.MEDIA_CAROUSEL}
          />
        </Suspense>
      </Container>
      <BrowseTopicsSection />
      <TestimonialsSection />
      <NewsEventsSection />
    </>
  )
}

export default HomePage
