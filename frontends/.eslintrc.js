module.exports = {
  extends: [
    "eslint-config-mitodl",
    "eslint-config-mitodl/jest",
    "plugin:styled-components-a11y/recommended",
    "plugin:import/typescript",
    "plugin:mdx/recommended",
    // The default `recommended`/`core-web-vitals` configs are flat-config shaped
    // (they carry a top-level `name`), which ESLint 8's legacy .eslintrc loader
    // rejects. The plugin dual-publishes eslintrc-compatible `-legacy` variants.
    "plugin:@next/next/recommended-legacy",
    "prettier",
  ],
  plugins: ["testing-library", "import", "styled-components-a11y"],
  ignorePatterns: [
    "**/build/**",
    "mit-learn",
    "github-pages",
    "storybook-static",
    "**/TiptapEditor/vendor/**",
  ],
  settings: {
    "import/resolver": {
      typescript: {
        project: ["tsconfig.json", "*/tsconfig.json"],
      },
    },
    "jsx-a11y": {
      components: {
        "ListCard.Image": "img",
        "Card.Image": "img",
        Button: "button",
        ButtonLink: "a",
        ActionButton: "button",
        ActionButtonLink: "a",
      },
    },
  },
  rules: {
    ...restrictedImports({
      paths: [
        {
          name: "lodash",
          importNames: ["default"],
          message:
            "Default import from 'lodash' is not allowed. Use named imports instead.",
        },
        {
          name: "ol-components",
          importNames: [
            "Button",
            "ButtonLink",
            "ActionButton",
            "ActionButtonLink",
          ],
          message: "Please import from @mitodl/smoot-design instead.",
        },
      ],
      patterns: [
        {
          group: ["next/navigation"],
          importNames: ["useRouter"],
          message: "Please use `useRouter` from `next-nprogress-bar` instead.",
        },
        {
          group: ["@mui/material*", "@mui/lab/*"],
          message:
            "Please use 'ol-components' isInterfaceDeclaration; Direct use of @mui/material is limited to ol-components.",
        },
        {
          group: ["**/LearningResourceDrawer/LearningResourceDrawer"],
          message:
            "The LearningResourceDrawer should be lazy loaded with dynamic import.",
        },
        {
          group: ["api/clients"],
          message:
            "Direct import from 'api/clients' is not allowed. Use React Query hooks from 'api/hooks/*' instead for caching and error handling. In server components, use getServerQueryClient().fetchQuery(), passing the queryOptions.",
        },
      ],
    }),
    // This rule is disabled in the default a11y config, but unclear why.
    // It does catch useful errors, e.g., buttons with no text or label.
    // If it proves to be flaky, we can find other ways to check for this.
    // We need both rules below. One for normal elements, one for styled
    "jsx-a11y/control-has-associated-label": ["error"],
    "styled-components-a11y/control-has-associated-label": ["error"],
    "@typescript-eslint/triple-slash-reference": [
      "error",
      {
        path: "never",
        types: "prefer-import",
        lib: "never",
      },
    ],
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: [
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/src/setupJest.ts",
          "**/jest-shared-setup.ts",
          "**/jsdom-extended.ts",
          "**/test-utils.ts",
          "**/test-utils.tsx",
          "**/test-utils/**",
          "**/webpack.config.js",
          "**/webpack.exports.js",
          "**/postcss.config.js",
          "**/*.stories.ts",
          "**/*.stories.tsx",
          "**/*.mdx",
        ],
      },
    ],
    "import/no-duplicates": "error",
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            target: "**/components/**",
            from: "**/{app,app-pages,page-components}/**",
            message:
              "Import breaks component hierarchy. See https://github.com/mitodl/mit-open/blob/main/docs/architecture/front-end-component-structure.md#module-boundary-and-importexport-rules",
          },
          {
            target: "**/page-components/**",
            from: "**/{app,app-pages}/**",
            message:
              "Import breaks component hierarchy. See https://github.com/mitodl/mit-open/blob/main/docs/architecture/front-end-component-structure.md#module-boundary-and-importexport-rules",
          },
        ],
      },
    ],
    quotes: ["error", "double", { avoidEscape: true }],
    ...restrictedSyntax(),
  },
  overrides: [
    {
      files: ["./**/ol-components/**/*.ts", "./**/ol-components/**/*.tsx"],
      rules: {
        ...restrictedImports(),
      },
    },
    {
      // Tests/setup legitimately set & read process.env.NEXT_PUBLIC_* directly
      // (jsdom). Lift only the NEXT_PUBLIC_* ban for these; keep other selectors.
      // next.config.js is intentionally NOT exempt: NEXT_PUBLIC_* are absent at
      // build time, so reads there are bugs except for a couple of justified
      // cases (NEXT_PUBLIC_VERSION, dev-only NEXT_PUBLIC_ORIGIN) allowed inline.
      files: [
        "./**/*.test.{ts,tsx}",
        "./**/test-utils/**",
        "./**/setupJest.{ts,tsx}",
        "./**/jest-shared-setup.ts",
      ],
      rules: {
        ...restrictedSyntax({ allowPublicEnv: true }),
      },
    },
    {
      files: ["./**/*.test.{ts,tsx}"],
      plugins: ["testing-library"],
      extends: ["plugin:testing-library/react"],
      rules: {
        "testing-library/no-node-access": "off",
      },
    },
    // Note: eslint-plugin-storybook is incompatible with Storybook 10 (ESM) and ESLint 8 (CommonJS)
    // Storybook linting rules are disabled until we upgrade to ESLint 9+ or the plugin is updated
    // To re-enable, add: { files: ["./**/*.stories.{ts,tsx}"], extends: ["plugin:storybook/recommended"] }
  ],
}

function restrictedImports({ paths = [], patterns = [] } = {}) {
  /**
   * With the `no-restricted-imports` rule (and its typescript counterpart),
   * it's difficult to restrict imports but allow a few exceptions.
   *
   * For example:
   *  - forbid importing `@mui/material/*`, EXCEPT within `ol-components`.
   *
   * It is possible to do this using overrides.
   *
   * This function exists to make it easier to share config between overrides.
   *
   * See also:
   *  - https://github.com/eslint/eslint/discussions/17047 no-restricted-imports: allow some specific imports in some specific directories
   *  - https://github.com/eslint/eslint/discussions/15011 Can a rule be specified multiple times without overriding itself?
   *
   * This may be easier if we swtich to ESLint's new "flat config" system.
   */
  return {
    "@typescript-eslint/no-restricted-imports": [
      "error",
      {
        paths: [
          /**
           * No direct imports from large "barrel files". They make Jest slow.
           *
           * For more, see:
           *  - https://github.com/jestjs/jest/issues/11234
           *  - https://github.com/faker-js/faker/issues/1114#issuecomment-1169532948
           */
          {
            name: "@faker-js/faker",
            message: "Please use @faker-js/faker/locale/en instead.",
            allowTypeImports: true,
          },
          {
            name: "@mui/material",
            message: "Please use @mui/material/<COMPONENT_NAME> instead.",
            allowTypeImports: true,
          },
          ...paths,
        ],
        patterns: [...patterns],
      },
    ],
  }
}

function restrictedSyntax({ allowPublicEnv = false } = {}) {
  /**
   * Shared no-restricted-syntax config. Factored into a helper (like
   * restrictedImports above) so the NEXT_PUBLIC_* process.env ban can be lifted
   * for tests/setup (which read process.env directly under jsdom) via an
   * override without losing the other selectors.
   *
   * The selectors use "ES Query", a css-like syntax for AST querying. A useful
   * tool is https://estools.github.io/esquery/
   * See https://eslint.org/docs/latest/rules/no-restricted-syntax
   */
  const selectors = [
    {
      selector:
        "Property[key.name=fontWeight][value.raw=/\\d+/], TemplateElement[value.raw=/font-weight: \\d+/]",
      message:
        "Do not specify `fontWeight` manually. Prefer spreading `theme.typography.subtitle1` or similar. If you MUST use a fontWeight, refer to `fontWeights` theme object.",
    },
    {
      selector:
        "Property[key.name=fontFamily][value.raw=/Neue Haas/], TemplateElement[value.raw=/Neue Haas/]",
      message:
        "Do not specify `fontFamily` manually. Prefer spreading `theme.typography.subtitle1` or similar. If using neue-haas-grotesk-text, this is ThemeProvider's default fontFamily.",
    },
    {
      selector:
        "FunctionDeclaration[id.name='generateMetadata'] > BlockStatement > ReturnStatement[argument.type!='CallExpression'], FunctionDeclaration[id.name='generateMetadata'] > BlockStatement > ReturnStatement[argument.callee.name!='safeGenerateMetadata']",
      message:
        "generateMetadata functions must return safeGenerateMetadata() to ensure proper error handling and fallback metadata.",
    },
  ]
  if (!allowPublicEnv) {
    selectors.push({
      // Matches `process.env.NEXT_PUBLIC_*` (dot) and
      // `process.env["NEXT_PUBLIC_*"]` (string-literal bracket). Does NOT match
      // `process.env[key]` with a variable key (e.g. the env() helper itself).
      selector:
        "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_/], MemberExpression[object.object.name='process'][object.property.name='env'][property.value=/^NEXT_PUBLIC_/]",
      message:
        "Do not read NEXT_PUBLIC_* from process.env directly: values are inlined at build time and are empty in the standalone Docker image. Use env() or requiredEnv() from @/env instead.",
    })
  }
  return { "no-restricted-syntax": ["error", ...selectors] }
}
