"use client"

import React from "react"
import { EmptyTableMessage } from "@/components/B2BTable/B2BTable"

/**
 * What a section renders in place of its content when its own query failed.
 *
 * Kept distinct from the empty state on purpose. Each section receives only
 * `rows`, which is `undefined` on both a successful empty response and a failed
 * one, so without this a failed section would say "No … recorded yet" — a
 * manager would read that as "my org has no activity" rather than "we could not
 * reach the analytics API". Same reasoning as the suppression marker: never let
 * an absence of data render as a factual zero.
 */

const SECTION_ERROR_MESSAGE =
  "This data could not be loaded. Please try again later."

const SectionError: React.FC = () => (
  <EmptyTableMessage role="status">{SECTION_ERROR_MESSAGE}</EmptyTableMessage>
)

export default SectionError
export { SECTION_ERROR_MESSAGE }
