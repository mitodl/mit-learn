import { styled, Button } from "@mitodl/smoot-design"

/**
 * Outer card wrapper: border, shadow, radius. No padding — children control
 * their own insets so that elements like the bundle upsell can span edge-to-edge.
 */
export const InfoBoxCard = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  overflow: "hidden",
}))

/** Padded content area inside the summary card. */
export const InfoBoxContent = styled.div(({ theme }) => ({
  padding: "24px",
  [theme.breakpoints.up("md")]: {
    padding: "24px 32px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

export const InfoBoxEnrollArea = styled.div(({ theme }) => ({
  padding: "8px 24px 24px",
  [theme.breakpoints.up("md")]: {
    padding: "8px 32px 24px",
  },
  [theme.breakpoints.between("sm", "md")]: {
    maxWidth: "50%",
    marginInline: "auto",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "8px 16px 16px",
  },
}))

export const AskTimButton = styled(Button)(({ theme }) => ({
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
  marginTop: "16px",
  width: "100%",
  [theme.breakpoints.between("sm", "md")]: {
    width: "auto",
  },
  color: theme.custom.colors.darkGray2,
  svg: {
    color: theme.custom.colors.mitRed,
  },
}))
