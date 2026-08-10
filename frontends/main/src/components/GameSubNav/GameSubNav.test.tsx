import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import GameSubNav from "./GameSubNav"

jest.mock("next-nprogress-bar", () => ({
  useRouter: jest.fn(),
}))

const mockBack = jest.fn()

const { useRouter } = jest.requireMock("next-nprogress-bar")
useRouter.mockReturnValue({ back: mockBack })

describe("GameSubNav", () => {
  beforeEach(() => {
    mockBack.mockReset()
  })

  test("shows the game's title as the page heading", () => {
    renderWithProviders(<GameSubNav title="HackSnack" />)
    expect(
      screen.getByRole("heading", { level: 1, name: "HackSnack" }),
    ).toBeInTheDocument()
  })

  test("goes back when the back control is clicked", async () => {
    renderWithProviders(<GameSubNav title="HackSnack" />)
    await user.click(screen.getByRole("button", { name: "Go back" }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
