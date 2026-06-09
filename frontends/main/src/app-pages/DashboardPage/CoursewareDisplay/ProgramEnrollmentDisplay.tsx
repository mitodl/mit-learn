import React from "react"
import { Skeleton, Stack, Typography, styled, theme } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { ResourceType, getKey } from "./model/dashboardViewModel"
import { CoursewareCard } from "./CoursewareCard"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"
import { ProgramAsCourseCard } from "./ProgramAsCourseCard"
import { RiAwardFill } from "@remixicon/react"
import { useProgramDashboardData } from "./hooks/useProgramDashboardData"

const CourseEntryCardStyled = styled(CoursewareCard)({
  borderRadius: "8px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
})

const ProgramEnrollmentCard = styled(CoursewareCard)({
  borderRadius: "8px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
})

export const ProgramCertificateButton = styled(ButtonLink)(({ theme }) => ({
  color: theme.custom.colors.red,
  width: "120px",
}))

interface ProgramEnrollmentDisplayProps {
  programId: number
}

const ProgramEnrollmentDisplay: React.FC<ProgramEnrollmentDisplayProps> = ({
  programId,
}) => {
  const data = useProgramDashboardData(programId)

  if (data.isLoading) {
    return (
      <Stack direction="column">
        <Stack direction="column" marginBottom="56px">
          <Skeleton variant="text" width="30%" height={24} />
          <Skeleton variant="text" width="50%" height={32} />
        </Stack>
        <Skeleton variant="rectangular" width="50%" height={24} />
        <Stack direction="column" spacing={2} paddingTop="16px">
          <Skeleton variant="rectangular" width="100%" height={64} />
          <Skeleton variant="rectangular" width="100%" height={64} />
          <Skeleton variant="rectangular" width="100%" height={64} />
        </Stack>
      </Stack>
    )
  }
  if (!data.enrolledInProgram) {
    return <NotFoundPage />
  }
  return (
    <Stack direction="column">
      <Stack direction="column" marginBottom="24px">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h5" color={theme.custom.colors.silverGrayDark}>
            Program
            {data.programType ? `: ${data.programType}` : ""}
          </Typography>
        </Stack>
        <Typography component="h1" variant="h3" paddingBottom="32px">
          {data.programTitle}
        </Typography>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2">
            You have completed
            <Typography component="span" variant="subtitle2">
              {` ${data.completedCount} of ${data.totalCount} courses `}
            </Typography>
            for this program.
          </Typography>
          <Stack direction="column" alignItems="flex-end" gap="8px">
            {data.programCertificateUrl && (
              <ProgramCertificateButton
                variant="bordered"
                size="small"
                startIcon={<RiAwardFill />}
                href={data.programCertificateUrl}
              >
                Certificate
              </ProgramCertificateButton>
            )}
          </Stack>
        </Stack>
      </Stack>
      {data.sections.map((section, index) => {
        return (
          <React.Fragment key={section.key}>
            <Stack
              direction="row"
              justifyContent="space-between"
              marginBottom="16px"
              marginTop={index > 0 ? "32px" : "0"}
            >
              <Typography
                component="h2"
                variant="subtitle2"
                color={theme.custom.colors.red}
              >
                {section.title}
              </Typography>
              {section.total > 0 ? (
                <Typography
                  data-testid="section-completion-count"
                  variant="body2"
                  color={theme.custom.colors.silverGrayDark}
                >
                  Completed {section.completed} of {section.total}
                </Typography>
              ) : null}
            </Stack>
            <Stack direction="column" gap="16px">
              {section.items.map((item) => {
                if (item.kind === "course") {
                  return (
                    <CourseEntryCardStyled
                      key={getKey({
                        resourceType: ResourceType.Course,
                        id: item.entry.course.id,
                        runId:
                          item.entry.displayedEnrollment?.run.id ??
                          item.entry.displayedRun?.id,
                      })}
                      entry={item.entry}
                      showNotComplete={false}
                    />
                  )
                }

                if (item.kind === "program-as-course") {
                  return (
                    <ProgramAsCourseCard
                      key={getKey({
                        resourceType: ResourceType.Program,
                        id: item.courseProgram.id,
                      })}
                      courseProgram={item.courseProgram}
                      moduleCourses={item.moduleCourses}
                      moduleEnrollmentsByCourseId={data.enrollmentsByCourseId}
                      courseProgramEnrollment={item.courseProgramEnrollment}
                      ancestorProgramEnrollment={data.ancestorProgramEnrollment}
                    />
                  )
                }

                // program-enrollment arm: still uses legacy DashboardCard until Phase 7b
                return (
                  <ProgramEnrollmentCard
                    key={getKey({
                      resourceType: ResourceType.Program,
                      id: item.enrollment.program.id,
                    })}
                    variant="program"
                    programEnrollment={item.enrollment}
                    showNotComplete={false}
                  />
                )
              })}
            </Stack>
          </React.Fragment>
        )
      })}
    </Stack>
  )
}

export { ProgramEnrollmentDisplay }
