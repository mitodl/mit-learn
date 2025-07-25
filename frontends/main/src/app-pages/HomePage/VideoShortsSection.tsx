import React, { useState } from "react"
import Image from "next/image"
import { Container, Typography, Card, CarouselV2, styled } from "ol-components"
import { useVideoShortsList, type VideoShort } from "api/hooks/videoShorts"
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
  const { data } = useVideoShortsList()

  const [showModal, setShowModal] = useState(false)
  const [videoIndex, setVideoIndex] = useState(0)

  return (
    <Section>
      <Container>
        {showModal ? (
          <VideoShortsModal
            startIndex={videoIndex}
            videoData={data as VideoShort[]}
            onClose={() => setShowModal(false)}
          />
        ) : null}
        <Header>
          <Typography component="h2" typography={{ xs: "h3", sm: "h2" }}>
            Video Shorts
          </Typography>
          <Typography variant="body1">
            Start your learning journey with our short-form educational videos
          </Typography>
        </Header>
        <StyledCarouselV2>
          {data?.map((item: VideoShort, index: number) => (
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
                        (item.snippet.thumbnails.high.width /
                          item.snippet.thumbnails.high.height)
                      }
                      height={235 / ASPECT_RATIO}
                      src={item.snippet.thumbnails.high.url}
                      alt={item.snippet.title}
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
