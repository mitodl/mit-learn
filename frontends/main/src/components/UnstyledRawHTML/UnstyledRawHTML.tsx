import DOMPurify from "isomorphic-dompurify"
import type { Config } from "isomorphic-dompurify"
import React, { memo } from "react"
import classnames from "classnames"

type UnstyledRawHTMLProps = {
  html: string
  className?: string
  Component?: React.ElementType
}

const SANITIZE_CONFIG: Config = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "frameborder",
    "scrolling",
    "width",
    "height",
    "title",
    "referrerpolicy",
  ],
  ADD_URI_SAFE_ATTR: ["src"],
  ALLOWED_URI_REGEXP: /^(?:(?:https):)|^(?:data:image\/)/i,
}

const UnstyledRawHTML: React.FC<UnstyledRawHTMLProps> = memo(
  ({ html, className, Component = "div" }) => {
    return (
      <Component
        className={classnames("raw-html", className)}
        data-testid="raw"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(html, SANITIZE_CONFIG),
        }}
      />
    )
  },
)

export default UnstyledRawHTML
export type { UnstyledRawHTMLProps }
