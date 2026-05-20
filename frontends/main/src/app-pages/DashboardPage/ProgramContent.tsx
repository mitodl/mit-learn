"use client"

import React from "react"
import { ProgramEnrollmentDisplay } from "./CoursewareDisplay/ProgramEnrollmentDisplay"

interface ProgramContentProps {
  programId: number
}

const ProgramContent: React.FC<ProgramContentProps> = ({ programId }) => {
  return <ProgramEnrollmentDisplay programId={programId} />
}

export default ProgramContent
