"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { styled } from "ol-components"
import { CarouselV2 } from "ol-components/CarouselV2"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine } from "@remixicon/react"
import { courseQueries } from "api/hooks/learningResources"
import { ResourceCard } from "@/page-components/ResourceCard/ResourceCard"
import { analytics } from "@/common/analytics"
import { querifiedSearchUrl } from "@/common/urls"
import { Section, SectionInner } from "./SectionLayout"
import { SELECTED_COURSES_PARAMS } from "./queryParams"

const TITLE = "Selected for teaching"

const SEARCH_FREE_OCW_COURSES = querifiedSearchUrl({
  offered_by: "ocw",
  free: "true",
  resource_type_group: "course",
})

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  padding: "80px 0",
  [theme.breakpoints.down("md")]: {
    gap: "24px",
    padding: "40px 0",
  },
}))

const Header = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
})

const HeaderText = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  flex: 1,
  minWidth: 0,
})

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.black,
  margin: 0,
}))

const Body = styled.p(({ theme }) => ({
  ...theme.typography.body1Loose,
  color: theme.custom.colors.black,
  margin: 0,
}))

const Arrows = styled.div(({ theme }) => ({
  display: "flex",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const StyledCarousel = styled(CarouselV2)({
  ".MitCarousel-track": {
    paddingBottom: "4px",
  },
})

const Footer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  [theme.breakpoints.down("sm")]: {
    a: { width: "100%" },
  },
}))

const SelectedCoursesSection: React.FC = () => {
  const [arrows, setArrows] = useState<HTMLDivElement | null>(null)
  const { data, isLoading } = useQuery(
    courseQueries.list(SELECTED_COURSES_PARAMS),
  )

  if (!isLoading && !data?.results.length) {
    return null
  }

  return (
    <Section>
      <Inner>
        <Header>
          <HeaderText>
            <Heading>{TITLE}</Heading>
            <Body>
              Explore MIT courses with materials you can use and adapt for your
              classroom.
            </Body>
          </HeaderText>
          <Arrows role="group" aria-label="Slide navigation" ref={setArrows} />
        </Header>
        <StyledCarousel
          arrowsContainer={arrows}
          mobileBleed="symmetric"
          mobileGutter={24}
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <ResourceCard
                  key={index}
                  isLoading
                  resource={null}
                  parentHeadingEl="h2"
                  size="medium"
                />
              ))
            : data?.results.map((resource, index) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  parentHeadingEl="h2"
                  size="medium"
                  onCardClick={() =>
                    analytics.courseCardClicked({
                      label: TITLE,
                      resourceId: resource.id,
                      readableId: resource.readable_id,
                      resourceType: resource.resource_type,
                      platformCode: resource.platform?.code,
                      position: index,
                    })
                  }
                />
              ))}
        </StyledCarousel>
        <Footer>
          <ButtonLink
            variant="primary"
            size="large"
            href={SEARCH_FREE_OCW_COURSES}
            endIcon={<RiArrowRightLine aria-hidden />}
          >
            {data
              ? `Browse all ${data.count.toLocaleString("en-US")} free courses on MIT Learn`
              : "Browse all free courses on MIT Learn"}
          </ButtonLink>
        </Footer>
      </Inner>
    </Section>
  )
}

export default SelectedCoursesSection
