import { readdirSync, existsSync } from "fs"
import path from "path"
import { defineWorkspace } from "vitest/config"

/**
 * Vitest workspace configuration for running tests across multiple packages.
 *
 * Automatically discovers packages with vitest.config.ts files.
 * Packages without vitest.config.ts will continue to use Jest.
 */
const workspaceRoot = __dirname
const allPackages = readdirSync(workspaceRoot, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .filter(
    (dirent) =>
      !dirent.name.startsWith(".") &&
      dirent.name !== "node_modules" &&
      dirent.name !== "coverage",
  )
  .map((dirent) => dirent.name)

const vitestPackages = allPackages.filter((name) => {
  // Check if package has vitest.config.ts
  const vitestConfigPath = path.join(workspaceRoot, name, "vitest.config.ts")
  return existsSync(vitestConfigPath)
})

const workspaces = vitestPackages.map((name) => ({
  extends: path.resolve(workspaceRoot, name, "vitest.config.ts"),
  test: {
    name,
    root: path.resolve(workspaceRoot, name),
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Exclude other packages' test files
      ...allPackages.filter((pkg) => pkg !== name).map((pkg) => `../${pkg}/**`),
    ],
  },
}))

export default defineWorkspace(workspaces.length > 0 ? workspaces : [])
