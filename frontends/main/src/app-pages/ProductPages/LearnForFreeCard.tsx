import React from "react"
import { styled } from "@mitodl/smoot-design"
import TrackCard, { FeatureRow, FeatureIcon } from "./TrackCard"

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
  fill?: boolean
}

const LearnForFreeCard: React.FC<LearnForFreeCardProps> = ({
  productNoun,
  certificateDeadlineNote,
  action,
  fill,
}) => {
  return (
    <TrackCard
      variant="bordered"
      title="Learn for Free"
      subtitle={`Audit this ${productNoun}`}
      price="Free"
      action={action}
      fill={fill}
      note={
        certificateDeadlineNote ? (
          <DeadlineNote>Certificate deadline passed</DeadlineNote>
        ) : undefined
      }
    >
      <FeatureRow>
        <FeatureIcon aria-hidden="true" />
        <span>
          {productNoun === "program"
            ? "Access to this program & materials"
            : "Access to this course & course materials"}
        </span>
      </FeatureRow>
    </TrackCard>
  )
}

export default LearnForFreeCard
