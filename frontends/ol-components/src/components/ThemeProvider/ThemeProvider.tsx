import React from "react"
import {
  createTheme,
  ThemeProvider as SmootThemeProvider,
} from "@mitodl/smoot-design"
import type {} from "@mitodl/smoot-design/type-augmentation"
import type {} from "@mui/lab/themeAugmentation"
import Image from "next/image"
import { LinkAdapter } from "../LinkAdapter/LinkAdapter"
import type { LinkAdapterExtraProps } from "../LinkAdapter/LinkAdapter"

declare module "@mitodl/smoot-design" {
  // Add extra props to smoot-design's LinkAdapter
  // See https://mitodl.github.io/smoot-design/?path=/docs/smoot-design-themeprovider--docs
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface LinkAdapterPropsOverrides extends LinkAdapterExtraProps {}
}

const theme = createTheme({
  custom: {
    LinkAdapter,
    ImgAdapter: Image,
  },
  components: {
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
