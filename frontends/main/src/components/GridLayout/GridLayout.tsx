import React from "react"
import { Grid } from "ol-components"
import type { GridProps } from "ol-components"

type GridContainerProps = Omit<
  GridProps,
  "item" | "container" | "columnSpacing"
> & { component?: React.ElementType }

type ColumnVariant =
  | "single-full"
  | "main-2"
  | "sidebar-2"
  | "main-2-wide-main"
  | "sidebar-2-wide-main"
type GridItemProps = Omit<
  GridProps,
  "item" | "xs" | "sm" | "md" | "lg" | "xl"
> & { variant: ColumnVariant; component?: React.ElementType }

const columnVariants: Record<ColumnVariant, GridProps> = {
  "single-full": {
    xs: 12,
    md: 12,
  },
  "main-2": {
    xs: 12,
    md: 9,
  },
  "sidebar-2": {
    xs: 12,
    md: 3,
  },
  "main-2-wide-main": {
    xs: 12,
    md: 8,
  },
  "sidebar-2-wide-main": {
    xs: 12,
    md: 4,
  },
}

/**
 * This is a thin wrapper around MUI's [Grid](https://mui.com/material-ui/react-grid/)
 * component specifying some app-specific props.
 * @deprecated The grid presets in this component predates formal designs for
 * MIT Learn site and should be avoided.
 */
const GridContainer: React.FC<GridContainerProps> = (props) => (
  <Grid container columnSpacing={6} {...props} />
)

/**
 * Represents a grid column and accepts a `variant` prop that determines the
 * column width.
 *
 * This is a thin wrapper around MUI's [Grid](https://mui.com/material-ui/react-grid/)
 * component. This is a `<Grid item />` with breakpoint widths specified by `variant`.
 *
 * @deprecated The grid presets in this component predates formal designs for
 * MIT Learn site and should be avoided.
 */
const GridColumn: React.FC<GridItemProps> = ({ variant, ...others }) => (
  <Grid item {...columnVariants[variant]} {...others} />
)

export { GridContainer, GridColumn }
