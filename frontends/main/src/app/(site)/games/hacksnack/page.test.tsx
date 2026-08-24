import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import Page, { metadata } from "./page"

const mockHacksnackClient = jest.fn((_props: unknown) => (
  <div data-testid="hacksnack-client">Hacksnack Client</div>
))

jest.mock("./HacksnackClient", () => ({
  __esModule: true,
  default: (props: unknown) => mockHacksnackClient(props),
}))

jest.mock("./HacksnackFlagGate", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("hacksnack page.tsx", () => {
  beforeEach(() => {
    // clearAllMocks, not resetAllMocks: the latter strips implementations from
    // every mock including the global window.IntersectionObserver stub in
    // jest-shared-setup, which next/link needs to prefetch. Only call history
    // needs clearing between these tests.
    jest.clearAllMocks()
    mockHacksnackClient.mockReturnValue(
      <div data-testid="hacksnack-client">Hacksnack Client</div>,
    )
  })

  test("renders the HacksnackClient", () => {
    renderWithProviders(
      <Page params={Promise.resolve({})} searchParams={Promise.resolve({})} />,
    )
    expect(screen.getByTestId("hacksnack-client")).toBeInTheDocument()
  })

  test("sets the page title metadata", () => {
    expect(metadata.title).toContain("Hack Snack")
  })

  test("passes GOOGLE_MAPS_API_KEY to HacksnackClient", () => {
    process.env.GOOGLE_MAPS_API_KEY = "maps-key-123"
    renderWithProviders(
      <Page params={Promise.resolve({})} searchParams={Promise.resolve({})} />,
    )
    expect(mockHacksnackClient).toHaveBeenCalledWith(
      expect.objectContaining({ googleMapsApiKey: "maps-key-123" }),
    )
    delete process.env.GOOGLE_MAPS_API_KEY
  })

  test("passes undefined googleMapsApiKey when env var is unset", () => {
    delete process.env.GOOGLE_MAPS_API_KEY
    renderWithProviders(
      <Page params={Promise.resolve({})} searchParams={Promise.resolve({})} />,
    )
    expect(mockHacksnackClient).toHaveBeenCalledWith(
      expect.objectContaining({ googleMapsApiKey: undefined }),
    )
  })
})
