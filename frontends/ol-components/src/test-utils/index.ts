import { render } from "@testing-library/react"

import { ThemeProvider } from "../components/ThemeProvider/ThemeProvider"

const renderWithTheme = (ui: React.ReactElement) =>
  render(ui, { wrapper: ThemeProvider })

export { renderWithTheme }
