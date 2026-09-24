"use client"

import React from "react"
import { Typography, pxToRem } from "ol-components"
import Image from "next/image"
import { styled, ActionButton } from "@mitodl/smoot-design"
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react"
import type { TestimonialItem } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"

// Fade + height-tween timing. ~300ms ease-out approximates the Figma
// interactive-component dissolve; the exact spec isn't exposed in dev mode.
const TRANSITION_MS = 300
const TRANSITION_EASING = "ease-out"

const TestimonialsSectionRoot = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const Card = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "32px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const HeaderRow = styled.div({
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
})

const QuoteMark = styled.span(({ theme }) => ({
  ...theme.typography.h1,
  flex: "1 1 0",
  height: "32px",
  overflow: "hidden",
  color: theme.custom.colors.red,
  userSelect: "none",
}))

const ArrowsContainer = styled.div({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: "16px",
  flexShrink: 0,
})

// The height tween and fade are driven imperatively in the layout effect below
// so the enter transition reliably plays after a forced reflow (a single
// requestAnimationFrame can be coalesced away and skip the transition). At rest
// the height is left as auto so the card reflows with its content on resize
// instead of clipping to a stale pixel height.
const BodyViewport = styled.div({
  overflow: "hidden",
})

const BodyInner = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const Quote = styled.blockquote(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  quotes: "none",
  fontStyle: "normal",
  [theme.breakpoints.down("md")]: {
    ...theme.typography.subtitle1,
    lineHeight: pxToRem(24),
  },
}))

const Attribution = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    gap: "8px",
  },
}))

const Avatar = styled(Image)({
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
})

const NameGroup = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
})

const Name = styled.span(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.subtitle2,
  },
}))

const Title = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  // Figma "Body/P22" is 14/400/22; body2 is 14/400/18.
  lineHeight: pxToRem(22),
  color: theme.custom.colors.darkGray2,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.body3,
  },
}))

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

const TestimonialsSection: React.FC<{ testimonials: TestimonialItem[] }> = ({
  testimonials,
}) => {
  const [index, setIndex] = React.useState(0)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const innerRef = React.useRef<HTMLDivElement>(null)
  // Height we are animating away from, captured just before the content swaps.
  const fromHeightRef = React.useRef<number | null>(null)
  const prevArrowRef = React.useRef<HTMLButtonElement>(null)
  const nextArrowRef = React.useRef<HTMLButtonElement>(null)
  // Which arrow to focus after a boundary-crossing navigation; consumed once
  // the new index has rendered and the sibling is actually enabled.
  const pendingFocusRef = React.useRef<"prev" | "next" | null>(null)

  const safeIndex = Math.min(index, Math.max(testimonials.length - 1, 0))
  const testimonial = testimonials[safeIndex]
  const hasArrows = testimonials.length > 1

  // Content swaps synchronously; this effect layers a fade-in + height tween on
  // top. It forces a reflow between the start and end states so the browser
  // registers the start height/opacity — without it the transition can be
  // coalesced away and skipped.
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    const inner = innerRef.current
    const fromHeight = fromHeightRef.current
    fromHeightRef.current = null
    // First render (no prior height) or reduced motion: show instantly.
    if (!viewport || !inner || fromHeight === null || prefersReducedMotion()) {
      return
    }

    const toHeight = inner.offsetHeight
    // Start state: previous height, new content transparent, transitions off.
    viewport.style.transition = "none"
    viewport.style.height = `${fromHeight}px`
    inner.style.transition = "none"
    inner.style.opacity = "0"
    void viewport.offsetHeight // force reflow to lock in the start state

    // End state: tween to the new height and fade the new content in.
    viewport.style.transition = `height ${TRANSITION_MS}ms ${TRANSITION_EASING}`
    viewport.style.height = `${toHeight}px`
    inner.style.transition = `opacity ${TRANSITION_MS}ms ${TRANSITION_EASING}`
    inner.style.opacity = "1"

    let released = false
    // Drop the inline height/opacity once settled so the card can reflow with
    // its content on resize (a fixed pixel height would clip a rewrapped quote).
    const release = (event?: TransitionEvent) => {
      if (event && event.target !== viewport && event.target !== inner) return
      if (released) return
      released = true
      viewport.style.transition = ""
      viewport.style.height = ""
      inner.style.transition = ""
      inner.style.opacity = ""
    }
    viewport.addEventListener("transitionend", release)
    // Fallback: transitionend won't fire if the height doesn't change.
    const timer = window.setTimeout(release, TRANSITION_MS + 80)

    return () => {
      released = true
      window.clearTimeout(timer)
      viewport.removeEventListener("transitionend", release)
    }
  }, [safeIndex, testimonial])

  const goTo = (next: number) => {
    if (next === safeIndex || next < 0 || next >= testimonials.length) return
    fromHeightRef.current = viewportRef.current?.offsetHeight ?? null
    setIndex(next)
  }

  // After a boundary crossing the clicked arrow is now disabled; move focus to
  // the enabled sibling here (post-render) since it wasn't focusable yet at
  // click time.
  React.useLayoutEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return
    pendingFocusRef.current = null
    const target =
      pending === "prev" ? prevArrowRef.current : nextArrowRef.current
    target?.focus()
  }, [safeIndex])

  if (!testimonial) return null

  return (
    <TestimonialsSectionRoot aria-labelledby={HeadingIds.Testimonials}>
      <Typography variant="h4" component="h2" id={HeadingIds.Testimonials}>
        What learners are saying
      </Typography>
      <Card>
        <HeaderRow>
          <QuoteMark aria-hidden>&ldquo;</QuoteMark>
          {hasArrows ? (
            <ArrowsContainer role="group" aria-label="Testimonial navigation">
              <ActionButton
                ref={prevArrowRef}
                size="small"
                edge="rounded"
                variant="tertiary"
                onClick={() => {
                  const target = safeIndex - 1
                  // Native `disabled` at the boundary drops focus to <body>;
                  // queue focus for the still-enabled button (applied after the
                  // re-render) so keyboard users keep their place.
                  if (target === 0) pendingFocusRef.current = "next"
                  goTo(target)
                }}
                disabled={safeIndex === 0}
                aria-label="Show previous testimonial"
              >
                <RiArrowLeftLine aria-hidden />
              </ActionButton>
              <ActionButton
                ref={nextArrowRef}
                size="small"
                edge="rounded"
                variant="tertiary"
                onClick={() => {
                  const target = safeIndex + 1
                  if (target === testimonials.length - 1)
                    pendingFocusRef.current = "prev"
                  goTo(target)
                }}
                disabled={safeIndex === testimonials.length - 1}
                aria-label="Show next testimonial"
              >
                <RiArrowRightLine aria-hidden />
              </ActionButton>
            </ArrowsContainer>
          ) : null}
        </HeaderRow>
        <BodyViewport ref={viewportRef}>
          <BodyInner ref={innerRef} aria-live="polite">
            <Quote>{testimonial.quote}</Quote>
            <Attribution>
              {testimonial.image_src ? (
                <Avatar
                  src={testimonial.image_src}
                  alt=""
                  width={48}
                  height={48}
                />
              ) : null}
              <NameGroup>
                <Name>{testimonial.name}</Name>
                {testimonial.title ? <Title>{testimonial.title}</Title> : null}
              </NameGroup>
            </Attribution>
          </BodyInner>
        </BodyViewport>
      </Card>
    </TestimonialsSectionRoot>
  )
}

export default TestimonialsSection
