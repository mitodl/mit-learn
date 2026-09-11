import { buildVideoStructuredData } from "./videoStructuredData"
import type { VideoResource } from "api/v1"

/*
 * schema.org values are plain text, but OVS descriptions are now rich text, so
 * the builder has to strip markup. Two things have gone wrong here before and
 * are pinned by the cases below:
 *
 *  - a single-pass tag strip is not idempotent, so removing one match can join
 *    its neighbours into a new tag (CodeQL: incomplete multi-character
 *    sanitization). This value lands inside a <script> block.
 *  - only some block tags were treated as boundaries, so <div>a</div><div>b</div>
 *    came out as "ab".
 */
const videoWith = (description: string): VideoResource =>
  ({
    id: 1,
    title: "Session 3",
    description,
    last_modified: "2026-01-01T00:00:00Z",
  }) as unknown as VideoResource

const descriptionOf = (html: string): string => {
  const data = buildVideoStructuredData(videoWith(html))
  return (data?.description as string) ?? ""
}

describe("buildVideoStructuredData description", () => {
  test("strips the markup an OVS description carries", () => {
    expect(descriptionOf("<p>How <strong>markets</strong> price it.</p>")).toBe(
      "How markets price it.",
    )
  })

  test.each([
    ["p", "<p>First</p><p>Second</p>"],
    ["div", "<div>First</div><div>Second</div>"],
    [
      "blockquote",
      "<blockquote>First</blockquote><blockquote>Second</blockquote>",
    ],
    ["pre", "<pre>First</pre><pre>Second</pre>"],
    ["li", "<ul><li>First</li><li>Second</li></ul>"],
    ["caption", "<caption>First</caption><caption>Second</caption>"],
    ["center", "<center>First</center><center>Second</center>"],
    ["q", "<q>First</q><q>Second</q>"],
  ])(
    "treats </%s> as a boundary rather than running words together",
    (_tag, html) => {
      // Every block tag main/constants.py ALLOWED_HTML_TAGS keeps has to separate.
      expect(descriptionOf(html)).toBe("First Second")
    },
  )

  test.each([
    ["br", "First<br>Second"],
    ["hr", "First<hr>Second"],
  ])("treats <%s> as a boundary", (_tag, html) => {
    expect(descriptionOf(html)).toBe("First Second")
  })

  test.each([
    ["nested-tag reconstitution", "<scr<div>ipt>alert(1)</scr<div>ipt>"],
    ["doubled brackets", "<<script>script>x<</script>/script>"],
    ["entity-encoded tags", "&lt;script&gt;alert(1)&lt;/script&gt;"],
  ])("leaves no angle bracket for %s", (_name, html) => {
    const result = descriptionOf(html)
    expect(result).not.toContain("<")
    expect(result).not.toContain(">")
  })

  test("decodes the entities the sanitizer emits", () => {
    expect(descriptionOf("<p>Sessions 1 &amp; 2</p>")).toBe("Sessions 1 & 2")
  })

  test("omits the description entirely when there is none", () => {
    const data = buildVideoStructuredData(videoWith(""))
    expect(data).not.toHaveProperty("description")
  })
})
