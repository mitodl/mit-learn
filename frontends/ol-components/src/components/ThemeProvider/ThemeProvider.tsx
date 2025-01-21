import React from "react"
import {
  createTheme,
  ThemeProvider as SmootThemeProvider,
} from "@mitodl/smoot-design"
import type {} from "@mitodl/smoot-design/type-augmentation"
import type {} from "@mui/lab/themeAugmentation"
import Link from "next/link"

const theme = createTheme((base) => {
  return {
    ...base,
    custom: {
      ...base.custom,
      /**
       * Workaround for https://github.com/mui/material-ui/issues/45052.
       * A merge is fixed, but new MUI version not yet released.
       */
      LinkAdapter: (props) => <Link {...props} />,
    },
    components: {
      ...base.components,
      /**
       * MuiTabPanel customization is not includedd in smoot-design because
       * it comes from @mui/lab, which doesn't exactly follow semver.
       * This makes it hard to include as a depednency of smoot-design without
       * causing duplicate versions.
       */
      MuiTabPanel: {
        styleOverrides: {
          root: {
            padding: "0px",
          },
        },
      },
    },
  }
})

type ThemeProviderProps = {
  children?: React.ReactNode
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return <SmootThemeProvider theme={theme}>{children}</SmootThemeProvider>
}

export {
  ThemeProvider,
  // To be removed
  theme,
}
