import React from "react"
import { theme, useMediaQuery } from "ol-components"
import * as Styled from "./VideoSeriesDetailPage.styled"

type MetaRowProps = {
  metaParts: string[]
  instructorNames: string | null
  departmentName: string | null
  term: string | null
}

const MetaRow: React.FC<MetaRowProps> = ({
  metaParts,
  instructorNames,
  departmentName,
  term,
}) => {
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

  if (isMobile) {
    if (!instructorNames && !departmentName && !term) return null
    return (
      <Styled.MetaRow>
        {instructorNames && (
          <Styled.MetaInstructorLine>
            {instructorNames}
          </Styled.MetaInstructorLine>
        )}
      </Styled.MetaRow>
    )
  }

  if (metaParts.length === 0) return null
  return <Styled.MetaRow>{metaParts.join(" · ")}</Styled.MetaRow>
}

export default MetaRow
