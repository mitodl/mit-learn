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

const ReqDescription = styled("p")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
  margin: "4px 0 0",
}))

export { RequirementsListing, ReqSubsectionTitle, ReqTitleNote, ReqDescription }
