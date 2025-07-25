import React, { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { styled } from "ol-components"
import useEmblaCarousel from "embla-carousel-react"
import { RiArrowUpLine, RiArrowDownLine } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import WheelIndicator from "wheel-indicator"
import { useThrottle } from "ol-utilities"

const Overlay = styled.div({
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
})

const Carousel = styled.div({
  height: "100%",
})

const CarouselScroll = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  height: "100%",
})

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

const StyledActionButton = styled(ActionButton)(({ disabled }) => ({
  opacity: disabled ? 0.5 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
}))

type CarouselV2VerticalProps = {
  children: React.ReactNode
  className?: string
  initialSlide?: number
  /**
   * Animation duration. Duration is not in milliseconds because Embla uses an attraction physics simulation.
   */
  animationDuration?: number
  arrowsContainer?: HTMLElement | null
  /**
   * aria-label for the prev/next buttons container.
   * Not used if `arrowsContainer` supplied.
   * Defaults to "Slide navigation".
   */
  arrowGroupLabel?: string
  /**
   * aria-label for the previous button; defaults to "Show previous slides".
   */
  prevLabel?: string
  /**
   * aria-label for the next button; defaults to "Show next slides".
   */
  nextLabel?: string

  onSlidesInView?: (inView: number[]) => void
}

/**
 * Vertical carousel including modal overlay.
 */
const CarouselV2Vertical: React.FC<CarouselV2VerticalProps> = ({
  children,
  className,
  initialSlide = 0,
  animationDuration = 25,
  arrowsContainer,
  arrowGroupLabel = "Slide navigation",
  prevLabel = "Show previous slide",
  nextLabel = "Show next slide",
  onSlidesInView,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "center",
      axis: "y",
      loop: false,
      skipSnaps: true,
      dragFree: false,
      slidesToScroll: 1,
      inViewThreshold: 1,
      duration: animationDuration,
    },
    [],
  )

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
  }

  useEffect(() => {
    emblaApi?.scrollTo(initialSlide)
  }, [emblaApi, initialSlide])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        emblaApi?.scrollPrev()
      }
      if (event.key === "ArrowDown") {
        emblaApi?.scrollNext()
      }
      event.preventDefault()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [emblaApi])

  useEffect(() => {
    emblaApi?.on("slidesInView", (event) => {
      const inView = event.slidesInView()
      if (inView.length === 1) {
        setCanScrollPrev(emblaApi.canScrollPrev())
        setCanScrollNext(emblaApi.canScrollNext())
      }
      onSlidesInView?.(inView)
    })
  }, [emblaApi, onSlidesInView])

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

  const throttledHandleWheelGesture = useThrottle(
    handleWheelGesture as (...args: unknown[]) => void,
    400,
  )
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let wheelIndicator: WheelIndicator | null = null
    if (overlayRef.current && emblaApi) {
      wheelIndicator = new WheelIndicator({
        elem: overlayRef.current,
        callback: throttledHandleWheelGesture,
      })
    }
    return () => {
      wheelIndicator?.destroy()
    }
  }, [emblaApi, overlayRef, throttledHandleWheelGesture])

  const arrows = (
    <>
      <StyledActionButton
        size="large"
        edge="rounded"
        variant="text"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        aria-label={prevLabel}
      >
        <RiArrowUpLine aria-hidden />
      </StyledActionButton>
      <StyledActionButton
        size="large"
        edge="rounded"
        variant="text"
        onClick={scrollNext}
        disabled={!canScrollNext}
        aria-label={nextLabel}
      >
        <RiArrowDownLine aria-hidden />
      </StyledActionButton>
    </>
  )
  return (
    <Overlay ref={overlayRef} className={className}>
      {arrowsContainer === undefined ? (
        <ButtonsContainer role="group" aria-label={arrowGroupLabel}>
          {arrows}
        </ButtonsContainer>
      ) : null}
      {arrowsContainer ? createPortal(arrows, arrowsContainer) : null}
      <Carousel ref={emblaRef}>
        <CarouselScroll ref={scrollRef}>{children}</CarouselScroll>
      </Carousel>
    </Overlay>
  )
}

export { CarouselV2Vertical }
export type { CarouselV2VerticalProps }
