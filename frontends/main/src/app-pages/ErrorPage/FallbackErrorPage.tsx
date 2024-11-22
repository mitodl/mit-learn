"use client"

import React from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"

const FallbackErrorPage = ({ error }: { error: Pick<Error, "message"> }) => {
  return (
    <ErrorPageTemplate title="Something went wrong.">
      {error.message}
    </ErrorPageTemplate>
  )
}

export default FallbackErrorPage
