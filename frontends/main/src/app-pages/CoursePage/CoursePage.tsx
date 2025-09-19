"use client"

import React from "react"
import {
  Container,
  Stack,
  Breadcrumbs,
  BannerBackground,
  Typography,
  MuiDialog,
} from "ol-components"
import { backgroundSrcSetCSS } from "ol-utilities"
import { HOME } from "@/common/urls"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { ActionButton, ButtonLink, styled } from "@mitodl/smoot-design"
import Image from "next/image"
import DOMPurify from "isomorphic-dompurify"
import type { Faculty } from "@mitodl/mitxonline-api-axios/v2"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { CourseInfo, UnderlinedLink } from "./CourseInfo"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { RiCloseLine } from "@remixicon/react"

type CoursePageProps = {
  readableId: string
}

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  paddingBottom: "24px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "16px",
  },
}))

const TitleBox = styled(Stack)(({ theme }) => ({
  color: theme.custom.colors.white,
}))
const OfferedByTag = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.darkGray1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "32px",
  padding: "0 12px",
  borderRadius: "4px",
  marginBottom: "4px",
  ...theme.typography.subtitle1,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const Page = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  paddingBottom: "80px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "24px",
  },
  ".raw-include": {
    "*:first-child": {
      marginTop: 0,
    },
    ...theme.typography.body1,
    lineHeight: "1.5",
    p: {
      marginTop: "16px",
      marginBottom: "0",
    },
    "& > ul": {
      listStyleType: "none",
      marginTop: "16px",
      marginBottom: 0,
      padding: 0,
      "> li": {
        padding: "16px",
        border: `1px solid ${theme.custom.colors.lightGray2}`,
        borderBottom: "none",
        ":first-of-type": {
          borderRadius: "4px 4px 0 0",
        },
        ":last-of-type": {
          borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
          borderRadius: "0 0 4px 4px",
        },
        ":first-of-type:last-of-type": {
          borderRadius: "4px",
        },
      },
    },

    [theme.breakpoints.down("md")]: {
      ...theme.typography.body2,
    },
  },
}))

const TopContainer = styled(Container)({
  display: "flex",
  justifyContent: "space-between",
  gap: "60px",
})
const BottomContainer = styled(Container)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: "60px",
  flexDirection: "row-reverse",

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "center",
    gap: "0px",
  },
}))

const MainCol = styled.div({
  flex: 1,
  display: "flex",
  flexDirection: "column",
})

const SidebarCol = styled.div(({ theme }) => ({
  width: "100%",
  maxWidth: "410px",
  [theme.breakpoints.down("md")]: {
    marginTop: "24px",
  },
}))
const SidebarSpacer = styled.div(({ theme }) => ({
  width: "410px",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const StyledLink = styled(ButtonLink)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    backgroundColor: theme.custom.colors.lightGray1,
    border: `1px solid ${theme.custom.colors.lightGray2}`,
  },
}))

const LinksContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  [theme.breakpoints.up("md")]: {
    gap: "24px",
    padding: "12px 16px",
    backgroundColor: theme.custom.colors.white,
    borderRadius: "4px",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
    marginTop: "-24px",
    width: "calc(100%)",
    marginBottom: "40px",
  },
  [theme.breakpoints.down("md")]: {
    alignSelf: "center",
    gap: "8px",
    rowGap: "16px",
    padding: 0,
    margin: "24px 0",
  },
}))

const SidebarImageWrapper = styled.div(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    height: "0px",
  },
}))
const SidebarImage = styled(Image)(({ theme }) => ({
  borderRadius: "4px",
  width: "100%",
  maxWidth: "410px",
  height: "230px",
  display: "block",
  [theme.breakpoints.up("md")]: {
    transform: "translateY(-100%)",
  },
  [theme.breakpoints.down("md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "4px 4px 0 0",
  },
}))

const RawHTML: React.FC<{ html: string }> = ({ html }) => {
  return (
    <div
      className="raw-include"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  )
}

const AboutSection = styled.section<{ expanded: boolean }>(({ expanded }) => {
  return [
    {
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    },
    !expanded && {
      ".raw-include > *:not(:first-child)": {
        display: "none",
      },
    },
  ]
})
const WhatSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})
const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const InstructorsSection = styled.section({})
const InstructorsList = styled.ul({
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  padding: 0,
  margin: 0,
  marginTop: "24px",
})
const InstructorCardRoot = styled.li(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "16px",
  width: "252px",
  minHeight: "272px",
  [theme.breakpoints.down("sm")]: {
    width: "171px",
  },
  ":hover": {
    boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
    cursor: "pointer",
  },
}))
const InstructorButton = styled.button(({ theme }) => ({
  backgroundColor: "unset",
  border: "none",
  textAlign: "left",
  padding: 0,
  ...theme.typography.h5,
  marginTop: "8px",
  cursor: "inherit",
}))
const InstructorImage = styled(Image)(({ theme }) => ({
  height: "140px",
  width: "220px",
  objectFit: "cover",
  borderRadius: "8px",
  [theme.breakpoints.down("sm")]: {
    height: "155px",
    width: "140px",
  },
}))
const InstructorCard: React.FC<{
  instructor: Faculty
}> = ({ instructor }) => {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <InstructorCardRoot onClick={() => setOpen(true)}>
        <InstructorImage
          width={220}
          height={140}
          src={instructor.feature_image_src}
          alt=""
        />
        <InstructorButton>{instructor.instructor_name}</InstructorButton>
        <Typography variant="body3">{instructor.instructor_title}</Typography>
      </InstructorCardRoot>
      <InstructorDialog
        instructor={instructor}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const CloseButton = styled(ActionButton)(({ theme }) => ({
  position: "absolute",
  top: "24px",
  right: "28px",
  backgroundColor: theme.custom.colors.lightGray2,
  "&&:hover": {
    backgroundColor: theme.custom.colors.red,
    color: theme.custom.colors.white,
  },
  [theme.breakpoints.down("md")]: {
    right: "16px",
  },
}))
const DialogImage = styled(Image)({
  width: "100%",
  aspectRatio: "1.92",
  objectFit: "cover",
})
const DialogContent = styled.div(({ theme }) => ({
  padding: "32px",
  ".raw-include": {
    ...theme.typography.body2,
    "*:first-child": {
      marginTop: 0,
    },
    p: {
      marginTop: "8px",
      marginBottom: "0",
    },
  },
}))
const InstructorDialog: React.FC<{
  instructor: Faculty
  open: boolean
  onClose: () => void
}> = ({ instructor, open, onClose }) => {
  return (
    <MuiDialog
      open={open}
      maxWidth="md"
      onClose={onClose}
      slotProps={{
        paper: { sx: { borderRadius: "8px", maxWidth: "770px" } },
      }}
    >
      <CloseButton
        onClick={onClose}
        variant="text"
        size="medium"
        aria-label="Close"
      >
        <RiCloseLine />
      </CloseButton>
      <DialogImage
        width={770}
        height={400}
        src={instructor.feature_image_src}
        alt=""
      />
      <DialogContent>
        <Typography component="h2" variant="h4" sx={{ marginBottom: "8px" }}>
          {instructor.instructor_name}
        </Typography>
        <Typography variant="subtitle1" sx={{ marginBottom: "16px" }}>
          {instructor.instructor_title}
        </Typography>
        <RawHTML html={instructor.instructor_bio_long} />
      </DialogContent>
    </MuiDialog>
  )
}

const WhoCanTakeSection = styled.section(({ theme }) => ({
  padding: "32px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
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

enum HeadingIds {
  About = "about",
  What = "what-you-will-learn",
  Prerequisites = "prerequisites",
  Instructors = "instructors",
  WhoCanTake = "who-can-take-this-course",
}

type HeadingData = {
  id: HeadingIds
  label: string
  variant: "primary" | "secondary"
}
const HEADINGS: HeadingData[] = [
  { id: HeadingIds.About, label: "About", variant: "primary" },
  { id: HeadingIds.What, label: "What you'll learn", variant: "secondary" },
  {
    id: HeadingIds.Prerequisites,
    label: "Prerequisites",
    variant: "secondary",
  },
  { id: HeadingIds.Instructors, label: "Instructors", variant: "secondary" },
]

const CoursePage: React.FC<CoursePageProps> = ({ readableId }) => {
  const pagesDetail = useQuery(pagesQueries.pagesDetail(readableId))
  const courses = useQuery(
    coursesQueries.coursesList({ readable_id: readableId }),
  )
  const page = pagesDetail.data?.items[0]
  const course = courses.data?.results?.[0]
  const [aboutExpanded, setAboutExpanded] = React.useState(false)
  const enabled = useFeatureFlagEnabled(FeatureFlags.ProductPageCourse)
  if (enabled === false) {
    return notFound()
  }
  if (!enabled) return
  if (!page || !course) return
  return (
    <Page>
      <BannerBackground backgroundUrl={backgroundSrcSetCSS(backgroundSteps)}>
        <TopContainer>
          <MainCol>
            <StyledBreadcrumbs
              variant="dark"
              ancestors={[{ href: HOME, label: "Home" }]}
              current="Course"
            />
            <TitleBox alignItems="flex-start" gap="4px">
              <OfferedByTag>MITx</OfferedByTag>
              <Stack alignItems="flex-start" gap="16px">
                <Typography typography={{ xs: "h3", sm: "h2" }}>
                  {page.title}
                </Typography>
                <Typography typography={{ xs: "body2", sm: "body1" }}>
                  {page.course_details.page.description}
                </Typography>
              </Stack>
            </TitleBox>
          </MainCol>
          <SidebarSpacer></SidebarSpacer>
        </TopContainer>
      </BannerBackground>
      <BottomContainer>
        <SidebarCol>
          <SidebarImageWrapper>
            <SidebarImage
              width={410}
              height={230}
              src={page.course_details.page.feature_image_src}
              alt=""
            />
          </SidebarImageWrapper>
          <CourseInfo course={course} />
        </SidebarCol>
        <MainCol>
          <LinksContainer>
            {HEADINGS.map((heading) => {
              const LinkComponent =
                heading.variant === "primary" ? ButtonLink : StyledLink
              return (
                <LinkComponent
                  key={heading.id}
                  href={`#${heading.id}`}
                  variant={heading.variant}
                  size="small"
                >
                  {heading.label}
                </LinkComponent>
              )
            })}
          </LinksContainer>
          <Stack gap={{ xs: "40px", sm: "56px" }}>
            <AboutSection expanded={aboutExpanded}>
              <Typography variant="h3" component="h2" id={HeadingIds.About}>
                About this course
              </Typography>
              <RawHTML html={page.about} />
              <UnderlinedLink
                href=""
                color="red"
                role="button"
                onClick={(e) => {
                  e.preventDefault()
                  setAboutExpanded((curr) => !curr)
                }}
              >
                Show more
              </UnderlinedLink>
            </AboutSection>
            <WhatSection>
              <Typography variant="h4" component="h2" id={HeadingIds.What}>
                What you'll learn
              </Typography>
              <RawHTML html={page.what_you_learn} />
            </WhatSection>
            <PrerequisitesSection>
              <Typography
                variant="h4"
                component="h2"
                id={HeadingIds.Prerequisites}
              >
                Prerequisites
              </Typography>
              <RawHTML html={page.prerequisites} />
            </PrerequisitesSection>
            <InstructorsSection>
              <Typography
                variant="h4"
                component="h2"
                id={HeadingIds.Instructors}
              >
                Meet your instructors
              </Typography>
              <InstructorsList>
                {page.faculty.map((instructor) => {
                  return (
                    <InstructorCard
                      key={instructor.id}
                      instructor={instructor}
                    />
                  )
                })}
              </InstructorsList>
            </InstructorsSection>

            <WhoCanTakeSection>
              <Typography
                variant="h4"
                component="h2"
                id={HeadingIds.WhoCanTake}
              >
                Who can take this course?
              </Typography>
              Because of U.S. Office of Foreign Assets Control (OFAC)
              restrictions and other U.S. federal regulations, learners residing
              in one or more of the following countries or regions will not be
              able to register for this course: Iran, Cuba, Syria, North Korea
              and the Crimea, Donetsk People's Republic and Luhansk People's
              Republic regions of Ukraine.
            </WhoCanTakeSection>
          </Stack>
        </MainCol>
      </BottomContainer>
    </Page>
  )
}

export default CoursePage
