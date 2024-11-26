import React from "react"
import { screen, setMockResponse, renderWithProviders } from "@/test-utils"
import { urls } from "api/test-utils"
import { Permission } from "api/hooks/user"
import PrivacyPage from "./PrivacyPage"

describe("PrivacyPage", () => {
  test("Renders title", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    renderWithProviders(<PrivacyPage />)

    screen.getByRole("heading", {
      name: "Privacy Policy",
    })
  })
})
