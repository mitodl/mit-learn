import React from "react"
import { styled } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"
import { theme } from "ol-components"

const CardShell = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
  alignSelf: "stretch",
})

const CardBody = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "16px",
  gap: "16px",
  background: theme.custom.colors.lightGray1,
  borderRadius: theme.shape.borderRadius,
  alignSelf: "stretch",
  boxSizing: "border-box",
}))

const TopRow = styled.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
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

const TrackTitle = styled.h3(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const TrackSubtitle = styled.div(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.darkGray2,
}))

const PriceContainer = styled.div(({ theme }) => ({
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
  color: theme.custom.colors.green,
  flexShrink: 0,
})

const FinancialAidLink = styled.a(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  textDecoration: "underline",
}))

type CertificateTrackCardProps = {
  price: React.ReactNode
  financialAid?: { href: string; applied: boolean } | null
  productNoun: "course" | "program"
  action?: React.ReactNode
}

const CertificateTrackCard: React.FC<CertificateTrackCardProps> = ({
  price,
  financialAid,
  productNoun,
  action,
}) => {
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
          <PriceContainer>{price}</PriceContainer>
        </TopRow>

        <FeatureList>
          <FeatureRow>
            <FeatureIcon aria-hidden="true" />
            <span>Access to this {productNoun} &amp; course materials</span>
          </FeatureRow>
          <FeatureRow>
            <FeatureIcon aria-hidden="true" />
            <span>Graded assignments &amp; exams</span>
          </FeatureRow>
          <FeatureRow>
            <FeatureIcon aria-hidden="true" />
            <span>MIT certificate on completion</span>
          </FeatureRow>
        </FeatureList>

        {financialAid !== null && financialAid !== undefined && (
          <FinancialAidLink href={financialAid.href}>
            {financialAid.applied
              ? "Financial assistance applied"
              : "Financial assistance available"}
          </FinancialAidLink>
        )}

        {action !== null && action !== undefined && action}
      </CardBody>
    </CardShell>
  )
}

export default CertificateTrackCard
