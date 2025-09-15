"use client"

import React from "react"
import {
  Container,
  Stack,
  Breadcrumbs,
  styled,
  BannerBackground,
  Typography,
} from "ol-components"
import { backgroundSrcSetCSS } from "ol-utilities"
import { HOME } from "@/common/urls"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { Button, ButtonLink } from "@mitodl/smoot-design"
import Image from "next/image"

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
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}))

const MainCol = styled.div({
  flex: 1,
})

const SidebarCol = styled.div({
  width: "410px",
})

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
  },
  [theme.breakpoints.down("md")]: {
    gap: "8px",
    rowGap: "16px",
    padding: 0,
  },
}))

const SidebarImageWrapper = styled.div({
  height: "0px",
})
const SidebarImage = styled(Image)({
  borderRadius: "4px",
  width: "410px",
  height: "230px",
  transform: "translateY(-100%)",
})
const SidebarInfo = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  padding: "24px 32px",
  position: "sticky",
  marginTop: "-24px",
  top: "calc(40px + 32px + 24px)",
}))
const WideButton = styled(Button)({
  width: "100%",
})

enum HeadingIds {
  About = "about",
  What = "what-you-will-learn",
  Prerequisites = "prerequisites",
  Instrucctors = "instructors",
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
  { id: HeadingIds.Instrucctors, label: "Instructors", variant: "secondary" },
]

const CoursePage: React.FC<CoursePageProps> = ({ readableId }) => {
  const pagesDetail = useQuery(pagesQueries.pagesDetail(readableId))
  const coursePage = pagesDetail.data?.items[0]
  if (!coursePage) return
  return (
    <>
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
                  {coursePage.title}
                </Typography>
                <Typography typography={{ xs: "body2", sm: "body1" }}>
                  {coursePage.course_details.page.description}
                </Typography>
              </Stack>
            </TitleBox>
          </MainCol>
          <SidebarCol></SidebarCol>
        </TopContainer>
      </BannerBackground>
      <BottomContainer>
        <SidebarCol>
          <SidebarImageWrapper>
            <SidebarImage
              width={410}
              height={230}
              src={coursePage.course_details.page.feature_image_src}
              alt=""
            />
          </SidebarImageWrapper>

          <SidebarInfo>
            <WideButton variant="primary" size="large">
              Enroll for free
            </WideButton>
          </SidebarInfo>
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
          {new Array(100).fill(null).map((_, idx) => (
            <p key={idx}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
              euismod, nunc ut laoreet tincidunt, nunc nisl aliquam nunc, eget
              aliquam nisl nunc euismod nunc. Sed euismod, nunc ut laoreet
              tincidunt, nunc nisl aliquam nunc, eget aliquam nisl nunc euismod
              nunc.
            </p>
          ))}
        </MainCol>
      </BottomContainer>
    </>
  )
}

export default CoursePage
