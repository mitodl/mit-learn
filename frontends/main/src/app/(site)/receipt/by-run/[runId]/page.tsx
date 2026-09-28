import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { standardizeMetadata } from "@/common/metadata"
import { ReceiptByRunRedirect } from "@/app-pages/ReceiptPage/ReceiptRedirect"

export const metadata: Metadata = standardizeMetadata({
  title: "Receipt",
  robots: { index: false },
})

/**
 * Resolves a course run to the order covering it and redirects to that order's
 * receipt. See `ReceiptRedirect` for why this route exists.
 */
const Page: React.FC<AppPageProps<"/receipt/by-run/[runId]">> = async ({
  params,
}) => {
  const { runId } = await params
  const id = Number(runId)
  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  return <ReceiptByRunRedirect runId={id} />
}

export default Page
