/**
 * @jest-environment @happy-dom/jest-environment
 */
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { useArticleSchema } from "./useArticleSchema"
import type { JSONContent } from "@tiptap/react"

// Mock console methods to avoid noise in test output
const originalError = console.error
let consoleErrorSpy: ReturnType<typeof jest.spyOn>

beforeEach(() => {
  // Suppress expected validation error messages in console.error
  consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation((message) => {
      // Suppress expected validation errors
      if (
        typeof message === "string" &&
        message.includes("Document schema check failed")
      ) {
        return
      }
      originalError(message)
    })
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

const TestComponent = ({
  content,
  enabled,
}: {
  content: JSONContent
  enabled: boolean
}) => {
  const mockUploadHandler = jest
    .fn()
    .mockResolvedValue("http://example.com/image.jpg")
  const mockSetUploadError = jest.fn()

  const { schemaError } = useArticleSchema({
    uploadHandler: mockUploadHandler,
    setUploadError: mockSetUploadError,
    enabled,
    content,
  })

  return (
    <div>
      {schemaError && <div data-testid="schema-error">{schemaError}</div>}
      {!schemaError && <div data-testid="no-error">No error</div>}
    </div>
  )
}

describe("useArticleSchema", () => {
  describe("schema validation", () => {
    test("show schema error when document is not valid ProseMirror content", async () => {
      const content: JSONContent = {
        some: "random",
      }
      render(<TestComponent content={content} enabled />)

      await screen.findByText(
        "Document schema check failed: Invalid content for node doc: content specification not satisfied",
      )
    })

    test("show schema error when document is not valid ProseMirror JSON", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "invalid",
          },
        ],
      }
      render(<TestComponent content={content} enabled />)

      await screen.findByText(
        'Document schema check failed: Invalid content for node doc: node type "invalid" not found in schema',
      )
    })

    test("shows schema error when document does not confirm to content expression (missing banner and byline)", async () => {
      // Content missing required banner and byline
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Content paragraph",
              },
            ],
          },
        ],
      }

      render(<TestComponent content={content} enabled />)

      await screen.findByText(
        "Document schema check failed: Invalid content for node doc: paragraph is not allowed in this position",
      )
    })

    test("shows no error when content is valid", async () => {
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "banner",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: "Title" }],
              },
              {
                type: "paragraph",
                content: [],
              },
            ],
          },
          {
            type: "byline",
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Content paragraph" }],
          },
        ],
      }

      render(<TestComponent content={content} enabled />)

      await waitFor(() => {
        expect(screen.getByTestId("no-error")).toBeInTheDocument()
      })
    })

    test("shows no error when enabled is false", async () => {
      // Invalid content, but validation should be skipped
      const content: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Content paragraph",
              },
            ],
          },
        ],
      }

      render(<TestComponent content={content} enabled={false} />)

      await waitFor(() => {
        expect(screen.getByTestId("no-error")).toBeInTheDocument()
      })
    })
  })
})
