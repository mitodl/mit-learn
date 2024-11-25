"use client"

import React from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"

const NotFoundPage: React.FC = () => {
  return (
    <ErrorPageTemplate title="404 Not Found Error">
      Resource Not Found
    </ErrorPageTemplate>
  )
}

export default NotFoundPage
