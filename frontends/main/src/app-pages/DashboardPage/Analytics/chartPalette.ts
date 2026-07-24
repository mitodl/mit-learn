/**
 * Chart colors for the B2B analytics dashboard.
 *
 * These are not eyeballed. Every value below was checked with the data-viz
 * validator against the *light* surface the dashboard renders on (the app has
 * no dark theme), on the adjacent pairlist that applies to lines and bars:
 * lightness band, chroma floor, CVD separation under simulated protanopia and
 * deuteranopia, a normal-vision separation floor, and >= 3:1 contrast vs the
 * surface. Changing a value means re-running that check, not swapping a hex.
 *
 * Hues come from the smoot-design token set (`theme.custom.colors`), so the
 * charts stay recognisably MIT Learn. Two of them are stepped:
 *
 *  - AMBER is the `orange` token's hue (#FAB005), darkened to enter the
 *    lightness band and clear 3:1 on white. The token itself is far too light
 *    to carry a 2px line.
 *  - The lightest funnel step is the `blue` token's hue lightened; the
 *    `lightBlue` token is too pale to be distinguishable from the card.
 *
 * Green and red are deliberately absent: they are reserved for status, so that
 * a red mark on this page always means "bad" and never "series 3".
 */

/**
 * Categorical hues — series *identity*. Assigned in this fixed order and never
 * cycled; the order is what makes the palette colorblind-safe, so a chart with
 * three series takes slots 1-3 in sequence rather than picking favourites.
 *
 * The list stops at three because these are the three MIT Learn hues that clear
 * the separation floor together. A fourth series is not a fourth color: fold it
 * into "Other" or split the chart.
 */
const CATEGORICAL = [
  "#1966FF", // blue token
  "#B17F21", // orange token hue, stepped into the lightness band
  "#FF14F0", // pink token
] as const

/**
 * Ordinal ramp for funnel stages — one hue, light to dark, so the reader sees
 * the progression in the color itself. Stage order is the meaning here, which
 * is why this is a ramp and not three categorical hues.
 */
const FUNNEL_STAGES = [
  "#7FA4EA", // lightest — widest stage
  "#1966FF",
  "#002896", // darkest — narrowest stage
] as const

/**
 * Non-data ink. Grid and axis lines stay recessive so the marks carry the
 * chart; labels wear text tokens rather than the series color.
 */
const CHART_INK = {
  grid: "#DDE1E6", // lightGray2
  axis: "#B8C2CC", // silverGrayLight
  label: "#626A73", // silverGrayDark
  surface: "#FFFFFF",
} as const

export { CATEGORICAL, CHART_INK, FUNNEL_STAGES }
