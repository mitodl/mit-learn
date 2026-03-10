"use client"

import React from "react"
import { Typography } from "ol-components"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { HeadingIds } from "./util"
import InstructorsSection from "./InstructorsSection"
import RawHTML from "./RawHTML"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate from "./ProductPageTemplate"
import WhoCanTakeSection from "./WhoCanTakeSection"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection, { DEFAULT_HOW_DATA } from "./HowYoullLearnSection"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ProgramAsCourseInfoBox from "./InfoBoxProgramAsCourse"

type ProgramAsCoursePageProps = {
  readableId: string
}

const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const DescriptionHTML = styled(UnstyledRawHTML)({
  p: { margin: 0 },
})

const ProgramAsCoursePage: React.FC<ProgramAsCoursePageProps> = ({
  readableId,
}) => {
  const pages = useQuery(pagesQueries.programPages(readableId))
  const programs = useQuery(
    programsQueries.programsList({ readable_id: readableId }),
  )

  const page = pages.data?.items[0]
  const program = programs.data?.results?.[0]

  const enabled = useFeatureFlagEnabled(FeatureFlags.MitxOnlineProductPages)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!enabled) {
    return flagsLoaded ? notFound() : null
  }

  const isLoading = pages.isLoading || programs.isLoading

  if (!page || !program) {
    if (!isLoading) {
      return notFound()
    }
    return null
  }

  const imageSrc = page.feature_image
    ? page.program_details.page.feature_image_src
    : DEFAULT_RESOURCE_IMG

  return (
    <ProductPageTemplate
      tags={["MITx"]}
      currentBreadcrumbLabel="Course"
      title={page.title}
      shortDescription={
        <DescriptionHTML
          Component="span"
          html={page.program_details.page.description}
        />
      }
      imageSrc={imageSrc}
      videoUrl={page.video_url}
      infoBox={<ProgramAsCourseInfoBox program={program} />}
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

export default ProgramAsCoursePage
