import { resolve } from "path"
import * as dotenv from "dotenv"
import type { StorybookConfig } from "@storybook/nextjs"
import { fileURLToPath } from "node:url"
import { dirname } from "path"
import { createRequire } from "module"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

dotenv.config({ path: resolve(__dirname, "../../../.env") })

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.tsx",
    "../../ol-components/src/**/*.mdx",
    "../../ol-components/src/**/*.stories.@(tsx|ts)",
  ],

  staticDirs: ["./public"],

  addons: ["@storybook/addon-links", "@storybook/addon-docs"],

  framework: {
    name: "@storybook/nextjs",
    options: {},
  },

  docs: {},

  webpackFinal: async (config: any) => {
    const webpack = require("webpack")
    config.plugins.push(
      new webpack.DefinePlugin({
        APP_SETTINGS: JSON.stringify({
          EMBEDLY_KEY: process.env.EMBEDLY_KEY,
          PUBLIC_URL: process.env.PUBLIC_URL,
        }),
      }),
    )

    /* Fix for this error:
       Module not found: Error: Can't resolve 'react-dom/test-utils' in './node_modules/@testing-library/react/dist/@testing-library'

       Described here: https://github.com/vercel/next.js/issues/55620

       react-dom/test-utils is deprecated and replaced with @testing-library/react and @storybook/nextjs introduces an incompatibility.
       The fix is to use @storybook/test in place of @testing-library/react, which provides the same API.
       The issue is that we are using factories from api/test-utils, which imports ol-test-utilities, which imports @testing-library/react, which itself requires react-dom/test-utils,
       We should not use @storybook packages in ol-test-utilities or anywhere outside of ol-components as they are not related
       so below we are aliasing @testing-library/react.
     */
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        "@testing-library/react": "@storybook/test",
      },
    }

    return config
  },

  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
}

export default config
