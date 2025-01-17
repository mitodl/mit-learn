import { render } from "@testing-library/react"

import { ThemeProvider } from "@mitodl/smoot-design"

const renderWithTheme = (ui: React.ReactElement) =>
  render(ui, { wrapper: ThemeProvider })

export { renderWithTheme }
