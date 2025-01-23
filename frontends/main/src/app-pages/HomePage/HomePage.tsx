"use client"

import React, { Suspense } from "react"
import { Container, styled, theme } from "ol-components"
import * as carousels from "./carousels"
import dynamic from "next/dynamic"

const HeroSearch = dynamic(
  () => import("@/page-components/HeroSearch/HeroSearch"),
  { ssr: true },
)

const TestimonialsSection = dynamic(() => import("./TestimonialsSection"), {
  ssr: true,
})

const ResourceCarousel = dynamic(
  () => import("@/page-components/ResourceCarousel/ResourceCarousel"),
  { ssr: true },
)

const PersonalizeSection = dynamic(() => import("./PersonalizeSection"), {
  ssr: true,
})

const BrowseTopicsSection = dynamic(() => import("./BrowseTopicsSection"), {
  ssr: true,
})

const NewsEventsSection = dynamic(() => import("./NewsEventsSection"), {
  ssr: true,
})

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
  { ssr: false },
)

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

const HomePage: React.FC<{ heroImageIndex: number }> = ({ heroImageIndex }) => {
  return (
    <>
      <LearningResourceDrawer />
      <FullWidthBackground>
        <StyledContainer>
          <HeroSearch imageIndex={heroImageIndex} />
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
