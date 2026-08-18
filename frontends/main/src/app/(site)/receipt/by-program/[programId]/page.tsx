import React from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { standardizeMetadata } from "@/common/metadata"
import { ReceiptByProgramRedirect } from "@/app-pages/ReceiptPage/ReceiptRedirect"

export const metadata: Metadata = standardizeMetadata({
  title: "Receipt",
  robots: { index: false },
})

/**
 * Resolves a program to the order covering it and redirects to that order's
 * receipt. See `ReceiptRedirect` for why this route exists.
 */
const Page: React.FC<PageProps<"/receipt/by-program/[programId]">> = async ({
  params,
}) => {
  const { programId } = await params
  const id = Number(programId)
  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  return <ReceiptByProgramRedirect programId={id} />
}

export default Page
