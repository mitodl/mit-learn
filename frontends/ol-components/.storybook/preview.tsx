import React from "react"
import { Preview } from "@storybook/react"
import { ThemeProvider } from "@mitodl/smoot-design"
import { MITLearnGlobalStyles } from "ol-components"

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <MITLearnGlobalStyles />
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    options: {
      // @ts-expect-error These have type {import("@storybook/types").IndexEntry}
      // But this function is run in JS and seems not to be compiled.
      storySort: ({ id: a }, { id: b }) => {
        if (a.slice(0, 3) === "old" && b.slice(0, 3) !== "old") {
          return 1
        }
        if (b.slice(0, 3) === "old" && a.slice(0, 3) !== "old") {
          return -1
        }
        return a.localeCompare(b, undefined, { numeric: true })
      },
    },
  },
  initialGlobals: {
    EMBEDLY_KEY: process.env.EMBEDLY_KEY,
  },
}

export default preview
