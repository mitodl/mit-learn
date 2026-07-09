import React from "react"
import styled from "@emotion/styled"
import type { Theme } from "@mui/material/styles"

/**
 * A keyboard "skip link" — a link, visually hidden until focused, that lets
 * keyboard users bypass a chunk of content. Two composable pieces cover the two
 * standard shapes; both share the same visual chrome (white box, red border,
 * revealed on focus).
 *
 * 1. Skip PAST a self-contained block (WCAG G123) — the component owns the
 *    target. Wrap the block; the trigger is revealed floating just above it and
 *    jumps focus to a sentinel rendered after it:
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
 * Each `Container` generates its own id (via `useId`), so any number of block
 * instances coexist without colliding.
 */

type SkipLinkContextValue = {
  targetId: string
  label: string
}

const SkipLinkContext = React.createContext<SkipLinkContextValue | null>(null)

const Root = styled.div({
  position: "relative",
})

// Shared visual chrome for every trigger — hidden but focusable by default,
// styled to match the app's existing skip-link treatment. Only the `:focus`
// reveal placement differs between the block and page variants below.
const skipLinkChrome = (theme: Theme) => ({
  position: "absolute" as const,
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
  whiteSpace: "nowrap" as const,
})

const revealBase = {
  width: "auto",
  height: "auto",
  overflow: "visible",
}

// Keyboard-focusable elements, used to move focus onto real content past a block.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

/** The first keyboard-focusable element after `marker` in DOM order, if any. */
const firstFocusableAfter = (marker: HTMLElement): HTMLElement | null => {
  const candidates = Array.from(
    marker.ownerDocument.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  )
  return (
    candidates.find(
      (el) =>
        !!(
          marker.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
    ) ?? null
  )
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
 * Zero-size marker at the end of a Container's block. Focus doesn't normally
 * land here — the Trigger moves focus to the first focusable element AFTER this
 * marker, so the user arrives on real, announced content instead of an empty
 * node (which screen readers read as "blank"/"group"). It stays focusable
 * (tabindex=-1) only as a fallback for when nothing focusable follows the block,
 * and is intentionally unnamed (its generic role prohibits an accessible name
 * under ARIA).
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
  const targetId = React.useId()
  const value = React.useMemo(() => ({ targetId, label }), [targetId, label])
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
    //
    // Block mode: `target` is an empty end-of-block marker; focusing it directly
    // just reads as "blank"/"group" and strands the user, so move focus to the
    // first real focusable element after the block. Standalone mode: `target` is
    // a real landmark, so focus it directly.
    const destination = context
      ? (firstFocusableAfter(target) ?? target)
      : target
    event.preventDefault()
    destination.focus()
  }
  return (
    <Anchor href={`#${targetId}`} className={className} onClick={handleClick}>
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
  return <TargetSentinel id={id} tabIndex={-1} className={className} />
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
