import DOMPurify from "isomorphic-dompurify"
import { htmlToPlainText } from "./htmlToPlainText"

describe("htmlToPlainText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToPlainText("<p>Daryl Morey &amp; Jessica Gelman</p>")).toBe(
      "Daryl Morey & Jessica Gelman",
    )
  })

  it("keeps a space between adjacent block-level elements", () => {
    expect(htmlToPlainText("<p>First</p><p>Second</p>")).toBe("First Second")
  })

  it("keeps a space where a <br> separates lines", () => {
    expect(htmlToPlainText("Line one<br>Line two")).toBe("Line one Line two")
  })

  it("keeps a space between adjacent table cells", () => {
    expect(
      htmlToPlainText("<table><tr><td>A</td><td>B</td></tr></table>"),
    ).toBe("A B")
  })

  it("keeps a space after a blockquote or pre block", () => {
    expect(
      htmlToPlainText("<blockquote>Quote</blockquote><pre>Code</pre>Text"),
    ).toBe("Quote Code Text")
  })

  it("strips links but keeps their text", () => {
    expect(
      htmlToPlainText('<p><a href="https://ocw.mit.edu">OCW</a> resources</p>'),
    ).toBe("OCW resources")
  })

  it("leaves plain text unchanged", () => {
    expect(htmlToPlainText("Just plain text")).toBe("Just plain text")
  })

  it("returns an empty string for empty input", () => {
    expect(htmlToPlainText("")).toBe("")
  })

  // Output-level guards on the two behaviours the fast path must not drop.
  // The entity case is the one that genuinely distinguishes the paths: skipping
  // sanitize for "&" input would leave the entity undecoded.
  it("decodes entities in text that has no tags", () => {
    expect(htmlToPlainText("Tom &amp; Jerry")).toBe("Tom & Jerry")
  })

  it("collapses whitespace in text that has no tags or entities", () => {
    expect(htmlToPlainText("  Spaced   out\n\ttext  ")).toBe("Spaced out text")
  })

  it("leaves a bare > in markup-free text alone", () => {
    expect(htmlToPlainText("2 > 1")).toBe("2 > 1")
  })

  // Avoiding the jsdom allocation is this change's actual contract, and no
  // assertion on the return value can pin it -- DOMPurify round-trips
  // markup-free input unchanged, so an output-only test passes either way.
  // These assert on whether sanitize ran.
  describe("markup-free fast path", () => {
    let sanitize: jest.SpyInstance

    beforeEach(() => {
      sanitize = jest.spyOn(DOMPurify, "sanitize")
    })

    afterEach(() => {
      sanitize.mockRestore()
    })

    it.each([
      ["plain text", "Just plain text"],
      ["the default site description", "Learn with MIT"],
      ["a bare greater-than", "2 > 1"],
      ["text needing whitespace collapsing", "  Spaced   out\n\ttext  "],
    ])("does not sanitize %s", (_label, input) => {
      htmlToPlainText(input)
      expect(sanitize).not.toHaveBeenCalled()
    })

    // The other direction: widening the guard so entities or tags skip
    // sanitizing would be a correctness bug, not an optimisation.
    it.each([
      ["tags", "<p>Hello</p>"],
      ["entities", "Tom &amp; Jerry"],
    ])("still sanitizes input containing %s", (_label, input) => {
      htmlToPlainText(input)
      expect(sanitize).toHaveBeenCalled()
    })
  })
})
