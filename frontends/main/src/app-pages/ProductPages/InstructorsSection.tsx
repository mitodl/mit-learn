"use client"

import React from "react"
import { Typography } from "ol-components"
import Image from "next/image"
import { styled } from "@mitodl/smoot-design"
import { CarouselV2 } from "ol-components/CarouselV2"

import type { Faculty } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import RawHTML from "./RawHTML"

const InstructorsSectionRoot = styled.section(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  [theme.breakpoints.up("sm")]: {
    padding: "32px",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "8px",
  },
}))
const InstructorsHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    justifyContent: "flex-start",
  },
}))
const ArrowButtonsContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))
const InstructorsCarousel = styled(CarouselV2)(({ theme }) => ({
  ".MitCarousel-track": {
    gap: "48px",
    [theme.breakpoints.down("sm")]: {
      gap: "8px",
    },
  },
}))
const CarouselSlide = styled.div(({ theme }) => ({
  flex: "0 0 112px",
  [theme.breakpoints.down("sm")]: {
    flexBasis: "104px",
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
}))
const InstructorAvatar = styled.div(({ theme }) => ({
  borderRadius: "50%",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  padding: "12px",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  [theme.breakpoints.down("sm")]: {
    padding: "8px",
  },
  '[aria-pressed="true"] &': {
    borderColor: "transparent",
    boxShadow: `inset 0 0 0 2px ${theme.custom.colors.red}`,
  },
}))
const InstructorImage = styled(Image)({
  height: "84px",
  width: "84px",
  objectFit: "cover",
  borderRadius: "50%",
})
const InstructorName = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  lineHeight: "22px",
  marginTop: "6px",
  '[aria-pressed="true"] &': {
    color: theme.custom.colors.red,
    fontWeight: theme.typography.fontWeightBold,
  },
}))
const ActiveInstructorContent = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.red}`,
  paddingTop: "24px",
  color: theme.custom.colors.darkGray2,
}))
const ActiveInstructorName = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.red,
  marginBottom: "8px",
  marginTop: "0px",
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
        mobileBleed="symmetric"
        mobileGutter={16}
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
                <InstructorAvatar>
                  <InstructorImage
                    width={84}
                    height={84}
                    src={instructor.feature_image_src}
                    alt=""
                  />
                </InstructorAvatar>
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
