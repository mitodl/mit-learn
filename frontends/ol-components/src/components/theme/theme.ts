// import React from "react"
// import {
//   createTheme,
//   ThemeProvider as MuiThemeProvider,
// } from "@mui/material/styles"
// import { extendTheme } from "@mui/material/styles"
//
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createTheme } from "@mui/material/styles"
import { typography } from "./typography"
import * as buttons from "./buttons"
import * as chips from "./chips"
import { colors } from "./colors"
import type { ThemeOptions } from "@mui/material/styles"
// import type { CustomTheme } from "../../types/theme"

const custom = {
  colors,
  dimensions: {
    headerHeight: "72px",
    headerHeightSm: "60px",
  },
}

const BREAKPOINTS = {
  values: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1272 + 48,
    xl: 1536,
  },
}

const themeOptions = {
  // cssVariables: true,
  custom,
  palette: {
    action: {
      disabled: colors.lightGray2,
    },
    text: {
      primary: "#000",
      secondary: colors.silverGrayDark,
    },
    primary: {
      main: colors.mitRed,
      light: colors.lightRed,
      active: colors.red,
      contrastText: colors.white,
    },
    secondary: {
      light: colors.darkGray2,
      active: colors.silverGrayDark,
      main: colors.black,
      contrastText: colors.white,
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  typography: typography as ThemeOptions["typography"],
  breakpoints: BREAKPOINTS,
  components: {
    MuiButtonBase: buttons.buttonBaseComponent,
    // TODO pigment
    // MuiTypography: typography.component,
    // MuiTabPanel: {
    //   styleOverrides: {
    //     root: {
    //       padding: "0px",
    //     },
    //   },
    // },
    MuiMenu: {
      styleOverrides: { paper: { borderRadius: "4px" } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { borderRadius: "4px" },
        // Mui puts paddingRight: 2px, marginRight: -2px on the popupIndicator,
        // which causes the browser to show a horizontal scrollbar on overflow
        // containers when a scrollbar isn't really necessary.
        popupIndicator: { paddingRight: 0, marginRight: 0 },
      },
    },
    MuiChip: chips.chipComponent,
  },
}

// type ExtendedTheme = Theme & {
//   custom: CustomTheme
// }

export const theme = createTheme(themeOptions)
// export const theme = themeOptions //extendTheme(themeOptions)
export { pxToRem } from "./typography"
