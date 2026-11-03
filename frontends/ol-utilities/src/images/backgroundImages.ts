import { getImageProps } from "next/image"
import type { ImageProps } from "next/image"

/* Generates a CSS `image-set()` declaration for a statically imported image.
 * The Next.js server optimizes the image at resolutions requested, allowing the
 * browser to select the best-suited image size based on the device's pixel density.
 *
 * When image optimization is disabled (next.config `images.unoptimized`),
 * getImageProps returns no `srcSet`, so we fall back to a plain `url(...)`.
 * That single check is sufficient — there is no separate env flag to consult.
 *
 * `quality` is what the optimizer re-encodes at, and 100 is a lot to ask of a
 * photograph: a caller drawing one above the fold should pass a lower figure.
 * It has to be one of next.config's `images.qualities`, since the optimizer
 * refuses any other.
 *
 * https://nextjs.org/docs/app/api-reference/components/image#background-css
 */

export const backgroundSrcSetCSS = (
  image: ImageProps["src"],
  quality = 100,
) => {
  const { props } = getImageProps({
    alt: "",
    quality,
    src: image,
  })

  if (!props.srcSet) {
    return `url("${props.src}")`
  }

  const imageSet = props.srcSet
    .split(", ")
    .map((str) => {
      const [url, dpi] = str.split(" ")
      return `url("${url}") ${dpi}`
    })
    .join(", ")

  return `image-set(${imageSet})`
}
