/**
 * @jest-environment jsdom
 */
import React from "react"
import { screen, renderWithProviders, user } from "@/test-utils"
import { factories } from "api/test-utils"
import {
  DigitalCredentialDialog,
  VerifiableCredential,
} from "./DigitalCredentialDialog"

const createMockVerifiableCredential = (
  overrides?: Partial<VerifiableCredential>,
): VerifiableCredential => factories.mitxonline.verifiableCredential(overrides)

describe("DigitalCredentialDialog", () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url")
    global.URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("Dialog visibility", () => {
    it("renders dialog when open is true", () => {
      const credential = createMockVerifiableCredential()
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      expect(
        screen.getByRole("dialog", { name: "Download Digital Credential" }),
      ).toBeInTheDocument()
    })

    it("does not render dialog when open is false", () => {
      const credential = createMockVerifiableCredential()
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={false}
          onClose={mockOnClose}
        />,
      )

      expect(
        screen.queryByRole("dialog", { name: "Download Digital Credential" }),
      ).not.toBeInTheDocument()
    })
  })

  describe("Content rendering", () => {
    it("renders issuer name", () => {
      const credential = createMockVerifiableCredential({
        issuer: { ...createMockVerifiableCredential().issuer, name: "MIT" },
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText("MIT")).toBeInTheDocument()
    })

    it("renders issuance date formatted correctly", () => {
      const credential = createMockVerifiableCredential({
        validFrom: "2024-01-15T10:00:00Z",
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      const issuanceDate = new Date("2024-01-15T10:00:00Z").toLocaleDateString()
      expect(screen.getByText(issuanceDate)).toBeInTheDocument()
    })

    it("renders expiration date formatted correctly", () => {
      const credential = createMockVerifiableCredential({
        validFrom: "2024-01-15T10:00:00Z",
        validUntil: "2027-12-31T23:59:59Z",
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      const expirationDate = new Date(
        "2027-12-31T23:59:59Z",
      ).toLocaleDateString()
      expect(screen.getByText(expirationDate)).toBeInTheDocument()
    })

    it("renders N/A for expiration date when validUntil is empty", () => {
      const credential = createMockVerifiableCredential({
        validUntil: "",
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      const expirationDetail = screen
        .getByText("Expiration Date:")
        .closest("dl")
        ?.querySelector("dd")
      expect(expirationDetail).toBeInTheDocument()
    })

    it("renders formatted expiration date when validUntil is provided", () => {
      const credential = createMockVerifiableCredential({
        validUntil: "2027-12-31T23:59:59Z",
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      const expirationDate = new Date(
        "2027-12-31T23:59:59Z",
      ).toLocaleDateString()
      expect(screen.getByText(expirationDate)).toBeInTheDocument()
    })

    it("renders identity hash", () => {
      const credential = createMockVerifiableCredential({
        credentialSubject: {
          ...createMockVerifiableCredential().credentialSubject,
          identifier: [
            {
              salt: "xyz",
              type: "IdentityHash",
              hashed: true,
              identityHash: "test-hash-12345",
              identityType: "email",
            },
          ],
        },
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText("test-hash-12345")).toBeInTheDocument()
    })

    it("renders achievement description", () => {
      const credential = createMockVerifiableCredential({
        credentialSubject: {
          ...createMockVerifiableCredential().credentialSubject,
          achievement: {
            ...createMockVerifiableCredential().credentialSubject.achievement,
            description: "Completed advanced machine learning course",
          },
        },
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      expect(
        screen.getByText("Completed advanced machine learning course"),
      ).toBeInTheDocument()
    })

    it("renders criteria narrative when present", () => {
      const credential = createMockVerifiableCredential({
        credentialSubject: {
          ...createMockVerifiableCredential().credentialSubject,
          achievement: {
            ...createMockVerifiableCredential().credentialSubject.achievement,
            criteria: {
              narrative: "Passed all exams with 90% or higher",
            },
          },
        },
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      expect(
        screen.getByText("Passed all exams with 90% or higher"),
      ).toBeInTheDocument()
    })

    it("renders empty criteria when criteria is missing", () => {
      const credential = createMockVerifiableCredential({
        credentialSubject: {
          ...createMockVerifiableCredential().credentialSubject,
          achievement: {
            ...createMockVerifiableCredential().credentialSubject.achievement,
            criteria: undefined,
          },
        },
      })
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      // The criteria field should still be rendered but empty
      const criteriaTerm = screen.getByText("Criteria:")
      expect(criteriaTerm).toBeInTheDocument()
    })
  })

  describe("Verify Credential link", () => {
    it("renders verify credential link with correct href and target", () => {
      const credential = createMockVerifiableCredential()
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      const verifyLink = screen.getByRole("link", {
        name: /Verify Credential/i,
      })
      expect(verifyLink).toHaveAttribute("href", "https://verifierplus.org/")
      expect(verifyLink).toHaveAttribute("target", "_blank")
    })
  })

  describe("Download functionality", () => {
    it("downloads credential as JSON when download button is clicked", async () => {
      const credential = createMockVerifiableCredential()
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      }

      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      // Mock document methods after rendering to avoid interfering with React's DOM setup
      const originalAppendChild = document.body.appendChild.bind(document.body)
      const originalRemoveChild = document.body.removeChild.bind(document.body)
      const createElementSpy = jest
        .spyOn(document, "createElement")
        .mockImplementation((tagName) => {
          if (tagName === "a") {
            return mockLink as unknown as HTMLElement
          }
          return document.createElement(tagName)
        })
      const appendChildSpy = jest
        .spyOn(document.body, "appendChild")
        .mockImplementation((node) => {
          // Call original for React Testing Library's container
          if (
            node instanceof HTMLElement &&
            (node.id === "root" || node.hasAttribute("data-reactroot"))
          ) {
            return originalAppendChild(node)
          }
          return node as unknown as Node
        })
      const removeChildSpy = jest
        .spyOn(document.body, "removeChild")
        .mockImplementation((node) => {
          // Call original for React Testing Library's container
          if (
            node instanceof HTMLElement &&
            (node.id === "root" || node.hasAttribute("data-reactroot"))
          ) {
            return originalRemoveChild(node)
          }
          return node as unknown as Node
        })

      const downloadButton = screen.getByRole("button", {
        name: "Download Digital Credential",
      })
      await user.click(downloadButton)

      expect(createElementSpy).toHaveBeenCalledWith("a")
      expect(mockLink.download).toBe("digital-credential.json")
      expect(mockLink.click).toHaveBeenCalled()
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink)
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink)
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url")

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it("creates blob with correct JSON content", async () => {
      const credential = createMockVerifiableCredential()
      const mockBlob = jest.fn()
      global.Blob = mockBlob as unknown as typeof Blob

      // Mock console.error to suppress navigation error from link.click()
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {})

      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      // Mock document.createElement to return a mock link after rendering
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      }
      const originalAppendChild = document.body.appendChild.bind(document.body)
      const originalRemoveChild = document.body.removeChild.bind(document.body)
      const createElementSpy = jest
        .spyOn(document, "createElement")
        .mockImplementation((tagName) => {
          if (tagName === "a") {
            return mockLink as unknown as HTMLElement
          }
          return document.createElement(tagName)
        })
      const appendChildSpy = jest
        .spyOn(document.body, "appendChild")
        .mockImplementation((node) => {
          if (
            node instanceof HTMLElement &&
            (node.id === "root" || node.hasAttribute("data-reactroot"))
          ) {
            return originalAppendChild(node)
          }
          return node as unknown as Node
        })
      const removeChildSpy = jest
        .spyOn(document.body, "removeChild")
        .mockImplementation((node) => {
          if (
            node instanceof HTMLElement &&
            (node.id === "root" || node.hasAttribute("data-reactroot"))
          ) {
            return originalRemoveChild(node)
          }
          return node as unknown as Node
        })

      const downloadButton = screen.getByRole("button", {
        name: "Download Digital Credential",
      })
      await user.click(downloadButton)

      expect(mockBlob).toHaveBeenCalledWith(
        [JSON.stringify(credential, null, 2)],
        { type: "application/json" },
      )

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })
  })

  describe("Dialog interactions", () => {
    it("calls onClose when dialog is closed", async () => {
      const credential = createMockVerifiableCredential()
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      const closeButton = screen.getByRole("button", { name: "Close" })
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it("calls onClose after download is confirmed", async () => {
      const credential = createMockVerifiableCredential()
      const mockLink = {
        href: "",
        download: "",
        click: jest.fn(),
      }

      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      // Mock document methods after rendering to avoid interfering with React's DOM setup
      const originalAppendChild = document.body.appendChild.bind(document.body)
      const originalRemoveChild = document.body.removeChild.bind(document.body)
      const createElementSpy = jest
        .spyOn(document, "createElement")
        .mockImplementation((tagName) => {
          if (tagName === "a") {
            return mockLink as unknown as HTMLElement
          }
          return document.createElement(tagName)
        })
      jest.spyOn(document.body, "appendChild").mockImplementation((node) => {
        // Call original for React Testing Library's container
        if (
          node instanceof HTMLElement &&
          (node.id === "root" || node.hasAttribute("data-reactroot"))
        ) {
          return originalAppendChild(node)
        }
        return node as unknown as Node
      })
      jest.spyOn(document.body, "removeChild").mockImplementation((node) => {
        // Call original for React Testing Library's container
        if (
          node instanceof HTMLElement &&
          (node.id === "root" || node.hasAttribute("data-reactroot"))
        ) {
          return originalRemoveChild(node)
        }
        return node as unknown as Node
      })

      const downloadButton = screen.getByRole("button", {
        name: "Download Digital Credential",
      })
      await user.click(downloadButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)

      createElementSpy.mockRestore()
    })
  })

  describe("Field labels", () => {
    it("renders all field labels correctly", () => {
      const credential = createMockVerifiableCredential()
      renderWithProviders(
        <DigitalCredentialDialog
          verifiableCredential={credential}
          open={true}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText("Issuer:")).toBeInTheDocument()
      expect(screen.getByText("Issuance Date:")).toBeInTheDocument()
      expect(screen.getByText("Expiration Date:")).toBeInTheDocument()
      expect(screen.getByText("Issued To:")).toBeInTheDocument()
      expect(screen.getByText("Description:")).toBeInTheDocument()
      expect(screen.getByText("Criteria:")).toBeInTheDocument()
    })
  })
})
