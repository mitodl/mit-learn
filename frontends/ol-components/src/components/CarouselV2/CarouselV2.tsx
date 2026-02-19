import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { styled } from "ol-components"
import useEmblaCarousel from "embla-carousel-react"
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"
import { ActionButton } from "@mitodl/smoot-design"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"

type MobileBleed = "symmetric" | "right" | "none"

const getMobileBleedStyles = (
  mobileBleed: MobileBleed,
  mobileGutter: number,
) => {
  switch (mobileBleed) {
    case "none":
      return {
        marginLeft: 0,
        marginRight: 0,
        paddingLeft: 0,
        paddingRight: 0,
      }
    case "right":
      return {
        marginLeft: 0,
        marginRight: `-${mobileGutter}px`,
        paddingLeft: 0,
        paddingRight: `${mobileGutter}px`,
      }
    case "symmetric":
    default:
      return {
        marginLeft: `-${mobileGutter}px`,
        marginRight: `-${mobileGutter}px`,
        paddingLeft: `${mobileGutter}px`,
        paddingRight: `${mobileGutter * 2}px`,
      }
  }
}

const ButtonsContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const CarouselContainer = styled.div<{
  mobileBleed: MobileBleed
  mobileGutter: number
}>(({ theme, mobileBleed, mobileGutter }) => ({
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    ...getMobileBleedStyles(mobileBleed, mobileGutter),
  },
}))

const CarouselTrack = styled.div({
  display: "flex",
  gap: "24px",
})

type CarouselV2Props = {
  children: React.ReactNode
  className?: string
  "data-testid"?: string
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
  /**
   * Controls how the carousel viewport bleeds on mobile screens.
   * - "symmetric": bleeds on both left and right edges (default)
   * - "right": only bleeds on the right edge
   * - "none": no mobile bleed
   */
  mobileBleed?: MobileBleed
  /**
   * Gutter size used when applying mobile bleed styles. Defaults to 16px.
   */
  mobileGutter?: number
}

/**
 * Usage note:
 * The element hosting the carousel viewport should have a real, bounded width
 * from layout (not content-driven/intrinsic sizing). Without this, the viewport
 * can expand to track content width instead of clipping overflow.
 *
 * In practice:
 * - In flex/grid layouts, ensure the relevant item can shrink (for example
 *   `min-width: 0`).
 * - Give the containing column/container defined width behavior (for example
 *   `width: 100%` or explicit grid track sizing).
 * - Avoid ancestors sized from children (`fit-content`, unconstrained inline sizing).
 *
 * Card hover shadows:
 * If carousel slides have box shadows on hover, add `paddingBottom` to the
 * `.MitCarousel-track` class to prevent clipping, e.g.:
 *   const StyledCarousel = styled(CarouselV2)({
 *     ".MitCarousel-track": { paddingBottom: "4px" }
 *   })
 */
const CarouselV2: React.FC<CarouselV2Props> = ({
  children,
  className,
  initialSlide = 0,
  animationDuration = 25,
  arrowsContainer,
  arrowGroupLabel = "Slide navigation",
  prevLabel = "Show previous slides",
  nextLabel = "Show next slides",
  mobileBleed = "symmetric",
  mobileGutter = 16,
  "data-testid": testId,
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

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  const updateCanScroll = React.useCallback(() => {
    if (!emblaApi) {
      return
    }
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) {
      return
    }
    emblaApi.scrollTo(initialSlide)
    updateCanScroll()
  }, [emblaApi, initialSlide, updateCanScroll])

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
  }

  useEffect(() => {
    if (!emblaApi) {
      return
    }

    updateCanScroll()
    emblaApi.on("select", updateCanScroll)
    emblaApi.on("reInit", updateCanScroll)
    emblaApi.on("scroll", updateCanScroll)

    return () => {
      emblaApi.off("select", updateCanScroll)
      emblaApi.off("reInit", updateCanScroll)
      emblaApi.off("scroll", updateCanScroll)
    }
  }, [emblaApi, updateCanScroll])

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
      <CarouselContainer
        ref={emblaRef}
        className={className}
        mobileBleed={mobileBleed}
        mobileGutter={mobileGutter}
        data-testid={testId}
      >
        <CarouselTrack className="MitCarousel-track">{children}</CarouselTrack>
      </CarouselContainer>
    </>
  )
}

export { CarouselV2 }
export type { CarouselV2Props }
