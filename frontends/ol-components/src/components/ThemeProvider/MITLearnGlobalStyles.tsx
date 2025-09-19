"use client"

import React from "react"
import { css, Global, Theme } from "@emotion/react"

const pageCss = (theme: Theme) => css`
  html {
    font-family: ${theme.typography.body1.fontFamily};
    color: ${theme.typography.body1.color};
    scroll-padding-top: ${theme.custom.dimensions.headerHeight};
    ${theme.breakpoints.down("sm")} {
      scroll-padding-top: ${theme.custom.dimensions.headerHeightSm};
    }
  }

  body {
    background-color: ${theme.custom.colors.lightGray1};
    margin: 0;
    padding: 0;
  }

  * {
    box-sizing: border-box;
  }

  a {
    text-decoration: none;
    color: inherit;
  }

  h1 {
    font-size: ${theme.typography.h1.fontSize};
  }

  h2 {
    font-size: ${theme.typography.h2.fontSize};
  }

  h4 {
    font-size: ${theme.typography.h4.fontSize};
  }
`

const MITLearnGlobalStyles: React.FC = () => {
  return <Global styles={pageCss}></Global>
}

export { MITLearnGlobalStyles }
