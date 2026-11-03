import { pxToPt } from "./utils"

jest.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  View: "View",
  Text: "Text",
  Svg: "Svg",
  G: "G",
  Path: "Path",
  Font: {
    register: jest.fn(),
    registerHyphenationCallback: jest.fn(),
  },
  Image: "Image",
  pdf: jest.fn(),
}))

describe("Certificate PDF", () => {
  describe("pxToPt", () => {
    it("maps the 1414 x 1093px Figma frame onto Letter landscape (792 x 612pt)", () => {
      expect(pxToPt(1414)).toBeCloseTo(792)
      expect(pxToPt(1093)).toBeCloseTo(612, 0)
      expect(pxToPt(0)).toBe(0)
    })
  })
})
