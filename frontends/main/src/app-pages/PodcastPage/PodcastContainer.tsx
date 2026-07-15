import { Container, styled } from "ol-components"

type PodcastContainerProps = {
  /** Max content width in px (default 1080). */
  width?: number
  /** Horizontal padding in px applied above the gutter breakpoint (default 0). */
  gutter?: number
  /** Breakpoint below which a 16px horizontal gutter is applied (default "md"). */
  gutterBreakpoint?: "md" | "sm"
}

/**
 * Shared page container for all podcast pages. Width and gutters are set via
 * props so callers don't redefine `maxWidth`/padding with `!important` overrides.
 * (Named `width` rather than `maxWidth` to avoid colliding with MUI Container's
 * own `maxWidth` breakpoint prop.)
 */
const PodcastContainer = styled(Container, {
  shouldForwardProp: (prop) =>
    !["width", "gutter", "gutterBreakpoint"].includes(prop as string),
})<PodcastContainerProps>(
  ({ theme, width = 1080, gutter = 0, gutterBreakpoint = "md" }) => ({
    maxWidth: `${width}px !important`,
    padding: gutter ? `0 ${gutter}px !important` : "0 !important",
    [theme.breakpoints.down(gutterBreakpoint)]: {
      padding: "0 16px !important",
    },
  }),
)

export default PodcastContainer
