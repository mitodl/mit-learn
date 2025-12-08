import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    root: path.resolve(__dirname, "./src"),
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: [
      path.resolve(__dirname, "../vitest-jest-compat.ts"),
      path.resolve(__dirname, "../vitest-shared-setup.ts"),
      path.resolve(__dirname, "./src/test-utils/setupVitest.tsx"),
    ],
  },
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: path.resolve(__dirname, "./src/$1"),
      },
      {
        find: /^rehype-mathjax\/browser$/,
        replacement: "ol-test-utilities/filemocks/filemock.js",
      },
      {
        find: /^rehype-raw$/,
        replacement: "ol-test-utilities/filemocks/filemock.js",
      },
      {
        find: /^remark-math$/,
        replacement: "ol-test-utilities/filemocks/filemock.js",
      },
      {
        find: /^remark-supersub$/,
        replacement: "ol-test-utilities/filemocks/filemock.js",
      },
    ],
  },
  plugins: [
    {
      name: "file-mock-resolver",
      resolveId(id) {
        // Handle image files
        if (id.match(/\.(svg|jpg|jpeg|png)$/)) {
          try {
            return require.resolve("ol-test-utilities/filemocks/imagemock.js")
          } catch {
            return null
          }
        }
        // Handle CSS/SCSS files
        if (id.match(/\.(css|scss)$/)) {
          try {
            return require.resolve("ol-test-utilities/filemocks/filemock.js")
          } catch {
            return null
          }
        }
        return null
      },
    },
  ],
})
