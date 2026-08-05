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
})
