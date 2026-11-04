import React from "react"
import type { NextRequest } from "next/server"
import { render, screen } from "@testing-library/react"
import { pdf } from "@react-pdf/renderer"
import { factories, setMockResponse } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { GET } from "./route"
import { pxToPt } from "./utils"

jest.mock("@react-pdf/renderer", () => {
  const primitive =
    (name: string) =>
    ({
      style,
      children,
    }: {
      style?: { lineHeight?: number }
      children?: React.ReactNode
    }) => (
      <div data-testid={`pdf-${name}`} data-line-height={style?.lineHeight}>
        {children}
      </div>
    )
  return {
    Document: primitive("Document"),
    Page: primitive("Page"),
    View: primitive("View"),
    Text: primitive("Text"),
    Svg: primitive("Svg"),
    G: primitive("G"),
    Path: primitive("Path"),
    Image: primitive("Image"),
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
    pdf: jest.fn(() => ({
      toBuffer: jest.fn().mockResolvedValue(Buffer.from("")),
    })),
  }
})

describe("Certificate PDF", () => {
  describe("pxToPt", () => {
    it("maps the 1414 x 1093px Figma frame onto Letter landscape (792 x 612pt)", () => {
      expect(pxToPt(1414)).toBeCloseTo(792)
      expect(pxToPt(1093)).toBeCloseTo(612, 0)
      expect(pxToPt(0)).toBe(0)
    })
  })

  // react-pdf multiplies a unitless lineHeight by fontSize, so a point value
  // passed as a bare number puts lines hundreds of points apart (hq#13842).
  it("gives every text line height as a ratio of its font size", async () => {
    const certificate = factories.mitxonline.programCertificate()
    // The two-line badge label only appears on program certificates
    certificate.program.program_type = "Series"
    setMockResponse.get(
      mitxonline.urls.certificates.programCertificatesRetrieve({
        uuid: certificate.uuid,
      }),
      certificate,
    )

    await GET({} as NextRequest, {
      params: Promise.resolve({
        certificateType: "program",
        uuid: certificate.uuid,
      }),
    })

    render(jest.mocked(pdf).mock.calls[0][0])
    const lineHeights = screen
      .getAllByTestId("pdf-Text")
      .map((el) => el.getAttribute("data-line-height"))
      .filter((value) => value !== null)
      .map(Number)

    expect(lineHeights.length).toBeGreaterThan(0)
    lineHeights.forEach((lineHeight) => {
      expect(lineHeight).toBeGreaterThanOrEqual(1)
      expect(lineHeight).toBeLessThanOrEqual(2)
    })
  })
})
