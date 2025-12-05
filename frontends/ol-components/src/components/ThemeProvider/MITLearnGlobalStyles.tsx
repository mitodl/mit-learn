"use client"

import React from "react"
import { css, Global, Theme } from "@emotion/react"

export const HEADER_HEIGHT = 72
export const HEADER_HEIGHT_MD = 60
export const FOOTER_HEIGHT = 132
export const FOOTER_HEIGHT_MD = 174

const pageCss = (theme: Theme) => css`
  html {
    font-family: ${theme.typography.body1.fontFamily};
    color: ${theme.typography.body1.color};
    scroll-padding-top: ${HEADER_HEIGHT}px;
    ${theme.breakpoints.down("md")} {
      scroll-padding-top: ${HEADER_HEIGHT_MD}px;
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
