import DOMPurify from "isomorphic-dompurify"
import { styled } from "@mitodl/smoot-design"
import React, { memo } from "react"
import classnames from "classnames"

const UnstyledRawHTML: React.FC<{
  html: string
  className?: string
  Component?: React.ElementType
}> = memo(({ html, className, Component = "div" }) => {
  return (
    <Component
      className={classnames("raw-html", className)}
      data-testid="raw"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  )
})

const RawHTML = styled(UnstyledRawHTML)(({ theme }) => ({
  "*:first-child": {
    marginTop: 0,
  },
  ...theme.typography.body1,
  lineHeight: "1.5",
  p: {
    marginTop: "16px",
    marginBottom: "0",
  },
  "& > ul": {
    listStyleType: "none",
    marginTop: "16px",
    marginBottom: 0,
    padding: 0,
    "> li": {
      padding: "16px",
      border: `1px solid ${theme.custom.colors.lightGray2}`,
      borderBottom: "none",
      ":first-of-type": {
        borderRadius: "4px 4px 0 0",
      },
      ":last-of-type": {
        borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
        borderRadius: "0 0 4px 4px",
      },
      ":first-of-type:last-of-type": {
        borderRadius: "4px",
      },
    },
  },
  [theme.breakpoints.down("md")]: {
    ...theme.typography.body2,
  },
}))

export default RawHTML
export { UnstyledRawHTML }
