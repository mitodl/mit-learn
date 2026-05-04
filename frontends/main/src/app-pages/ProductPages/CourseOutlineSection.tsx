"use client"

import React from "react"
import { Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"
import type { CourseOutlineModule } from "api/mitxonline-hooks/courses"
import { HeadingIds } from "./util"

const SectionRoot = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const SummaryText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
}))

const ModuleStack = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
})

const ModuleShell = styled.article(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "24px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.lightGray1,
}))

const TitleBlock = styled.div({
  width: "100%",
  minHeight: "24px",
})

const ModuleTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontSize: "16px",
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: 1.5,
  color: theme.custom.colors.darkGray2,
}))

const ModuleSubtitle = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  fontSize: "12px",
  lineHeight: "16px",
  color: theme.custom.colors.silverGrayDark,
  display: "inline-flex",
  flexWrap: "wrap",
  rowGap: "4px",
}))

const getModuleTitle = (module: CourseOutlineModule, index: number): string => {
  if (module.title && module.title.trim().length > 0) {
    return module.title
  }
  return `Module ${index + 1}`
}

const formatHours = (seconds: number): string => {
  const hours = seconds / 3600
  // Keep one decimal for short modules, but avoid trailing ".0".
  const rounded = hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}

const formatEffort = (seconds?: number | null): string | null => {
  if (seconds === undefined || seconds === null || seconds <= 0) {
    return null
  }
  if (seconds < 3600) {
    return "Less than 1 hour to complete"
  }
  const hourLabel = formatHours(seconds)
  const isSingular = Number(hourLabel) === 1
  return `${hourLabel} ${isSingular ? "hour" : "hours"} to complete`
}

const formatCount = (
  count: number,
  singularLabel: string,
  pluralLabel: string,
): string => `${count} ${count === 1 ? singularLabel : pluralLabel}`

const getMetaLine = (module: CourseOutlineModule): string => {
  const counts = module.counts ?? {}
  const videos = counts.videos ?? 0
  const readings = counts.readings ?? 0
  const assignments = counts.assignments ?? 0

  const metaParts = [
    formatCount(videos, "Video", "Videos"),
    formatCount(readings, "Reading", "Readings"),
    formatCount(assignments, "Assignment", "Assignments"),
  ]
  const effort = formatEffort(module.effort_time)
  if (effort) {
    metaParts.unshift(effort)
  }
  return metaParts.join(" . ")
}

const CourseOutlineSection: React.FC<{
  modules: CourseOutlineModule[]
}> = ({ modules }) => {
  if (modules.length === 0) {
    return null
  }

  const countLabel =
    modules.length === 1
      ? "There is 1 lecture in this course"
      : `There are ${modules.length} lectures in this course`

  return (
    <SectionRoot aria-labelledby={HeadingIds.CourseContent}>
      <Typography variant="h4" component="h2" id={HeadingIds.CourseContent}>
        Course content
      </Typography>
      <SummaryText variant="body1">{countLabel}</SummaryText>
      <ModuleStack>
        {modules.map((module, index) => {
          const title = getModuleTitle(module, index)
          const subtitle = getMetaLine(module)

          return (
            <ModuleShell key={module.id ?? `${title}-${index}`}>
              <TitleBlock>
                <ModuleTitle>{title}</ModuleTitle>
              </TitleBlock>
              <ModuleSubtitle>{subtitle}</ModuleSubtitle>
            </ModuleShell>
          )
        })}
      </ModuleStack>
    </SectionRoot>
  )
}

export default CourseOutlineSection
