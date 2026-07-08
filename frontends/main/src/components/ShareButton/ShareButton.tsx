import { styled } from "ol-components"

const ShareButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "4px",
  padding: "14px 12px",
  height: "32px",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  background: `${theme.custom.colors.white}`,
  cursor: "pointer",
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
  fontWeight: theme.typography.fontWeightMedium,
  "&:hover": {
    color: theme.custom.colors.red,
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    justifyContent: "center",
  },
}))

export default ShareButton
