import React from "react"
import { styled, VisuallyHidden, Button } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { CourseSummary, ProgramBundleUpsell } from "./ProductSummary"
import CourseEnrollmentButton from "./CourseEnrollmentButton"

/**
 * Outer card wrapper: border, shadow, radius. No padding — children control
 * their own insets so that elements like the bundle upsell can span edge-to-edge.
 */
export const SummaryCard = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  overflow: "hidden",
}))

/** Padded content area inside the summary card. */
export const SummaryContent = styled.div(({ theme }) => ({
  padding: "24px",
  [theme.breakpoints.up("md")]: {
    padding: "24px 32px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

export const EnrollArea = styled.div(({ theme }) => ({
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

type CourseInfoBoxProps = {
  course: CourseWithCourseRunsSerializerV2
}

const CourseInfoBox: React.FC<CourseInfoBoxProps> = ({ course }) => {
  return (
    <>
      <SummaryCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Course summary</h2>
        </VisuallyHidden>
        <SummaryContent>
          <CourseSummary course={course} />
        </SummaryContent>
        <EnrollArea>
          <CourseEnrollmentButton course={course} />
        </EnrollArea>
        {course.programs?.length ? (
          <ProgramBundleUpsell programs={course.programs} />
        ) : null}
      </SummaryCard>
      <AskTimButton
        variant="bordered"
        size="large"
        startIcon={<RiSparkling2Line />}
        onClick={() => void 0}
        data-testid="ask-tim-button"
      >
        AskTIM about this course
      </AskTimButton>
    </>
  )
}

export default CourseInfoBox
