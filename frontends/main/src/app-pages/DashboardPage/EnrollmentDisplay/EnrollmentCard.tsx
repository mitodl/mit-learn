import React from "react"
import { styled, Stack, Link } from "ol-components"
import type { EnrollmentData } from "./types"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine } from "@remixicon/react"

const CardRoot = styled.div(({ theme }) => ({
  borderStyle: "solid",
  borderColor: theme.custom.colors.lightGray2,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
}))
const Left = styled.div({
  padding: "24px 0px 16px 24px",
  flex: 1,
})
const Right = styled.div({
  padding: "16px",
})
const Bottom = styled.div({
  padding: "0px 24px 16px 24px",
})

const EnrollmentCard: React.FC<EnrollmentData> = ({
  title,
  marketingUrl,
  coursewareUrl,
}) => {
  return (
    <CardRoot>
      <Stack direction="row">
        <Left>
          <Link size="medium" color="black" href={marketingUrl}>
            {title}
          </Link>
        </Left>
        <Right>
          <Stack
            direction="row"
            gap="8px"
            alignItems="start"
            justifyContent="center"
          >
            <ButtonLink
              size="small"
              variant="primary"
              endIcon={<RiArrowRightLine />}
              href={coursewareUrl}
            >
              Continue Course
            </ButtonLink>
          </Stack>
        </Right>
      </Stack>
      <Bottom>{/* Enrollment Card Bottom Content */}</Bottom>
    </CardRoot>
  )
}

export { EnrollmentCard }
