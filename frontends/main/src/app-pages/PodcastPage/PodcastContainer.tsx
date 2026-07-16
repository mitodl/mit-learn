import { Container, styled } from "ol-components"

type PodcastContainerProps = {
  /** Max content width in px (default 1080). */
  contentWidth?: number
  /** Horizontal padding in px applied above the gutter breakpoint (default 0). */
  gutter?: number
  /** Breakpoint below which a 16px horizontal gutter is applied (default "md"). */
  gutterBreakpoint?: "md" | "sm"
}

/**
 * Shared page container for all podcast pages. Width and gutters are set via
 * props so callers don't redefine `maxWidth`/padding with `!important` overrides.
 * (Named `contentWidth` rather than `maxWidth`/`width` to avoid colliding with
 * MUI Container's `maxWidth` breakpoint prop and the CSS `width` property.)
 */
const PodcastContainer = styled(Container, {
  shouldForwardProp: (prop) =>
    !["contentWidth", "gutter", "gutterBreakpoint"].includes(prop as string),
})<PodcastContainerProps>(
  ({ theme, contentWidth = 1080, gutter = 0, gutterBreakpoint = "md" }) => ({
    maxWidth: `${contentWidth}px !important`,
    padding: gutter ? `0 ${gutter}px !important` : "0 !important",
    [theme.breakpoints.down(gutterBreakpoint)]: {
      padding: "0 16px !important",
    },
  }),
)

export default PodcastContainer
