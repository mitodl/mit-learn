import DOMPurify from "isomorphic-dompurify"
import type { Config } from "isomorphic-dompurify"
import React, { memo } from "react"
import classnames from "classnames"
import { externalLinkProps } from "@/common/utils"

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
  ALLOWED_URI_REGEXP: /^(?:(?:https|mailto):)|^(?:data:image\/)/i,
}

/**
 * Sanitizes the HTML and sets target="_blank" on links to other origins. The
 * target is set on the sanitized DOM, which is then serialized once. Editing
 * the serialized string instead is unsafe: some serializers (older browsers,
 * jest's jsdom) leave "<" and ">" raw inside attribute values, so a string
 * edit can turn attribute text into markup.
 */
const sanitizeHtml = (html: string): string => {
  const fragment = DOMPurify.sanitize(html, {
    ...SANITIZE_CONFIG,
    RETURN_DOM_FRAGMENT: true,
  })
  fragment.querySelectorAll("a[href]").forEach((anchor) => {
    const { target } = externalLinkProps(anchor.getAttribute("href") ?? "")
    if (target) anchor.setAttribute("target", target)
  })
  const container = fragment.ownerDocument.createElement("div")
  container.append(fragment)
  return container.innerHTML
}

/**
 * Sanitizes an HTML string and renders it. Render HTML from the mitxonline CMS
 * through this component; external links in it open in a new tab.
 */
const UnstyledRawHTML: React.FC<UnstyledRawHTMLProps> = memo(
  ({ html, className, Component = "div" }) => {
    return (
      <Component
        className={classnames("raw-html", className)}
        data-testid="raw"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    )
  },
)

export default UnstyledRawHTML
export type { UnstyledRawHTMLProps }
