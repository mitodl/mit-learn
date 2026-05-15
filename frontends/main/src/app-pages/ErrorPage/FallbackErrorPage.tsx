"use client"

import React from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"

type FallbackErrorPageProps = {
  showHomeButton?: boolean
}

const FallbackErrorPage = ({ showHomeButton }: FallbackErrorPageProps) => {
  return (
    <ErrorPageTemplate
      title="Something went wrong."
      showHomeButton={showHomeButton}
    />
  )
}

export default FallbackErrorPage
