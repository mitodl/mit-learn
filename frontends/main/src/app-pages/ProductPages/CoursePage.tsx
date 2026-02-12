"use client"

import React from "react"
import { Stack, Typography } from "ol-components"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { CourseSummary } from "./ProductSummary"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { HeadingIds } from "./util"
import InstructorsSection from "./InstructorsSection"
import RawHTML from "./RawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate, {
  HeadingData,
  ProductNavbar,
  WhoCanTake,
  WhatSection,
  HowYoullLearnSection,
} from "./ProductPageTemplate"
import { CoursePageItem } from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import CourseEnrollmentButton from "./CourseEnrollmentButton"

type CoursePageProps = {
  readableId: string
}

const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const getNavLinks = (page: CoursePageItem): HeadingData[] => {
  const all = [
    {
      id: HeadingIds.About,
      label: "About",
      content: page.about,
    },
    {
      id: HeadingIds.What,
      label: "What you'll learn",
      content: page.what_you_learn,
    },
    {
      id: HeadingIds.How,
      label: "How you'll learn",
      content: true,
    },
    {
      id: HeadingIds.Prereqs,
      label: "Prerequisites",
      content: page.prerequisites,
    },
    {
      id: HeadingIds.Instructors,
      label: "Instructors",
      content: page.faculty.length ? "x" : undefined,
    },
  ] as const
  return all.filter((item) => item.content)
}

const CoursePage: React.FC<CoursePageProps> = ({ readableId }) => {
  const pages = useQuery(pagesQueries.coursePages(readableId))
  const courses = useQuery(
    coursesQueries.coursesList({ readable_id: readableId }),
  )
  const page = pages.data?.items[0]
  const course = courses.data?.results?.[0]
  const enabled = useFeatureFlagEnabled(FeatureFlags.MitxOnlineProductPages)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!enabled) {
    return flagsLoaded ? notFound() : null
  }

  const doneLoading = pages.isSuccess && courses.isSuccess

  if (!page || !course) {
    if (doneLoading) {
      return notFound()
    } else {
      return null
    }
  }

  const navLinks = getNavLinks(page)

  const imageSrc = page.feature_image
    ? page.course_details.page.feature_image_src
    : DEFAULT_RESOURCE_IMG

  return (
    <ProductPageTemplate
      tags={["MITx"]}
      currentBreadcrumbLabel="Course"
      title={page.title}
      shortDescription={page.course_details.page.description}
      imageSrc={imageSrc}
      sidebarSummary={<CourseSummary course={course} />}
      enrollButton={<CourseEnrollmentButton course={course} />}
      navLinks={navLinks}
    >
      <ProductNavbar navLinks={navLinks} productNoun="Course" />
      <Stack gap={{ xs: "40px", sm: "56px" }}>
        {page.about ? (
          <AboutSection productNoun="Course" aboutHtml={page.about} />
        ) : null}
        {page.what_you_learn ? (
          <WhatSection html={page.what_you_learn} />
        ) : null}
        <HowYoullLearnSection />
        {page.prerequisites ? (
          <PrerequisitesSection aria-labelledby={HeadingIds.Prereqs}>
            <Typography variant="h4" component="h2" id={HeadingIds.Prereqs}>
              Prerequisites
            </Typography>
            <RawHTML html={page.prerequisites} />
          </PrerequisitesSection>
        ) : null}
        {page.faculty.length ? (
          <InstructorsSection instructors={page.faculty} />
        ) : null}
        <WhoCanTake productNoun="Course" />
      </Stack>
    </ProductPageTemplate>
  )
}

export default CoursePage
