import React from "react"
import { Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"
import { HeadingIds } from "./util"
import type { ProductNoun } from "./util"

const WhoCanTakeSectionRoot = styled.section(({ theme }) => ({
  padding: "32px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.lightGray1,
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  ...theme.typography.body1,
  lineHeight: "1.5",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
    gap: "16px",
    ...theme.typography.body2,
  },
}))

const WhoCanTakeSection: React.FC<{ productNoun: ProductNoun }> = ({
  productNoun,
}) => {
  return (
    <WhoCanTakeSectionRoot aria-labelledby={HeadingIds.WhoCanTake}>
      <Typography variant="h4" component="h2" id={HeadingIds.WhoCanTake}>
        Who can take this {productNoun}?
      </Typography>
      Because of U.S. Office of Foreign Assets Control (OFAC) restrictions and
      other U.S. federal regulations, learners residing in one or more of the
      following countries or regions will not be able to register for this{" "}
      {productNoun.toLowerCase()}: Iran, Cuba, North Korea and the Crimea,
      Donetsk People's Republic and Luhansk People's Republic regions of
      Ukraine.
    </WhoCanTakeSectionRoot>
  )
}

export default WhoCanTakeSection
