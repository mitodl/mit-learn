"use client"

import React from "react"
import { EnrollmentDisplay } from "./CoursewareDisplay/EnrollmentDisplay"

interface ProgramContentProps {
  programId: number
}

const ProgramContent: React.FC<ProgramContentProps> = ({ programId }) => {
  return <EnrollmentDisplay programId={programId} />
}

export default ProgramContent
