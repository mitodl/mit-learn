import { useEffect, useState } from "react"
import Image from "next/image"
import { Container, Typography, Card, styled } from "ol-components"
import { useVideoShortsList } from "api/hooks/videoShorts"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { ActionButton } from "@mitodl/smoot-design"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import VideoShortsModal from "./VideoShortsModal"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagEnabled } from "posthog-js/react"

const Section = styled.section(({ theme }) => ({
  padding: "80px 0",
  [theme.breakpoints.down("md")]: {
    padding: "40px 0",
  },
}))

const Header = styled(Container)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "8px",

  [theme.breakpoints.down("md")]: {
    paddingBottom: "28px",
  },
}))

// const VideoShortsCarousel = styled(ResourceCarousel)(({ theme }) => ({
//   margin: "80px 0",
//   minHeight: "388px",
//   [theme.breakpoints.down("md")]: {
//     margin: "40px 0",
//     minHeight: "418px",
//   },
// }))

// const StyledCarousel = styled(SlickCarousel)({
//   /**
//    * Our cards have a hover shadow that gets clipped by the carousel container.
//    * To compensate for this, we add a 4px padding to the left of each slide, and
//    * remove 4px from the gap.
//    */
//   width: "calc(100% + 4px)",
//   transform: "translateX(-4px)",
//   margin: "24px 0",
//   ".slick-track": {
//     display: "flex",
//     gap: "20px",
//     marginBottom: "4px",
//   },
//   ".slick-slide": {
//     paddingLeft: "4px",
//   },
// })

const ButtonsContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
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

const Carousel = styled.div({
  overflow: "hidden",
  margin: "24px 0",
})

const CarouselScroll = styled.div({
  display: "flex",
  gap: "24px",
})

const CarouselSlide = styled.div<{ width: number; height: number }>(
  ({ width, height }) => ({
    flex: "0 0 100%",
    width,
    maxWidth: width,
    height,
  }),
)

const VideoShortsSection = () => {
  // const { data } = useLearningResourcesList({
  //   resource_type: ["video"],
  //   limit: 12,
  //   sortby: "new",
  // })

  const videoShortsEnabled = useFeatureFlagEnabled(FeatureFlags.VideoShorts)

  const { data } = useVideoShortsList(!!videoShortsEnabled)

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      loop: false,
      // skipSnaps: true,
      dragFree: true,
      // draggable: true,
      // containScroll: "trimSnaps",
      slidesToScroll: 5,
    },
    [WheelGesturesPlugin()],
  )

  const [buttonsRef, setButtonsRef] = useState<HTMLDivElement | null>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [videoIndex, setVideoIndex] = useState(0)

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
  }

  useEffect(() => {
    emblaApi?.on("scroll", () => {
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    })
  }, [emblaApi])

  if (!videoShortsEnabled) {
    return null
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
            Video Shorts
          </Typography>
          <Typography variant="body1">
            Start your learning journey with our short-form educational videos
          </Typography>
        </Header>
        <ButtonsContainer role="group" aria-label="Slide navigation">
          <ActionButton
            size="small"
            edge="rounded"
            variant="tertiary"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            // aria-label={prevLabel}
          >
            <RiArrowLeftLine aria-hidden />
          </ActionButton>
          <ActionButton
            size="small"
            edge="rounded"
            variant="tertiary"
            onClick={scrollNext}
            disabled={!canScrollNext}
            // aria-label={nextLabel}
          >
            <RiArrowRightLine aria-hidden />
          </ActionButton>
        </ButtonsContainer>
        <Carousel ref={emblaRef}>
          <CarouselScroll>
            {data?.map((item: any, index: number) => (
              <CarouselSlide
                width={235}
                height={235 / ASPECT_RATIO}
                key={index}
              >
                {/* 235 is our fixed width to ensure slides align with the container edge */}
                <Card
                  onClick={() => {
                    setShowModal(true)
                    setVideoIndex(index)
                  }}
                >
                  <Card.Content>
                    <CardContent
                      width={235}
                      height={
                        235 / ASPECT_RATIO
                        //item.snippet.thumbnails.high.height
                      }
                    >
                      {/* The thumbnail images are e.g. width: 480, height: 360 (landscape) and pillarboxed.

                     */}
                      <Image
                        width={
                          (235 / ASPECT_RATIO) *
                          (item.snippet.thumbnails.high.width /
                            item.snippet.thumbnails.high.height)
                        }
                        // height={item.snippet.thumbnails.high.height}
                        height={235 / ASPECT_RATIO}
                        src={item.snippet.thumbnails.high.url}
                        alt={item.snippet.title}
                      />
                    </CardContent>
                  </Card.Content>
                </Card>
              </CarouselSlide>
            ))}
          </CarouselScroll>
        </Carousel>
      </Container>
    </Section>
  )
}

export default VideoShortsSection
