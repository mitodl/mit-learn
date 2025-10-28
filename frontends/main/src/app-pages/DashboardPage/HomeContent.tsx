"use client"
import React, { Suspense } from "react"
import { ButtonLink } from "@mitodl/smoot-design"
import { ResourceTypeEnum } from "api"
import { styled, Typography } from "ol-components"
import { PROFILE } from "@/common/urls"
import {
  TopPicksCarouselConfig,
  TopicCarouselConfig,
  NEW_LEARNING_RESOURCES_CAROUSEL,
  POPULAR_LEARNING_RESOURCES_CAROUSEL,
  CERTIFICATE_COURSES_CAROUSEL,
  FREE_COURSES_CAROUSEL,
} from "@/common/carousels"
import ResourceCarousel from "@/page-components/ResourceCarousel/ResourceCarousel"
import { EnrollmentDisplay } from "./CoursewareDisplay/EnrollmentDisplay"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useUserMe } from "api/hooks/user"
import { OrganizationCards } from "./CoursewareDisplay/OrganizationCards"

const SubTitleText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body1,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.subtitle3,
  },
}))

const HomeHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "8px",
  },
}))

const HomeHeaderLeft = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  flex: "1 0 0",
})

const HomeHeaderRight = styled.div(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const StyledResourceCarousel = styled(ResourceCarousel)(({ theme }) => ({
  padding: "40px 0",
  [theme.breakpoints.down("md")]: {
    padding: "16px 0",
  },
}))

const TitleText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  paddingBottom: "16px",
  ...theme.typography.h3,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h5,
  },
})) as typeof Typography

const HomeContent: React.FC = () => {
  const { isLoading: isLoadingProfile, data: user } = useUserMe()
  const topics = user?.profile?.preference_search_filters.topic
  const certification = user?.profile?.preference_search_filters.certification
  const showEnrollments = useFeatureFlagEnabled(
    FeatureFlags.EnrollmentDashboard,
  )
  return (
    <>
      <HomeHeader>
        <HomeHeaderLeft>
          <TitleText component="h1">Your MIT Learning Journey</TitleText>
          <SubTitleText>
            A customized course list based on your preferences.
          </SubTitleText>
        </HomeHeaderLeft>
        <HomeHeaderRight>
          <ButtonLink variant="tertiary" href={PROFILE}>
            Edit Profile
          </ButtonLink>
        </HomeHeaderRight>
      </HomeHeader>
      <OrganizationCards />
      {showEnrollments ? <EnrollmentDisplay /> : null}
      <Suspense>
        <StyledResourceCarousel
          titleComponent="h2"
          title="Top picks for you"
          isLoading={isLoadingProfile}
          config={TopPicksCarouselConfig(user?.profile)}
        />
        {topics?.map((topic, index) => (
          <StyledResourceCarousel
            key={index}
            titleComponent="h2"
            title={`Popular courses in ${topic}`}
            isLoading={isLoadingProfile}
            config={TopicCarouselConfig(topic, [ResourceTypeEnum.Course])}
          />
        ))}
        {certification === true ? (
          <StyledResourceCarousel
            titleComponent="h2"
            title="Courses with Certificates"
            isLoading={isLoadingProfile}
            config={CERTIFICATE_COURSES_CAROUSEL}
          />
        ) : (
          <StyledResourceCarousel
            titleComponent="h2"
            title="Free courses"
            isLoading={isLoadingProfile}
            config={FREE_COURSES_CAROUSEL}
          />
        )}
        <StyledResourceCarousel
          titleComponent="h2"
          title="New"
          config={NEW_LEARNING_RESOURCES_CAROUSEL}
        />
        <StyledResourceCarousel
          titleComponent="h2"
          title="Popular"
          config={POPULAR_LEARNING_RESOURCES_CAROUSEL}
        />
      </Suspense>
    </>
  )
}

export default HomeContent
export { HomeContent, TitleText }
