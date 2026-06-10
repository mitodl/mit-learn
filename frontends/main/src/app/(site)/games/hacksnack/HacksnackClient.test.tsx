import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import HacksnackClient from "./HacksnackClient"

// Mutable ref read at render time, not at module load time, so swapping
// Component between tests reliably controls what next/dynamic renders.
const dynamicRef = {
  Component: (() => (
    <div data-testid="hacksnack">HackSnack Game</div>
  )) as React.FC,
}

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => (props: Record<string, unknown>) => (
    <dynamicRef.Component {...props} />
  ),
}))

describe("HacksnackClient", () => {
  afterEach(() => {
    dynamicRef.Component = () => (
      <div data-testid="hacksnack">HackSnack Game</div>
    )
  })

  test("renders the HackSnackGame component", async () => {
    renderWithProviders(<HacksnackClient />)
    expect(await screen.findByTestId("hacksnack")).toBeInTheDocument()
  })

  test("renders nothing while the dynamic import is loading", () => {
    dynamicRef.Component = () => null
    renderWithProviders(<HacksnackClient />)
    expect(screen.queryByTestId("hacksnack")).not.toBeInTheDocument()
  })

  test("passes googleMapsApiKey to HackSnackGame", async () => {
    let capturedProps: Record<string, unknown> = {}
    dynamicRef.Component = (props) => {
      capturedProps = props as Record<string, unknown>
      return <div data-testid="hacksnack">HackSnack Game</div>
    }
    renderWithProviders(<HacksnackClient googleMapsApiKey="test-key" />)
    await screen.findByTestId("hacksnack")
    expect(capturedProps.googleMapsApiKey).toBe("test-key")
  })
})
