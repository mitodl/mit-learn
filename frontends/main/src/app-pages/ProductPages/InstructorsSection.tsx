"use client"

import React, { useId } from "react"
import { Typography, MuiDialog } from "ol-components"
import Image from "next/image"
import { ActionButton, styled } from "@mitodl/smoot-design"

import type { Faculty } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { RiCloseLine } from "@remixicon/react"
import RawHTML from "./RawHTML"

const InstructorsSectionRoot = styled.section({})
const InstructorsList = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  padding: 0,
  margin: 0,
  marginTop: "24px",
  gap: "24px",
  [theme.breakpoints.down("sm")]: {
    gap: "16px",
    justifyContent: "center",
  },
}))
const InstructorCardRoot = styled.li(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "16px",
  width: "252px",
  minHeight: "272px",
  [theme.breakpoints.down("sm")]: {
    width: "calc(50% - 8px)",
    minWidth: "162px",
  },
  ":hover": {
    boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
    cursor: "pointer",
  },
}))
const InstructorButton = styled.button(({ theme }) => ({
  backgroundColor: "unset",
  border: "none",
  textAlign: "left",
  padding: 0,
  ...theme.typography.h5,
  marginTop: "8px",
  cursor: "inherit",
}))
const InstructorImage = styled(Image)(({ theme }) => ({
  height: "140px",
  width: "100%",
  objectFit: "cover",
  borderRadius: "8px",
  [theme.breakpoints.down("sm")]: {
    height: "155px",
  },
}))
const InstructorCard: React.FC<{
  instructor: Faculty
}> = ({ instructor }) => {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <InstructorCardRoot onClick={() => setOpen(true)}>
        <InstructorImage
          width={220}
          height={140}
          src={instructor.feature_image_src}
          alt=""
        />
        <InstructorButton>{instructor.instructor_name}</InstructorButton>
        <Typography variant="body3">{instructor.instructor_title}</Typography>
      </InstructorCardRoot>
      <InstructorDialog
        instructor={instructor}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const CloseButton = styled(ActionButton)(({ theme }) => ({
  position: "absolute",
  top: "24px",
  right: "28px",
  backgroundColor: theme.custom.colors.lightGray2,
  "&&:hover": {
    backgroundColor: theme.custom.colors.red,
    color: theme.custom.colors.white,
  },
  [theme.breakpoints.down("md")]: {
    right: "16px",
  },
}))
const DialogImage = styled(Image)({
  width: "100%",
  aspectRatio: "1.92",
  objectFit: "cover",
})
const DialogContent = styled.div(({ theme }) => ({
  padding: "32px",
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
const InstructorDialog: React.FC<{
  instructor: Faculty
  open: boolean
  onClose: () => void
}> = ({ instructor, open, onClose }) => {
  const titleId = useId()
  return (
    <MuiDialog
      open={open}
      maxWidth="md"
      onClose={onClose}
      aria-labelledby={titleId}
      slotProps={{
        paper: { sx: { borderRadius: "8px", maxWidth: "770px" } },
      }}
    >
      <CloseButton
        onClick={onClose}
        variant="text"
        size="medium"
        aria-label="Close"
      >
        <RiCloseLine />
      </CloseButton>
      <DialogImage
        width={770}
        height={400}
        src={instructor.feature_image_src}
        alt=""
      />
      <DialogContent>
        <Typography
          component="h2"
          variant="h4"
          sx={{ marginBottom: "8px" }}
          id={titleId}
        >
          {instructor.instructor_name}
        </Typography>
        <Typography variant="subtitle1" sx={{ marginBottom: "16px" }}>
          {instructor.instructor_title}
        </Typography>
        <RawHTML html={instructor.instructor_bio_long} />
      </DialogContent>
    </MuiDialog>
  )
}

const InstructorsSection: React.FC<{ instructors: Faculty[] }> = ({
  instructors,
}) => {
  return (
    <InstructorsSectionRoot aria-labelledby={HeadingIds.Instructors}>
      <Typography variant="h4" component="h2" id={HeadingIds.Instructors}>
        Meet your instructors
      </Typography>
      <InstructorsList>
        {instructors.map((instructor) => {
          return <InstructorCard key={instructor.id} instructor={instructor} />
        })}
      </InstructorsList>
    </InstructorsSectionRoot>
  )
}

export default InstructorsSection
