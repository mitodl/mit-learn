import React from "react"
import { ButtonLink, type ButtonProps } from "@mitodl/smoot-design"
import { RiCheckLine } from "@remixicon/react"

type EnrolledLinkProps = {
  href: string
  variant: ButtonProps["variant"]
}

const EnrolledLink: React.FC<EnrolledLinkProps> = ({ href, variant }) => {
  return (
    <ButtonLink variant={variant} size="large" href={href}>
      Enrolled
      <RiCheckLine aria-hidden="true" />
    </ButtonLink>
  )
}

export default EnrolledLink
