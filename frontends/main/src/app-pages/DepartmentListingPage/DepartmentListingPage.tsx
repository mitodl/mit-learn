"use client"

import React from "react"
import {
  Container,
  Typography,
  styled,
  List,
  ListItem,
  ListItemLink,
  ListItemText,
  Grid2 as Grid,
  Banner,
  Breadcrumbs,
} from "ol-components"
import { pluralize, backgroundSrcSetCSS } from "ol-utilities"
import type { LearningResourceSchool } from "api"
import { useSchoolsList } from "api/hooks/learningResources"
import {
  RiPaletteLine,
  RiArrowRightSLine,
  RiBuilding2Line,
  RiCompasses2Line,
  RiGovernmentLine,
  RiShakeHandsLine,
  RiFlaskLine,
  RiTerminalBoxLine,
} from "@remixicon/react"
import { HOME } from "@/common/urls"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { aggregateProgramCounts, aggregateCourseCounts } from "@/common/utils"
import { useChannelCounts } from "api/hooks/channels"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

const SCHOOL_ICONS: Record<string, React.ReactNode> = {
  // School of Architecture and Planning
  "https://sap.mit.edu/": <RiBuilding2Line />,
  "https://engineering.mit.edu/": <RiCompasses2Line />,
  // School of Humanities, Arts, and Social Sciences
  "https://shass.mit.edu/": <RiGovernmentLine />,
  "https://science.mit.edu/": <RiFlaskLine />,
  "http://mitsloan.mit.edu/": <RiShakeHandsLine />,
  "https://computing.mit.edu/": <RiTerminalBoxLine />,
}

const SchoolTitle = styled.h2(({ theme }) => {
  return {
    marginBottom: "10px",
    marginTop: "0",
    display: "flex",
    alignItems: "center",
    ...theme.typography.h5,
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.subtitle1,
    },
  }
})

const SchoolIcon = styled.span(({ theme }) => ({
  paddingRight: "10px",
  verticalAlign: "text-top",
  display: "inline-flex",
  fontSize: theme.typography.pxToRem(20),
  [theme.breakpoints.down("sm")]: {
    fontSize: theme.typography.pxToRem(16),
  },
  "& svg": {
    width: "1em",
    height: "1em",
  },
}))

const DepartmentLink = styled(ListItemLink)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  paddingTop: "16px",
  paddingBottom: "16px",
  paddingLeft: `calc(${theme.typography.pxToRem(20)} + 10px)`,
  [theme.breakpoints.down("sm")]: {
    paddingBottom: "12px",
    paddingTop: "12px",
    paddingLeft: `calc(${theme.typography.pxToRem(16)} + 10px)`,
  },
  display: "flex",
  columnGap: "16px",
  "& svg": {
    color: theme.custom.colors.silverGray,
  },
  "& .MuiListItemText-primary": {
    ...theme.typography.subtitle1,
    [theme.breakpoints.down("sm")]: {
      ...theme.typography.subtitle2,
    },
  },
  "& .MuiListItemText-secondary": {
    ...theme.typography.body2,
    color: theme.custom.colors.silverGrayDark,
    marginTop: "4px",
    "& > *": {
      marginRight: "12px",
    },
  },
  "&:hover": {
    backgroundColor: theme.custom.colors.white,
    ".hover-dark, .MuiListItemText-secondary": {
      color: theme.custom.colors.darkGray1,
    },
    ".hover-highlight": {
      color: theme.custom.colors.lightRed,
      textDecoration: "underline",
    },
  },
  "& .view-link": {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
}))

type SchoolDepartmentProps = {
  school: LearningResourceSchool
  courseCounts: Record<string, number>
  programCounts: Record<string, number>
  className?: string
  as?: React.ElementType
}
const SchoolDepartments: React.FC<SchoolDepartmentProps> = ({
  school,
  courseCounts,
  programCounts,
  className,
}) => {
  const posthog = usePostHog()
  return (
    <section className={className}>
      <SchoolTitle>
        <SchoolIcon aria-hidden>
          {SCHOOL_ICONS[school.url] ?? <RiPaletteLine />}
        </SchoolIcon>
        {school.name}
      </SchoolTitle>
      <List disablePadding>
        {school.departments.map((department) => {
          const courses = courseCounts[department.name] ?? 0
          const programs = programCounts[department.name] ?? 0
          const counts = [
            { count: courses, label: pluralize("Course", courses) },
            { count: programs, label: pluralize("Program", programs) },
          ]
          if (!department.channel_url) return null
          return (
            <ListItem disablePadding key={department.department_id}>
              <DepartmentLink
                href={
                  department.channel_url &&
                  new URL(department.channel_url).pathname
                }
                onClick={() => {
                  posthog.capture(PostHogEvents.DepartmentLinkClicked, {
                    department,
                  })
                }}
              >
                <ListItemText
                  primary={department.name}
                  secondary={counts
                    .filter(({ count }) => count > 0)
                    .map(({ count, label }) => (
                      <span key={label}>{`${count} ${label}`}</span>
                    ))}
                />
                <Typography
                  variant="body2"
                  className="view-link hover-highlight"
                  aria-hidden // This is a visual affordance only. Screenreaders will announce the link ancestor role.
                >
                  View
                </Typography>
                <RiArrowRightSLine className="hover-dark" />
              </DepartmentLink>
            </ListItem>
          )
        })}
      </List>
    </section>
  )
}

const DepartmentListingPage: React.FC = () => {
  const channelCountQuery = useChannelCounts("department")
  const courseCounts = channelCountQuery.data
    ? aggregateCourseCounts("title", channelCountQuery.data)
    : {}
  const programCounts = channelCountQuery.data
    ? aggregateProgramCounts("title", channelCountQuery.data)
    : {}

  const schoolsQuery = useSchoolsList()

  return (
    <>
      <Banner
        title="Browse by Academic Department"
        header="At MIT, academic departments span a wide range of disciplines, from science and engineering to humanities. Select a department below to explore all of its non-degree learning offerings."
        navText={
          <Breadcrumbs
            variant="dark"
            ancestors={[{ href: HOME, label: "Home" }]}
            current="Departments"
          />
        }
        backgroundUrl={backgroundSrcSetCSS(backgroundSteps)}
      />
      <Container>
        <Grid container>
          <Grid
            size={{ xs: 12, sm: 10 }}
            offset={{ xs: 0, sm: 1 }}
            sx={(theme) => ({
              display: "flex",
              flexDirection: "column",
              gap: "40px",
              margin: "80px 0",
              [theme.breakpoints.down("sm")]: {
                margin: "20px 0",
                gap: "30px",
              },
            })}
          >
            {schoolsQuery.data?.results?.map((school) => (
              <SchoolDepartments
                key={school.id}
                school={school}
                courseCounts={courseCounts}
                programCounts={programCounts}
              />
            ))}
          </Grid>
        </Grid>
      </Container>
    </>
  )
}

export default DepartmentListingPage
