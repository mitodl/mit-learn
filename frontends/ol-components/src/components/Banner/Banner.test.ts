import { standardizeBackgroundUrl } from "./Banner"

/**
 * `banner_background` holds whatever an editor configured: usually a bare
 * src, sometimes a value already written as a CSS function. Both have to
 * survive into a `background-image`, and the browser drops the whole
 * declaration rather than complaining when they do not.
 */
describe("standardizeBackgroundUrl", () => {
  test("wraps and quotes a bare src", () => {
    expect(standardizeBackgroundUrl("/images/banner.jpg")).toBe(
      "url('/images/banner.jpg')",
    )
  })

  /* Unquoted `url()` takes neither, so quoting is what keeps them usable. */
  test.each([
    { src: "/images/a photo.jpg", label: "a space" },
    { src: "/images/photo(1).jpg", label: "a parenthesis" },
  ])("quotes a src containing $label", ({ src }) => {
    expect(standardizeBackgroundUrl(src)).toBe(`url('${src}')`)
  })

  /* Wrapping these again nests the function, which CSS rejects outright. */
  test.each([
    "url('/images/banner.jpg')",
    'url("/images/banner.jpg")',
    "image-set(url('/images/banner.jpg') 1x)",
  ])("passes through %s untouched", (value) => {
    expect(standardizeBackgroundUrl(value)).toBe(value)
  })
})
