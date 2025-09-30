"use client"

import React from "react"
import { Stack, Typography } from "ol-components"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { HeadingIds } from "./util"
import InstructorsSection from "./InstructorsSection"
import RawHTML, { UnstyledRawHTML } from "./RawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate, {
  HeadingData,
  ProductNavbar,
  WhoCanTake,
} from "./ProductPageTemplate"
import { ProgramPageItem } from "@mitodl/mitxonline-api-axios/v2"
import { ProgramSummary } from "./CourseSummary"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"

type ProgramPageProps = {
  readableId: string
}

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

const getNavLinks = (page: ProgramPageItem): HeadingData[] => {
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

const DescriptionHTML = styled(UnstyledRawHTML)({
  p: { margin: 0 },
})

const ProgramPage: React.FC<ProgramPageProps> = ({ readableId }) => {
  const programDetail = useQuery(pagesQueries.programsDetail(readableId))
  const programs = useQuery(
    programsQueries.programsList({ readable_id: readableId }),
  )
  const page = programDetail.data?.items[0]
  const course = programs.data?.results?.[0]
  const enabled = useFeatureFlagEnabled(FeatureFlags.ProductPageCourse)
  if (enabled === false) {
    return notFound()
  }
  if (!enabled) return

  const doneLoading = programDetail.isSuccess && programs.isSuccess

  if (!page || !course) {
    if (doneLoading) {
      return notFound()
    } else {
      return null
    }
  }

  const navLinks = getNavLinks(page)

  const imageSrc = page.feature_image
    ? page.program_details.page.feature_image_src
    : DEFAULT_RESOURCE_IMG
  return (
    <ProductPageTemplate
      offeredBy="MITx"
      currentBreadcrumbLabel="Program"
      title={page.title}
      shortDescription={
        <DescriptionHTML
          Component="span"
          html={page.program_details.page.description}
        />
      }
      imageSrc={imageSrc}
      sidebarSummary={<ProgramSummary />}
      navLinks={navLinks}
    >
      <ProductNavbar navLinks={navLinks} productNoun="Program" />
      <Stack gap={{ xs: "40px", sm: "56px" }}>
        {page.about ? (
          <AboutSection productNoun="Program" aboutHtml={page.about} />
        ) : null}
        {page.what_you_learn ? (
          <WhatSection aria-labelledby={HeadingIds.What}>
            <Typography variant="h4" component="h2" id={HeadingIds.What}>
              What you'll learn
            </Typography>
            <RawHTML html={page.what_you_learn} />
          </WhatSection>
        ) : null}
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
        <WhoCanTake productNoun="Program" />
      </Stack>
    </ProductPageTemplate>
  )
}

export default ProgramPage
