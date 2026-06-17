import React from "react"
import { styled } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { formatPrice } from "@/common/mitxonline"

const CardShell = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
  alignSelf: "stretch",
  marginBottom: "16px",
})

const CardBody = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: "16px",
  gap: "16px",
  background: theme.custom.colors.lightGray1,
  borderRadius: "8px",
  alignSelf: "stretch",
  boxSizing: "border-box",
}))

const TopRow = styled.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  gap: "8px",
  width: "100%",
})

const LeftCol = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
  flexGrow: 1,
})

const TrackTitle = styled.div(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
}))

const TrackSubtitle = styled.div(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.darkGray2,
}))

const Price = styled.div(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
}))

const FeatureList = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  width: "100%",
})

const FeatureRow = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "4px",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
}))

const FeatureIcon = styled(RiCheckLine)({
  width: "16px",
  height: "16px",
  color: "#00AD00",
  flexShrink: 0,
})

type ProgramAsCourseCertificateTrackCardProps = {
  program: V2ProgramDetail
}

const ProgramAsCourseCertificateTrackCard: React.FC<
  ProgramAsCourseCertificateTrackCardProps
> = ({ program }) => {
  const currentPrice = program.products?.[0]?.price
  const displayPrice = currentPrice
    ? formatPrice(currentPrice, { avoidCents: true })
    : "Price unavailable"

  return (
    <CardShell>
      <CardBody>
        <TopRow>
          <LeftCol>
            <TrackTitle>Certificate Track</TrackTitle>
            <TrackSubtitle>
              Earn a verified certificate of completion
            </TrackSubtitle>
          </LeftCol>
          <Price>{displayPrice}</Price>
        </TopRow>

        <FeatureList>
          <FeatureRow>
            <FeatureIcon aria-hidden="true" />
            <span>Access to this course and course materials</span>
          </FeatureRow>
          <FeatureRow>
            <FeatureIcon aria-hidden="true" />
            <span>Graded assignments and exams</span>
          </FeatureRow>
          <FeatureRow>
            <FeatureIcon aria-hidden="true" />
            <span>MIT certificate on completion</span>
          </FeatureRow>
        </FeatureList>
      </CardBody>
    </CardShell>
  )
}

export default ProgramAsCourseCertificateTrackCard
