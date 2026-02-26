"use client"

import React from "react"
import { Typography } from "ol-components"

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
import ProductPageTemplate from "./ProductPageTemplate"
import ProductNavbar, { HeadingData } from "./ProductNavbar"
import WhoCanTakeSection from "./WhoCanTakeSection"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection, { DEFAULT_HOW_DATA } from "./HowYoullLearnSection"
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
      variant: "primary",
      content: page.about,
    },
    {
      id: HeadingIds.What,
      label: "What you'll learn",
      variant: "secondary",
      content: page.what_you_learn,
    },
    {
      id: HeadingIds.How,
      label: "How you'll learn",
      variant: "secondary",
      content: true,
    },
    {
      id: HeadingIds.Prereqs,
      label: "Prerequisites",
      variant: "secondary",
      content: page.prerequisites,
    },
    {
      id: HeadingIds.Instructors,
      label: "Instructors",
      variant: "secondary",
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
      videoUrl={page.video_url}
      summaryTitle="Course summary"
      sidebarSummary={<CourseSummary course={course} />}
      enrollButton={<CourseEnrollmentButton course={course} />}
      navbar={<ProductNavbar navLinks={navLinks} productNoun="Course" />}
    >
      {page.about ? (
        <AboutSection productNoun="Course" aboutHtml={page.about} />
      ) : null}
      {page.what_you_learn ? (
        <WhatYoullLearnSection html={page.what_you_learn} />
      ) : null}
      <HowYoullLearnSection data={DEFAULT_HOW_DATA} />
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
      <WhoCanTakeSection productNoun="Course" />
    </ProductPageTemplate>
  )
}

export default CoursePage
