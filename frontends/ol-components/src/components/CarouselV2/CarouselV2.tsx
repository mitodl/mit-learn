import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Container, styled } from "ol-components"
import { useVideoShortsList } from "api/hooks/videoShorts"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { ActionButton } from "@mitodl/smoot-design"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"

// const Section = styled.section(({ theme }) => ({
//   padding: "80px 0",
//   [theme.breakpoints.down("md")]: {
//     padding: "40px 0",
//   },
// }))

// const Header = styled(Container)(({ theme }) => ({
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
//   textAlign: "center",
//   gap: "8px",

//   [theme.breakpoints.down("md")]: {
//     paddingBottom: "28px",
//   },
// }))

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

const CarouselContainer = styled.div({
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

type CarouselV2Props = {
  children: React.ReactNode
  className?: string
  initialSlide?: number
  /**
   * Animation duration in milliseconds.
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
  arrowsContainer,
  arrowGroupLabel = "Slide navigation",
  prevLabel = "Show previous slides",
  nextLabel = "Show next slides",
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      loop: false,
      dragFree: true,
      slidesToScroll: "auto",
    },
    [WheelGesturesPlugin()],
  )

  useEffect(() => {
    emblaApi?.scrollTo(initialSlide)
  }, [emblaApi, initialSlide])

  const [buttonsRef, setButtonsRef] = useState<HTMLDivElement | null>(null)
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
        <ButtonsContainer role="group" aria-label={arrowGroupLabel}>
          {arrows}
        </ButtonsContainer>
      ) : null}
      {arrowsContainer ? createPortal(arrows, arrowsContainer) : null}
      <CarouselContainer ref={emblaRef} className={className}>
        <CarouselScroll>{children}</CarouselScroll>
      </CarouselContainer>
    </>
  )
}

export { CarouselV2 }
export type { CarouselV2Props }
