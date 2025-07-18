import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button, EmbedlyCard, styled } from "ol-components"
import { useVideoShortsList } from "api/hooks/videoShorts"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import {
  RiArrowRightLine,
  RiArrowUpLine,
  RiArrowDownLine,
} from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"

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
  height: "100%",
  border: "1px solid blue",
})

const CarouselSlide = styled.div<{ height: number; width: number }>(
  ({ height, width, theme }) => ({
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
    border: "1px solid red",

    [theme.breakpoints.down("md")]: {
      width: "100%",
      flex: "0 0 100%",
      margin: "0",
      border: "1px solid blue",
    },
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

const Video = styled.video(({ height, width, theme }) => ({
  width,
  height,
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "100%",
  },
}))

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
  const [navigating, setNavigating] = useState<1 | -1 | false>(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null)

  const videosRef = useRef<(HTMLVideoElement | null)[]>([])

  useEffect(() => {
    videosRef.current = videosRef.current.slice(0, videoData.length)
  }, [videoData])

  // useEffect(() => {
  //   if (scrollRef.current) {
  //     if (intersectionObserverRef.current) {
  //       intersectionObserverRef.current.disconnect()
  //     }

  //     intersectionObserverRef.current = new IntersectionObserver(
  //       (entries) => {
  //         entries.forEach((entry) => {
  //           const index = parseInt(
  //             entry.target.getAttribute("data-index") || "0",
  //           )
  //           console.log("INDEX", index)
  //           if (entry.isIntersecting) {
  //             console.log(`Slide ${index} VISIBLE`)
  //           } else {
  //             console.log(`Slide ${index} NOT VISIBLE`)
  //           }
  //         })
  //       },
  //       {
  //         root: null,
  //         rootMargin: "0px",
  //         threshold: 0.5,
  //       },
  //     )

  //     const slides = scrollRef.current.querySelectorAll("[data-index]")
  //     slides.forEach((slide) => {
  //       intersectionObserverRef.current?.observe(slide)
  //     })

  //     return () => {
  //       if (intersectionObserverRef.current) {
  //         intersectionObserverRef.current.disconnect()
  //       }
  //     }
  //   }
  // }, [videoData, selectedIndex])

  // const [startIndex, setVideoIndex] = useState(0)

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
    videosRef.current
      .filter((video) => video)
      .forEach((video) => {
        video!.pause()
      })
    const prevVideo = videosRef.current[selectedIndex - 1]
    setNavigating(-1)
    prevVideo?.play()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
    videosRef.current
      .filter((video) => video)
      .forEach((video) => {
        video!.pause()
      })
    const nextVideo = videosRef.current[selectedIndex + 1]
    setNavigating(1)
    nextVideo?.play()
  }

  useEffect(() => {
    emblaApi?.on("scroll", () => {
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    })
  }, [emblaApi])

  useEffect(() => {
    emblaApi?.scrollTo(startIndex)
  }, [emblaApi, startIndex])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) {
        onClose()
      }
      if (event.key === "ArrowUp") {
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
    emblaApi?.on("select", (event) => {
      setNavigating(false)
      console.log("SELECT", event)
      // console.log("PAUSING VIDEO", videosRef.current[selectedIndex])

      videosRef.current
        .filter((video) => video)
        .forEach((video) => {
          video!.pause()
        })

      const inView = event.slidesInView()

      const _selectedIndex = inView[inView.length - 1]
      console.log(
        "SELECTED ",
        _selectedIndex,
        videosRef.current[_selectedIndex],
      )
      setSelectedIndex(_selectedIndex)

      if (videosRef.current[_selectedIndex]) {
        videosRef.current[_selectedIndex]?.play()
      }
    })
    emblaApi?.on("settle", (event) => {
      console.log("SETTLE", event)
    })
    emblaApi?.on("slidesInView", (event) => {
      console.log("SLIDES IN", event.slidesInView())
      console.log("SLIDES OUT", event.slidesNotInView())
    })
  }, [emblaApi])

  useEffect(() => {
    emblaApi?.reInit()
  }, [selectedIndex, emblaApi])

  useEffect(() => {
    console.log("videosRef.current", videosRef.current)
  }, [videosRef.current])

  // const handleWheel = (e: React.WheelEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()
  // }

  // const handleTouchMove = (e: React.TouchEvent) => {
  //   e.preventDefault()
  //   e.stopPropagation()
  // }

  console.log("startIndex", startIndex)
  console.log("selectedIndex", selectedIndex)

  return (
    <Overlay>
      {/* onWheel={handleWheel} onTouchMove={handleTouchMove} */}
      <ButtonsContainer role="group" aria-label="Video navigation">
        <ActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={scrollPrev}
          disabled={!canScrollPrev || navigating === -1}
          // aria-label={prevLabel}
        >
          <RiArrowUpLine aria-hidden />
        </ActionButton>
        <ActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={scrollNext}
          disabled={!canScrollNext || navigating === 1}
          // aria-label={nextLabel}
        >
          <RiArrowDownLine aria-hidden />
        </ActionButton>
      </ButtonsContainer>
      <Carousel ref={emblaRef}>
        <CarouselScroll ref={scrollRef}>
          {videoData?.map((item: any, index: number) => (
            <CarouselSlide
              key={index}
              height={height - 60}
              width={(height - 60) * (9 / 16)}
              data-index={index}
            >
              {Math.abs(selectedIndex - index) < 2 ? (
                <Video
                  ref={(el) => {
                    if (videosRef.current && el) {
                      console.log("VIDEO ELEMENT", index, el)
                      videosRef.current[index] = el

                      // if (intersectionObserverRef.current) {
                      //   intersectionObserverRef.current.observe(el)
                      // }
                    } else {
                      console.info("Video element  - no ref")
                    }
                  }}
                  // TODO: Using a temporary bucket on GCP owned by jk
                  src={`https://storage.googleapis.com/mit-open-learning/${item.id.videoId}.mp4`}
                  controls
                  width={(height - 60) * (9 / 16)}
                  height={height - 60}
                  preload="metadata"
                />
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
/* <span style={{ color: "white" }}>
                selected: {selectedIndex} index: {index}
              </span> */

/* <IFrame
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
                  /> */

/* <EventOverlay
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
                  /> */
