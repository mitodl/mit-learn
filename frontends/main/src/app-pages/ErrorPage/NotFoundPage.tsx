"use client"

import React from "react"
import ErrorPageTemplate from "./ErrorPageTemplate"

const NotFoundPage: React.FC = () => {
  return (
    <ErrorPageTemplate
      title="Looks like we couldn't find what you were looking for!"
      timSays="404"
    />
  )
}

export default NotFoundPage
