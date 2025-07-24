import { useEffect, useRef, useState, useCallback } from "react"
import { styled } from "ol-components"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { RiArrowUpLine, RiArrowDownLine, RiCloseLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
// import { useWheel } from "@use-gesture/react"
// import { WheelGestures } from "wheel-gestures"
import WheelIndicator from "wheel-indicator"

// const wheelGestures = WheelGestures()

const useThrottle = (callback: Function, delay: number) => {
  const lastRun = useRef(Date.now())

  return useCallback(
    (...args: any[]) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = Date.now()
      }
    },
    [callback, delay],
  )
}

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

const Overlay = styled.div(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.9)",
  zIndex: 1200,
  [theme.breakpoints.down("md")]: {
    backgroundColor: theme.custom.colors.black,
  },
}))

const CloseContainer = styled.div(({ theme }) => ({
  position: "absolute",
  top: "16px",
  right: "16px",
  zIndex: 1,
  svg: {
    fill: "white",
  },
}))

const Debug = styled.div({
  position: "absolute",
  top: "16px",
  left: "16px",
  zIndex: 1,
  color: "white",
  fontSize: "12px",
  fontWeight: "bold",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  padding: "4px 8px",
})

const Debug2 = styled(Debug)({
  top: "32px",
})
const Carousel = styled.div({
  // margin: "24px 0",
  height: "100%",
})

const CarouselScroll = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  height: "100%",
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

    flex: "0 0 calc(100% - 60px)",
    margin: "30px 0",
    position: "relative",

    [theme.breakpoints.down("md")]: {
      width: "100%",
      margin: "10px 0",
      flex: "0 0 calc(100% - 20px)",
      borderRadius: 0,
    },
  }),
)

const Placeholder = styled.div(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: "black",
  borderRadius: "12px",
  [theme.breakpoints.down("md")]: {
    borderRadius: 0,
  },
}))

const ButtonsContainer = styled.div(({ theme }) => ({
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
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

// const IFrame = styled.iframe({
//   backgroundColor: "black",
//   position: "absolute",
//   top: 0,
//   left: 0,
//   width: "100%",
//   height: "100%",
//   zIndex: 1,
// })

// const EventOverlay = styled.div({
//   position: "absolute",
//   top: 0,
//   left: 0,
//   bottom: 40,
//   right: 0,
//   zIndex: 2,
//   // pointerEvents: "none", // Allow clicks to pass through
//   "&:hover": {
//     pointerEvents: "none", // Enable pointer events on hover to catch wheel events
//   },
//   border: "1px solid green",
//   backgroundColor: "rgba(0, 0, 0, 0.5)",
// })

const StyledActionButton = styled(ActionButton)(({ disabled }) => ({
  opacity: disabled ? 0.5 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
}))

const Video = styled.video(({ height, width, theme }) => ({
  width,
  height,
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "100%",
  },
}))

const isPlaying = (videoElement: HTMLVideoElement | null): boolean => {
  if (!videoElement) return false

  const isPlaying =
    !videoElement.paused && !videoElement.ended && videoElement.currentTime > 0

  const isReady = videoElement.readyState >= 2

  const hasDuration = videoElement.duration > 0

  return isPlaying && isReady && hasDuration
}

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
  const [debug, setDebug] = useState("")
  const [debug2, setDebug2] = useState("")

  // const bindWheel = useWheel((options) => {
  //   console.log("OPTIONS", options)
  // })

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "center",
      axis: "y",
      loop: false,
      skipSnaps: true,
      dragFree: false,
      // draggable: true,
      // containScroll: "trimSnaps",
      slidesToScroll: 1,
      inViewThreshold: 1,
      // startIndex: startIndex,
    },
    [],
  )

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(startIndex)

  const scrollRef = useRef<HTMLDivElement>(null)

  const videosRef = useRef<(HTMLVideoElement | null)[]>([])

  useEffect(() => {
    videosRef.current = videosRef.current.slice(0, videoData.length)
  }, [videoData])

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
    // videosRef.current
    //   .filter((video) => video)
    //   .forEach((video) => {
    //     video!.pause()
    //   })
    // const prevVideo = videosRef.current[selectedIndex - 1]
    // setNavigating(-1)
    // prevVideo?.play()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
    // videosRef.current
    //   .filter((video) => video)
    //   .forEach((video) => {
    //     video!.pause()
    //   })
    // const nextVideo = videosRef.current[selectedIndex + 1]
    // setNavigating(1)
    // nextVideo?.play()
  }

  // useEffect(() => {
  //   emblaApi?.on("scroll", () => {
  //     setCanScrollPrev(emblaApi.canScrollPrev())
  //     setCanScrollNext(emblaApi.canScrollNext())
  //   })
  // }, [emblaApi])

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

      if (event.key === "Space") {
        if (isPlaying(videosRef.current[selectedIndex])) {
          videosRef.current[selectedIndex]?.pause()
        } else {
          videosRef.current[selectedIndex]?.play()
        }
      }

      event.preventDefault()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, emblaApi, selectedIndex])

  useEffect(() => {
    emblaApi?.on("select", (event) => {
      setDebug2(
        `select: ${selectedIndex} inView: ${JSON.stringify(event.slidesInView())}`,
      )
    })

    emblaApi?.on("slidesInView", (event) => {
      console.log("SLIDES IN", event.slidesInView())

      const inView = event.slidesInView()

      setDebug(
        `selectedIndex: ${selectedIndex} inView: ${JSON.stringify(inView)}`,
      )

      if (inView.length === 1) {
        videosRef.current
          .filter((video, index) => video && index !== inView[0])
          .forEach((video) => {
            video!.pause()
          })
        setSelectedIndex(inView[0])
        setDebug(
          `selectedIndex: ${inView[0]} inView: ${JSON.stringify(inView)}`,
        )
        if (videosRef.current[inView[0]]) {
          videosRef.current[inView[0]]?.play()
        }
        setCanScrollPrev(emblaApi.canScrollPrev())
        setCanScrollNext(emblaApi.canScrollNext())
      }
    })
  }, [emblaApi])

  useEffect(() => {
    emblaApi?.reInit()
  }, [selectedIndex, emblaApi])

  useEffect(() => {
    console.log("videosRef.current", videosRef.current)
  }, [videosRef.current])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleWheelGesture = useCallback(
    ({ direction }: { direction: "up" | "down" }) => {
      if (direction === "up") {
        emblaApi?.scrollPrev()
      } else {
        emblaApi?.scrollNext()
      }
    },
    [emblaApi],
  )

  const throttledHandleWheelGesture = useThrottle(handleWheelGesture, 400)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (overlayRef.current && emblaApi) {
      const wheelIndicator = new WheelIndicator({
        elem: overlayRef.current,
        callback: throttledHandleWheelGesture,
      })

      return () => {
        wheelIndicator.destroy()
      }
    }
  }, [emblaApi, throttledHandleWheelGesture])

  return (
    <Overlay ref={overlayRef}>
      {/* onWheel={handleWheel} onTouchMove={handleTouchMove} */}
      <Debug>{debug}</Debug>
      <Debug2>{debug2}</Debug2>
      <CloseContainer>
        <StyledActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={onClose}
        >
          <RiCloseLine aria-hidden />
        </StyledActionButton>
      </CloseContainer>
      <ButtonsContainer role="group" aria-label="Video navigation">
        <StyledActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          // aria-label={prevLabel}
        >
          <RiArrowUpLine aria-hidden />
        </StyledActionButton>
        <StyledActionButton
          size="large"
          edge="rounded"
          variant="text"
          onClick={scrollNext}
          disabled={!canScrollNext}
          // aria-label={nextLabel}
        >
          <RiArrowDownLine aria-hidden />
        </StyledActionButton>
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
                  loop
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
