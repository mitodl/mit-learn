import React from "react"
import { Container, styled } from "ol-components"
import VideoShortsSection from "./VideoShortsSection"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled } from "posthog-js/react"
import ResourceCarousel from "@/page-components/ResourceCarousel/ResourceCarousel"
import * as carousels from "./carousels"

const MediaCarousel = styled(ResourceCarousel)(({ theme }) => ({
  margin: "80px 0",
  minHeight: "388px",
  [theme.breakpoints.down("md")]: {
    margin: "40px 0",
    minHeight: "418px",
  },
}))

const MediaSection = () => {
  const videoShortsEnabled = useFeatureFlagEnabled(FeatureFlags.VideoShorts)

  if (videoShortsEnabled === undefined) {
    return null
  }
  if (videoShortsEnabled) {
    return <VideoShortsSection />
  }
  return (
    <Container component="section">
      <MediaCarousel
        titleComponent="h2"
        title="Media"
        config={carousels.MEDIA_CAROUSEL}
      />
    </Container>
  )
}

export default MediaSection
