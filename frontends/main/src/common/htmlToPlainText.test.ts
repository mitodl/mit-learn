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

  // The markup-free fast path returns without sanitizing. These pin the two
  // behaviours it would silently drop if its guard were widened to skip them.
  it("decodes entities in text that has no tags", () => {
    expect(htmlToPlainText("Tom &amp; Jerry")).toBe("Tom & Jerry")
  })

  it("collapses whitespace in text that has no tags or entities", () => {
    expect(htmlToPlainText("  Spaced   out\n\ttext  ")).toBe("Spaced out text")
  })

  it("leaves a bare > in markup-free text alone", () => {
    expect(htmlToPlainText("2 > 1")).toBe("2 > 1")
  })
})
