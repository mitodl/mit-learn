import React, { useState } from "react"
import Image from "next/image"
import { Container, Typography, Card, styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { CarouselV2 } from "ol-components/CarouselV2"
import { useQuery } from "@tanstack/react-query"
import { learningResourceQueries } from "api/hooks/learningResources"
import { ResourceTypeEnum } from "api"
import VideoShortsModal from "./VideoShortsModal"
import MITOpenLearningLogo from "@/public/images/mit-open-learning-logo.svg"
import type { VideoResource } from "api/v1"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { env } from "@/env"

const Section = styled.section(({ theme }) => ({
  padding: "80px 0",
  [theme.breakpoints.down("md")]: {
    padding: "40px 0",
  },
}))

const Header = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "8px",

  [theme.breakpoints.down("md")]: {
    paddingBottom: "28px",
  },
}))

const StyledCarouselV2 = styled(CarouselV2)(({ theme }) => ({
  margin: "24px 0",
  ".MitCarousel-track": {
    paddingBottom: "4px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "0 16px",
  },
}))

const CardContent = styled.div<{ width: number; height: number }>(
  ({ width, height }) => ({
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    height,
    width,
    position: "relative",
  }),
)

const ASPECT_RATIO = 9 / 16

const CarouselSlide = styled("div", {
  shouldForwardProp: (prop) => prop !== "width" && prop !== "height",
})<{ width: number; height: number }>(({ width, height, theme }) => ({
  flex: "0 0 100%",
  width,
  maxWidth: width,
  height,
  cursor: "pointer",
  "&:focus-visible": {
    outline: `2px solid ${theme.custom.colors.darkGray2}`,
    outlineOffset: "2px",
    borderRadius: "8px",
  },
}))

const ImagePlaceholder = styled.div(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: theme.custom.colors.black,
  borderRadius: "12px",

  img: {
    position: "absolute",
    top: "18px",
    left: "14px",
  },

  p: {
    position: "absolute",
    top: "197px",
    left: "14px",
    color: theme.custom.colors.white,
  },
}))

const VideoShortsSection = () => {
  const { data, isLoading } = useQuery({
    ...learningResourceQueries.search({
      resource_category: ["Video Short"],
      resource_type: [ResourceTypeEnum.Video],
      limit: 50,
      sortby: "new",
    }),
    select: (data) =>
      data?.result.results.filter(
        (r): r is VideoResource => r.resource_type === ResourceTypeEnum.Video,
      ),
  })

  const [showModal, setShowModal] = useState(false)
  const [videoIndex, setVideoIndex] = useState(0)
  const [announcement, setAnnouncement] = useState("")
  const [visibleSlides, setVisibleSlides] = useState<number[]>([])
  const posthog = usePostHog()

  if (isLoading || !data?.length) return null

  const openModal = (video: VideoResource, index: number) => {
    setShowModal(true)
    setVideoIndex(index)
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.VideoShortsOpened, {
        videoId: video.id,
        videoTitle: video.title,
        position: index,
      })
    }
  }

  return (
    <Section>
      <Container>
        {showModal ? (
          <VideoShortsModal
            startIndex={videoIndex}
            videoData={data}
            onClose={() => setShowModal(false)}
          />
        ) : null}
        <Header>
          <Typography component="h2" typography={{ xs: "h3", sm: "h2" }}>
            MIT Learning Moments
          </Typography>
          <Typography variant="body1">
            Learn something new in less than 60 seconds.
          </Typography>
        </Header>
        <VisuallyHidden aria-live="polite" aria-atomic="true">
          {announcement}
        </VisuallyHidden>
        <StyledCarouselV2
          onSettle={(inView) => {
            setVisibleSlides(inView)
            if (inView.length > 0) {
              setAnnouncement(
                `${inView[0] + 1} of ${data.length}: ${data[inView[0]].title}`,
              )
            }
          }}
        >
          {data?.map((video: VideoResource, index: number) => (
            <CarouselSlide
              width={235}
              height={235 / ASPECT_RATIO}
              key={video.id}
              role="button"
              tabIndex={
                visibleSlides.length === 0 || visibleSlides.includes(index)
                  ? 0
                  : -1
              }
              aria-label={`Play ${video.title}`}
              onClick={() => {
                openModal(video, index)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  openModal(video, index)
                }
              }}
            >
              {/* 235 is our fixed width to ensure slides align with the container edge */}
              <Card>
                <Card.Content>
                  <CardContent width={235} height={235 / ASPECT_RATIO}>
                    {video.image?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        src={video.image.url}
                        alt={video.image.alt ?? video.title}
                      />
                    ) : (
                      <ImagePlaceholder>
                        <Image
                          src={MITOpenLearningLogo.src}
                          alt="MIT Open Learning Logo"
                          width={63}
                          height={16}
                          style={{ filter: "brightness(0) invert(1)" }}
                        />
                        <Typography variant="body1">{video.title}</Typography>
                      </ImagePlaceholder>
                    )}
                  </CardContent>
                </Card.Content>
              </Card>
            </CarouselSlide>
          ))}
        </StyledCarouselV2>
      </Container>
    </Section>
  )
}

export default VideoShortsSection
