import invariant from "tiny-invariant"
import {
  convertToEmbedUrl,
  externalLinkProps,
  addExternalLinkTargets,
  stripAnchorTags,
} from "./utils"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN
invariant(NEXT_PUBLIC_ORIGIN, "NEXT_PUBLIC_ORIGIN must be defined")

describe("externalLinkProps", () => {
  it("returns blank-target props for an external URL", () => {
    expect(externalLinkProps("https://ocw.mit.edu/courses/123")).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    })
  })

  it("returns extra props only for external URLs", () => {
    const extra = { endIcon: "external" }
    expect(externalLinkProps("https://ocw.mit.edu/courses/123", extra)).toEqual(
      {
        target: "_blank",
        rel: "noopener noreferrer",
        ...extra,
      },
    )
    expect(externalLinkProps("/courses/123", extra)).toEqual({})
  })

  it("returns empty object for an internal absolute URL", () => {
    expect(externalLinkProps(`${NEXT_PUBLIC_ORIGIN}/courses/123`)).toEqual({})
  })

  it("returns empty object for a relative URL", () => {
    expect(externalLinkProps("/courses/123")).toEqual({})
  })

  it("returns empty object for a hash-only href", () => {
    expect(externalLinkProps("#section")).toEqual({})
  })
})

describe("addExternalLinkTargets", () => {
  it("adds target=_blank to external links", () => {
    const html = addExternalLinkTargets('<a href="https://ocw.mit.edu">OCW</a>')
    expect(html).toBe('<a href="https://ocw.mit.edu" target="_blank">OCW</a>')
  })

  it("leaves internal links unchanged", () => {
    const html = addExternalLinkTargets('<a href="/search">Search</a>')
    expect(html).toBe('<a href="/search">Search</a>')
  })

  it("leaves anchors without an href unchanged", () => {
    const html = addExternalLinkTargets('<a name="top">Top</a>')
    expect(html).toBe('<a name="top">Top</a>')
  })

  it("preserves other attributes on external links", () => {
    const html = addExternalLinkTargets(
      '<a href="https://ocw.mit.edu" rel="noopener noreferrer">OCW</a>',
    )
    expect(html).toBe(
      '<a href="https://ocw.mit.edu" rel="noopener noreferrer" target="_blank">OCW</a>',
    )
  })
})

describe("stripAnchorTags", () => {
  it("removes an anchor tag but keeps its text", () => {
    const html = stripAnchorTags('<a href="https://ocw.mit.edu">OCW</a>')
    expect(html).toBe("OCW")
  })

  it("removes multiple anchors within surrounding text", () => {
    const html = stripAnchorTags(
      'Resources: <a href="https://ocw.mit.edu">OCW</a> and <a href="/search">Search</a>.',
    )
    expect(html).toBe("Resources: OCW and Search.")
  })

  it("keeps nested inline markup inside the anchor's text", () => {
    const html = stripAnchorTags('<a href="https://ocw.mit.edu"><b>OCW</b></a>')
    expect(html).toBe("<b>OCW</b>")
  })

  it("leaves text with no anchors unchanged", () => {
    const html = stripAnchorTags("<p>Safe text</p>")
    expect(html).toBe("<p>Safe text</p>")
  })
})

describe("convertToEmbedUrl", () => {
  describe("invalid / unsupported input", () => {
    it("returns null for a non-URL string", () => {
      expect(convertToEmbedUrl("not a url")).toBeNull()
    })

    it("returns null for an unsupported domain", () => {
      expect(convertToEmbedUrl("https://example.com/video/123")).toBeNull()
    })
  })

  describe("YouTube watch URLs", () => {
    it("converts a standard watch URL", () => {
      expect(convertToEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe(
        "https://www.youtube.com/embed/abc123",
      )
    })

    it("returns null when the v param is missing", () => {
      expect(convertToEmbedUrl("https://www.youtube.com/watch")).toBeNull()
    })
  })

  describe("YouTube Shorts URLs", () => {
    it("converts a youtube.com/shorts URL", () => {
      expect(convertToEmbedUrl("https://www.youtube.com/shorts/xyz789")).toBe(
        "https://www.youtube.com/embed/xyz789",
      )
    })

    it("converts a youtu.be/shorts URL", () => {
      expect(convertToEmbedUrl("https://youtu.be/shorts/xyz789")).toBe(
        "https://www.youtube.com/embed/xyz789",
      )
    })
  })

  describe("YouTube short share URLs (youtu.be)", () => {
    it("converts a youtu.be share URL", () => {
      expect(convertToEmbedUrl("https://youtu.be/abc123")).toBe(
        "https://www.youtube.com/embed/abc123",
      )
    })
  })

  describe("YouTube embed URLs (already embedded)", () => {
    it("returns the URL unchanged", () => {
      const url = "https://www.youtube.com/embed/abc123"
      expect(convertToEmbedUrl(url)).toBe(url)
    })
  })

  describe("Vimeo URLs", () => {
    it("converts a vimeo.com URL", () => {
      expect(convertToEmbedUrl("https://vimeo.com/123456789")).toBe(
        "https://player.vimeo.com/video/123456789",
      )
    })
  })

  describe("ODL video URLs", () => {
    it("returns an ODL video URL unchanged", () => {
      const url = "https://video.odl.mit.edu/embed/abc"
      expect(convertToEmbedUrl(url)).toBe(url)
    })
  })
})
