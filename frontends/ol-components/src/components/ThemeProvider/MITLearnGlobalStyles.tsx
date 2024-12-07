"use client"

import React from "react"
import { css, Global } from "@emotion/react"
import { theme } from "./ThemeProvider"
import { preload } from "react-dom"

/**
    Font files for Adobe neue haas grotesk.
    WARNING: This is linked to chudzick@mit.edu's Adobe account.
    We'd prefer a non-personal MIT account to be used.
    See https://github.com/mitodl/hq/issues/4237 for more.

    Ideally the font would be loaded via a <link /> tag; see
      - https://nextjs.org/docs/app/api-reference/functions/generate-metadata#unsupported-metadata
      - https://github.com/vercel/next.js/discussions/52877
      - https://github.com/vercel/next.js/discussions/50796
 */
const ADOBE_FONT_URL = "https://use.typekit.net/lbk1xay.css"

const pageCss = css`
  @import url("${ADOBE_FONT_URL}"); /**
    @import must come before other styles, including comments
  */

  html {
    font-family: ${theme.typography.body1.fontFamily};
    color: ${theme.typography.body1.color};
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
  /**
   * Preload the font just in case emotion doesn't put the import near top of
   * HTML.
   */
  preload(ADOBE_FONT_URL, { as: "style", fetchPriority: "high" })
  return <Global styles={[pageCss]}></Global>
}

export { MITLearnGlobalStyles }
