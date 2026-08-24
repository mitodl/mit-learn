import React from "react"
import { notFound } from "next/navigation"
import type { AppPageProps } from "@/common/searchParams"

export const generateMetadata = () => notFound()

const UnmatchedPage: React.FC<AppPageProps<"/[...unmatched]">> = () =>
  notFound()

export default UnmatchedPage
