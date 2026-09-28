import { styled, css } from "ol-components"

/**
 * Shared chrome for the admin options panel: the label above a control and the
 * small print under it. Kept out of SearchDisplay so the components it renders
 * in the panel (e.g. VectorAdminOptions) can use them without importing their
 * parent.
 */
export const ExplanationContainer = styled.div`
  ${({ theme }) => css({ ...theme.typography.body3 })}
  color: ${({ theme }) => theme.custom.colors.silverGrayDark};
`

export const AdminTitleContainer = styled.div`
  ${({ theme }) => css({ ...theme.typography.subtitle3 })}
  margin-top: 20px;
`
