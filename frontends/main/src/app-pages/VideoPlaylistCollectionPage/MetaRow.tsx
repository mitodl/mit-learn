import React from "react"
import * as Styled from "./VideoSeriesDetailPage.styled"

type MetaRowProps = {
  metaParts: string[]
  instructorNames: string | null
  departmentName: string | null
  duration: string | null
  term: string | null
}

const MetaRow: React.FC<MetaRowProps> = ({
  metaParts,
  instructorNames,
  departmentName,
  duration,
  term,
}) => {
  return (
    <>
      {metaParts.length > 0 && (
        <Styled.HideOnMobile>
          <Styled.MetaRow>{metaParts.join(" · ")}</Styled.MetaRow>
        </Styled.HideOnMobile>
      )}
      {(instructorNames || departmentName || duration || term) && (
        <Styled.HideOnDesktop>
          <Styled.MetaRow>
            {instructorNames && (
              <Styled.MetaInstructorLine>
                {instructorNames}
              </Styled.MetaInstructorLine>
            )}
            {departmentName && <div>{departmentName}</div>}
            {(duration || term) && (
              <Styled.StyledDuration>
                {[duration, term].filter(Boolean).join(" · ")}
              </Styled.StyledDuration>
            )}
          </Styled.MetaRow>
        </Styled.HideOnDesktop>
      )}
    </>
  )
}

export default MetaRow
