import { PlainList, Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"

const RequirementsListing = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  marginTop: "24px",
})

const ReqSubsectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  fontSize: theme.typography.pxToRem(20), // boosted size
})) as typeof Typography

const ReqTitleNote = styled("span")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
}))

export { RequirementsListing, ReqSubsectionTitle, ReqTitleNote }
