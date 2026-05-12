"use client"

import React from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"

type FallbackErrorPageProps = {
  hideHomeButton?: boolean
}

const FallbackErrorPage = ({ hideHomeButton }: FallbackErrorPageProps) => {
  return (
    <ErrorPageTemplate
      title="Something went wrong."
      hideHomeButton={hideHomeButton}
    />
  )
}

export default FallbackErrorPage
