import React from "react"
import { Link, styled } from "ol-components"
import * as urls from "@/common/urls"

const SupportLink = styled(Link)({
  textDecoration: "underline",
})

/**
 * An error message followed by "Contact Support for assistance.", for a failure
 * the user cannot resolve themselves - chiefly enrollment, where the API's own
 * explanation is often only actionable by a human ("Error code: CS_700").
 *
 * Mirrors the copy of the dashboard's upgrade-failure banners, but links to the
 * support site's request form rather than a mailto.
 */
const ErrorMessageWithSupport: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <>
    {/* The message keeps its own node so it stays addressable as a single
        string, separate from this static suffix. */}
    <span>{children}</span>{" "}
    <SupportLink
      color="red"
      href={urls.SUPPORT_REQUEST}
      target="_blank"
      rel="noopener noreferrer"
    >
      Contact Support
    </SupportLink>{" "}
    for assistance.
  </>
)

export default ErrorMessageWithSupport
