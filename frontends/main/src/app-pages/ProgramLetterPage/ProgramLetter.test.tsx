import React from "react"
import { renderWithProviders, screen, waitFor } from "@/test-utils"
import type { ProgramLetter } from "api"
import { letters as factory } from "api/test-utils/factories"
import { setMockResponse, urls } from "api/test-utils"
import { programLetterView } from "@/common/urls"
import ProgramLetterPage from "./ProgramLetterPage"

const setup = ({ programLetter }: { programLetter: ProgramLetter }) => {
  setMockResponse.get(
    urls.programLetters.details(programLetter.id),
    programLetter,
  )
  setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
  renderWithProviders(<ProgramLetterPage />, {
    url: programLetterView(programLetter.id),
  })
}

describe("ProgramLetterDisplayPage", () => {
  // See https://github.com/mitodl/hq/issues/5694
  it("Renders a program letter from api", async () => {
    const programLetter = factory.programLetter()
    setup({ programLetter })
    await waitFor(() => {
      const letterText = document.querySelector(".letter-text > div")
      expect(letterText?.innerHTML).toBe(
        programLetter?.template_fields?.program_letter_text,
      )
    })
    await waitFor(() => {
      const signatureImage = document.querySelector(
        ".sig-image > img",
      ) as HTMLImageElement
      expect(signatureImage?.src).toBe(
        programLetter?.template_fields?.program_letter_signatories![0]
          .signature_image?.meta?.download_url,
      )
    })
  })

  // A missing letter, or one whose certificate was revoked, 404s from the API.
  it("Renders the 404 page instead of an empty letter", async () => {
    const id = "5de96fc0-449e-4668-be89-a119dbdcab79"
    setMockResponse.get(urls.programLetters.details(id), "Not found", {
      code: 404,
    })
    setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
    renderWithProviders(<ProgramLetterPage />, {
      url: programLetterView(id),
    })

    expect(
      await screen.findByText(/couldn't find what you were looking for/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Dear/)).not.toBeInTheDocument()
  })
})
