import styled from "@emotion/styled"

type PlainListProps = {
  /**
   * If disabled, list will be rendered with reduced opacity.
   */
  disabled?: boolean
  /**
   * Spacing between list items, in units of the theme's spacing.
   */
  itemSpacing?: number | string
}

/**
 * A list with no padding, margins, or bullets. Optionally specify a spacing
 * between list items.
 */
const PlainList = styled.ul<PlainListProps>(
  ({ theme, itemSpacing, disabled }) => [
    {
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
    },
    itemSpacing && {
      "> li + li": {
        marginTop: theme.spacing(itemSpacing),
      },
    },
    disabled && { opacity: 0.5 },
  ],
)

export { PlainList }
export type { PlainListProps }
