"use client"

import React from "react"
import { Container, Grid2 as Grid, Banner, Breadcrumbs } from "ol-components"
import { backgroundSrcSetCSS } from "ol-utilities"
import { HOME } from "@/common/urls"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"

type CoursePageProps = {
  readableId: string
}

const CoursePage: React.FC<CoursePageProps> = ({ readableId }) => {
  const pagesDetail = useQuery(pagesQueries.pagesDetail(readableId))
  const coursePage = pagesDetail.data?.items[0]
  return (
    <>
      <Banner
        title={coursePage?.title}
        header={coursePage?.description}
        navText={
          <Breadcrumbs
            variant="dark"
            ancestors={[{ href: HOME, label: "Home" }]}
            current="Course"
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
          ></Grid>
        </Grid>
      </Container>
    </>
  )
}

export default CoursePage
