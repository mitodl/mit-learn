import { getImageProps } from "next/image"
import type { ImageProps } from "next/image"

/* Generates a CSS `image-set()` declaration for a statically imported image.
 * The Next.js server optimizes the image at resolutions requested, allowing the
 * browser to select the best-suited image size based on the device's pixel density.
 *
 * https://nextjs.org/docs/app/api-reference/components/image#background-css
 */

export const backgroundSrcSetCSS = (image: ImageProps["src"]) => {
  const { props } = getImageProps({
    alt: "",
    quality: 100,
    src: image,
  })

  const imageSet = props.srcSet
    ?.split(", ")
    .map((str) => {
      const [url, dpi] = str.split(" ")
      return `url("${url}") ${dpi}`
    })
    .join(", ")

  return `image-set(${imageSet})`
}
