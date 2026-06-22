import React from "react"
import { styled } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"

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
  background: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
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

const FeatureIcon = styled(RiCheckLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.green,
  flexShrink: 0,
}))

const DeadlineNote = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold,
  textDecoration: "underline",
  color: theme.custom.colors.darkGray2,
}))

type LearnForFreeCardProps = {
  productNoun: "course" | "program"
  certificateDeadlineNote?: boolean
  action?: React.ReactNode
}

const LearnForFreeCard: React.FC<LearnForFreeCardProps> = ({
  productNoun,
  certificateDeadlineNote,
  action,
}) => {
  return (
    <CardShell>
      <CardBody>
        <TopRow>
          <LeftCol>
            <TrackTitle>Learn for Free</TrackTitle>
            <TrackSubtitle>Audit this {productNoun}</TrackSubtitle>
          </LeftCol>
          <PriceContainer>Free</PriceContainer>
        </TopRow>

        {certificateDeadlineNote && (
          <DeadlineNote>Certificate deadline passed</DeadlineNote>
        )}

        <FeatureList>
          <FeatureRow>
            <FeatureIcon aria-hidden="true" />
            <span>Access to this {productNoun} &amp; course materials</span>
          </FeatureRow>
        </FeatureList>

        {action}
      </CardBody>
    </CardShell>
  )
}

export default LearnForFreeCard
