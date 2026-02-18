import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { styled } from "ol-components"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { ActionButton } from "@mitodl/smoot-design"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"

const ButtonsContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const CarouselContainer = styled.div(({ theme }) => ({
  overflow: "hidden",
  margin: "24px 0",
  [theme.breakpoints.down("sm")]: {
    margin: "0 -16px",
    padding: "0 32px 0 16px",
  },
}))

const CarouselScroll = styled.div({
  display: "flex",
  gap: "24px",
  /* Space for the card box shadow on hover to prevent clipping */
  paddingBottom: "4px",
})

type CarouselV2Props = {
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
}

const CarouselV2: React.FC<CarouselV2Props> = ({
  children,
  className,
  initialSlide = 0,
  animationDuration = 25,
  arrowsContainer,
  arrowGroupLabel = "Slide navigation",
  prevLabel = "Show previous slides",
  nextLabel = "Show next slides",
  ...others
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      loop: false,
      dragFree: true,
      slidesToScroll: "auto",
      duration: animationDuration,
    },
    [WheelGesturesPlugin()],
  )

  useEffect(() => {
    emblaApi?.scrollTo(initialSlide)
  }, [emblaApi, initialSlide])

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

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

  const arrows = (
    <>
      <ActionButton
        size="small"
        edge="rounded"
        variant="tertiary"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        aria-label={prevLabel}
      >
        <RiArrowLeftLine aria-hidden />
      </ActionButton>
      <ActionButton
        size="small"
        edge="rounded"
        variant="tertiary"
        onClick={scrollNext}
        disabled={!canScrollNext}
        aria-label={nextLabel}
      >
        <RiArrowRightLine aria-hidden />
      </ActionButton>
    </>
  )
  return (
    <>
      {arrowsContainer === undefined ? (
        <ButtonsContainer role="group" aria-label={arrowGroupLabel} {...others}>
          {arrows}
        </ButtonsContainer>
      ) : null}
      {arrowsContainer ? createPortal(arrows, arrowsContainer) : null}
      <CarouselContainer ref={emblaRef} className={className} {...others}>
        <CarouselScroll>{children}</CarouselScroll>
      </CarouselContainer>
    </>
  )
}

export { CarouselV2 }
export type { CarouselV2Props }
