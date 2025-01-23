import { styled } from "@pigment-css/react"

type PlainListProps = {
  /**
   * If disabled, list will be rendered with reduced opacity.
   */
  disabled?: boolean
  /**
   * Spacing between list items, in units of the theme's spacing.
   */
  itemSpacing?: number
}

/**
 * A list with no padding, margins, or bullets. Optionally specify a spacing
 * between list items.
 */
const PlainList = styled("ul")<PlainListProps>(({ theme }) => ({
  paddingLeft: 0,
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  marginBottom: 0,
  "> li": {
    listStyle: "none",
    marginTop: 0,
    marginBottom: 0,
  },
  "> li + li": {
    marginTop: ({ itemSpacing }) =>
      itemSpacing ? theme.spacing(itemSpacing) : "0",
  },
  variants: [
    {
      props: { disabled: true },
      style: {
        opacity: 0.5,
      },
    },
  ],
}))

export { PlainList }
export type { PlainListProps }
