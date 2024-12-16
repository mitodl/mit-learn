import { resolve } from "path"
import * as dotenv from "dotenv"
import * as webpack from "webpack"
import { StorybookConfig } from "@storybook/nextjs"

dotenv.config({ path: resolve(__dirname, "../../../.env") })

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.tsx",
    "../../ol-components/src/**/*.mdx",
    "../../ol-components/src/**/*.stories.@(tsx|ts)",
  ],

  staticDirs: ["./public"],

  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-webpack5-compiler-swc",
    "@storybook/addon-mdx-gfm",
  ],

  framework: {
    name: "@storybook/nextjs",
    options: {},
  },

  docs: {},

  webpackFinal: async (config: any) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        APP_SETTINGS: {
          EMBEDLY_KEY: JSON.stringify(process.env.EMBEDLY_KEY),
          PUBLIC_URL: JSON.stringify(process.env.PUBLIC_URL),
        },
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
