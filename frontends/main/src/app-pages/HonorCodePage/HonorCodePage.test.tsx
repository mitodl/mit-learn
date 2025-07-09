import React from "react"
import { screen, setMockResponse, renderWithProviders } from "@/test-utils"
import { urls } from "api/test-utils"
import { Permission } from "api/hooks/user"
import HonorCodePage from "./HonorCodePage"

describe("HonorCodePage", () => {
  test("Renders title", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    renderWithProviders(<HonorCodePage />)

    screen.getByRole("heading", {
      name: "Honor Code",
    })
  })
})
