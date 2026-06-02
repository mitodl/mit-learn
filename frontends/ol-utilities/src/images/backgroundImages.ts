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
 * https://nextjs.org/docs/app/api-reference/components/image#background-css
 */

export const backgroundSrcSetCSS = (image: ImageProps["src"]) => {
  const { props } = getImageProps({
    alt: "",
    quality: 100,
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
