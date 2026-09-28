import React from "react"
import styled from "@emotion/styled"
import type { CSSObject } from "@emotion/react"
import type { Theme } from "@mui/material/styles"

/**
 * A keyboard "skip link" — a link, visually hidden until focused, that lets
 * keyboard users bypass a chunk of content. Two composable pieces cover the two
 * standard shapes; both share the same visual chrome (white box, red border,
 * revealed on focus).
 *
 * 1. Skip PAST a self-contained block (WCAG G123) — the component owns the
 *    target. Wrap the block; the trigger is revealed floating just above it and
 *    jumps focus to a "Return to {label}" link rendered after the block (which
 *    itself sends focus back to the trigger):
 *
 *      <SkipLink.Container label="Featured Courses">
 *        <SkipLink.Trigger />
 *        ...repeated / interactive content...
 *        <SkipLink.Target />
 *      </SkipLink.Container>
 *
 * 2. Skip TO existing landmarks (WCAG 2.4.1) — you own the targets. Use standalone
 *    triggers pointing at elements already in the page by id (each target should
 *    be focusable, e.g. `tabIndex={-1}`). The reveal anchors to the top-left of
 *    the nearest positioned ancestor, so the grouping nav must be positioned:
 *
 *      <nav aria-label="Skip links" style={{ position: "relative" }}>
 *        <SkipLink.Trigger targetId="main-content">Skip to main content</SkipLink.Trigger>
 *        <SkipLink.Trigger targetId="player">Skip to video player</SkipLink.Trigger>
 *      </nav>
 *
 * Each `Container` generates its own ids (via `useId`), so any number of block
 * instances coexist without colliding.
 */

type SkipLinkContextValue = {
  /** Id of the "Return to {label}" link the trigger lands focus on. */
  targetId: string
  /** Id of the trigger, so the "Return to {label}" link can send focus back. */
  triggerId: string
  label: string
}

const SkipLinkContext = React.createContext<SkipLinkContextValue | null>(null)

const Root = styled.div({
  position: "relative",
})

// Shared visual chrome for every trigger — hidden but focusable by default,
// styled to match the app's existing skip-link treatment. Only the `:focus`
// reveal placement differs between the block and page variants below.
const skipLinkChrome = (theme: Theme): CSSObject => ({
  position: "absolute",
  left: "-9999px",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  zIndex: 10,
  ...theme.typography.body2,
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.black,
  padding: "8px 12px",
  border: `2px solid ${theme.custom.colors.red}`,
  borderRadius: "4px",
  textDecoration: "none",
  whiteSpace: "nowrap",
})

const revealBase: CSSObject = {
  width: "auto",
  height: "auto",
  overflow: "visible",
}

/**
 * Block variant (inside a Container): revealed floating fully above the block,
 * so it neither covers the block's heading nor shifts layout.
 */
const BlockTriggerAnchor = styled.a(({ theme }) => ({
  ...skipLinkChrome(theme),
  // The reveal floats up via translateY. The app's global scroll-padding-top
  // already reserves header space for focus scrolling; reserve a little extra
  // here so the upward-floated box also stays clear of a fixed header when the
  // block is focus-scrolled from below (WCAG 2.4.11 Focus Not Obscured).
  scrollMarginTop: "48px",
  "&:focus": {
    ...revealBase,
    left: "0",
    top: "0",
    transform: "translateY(calc(-100% - 4px))",
  },
}))

/**
 * Page variant (standalone): revealed at the top-left corner of the nearest
 * positioned ancestor (a skip-links nav), inset slightly so it isn't jammed
 * into the corner.
 */
const PageTriggerAnchor = styled.a(({ theme }) => ({
  ...skipLinkChrome(theme),
  "&:focus": {
    ...revealBase,
    left: "16px",
    top: "16px",
  },
}))

/**
 * The Container-owned target: a real "Return to {label}" link at the end of the
 * block. The Trigger always lands focus here (a deterministic, named, announced
 * destination — no fragile "next focusable element" hunt), and activating it
 * sends focus back to the Trigger. `tabIndex={-1}` keeps it out of the normal
 * tab order, so it's only a focus stop for people who activated the skip.
 * Mirrors the block Trigger's reveal, floated just BELOW the block instead of
 * above, so it clears both the block and any following content.
 */
const ReturnAnchor = styled.a(({ theme }) => ({
  ...skipLinkChrome(theme),
  scrollMarginTop: "48px",
  "&:focus": {
    ...revealBase,
    left: "0",
    bottom: "0",
    transform: "translateY(calc(100% + 4px))",
  },
}))

/**
 * Zero-size, unnamed marker for a STANDALONE Target (one given an explicit `id`
 * with no Container). The caller owns what it points at and its surrounding
 * semantics, so it stays a bare focusable node; inside a Container the Target
 * renders a named `ReturnAnchor` instead.
 */
const TargetSentinel = styled.div({
  outline: "none",
})

type SkipLinkContainerProps = {
  /**
   * Human-readable name of the block being skipped. Used to build the trigger's
   * default text ("Skip {label}"), so it should read naturally after "Skip",
   * e.g. "Featured Courses". Keep it distinct per instance so multiple triggers
   * on a page are distinguishable to screen reader users.
   */
  label: string
  children: React.ReactNode
  className?: string
}

const Container: React.FC<SkipLinkContainerProps> = ({
  label,
  children,
  className,
}) => {
  const baseId = React.useId()
  const value = React.useMemo(
    () => ({
      targetId: `${baseId}-target`,
      triggerId: `${baseId}-trigger`,
      label,
    }),
    [baseId, label],
  )
  return (
    <SkipLinkContext.Provider value={value}>
      <Root className={className}>{children}</Root>
    </SkipLinkContext.Provider>
  )
}

type SkipLinkTriggerProps = {
  className?: string
  /**
   * Id of the element to move focus to. Required for standalone triggers; when
   * omitted, the trigger uses the target generated by its `SkipLink.Container`.
   */
  targetId?: string
  /** Overrides the default "Skip {label}" text (required for standalone triggers). */
  children?: React.ReactNode
}

const Trigger: React.FC<SkipLinkTriggerProps> = ({
  className,
  targetId: targetIdProp,
  children,
}) => {
  const context = React.useContext(SkipLinkContext)
  const targetId = targetIdProp ?? context?.targetId
  if (!targetId) {
    throw new Error(
      "SkipLink.Trigger needs a `targetId` prop or a SkipLink.Container ancestor",
    )
  }
  // A Container supplies default "Skip {label}" text; a standalone trigger must
  // pass its own children, or the link would have no accessible name.
  const content = children ?? (context ? `Skip ${context.label}` : undefined)
  if (content === undefined) {
    throw new Error(
      "SkipLink.Trigger needs `children` (link text) when used without a SkipLink.Container",
    )
  }
  // Inside a Container we skip past a block, so float the reveal above it;
  // standalone we're a page-level skip-to-landmark link, revealed in the corner.
  const Anchor = context ? BlockTriggerAnchor : PageTriggerAnchor
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = event.currentTarget.ownerDocument.getElementById(targetId)
    if (!target) {
      return
    }
    // Move focus explicitly (rather than relying on native hash navigation) so
    // it's reliable everywhere, including tests, and leaves the URL untouched.
    // The target is always a real, focusable, named element: in block mode the
    // Container's "Return to {label}" link at the end of the block; standalone
    // the landmark the caller pointed at.
    event.preventDefault()
    target.focus()
  }
  return (
    <Anchor
      id={context?.triggerId}
      href={`#${targetId}`}
      className={className}
      onClick={handleClick}
    >
      {content}
    </Anchor>
  )
}

type SkipLinkTargetProps = {
  className?: string
  /**
   * Explicit id for a standalone target. When omitted, uses the id generated by
   * the surrounding `SkipLink.Container`.
   */
  id?: string
}

const Target: React.FC<SkipLinkTargetProps> = ({ className, id: idProp }) => {
  const context = React.useContext(SkipLinkContext)
  const id = idProp ?? context?.targetId
  if (!id) {
    throw new Error(
      "SkipLink.Target needs an `id` prop or a SkipLink.Container ancestor",
    )
  }
  // Standalone (explicit id, no Container): a bare focusable node the caller
  // points at; the caller owns its surrounding semantics.
  if (!context) {
    return <TargetSentinel id={id} tabIndex={-1} className={className} />
  }
  // Inside a Container: a real, named "Return to {label}" link. It's the
  // deterministic destination the Trigger focuses, and activating it returns
  // focus to the Trigger. tabindex=-1 keeps it out of the normal tab order.
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const trigger = event.currentTarget.ownerDocument.getElementById(
      context.triggerId,
    )
    if (!trigger) {
      return
    }
    event.preventDefault()
    trigger.focus()
  }
  return (
    <ReturnAnchor
      id={id}
      tabIndex={-1}
      href={`#${context.triggerId}`}
      className={className}
      onClick={handleClick}
    >
      Return to {context.label}
    </ReturnAnchor>
  )
}

const SkipLink = {
  Container,
  Trigger,
  Target,
}

export { SkipLink }
export type {
  SkipLinkContainerProps,
  SkipLinkTriggerProps,
  SkipLinkTargetProps,
}
