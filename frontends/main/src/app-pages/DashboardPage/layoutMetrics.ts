import type { Theme } from "ol-components"

/**
 * The fixed measurements of the `/dashboard` shell, in one place so a child
 * that has to size itself in absolute pixels can derive its width from the
 * column it actually gets rather than guess at one.
 *
 * `DashboardLayout` builds its grid from the first two, so editing the sidebar
 * or the gap moves every derivation below with it.
 *
 * This module holds constants only, deliberately: `DashboardLayout` itself
 * pulls in queries, tabs and a dynamic import, and a table reaching for one
 * number should not drag all of that into its own bundle.
 */
const SIDEBAR_WIDTH = 300
const GRID_GAP = 48

/**
 * MUI's own `Container` gutter at `sm` and up, which `PageContainer` does not
 * override. Hardcoded because MUI applies it from a default it does not publish
 * as a theme value.
 */
const CONTAINER_GUTTER = 24

/**
 * How wide the dashboard's content column gets, and no wider: `PageContainer`
 * caps at the `lg` breakpoint less its own gutters, and the grid spends
 * `SIDEBAR_WIDTH` plus `GRID_GAP` of that on the sidebar. A 1920px desktop
 * therefore sees exactly the same number as a 1280px one.
 *
 * That ceiling is what makes a fixed floor workable for a wide table: a floor
 * at or under this value scrolls only while the window is narrower than `lg`,
 * whereas one above it scrolls on every screen ever made.
 */
const dashboardContentWidth = (theme: Theme) =>
  theme.breakpoints.values.lg - 2 * CONTAINER_GUTTER - SIDEBAR_WIDTH - GRID_GAP

export { CONTAINER_GUTTER, dashboardContentWidth, GRID_GAP, SIDEBAR_WIDTH }
