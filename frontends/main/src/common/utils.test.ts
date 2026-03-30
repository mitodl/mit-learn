import { convertToEmbedUrl, externalLinkProps } from "./utils"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN!

describe("externalLinkProps", () => {
  it("returns blank-target props for an external URL", () => {
    expect(externalLinkProps("https://ocw.mit.edu/courses/123")).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    })
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
