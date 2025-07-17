import { useEffect, useState } from "react"
import Image from "next/image"
import { Button, EmbedlyCard, styled } from "ol-components"
import { useVideoShortsList } from "api/hooks/videoShorts"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { RiArrowRightLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import { RiArrowUpLine, RiArrowDownLine } from "@remixicon/react"

const useWindowDimensions = () => {
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  })

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener("resize", handleResize)

    handleResize()

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return windowDimensions
}

const Overlay = styled.div({
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.9)",
  zIndex: 1200,
})

const Carousel = styled.div({
  // margin: "24px 0",
  height: "100%",
  border: "1px solid green",
})

const CarouselScroll = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  // gap: "24px",
  height: "100%",
  border: "1px solid blue",
})

const CarouselSlide = styled.div<{ height: number; width: number }>(
  ({ height, width }) => ({
    // flex: "0 0 100%",
    // height: "calc(100vh - 60px)",
    // width: "calc((100vh - 60px) * 9 / 16)",
    // height: "800px",
    width,
    // margin: "20px 0",
    overflow: "hidden",
    borderRadius: "12px",
    // border: "5px solid red",

    flex: "0 0 calc(100% - 60px)",
    // border: "1px solid red",
    margin: "30px 0",
    position: "relative",
  }),
)

const Placeholder = styled.div({
  width: "100%",
  height: "100%",
  backgroundColor: "black",
  borderRadius: "12px",
})

const ButtonsContainer = styled.div({
  position: "absolute",
  top: "50%",
  left: "calc(50% - ((100vh * 9 / 16) / 2) - 30px)",
  transform: "translate(-50%, -50%)",
  display: "flex",
  gap: "12px",
  flexDirection: "column",
  svg: {
    fill: "white",
  },
})

const IFrame = styled.iframe({
  backgroundColor: "black",
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  zIndex: 1,
})

const EventOverlay = styled.div({
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 40,
  right: 0,
  zIndex: 2,
  // pointerEvents: "none", // Allow clicks to pass through
  "&:hover": {
    pointerEvents: "none", // Enable pointer events on hover to catch wheel events
  },
  border: "1px solid green",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
})

type VideoShortsModalProps = {
  startIndex: number
  videoData: any
  onClose: () => void
}
const VideoShortsModal = ({
  startIndex,
  videoData,
  onClose,
}: VideoShortsModalProps) => {
  const { width, height } = useWindowDimensions()
  console.log("height", height)
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "center",
      axis: "y",
      loop: false,
      // skipSnaps: true,
      dragFree: false,
      // draggable: true,
      // containScroll: "trimSnaps",
      slidesToScroll: 1,
      // startIndex: startIndex,
    },
    [WheelGesturesPlugin()],
  )

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(startIndex)

  // const [startIndex, setVideoIndex] = useState(0)

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

  useEffect(() => {
    // console.log("SCROLLING TO VIDEO INDEX", startIndex)
    emblaApi?.scrollTo(startIndex)
  }, [emblaApi, startIndex])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) {
        onClose()
      }
      console.log("KEY DOWN", event.key)
      if (event.key === "ArrowUp") {
        console.log("SCROLLING UP", emblaApi)
        emblaApi?.scrollPrev()
      }

      if (event.key === "ArrowDown") {
        emblaApi?.scrollNext()
      }

      // event.stopPropagation()
      event.preventDefault()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, emblaApi])

  useEffect(() => {
    emblaApi?.on("settle", (event) => {
      const inView = event.slidesInView()

      console.log("IN VIEW ", inView)
      setSelectedIndex(inView[inView.length - 1])
    })
  }, [emblaApi])

  useEffect(() => {
    emblaApi?.reInit()
  }, [selectedIndex, emblaApi])

  // const handleWheel = (e: React.WheelEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()
  // }

  // const handleTouchMove = (e: React.TouchEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()
  // }

  console.log("startIndex", startIndex)
  return (
    <Overlay>
      {/* onWheel={handleWheel} onTouchMove={handleTouchMove} */}
      <ButtonsContainer role="group" aria-label="Video navigation">
        <ActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          // aria-label={prevLabel}
        >
          <RiArrowUpLine aria-hidden />
        </ActionButton>
        <ActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={scrollNext}
          disabled={!canScrollNext}
          // aria-label={nextLabel}
        >
          <RiArrowDownLine aria-hidden />
        </ActionButton>
      </ButtonsContainer>
      <Carousel ref={emblaRef}>
        <CarouselScroll>
          {videoData?.map((item: any, index: number) => (
            <CarouselSlide
              key={index}
              height={height - 60}
              width={(height - 60) * (9 / 16)}
            >
              {/* <span style={{ color: "white" }}>
                selected: {selectedIndex} index: {index}
              </span> */}
              {selectedIndex === index ? (
                <>
                  <IFrame
                    src={`https://youtube.com/embed/${item.id.videoId}?autoplay=1&mute=0&loop=1`}
                    // src={`https://youtube.com/embed/${item.video_id}?si=gbiHIGhW2yBqAhxg?autoplay=1&&mute=1`}
                    width={(height - 60) * (9 / 16)}
                    height={height - 60}
                    title={item.title}
                    frameBorder="0"
                    allow="autoplay;"
                    allowFullScreen
                    onWheel={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      // Manually trigger carousel scroll based on wheel direction
                      if (emblaApi) {
                        if (e.deltaY > 0) {
                          emblaApi.scrollNext()
                        } else {
                          emblaApi.scrollPrev()
                        }
                      }
                    }}
                  />
                  <EventOverlay
                    onWheel={(e) => {
                      console.log("WHEEL EVENT", e)
                      e.preventDefault()
                      e.stopPropagation()

                      // // Manually trigger carousel scroll based on wheel direction
                      // if (emblaApi) {
                      //   if (e.deltaY > 0) {
                      //     emblaApi.scrollNext()
                      //   } else {
                      //     emblaApi.scrollPrev()
                      //   }
                      // }
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onTouchStart={(e) => {
                      // Prevent touch events from bubbling to iframe
                      e.stopPropagation()
                    }}
                    onTouchEnd={(e) => {
                      // Prevent touch events from bubbling to iframe
                      e.stopPropagation()
                    }}
                  />
                </>
              ) : (
                <Placeholder />
              )}
            </CarouselSlide>
          ))}
        </CarouselScroll>
      </Carousel>
    </Overlay>
  )
}

export default VideoShortsModal
