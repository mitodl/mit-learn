import { notFound } from "next/navigation"
import { setMockResponse, urls } from "api/test-utils"
import { letters as factory } from "api/test-utils/factories"
import Page, { generateMetadata } from "./page"

jest.mock("@/app/getQueryClient", () => {
  const { makeBrowserQueryClient } = jest.requireActual("@/app/getQueryClient")
  return { getQueryClient: () => makeBrowserQueryClient({ maxRetries: 0 }) }
})
// fetchQueryOr404 only calls notFound() on the server.
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  isServer: true,
  dehydrate: jest.fn().mockReturnValue({}),
}))
jest.mock("@/app-pages/ProgramLetterPage/ProgramLetterPage", () => ({
  __esModule: true,
  default: () => null,
}))

const mockNotFound = jest.mocked(notFound)
beforeEach(() => {
  mockNotFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND")
  })
})

const pageProps = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
})
const callGenerateMetadata = (id: string) => generateMetadata(pageProps(id))
const missingId = "5de96fc0-449e-4668-be89-a119dbdcab79"

describe("Program letter page generateMetadata", () => {
  it("names the learner and program, for share previews", async () => {
    const programLetter = factory.programLetter()
    setMockResponse.get(
      urls.programLetters.details(programLetter.id),
      programLetter,
    )
    const { user_full_name: name, program_title: program } =
      programLetter.certificate

    const metadata = await callGenerateMetadata(programLetter.id)

    expect(metadata.title).toContain(`${name}'s Program Letter`)
    expect(metadata.description).toBe(
      `${name} has successfully completed: ${program}`,
    )
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        title: metadata.title,
        description: metadata.description,
      }),
    )
    expect(metadata.twitter).toEqual(
      expect.objectContaining({ title: metadata.title }),
    )
  })

  it("is never indexed", async () => {
    const programLetter = factory.programLetter()
    setMockResponse.get(
      urls.programLetters.details(programLetter.id),
      programLetter,
    )

    const metadata = await callGenerateMetadata(programLetter.id)

    expect(metadata.robots).toEqual({ index: false })
  })

  it("falls back when the learner has no name", async () => {
    const programLetter = factory.programLetter()
    programLetter.certificate.user_full_name = ""
    setMockResponse.get(
      urls.programLetters.details(programLetter.id),
      programLetter,
    )

    const metadata = await callGenerateMetadata(programLetter.id)

    expect(metadata.title).toMatch(/^Program Letter \|/)
    expect(metadata.description).toBe(
      `Program letter for ${programLetter.certificate.program_title}`,
    )
  })

  // A missing letter, or one whose certificate was revoked, 404s from the API.
  it("calls notFound for a missing or revoked letter", async () => {
    setMockResponse.get(urls.programLetters.details(missingId), "Not found", {
      code: 404,
    })

    await expect(callGenerateMetadata(missingId)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    )
  })
})

describe("Program letter page", () => {
  it("renders a letter", async () => {
    const programLetter = factory.programLetter()
    setMockResponse.get(
      urls.programLetters.details(programLetter.id),
      programLetter,
    )

    await expect(Page(pageProps(programLetter.id))).resolves.toBeTruthy()
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  // A missing letter, or one whose certificate was revoked, 404s from the API.
  it("is served as a 404 for a missing or revoked letter", async () => {
    setMockResponse.get(urls.programLetters.details(missingId), "Not found", {
      code: 404,
    })

    await expect(Page(pageProps(missingId))).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
