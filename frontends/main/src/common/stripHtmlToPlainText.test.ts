import { stripHtmlToPlainText } from "./stripHtmlToPlainText"

test("drops tags and keeps the text", () => {
  expect(
    stripHtmlToPlainText("<p>How <strong>markets</strong> price it.</p>"),
  ).toBe("How markets price it.")
})

test.each([
  "<p>First</p><p>Second</p>",
  "<div>First</div><div>Second</div>",
  "<li>First</li><li>Second</li>",
  "First<br>Second",
])("treats a block boundary as a space: %s", (html) => {
  expect(stripHtmlToPlainText(html)).toBe("First Second")
})

test("decodes the entities the sanitizer emits", () => {
  expect(stripHtmlToPlainText("<p>Sessions 1 &amp; 2</p>")).toBe(
    "Sessions 1 & 2",
  )
})

test("collapses whitespace and trims", () => {
  expect(stripHtmlToPlainText("<p>  Spaced   out\n\ttext  </p>")).toBe(
    "Spaced out text",
  )
})

test("strips to empty when there is only markup and whitespace", () => {
  expect(stripHtmlToPlainText("<p>&nbsp;</p>")).toBe("")
})

// The output lands inside a JSON-LD <script> block, so it must not be able to
// contribute to a tag however the input is nested or encoded.
test.each([
  "<scr<div>ipt>alert(1)</scr<div>ipt>",
  "&lt;script&gt;alert(1)&lt;/script&gt;",
  "&amp;lt;script&amp;gt;",
  "<p>unterminated <span",
])("leaves no angle bracket behind: %s", (html) => {
  expect(stripHtmlToPlainText(html)).not.toMatch(/[<>]/)
})
