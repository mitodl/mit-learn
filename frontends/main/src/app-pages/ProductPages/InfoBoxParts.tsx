import { styled } from "@mitodl/smoot-design"

/**
 * Outer card wrapper: border, shadow, radius. No padding — children control
 * their own insets so that elements like the bundle upsell can span edge-to-edge.
 */
export const InfoBoxCard = styled.div(({ theme }) => ({
  // Fill the column. Required because InfoBoxColumn uses `align-items:
  // flex-start` on tablet (to left-align the 320px Ask TIM card), which would
  // otherwise shrink this width-less flex child to its content.
  width: "100%",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  overflow: "hidden",
}))

export const InfoBoxColumn = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  width: "100%",
  /** Tablet: Ask TIM card is 320px wide, left-aligned below the InfoBox. */
  [theme.breakpoints.between("sm", "md")]: {
    alignItems: "flex-start",
  },
}))
