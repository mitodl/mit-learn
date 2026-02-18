"use client"

import React from "react"
import { Typography } from "ol-components"
import Image from "next/image"
import { styled } from "@mitodl/smoot-design"
import { CarouselV2 } from "ol-components/CarouselV2"

import type { Faculty } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import RawHTML from "./RawHTML"

const InstructorsSectionRoot = styled.section({})
const InstructorsHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    justifyContent: "flex-start",
  },
}))
const ArrowButtonsContainer = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
})
const InstructorsCarousel = styled(CarouselV2)(({ theme }) => ({
  backgroundColor: "peachpuff",
}))
const CarouselSlide = styled.div(({ theme }) => ({
  flex: "0 0 clamp(104px, 16vw, 136px)",
  [theme.breakpoints.down("sm")]: {
    flexBasis: "108px",
  },
}))
const InstructorButton = styled.button(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignItems: "center",
  width: "100%",
  border: 0,
  padding: 0,
  margin: 0,
  backgroundColor: "transparent",
  textAlign: "center",
  color: theme.custom.colors.darkGray2,
  font: "inherit",
  lineHeight: "inherit",
  cursor: "pointer",
  "&:focus-visible": {
    outline: `2px solid ${theme.custom.colors.lightBlue}`,
    outlineOffset: "4px",
    borderRadius: "8px",
  },
  "&[aria-pressed='true']": {
    color: theme.custom.colors.red,
    fontWeight: theme.typography.fontWeightBold,
  },
  "&[aria-pressed='true'] img": {
    borderColor: theme.custom.colors.red,
  },
}))
const InstructorImage = styled(Image)(({ theme }) => ({
  height: "108px",
  width: "108px",
  objectFit: "cover",
  borderRadius: "50%",
  border: `2px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    height: "84px",
    width: "84px",
  },
}))
const InstructorName = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  marginTop: "6px",
  minHeight: "48px",
}))
const ActiveInstructorContent = styled.div(({ theme }) => ({
  marginTop: "20px",
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
const ActiveInstructorName = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.red,
  marginBottom: "8px",
}))

const ActiveInstructor: React.FC<{
  instructor: Faculty
  contentId: string
}> = ({ instructor, contentId }) => {
  return (
    <ActiveInstructorContent id={contentId}>
      <ActiveInstructorName>{instructor.instructor_name}</ActiveInstructorName>
      <Typography variant="subtitle1" sx={{ marginBottom: "16px" }}>
        {instructor.instructor_title}
      </Typography>
      <RawHTML html={instructor.instructor_bio_long} />
    </ActiveInstructorContent>
  )
}

const InstructorsSection: React.FC<{ instructors: Faculty[] }> = ({
  instructors,
}) => {
  const panelId = React.useId()
  const [arrowsContainer, setArrowsContainer] =
    React.useState<HTMLDivElement | null>(null)
  const [activeInstructorId, setActiveInstructorId] = React.useState<
    Faculty["id"] | null
  >(instructors[0]?.id ?? null)

  React.useEffect(() => {
    if (!instructors.length) {
      setActiveInstructorId(null)
      return
    }
    if (
      !instructors.some((instructor) => instructor.id === activeInstructorId)
    ) {
      setActiveInstructorId(instructors[0].id)
    }
  }, [activeInstructorId, instructors])

  const activeInstructor =
    instructors.find((instructor) => instructor.id === activeInstructorId) ??
    instructors[0]

  return (
    <InstructorsSectionRoot aria-labelledby={HeadingIds.Instructors}>
      <InstructorsHeader>
        <Typography variant="h4" component="h2" id={HeadingIds.Instructors}>
          Meet your instructors
        </Typography>
        <ArrowButtonsContainer ref={setArrowsContainer} />
      </InstructorsHeader>
      <InstructorsCarousel
        data-testid="carousel-div"
        arrowsContainer={arrowsContainer}
        arrowGroupLabel="Instructor navigation"
        prevLabel="Show previous instructors"
        nextLabel="Show next instructors"
      >
        {instructors.map((instructor) => {
          const isActive = instructor.id === activeInstructor?.id
          return (
            <CarouselSlide key={instructor.id}>
              <InstructorButton
                type="button"
                aria-pressed={isActive}
                aria-controls={panelId}
                onClick={() => setActiveInstructorId(instructor.id)}
              >
                <InstructorImage
                  width={96}
                  height={96}
                  src={instructor.feature_image_src}
                  alt=""
                />
                <InstructorName>{instructor.instructor_name}</InstructorName>
              </InstructorButton>
            </CarouselSlide>
          )
        })}
      </InstructorsCarousel>
      {activeInstructor ? (
        <ActiveInstructor instructor={activeInstructor} contentId={panelId} />
      ) : null}
    </InstructorsSectionRoot>
  )
}

export default InstructorsSection
