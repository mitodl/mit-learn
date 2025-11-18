import React, { useState } from "react"
import Image from "next/image"
import { Container, Typography, Card, styled } from "ol-components"
import { CarouselV2 } from "ol-components/CarouselV2"
import { useVideoShortsList } from "api/hooks/videoShorts"
import VideoShortsModal from "./VideoShortsModal"

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
  }),
)

const ASPECT_RATIO = 9 / 16

const CarouselSlide = styled.div<{ width: number; height: number }>(
  ({ width, height }) => ({
    flex: "0 0 100%",
    width,
    maxWidth: width,
    height,
  }),
)

const VideoShortsSection = () => {
  const { data, isLoading } = useVideoShortsList()

  const [showModal, setShowModal] = useState(false)
  const [videoIndex, setVideoIndex] = useState(0)

  if (isLoading || !data?.length) return null

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
        <StyledCarouselV2>
          {data?.map((video, index: number) => (
            <CarouselSlide width={235} height={235 / ASPECT_RATIO} key={index}>
              {/* 235 is our fixed width to ensure slides align with the container edge */}
              <Card
                onClick={() => {
                  setShowModal(true)
                  setVideoIndex(index)
                }}
              >
                <Card.Content>
                  <CardContent width={235} height={235 / ASPECT_RATIO}>
                    <Image
                      width={
                        (235 / ASPECT_RATIO) *
                        (video.thumbnail_width / video.thumbnail_height)
                      }
                      height={235 / ASPECT_RATIO}
                      src={video.thumbnail_url}
                      alt={video.title}
                    />
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
