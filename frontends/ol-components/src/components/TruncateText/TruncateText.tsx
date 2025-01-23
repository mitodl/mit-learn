import { styled } from "@pigment-css/react"

type TruncateTextProps = {
  /**
   * Number of lines to display before truncating text.
   */
  lineClamp?: number | "none"
}

/**
 * Truncate the content after specified number of lines.
 */
const TruncateText = styled("div")<TruncateTextProps>({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  textOverflow: "ellipsis",
  WebkitLineClamp: ({ lineClamp }) => lineClamp,
  // TODO pigment
  // [`@supports (-webkit-line-clamp: ${lines})`]: {
  //   whiteSpace: "initial",
  //   display: "-webkit-box",
  //   WebkitLineClamp: `${lines}`, // cast to any to avoid typechecking error in lines,
  //   WebkitBoxOrient: "vertical",
  // },
})

// export { TruncateText, truncateText }
export { TruncateText }
export type { TruncateTextProps }
