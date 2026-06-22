import React from "react"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import { setMockResponse } from "api/test-utils"
import { factories, urls } from "api/mitxonline-test-utils"
import { AssignSeatsSection } from "./AssignSeatsSection"

// jsdom's File/Blob has no .text() or .arrayBuffer(), so FileReader.readAsText
// always fires onerror. Tests set mockFileContent before each upload so the mock
// can return the expected text.
let mockFileContent: string | null = null

describe("AssignSeatsSection", () => {
  let originalFileReader: typeof FileReader

  beforeAll(() => {
    originalFileReader = window.FileReader

    class FileReaderMock {
      result: string | null = null
      onload: ((e: { target: FileReaderMock }) => void) | null = null
      onerror: (() => void) | null = null

      readAsText(_file: File): void {
        const content = mockFileContent
        mockFileContent = null
        if (content !== null) {
          Promise.resolve().then(() => {
            this.result = content
            this.onload?.({ target: this })
          })
        } else {
          Promise.resolve().then(() => this.onerror?.())
        }
      }
    }

    Object.defineProperty(window, "FileReader", {
      value: FileReaderMock,
      writable: true,
      configurable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, "FileReader", {
      value: originalFileReader,
      writable: true,
      configurable: true,
    })
  })

  test("renders section title and key UI elements", () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    expect(
      screen.getByRole("heading", { name: "Assign Seats" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Assign Seats" }),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/enter employee emails/i),
    ).toBeInTheDocument()
    // Pseudo-links visible text
    expect(screen.getByText("import from CSV")).toBeInTheDocument()
    expect(screen.getByText("(download sample CSV)")).toBeInTheDocument()
  })

  test("download sample CSV pseudo-link is in the tab order and disabled", () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    // Only the download link is still disabled — import from CSV is now active
    const downloadLink = screen.getByRole("button", {
      name: "(download sample CSV)",
    })
    expect(downloadLink).toHaveAttribute("tabindex", "0")
    expect(downloadLink).toHaveAttribute("aria-disabled", "true")
  })

  test("import from CSV button is active and in the tab order", () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const importButton = screen.getByRole("button", { name: "import from CSV" })
    expect(importButton).toBeInTheDocument()
    expect(importButton).toHaveAttribute("tabindex", "0")
    expect(importButton).not.toHaveAttribute("aria-disabled")
  })

  test("Assign Seats button is disabled when textarea is empty", () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    expect(screen.getByRole("button", { name: "Assign Seats" })).toBeDisabled()
  })

  test("Assign Seats button is disabled when valid email count exceeds available seats", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={1} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, bob@example.com")

    expect(screen.getByRole("button", { name: "Assign Seats" })).toBeDisabled()
  })

  test("Assign Seats button enables when at least one valid email is entered", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com")

    expect(
      screen.getByRole("button", { name: "Assign Seats" }),
    ).not.toBeDisabled()
  })

  test("Assign Seats button stays disabled when only invalid emails are entered", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "notanemail")

    expect(screen.getByRole("button", { name: "Assign Seats" })).toBeDisabled()
  })

  test("sole invalid token is not highlighted while focused (no preceding comma)", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "notvalid")

    // User is still typing their first token — don't highlight yet
    expect(screen.getByText("1 invalid")).toBeInTheDocument()
    expect(document.querySelector("[data-invalid-email]")).toBeNull()
  })

  test("last invalid token is highlighted while focused when preceded by a comma", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, notvalid")

    const invalidSegment = document.querySelector("[data-invalid-email]")
    expect(invalidSegment).not.toBeNull()
    expect(invalidSegment?.textContent).toContain("notvalid")
  })

  test("last invalid token is highlighted after blur (no trailing comma)", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "notvalid")
    await user.click(document.body) // blur

    const invalidSegment = document.querySelector("[data-invalid-email]")
    expect(invalidSegment).not.toBeNull()
    expect(invalidSegment?.textContent).toContain("notvalid")
  })

  test("shows valid/invalid counts after entering emails", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, bob@example.com, notvalid")

    expect(screen.getByText("2 valid")).toBeInTheDocument()
    expect(screen.getByText("1 invalid")).toBeInTheDocument()
  })

  test("shows only valid count when all emails are valid", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, bob@example.com")

    expect(screen.getByText("2 valid")).toBeInTheDocument()
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument()
  })

  test("validation badge is not shown when textarea is empty", () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    expect(screen.queryByText(/valid/i)).not.toBeInTheDocument()
  })

  test("live region announces email validation summary after debounce", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com, bad-email")

    const liveRegion = document.querySelector("[aria-live='polite']")
    expect(liveRegion).not.toBeNull()
    // Announcement is debounced — wait for the timeout to fire
    await waitFor(
      () =>
        expect(liveRegion as HTMLElement).toHaveTextContent(
          "1 valid email, 1 invalid",
        ),
      { timeout: 1000 },
    )
  })

  test("clicking Assign Seats opens the confirm modal", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))

    expect(
      await screen.findByRole("heading", {
        name: /ready to send invitations/i,
      }),
    ).toBeInTheDocument()
  })

  test("modal shows invalid emails when textarea has mixed input", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.click(textarea)
    await user.paste("alice@example.com\nbadtoken")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))

    expect(await screen.findAllByText("badtoken")).not.toHaveLength(0)
  })

  test("modal shows duplicate count when textarea has repeated emails", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.click(textarea)
    await user.paste("alice@example.com\nalice@example.com\nbob@example.com")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      /1 duplicate.*removed/i,
    )
  })

  test("closing the modal hides it", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    await user.type(textarea, "alice@example.com")
    await user.click(screen.getByRole("button", { name: "Assign Seats" }))
    await screen.findByRole("heading", { name: /ready to send invitations/i })

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /ready to send invitations/i }),
      ).not.toBeInTheDocument(),
    )
  })

  // CSV import tests

  test("importing a valid CSV opens the modal without populating the textarea", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const csvContent = "email\nalice@example.com\nbob@example.com"
    mockFileContent = csvContent
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(
      await screen.findByRole("heading", {
        name: /ready to send invitations/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter employee emails/i)).toHaveValue(
      "",
    )
  })

  test("importing a CSV with invalid emails shows them in the modal", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const csvContent = "alice@example.com\nbad@\nnot-quite@.com"
    mockFileContent = csvContent
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(await screen.findByText("bad@")).toBeInTheDocument()
    expect(screen.getByText("not-quite@.com")).toBeInTheDocument()
  })

  test("importing a CSV with duplicates shows duplicate count in modal", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const csvContent = "alice@example.com\nbob@example.com\nalice@example.com"
    mockFileContent = csvContent
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      /1 duplicate.*removed/i,
    )
  })

  test("importing a CSV with no-@ rows shows skipped count in modal", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const csvContent =
      "alice@example.com\nnoatsymbol\nalso-no-at\nalice@example.com"
    mockFileContent = csvContent
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      /2 rows skipped.*no email address found/i,
    )
  })

  test("importing a CSV with no valid emails shows inline error", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const csvContent = "Email\nNot An Email\nbad@"
    mockFileContent = csvContent
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no valid email addresses found in this file/i,
    )
    expect(
      screen.queryByRole("heading", { name: /ready to assign/i }),
    ).not.toBeInTheDocument()
  })

  test("assertive live region announces CSV error text for screen readers", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const csvContent = "Email\nNot An Email\nbad@"
    mockFileContent = csvContent
    const file = new File([csvContent], "emails.csv", { type: "text/csv" })

    const fileInput = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement
    await user.upload(fileInput, file)

    await screen.findByRole("alert")
    const assertiveRegion = document.querySelector("[aria-live='assertive']")
    expect(assertiveRegion).toHaveTextContent(
      /no valid email addresses found in this file/i,
    )
  })

  test("accepts newline-separated emails", async () => {
    renderWithProviders(
      <AssignSeatsSection orgId={1} contractId={2} availableSeats={50} />,
    )

    const textarea = screen.getByPlaceholderText(/enter employee emails/i)
    // Simulate pasting newline-separated emails
    await user.click(textarea)
    await user.paste("alice@example.com\nbob@example.com\nbad")

    expect(screen.getByText("2 valid")).toBeInTheDocument()
    expect(screen.getByText("1 invalid")).toBeInTheDocument()
  })

  describe("submitting the assignment", () => {
    const ORG_ID = 1
    const CONTRACT_ID = 2

    const enterEmailsAndConfirm = async (emails: string) => {
      const textarea = screen.getByPlaceholderText(/enter employee emails/i)
      await user.click(textarea)
      await user.paste(emails)
      await user.click(screen.getByRole("button", { name: "Assign Seats" }))
      await user.click(
        screen.getByRole("button", { name: /send 2 invitations/i }),
      )
    }

    test("assigns seats and shows a success alert, clearing the input", async () => {
      setMockResponse.post(
        urls.contracts.managerContractBulkAssign(ORG_ID, CONTRACT_ID),
        factories.contracts.bulkAssignResult({
          assigned: [
            factories.contracts.contractCode(),
            factories.contracts.contractCode(),
          ],
          errors: [],
        }),
      )
      renderWithProviders(
        <AssignSeatsSection
          orgId={ORG_ID}
          contractId={CONTRACT_ID}
          availableSeats={50}
        />,
      )

      await enterEmailsAndConfirm("alice@example.com\nbob@example.com")

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent("2 seats assigned.")
      expect(screen.getByPlaceholderText(/enter employee emails/i)).toHaveValue(
        "",
      )
    })

    test("surfaces partial failures with a warning alert and the failed addresses", async () => {
      setMockResponse.post(
        urls.contracts.managerContractBulkAssign(ORG_ID, CONTRACT_ID),
        factories.contracts.bulkAssignResult({
          assigned: [factories.contracts.contractCode()],
          errors: [
            factories.contracts.bulkAssignError({
              email: "taken@example.com",
              detail: "Code has already been assigned or redeemed.",
            }),
          ],
        }),
      )
      renderWithProviders(
        <AssignSeatsSection
          orgId={ORG_ID}
          contractId={CONTRACT_ID}
          availableSeats={50}
        />,
      )

      await enterEmailsAndConfirm("alice@example.com\ntaken@example.com")

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent("1 seat assigned.")
      expect(alert).toHaveTextContent("1 could not be assigned:")
      expect(alert).toHaveTextContent("taken@example.com")
    })

    test("shows an error alert when the request fails", async () => {
      setMockResponse.post(
        urls.contracts.managerContractBulkAssign(ORG_ID, CONTRACT_ID),
        { detail: "boom" },
        { code: 500 },
      )
      renderWithProviders(
        <AssignSeatsSection
          orgId={ORG_ID}
          contractId={CONTRACT_ID}
          availableSeats={50}
        />,
      )

      await enterEmailsAndConfirm("alice@example.com\nbob@example.com")

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /something went wrong/i,
      )
    })
  })
})
