import { env } from "@/env"
import type {
  V2ProgramCertificate,
  V2CourseRunCertificate,
} from "@mitodl/mitxonline-api-axios/v2"

import { LINKEDIN_ADD_TO_PROFILE_BASE_URL } from "@/common/urls"

export type CertificateBadgeLines = {
  primary: string
  secondary?: string
  registeredMark?: boolean
}

type ProgramTypeLabelKey = "micromasters" | "series" | "program"

type CertificateLabel = {
  displayType: string
  badgeLines: CertificateBadgeLines
}

const PROGRAM_TYPE_LABELS: Record<ProgramTypeLabelKey, CertificateLabel> = {
  micromasters: {
    displayType: "MicroMasters\u00ae Certificate",
    badgeLines: {
      primary: "MicroMasters",
      secondary: "Certificate",
      registeredMark: true,
    },
  },
  series: {
    displayType: "Series Certificate",
    badgeLines: { primary: "Series", secondary: "Certificate" },
  },
  program: {
    displayType: "Program Certificate",
    badgeLines: { primary: "Program", secondary: "Certificate" },
  },
}

const DEFAULT_LABEL: CertificateLabel = {
  displayType: "Certificate",
  badgeLines: { primary: "Certificate" },
}

const normalizeProgramType = (programType?: string | null): string =>
  (programType ?? "")
    .trim()
    .toLowerCase()
    .replace(/®/g, "")
    .replace(/\s+/g, "")

/*
 * program_type is a free-form string on the client (`string | null`); the
 * canonical enum is owned by MITx Online. Match the normalized value exactly
 * against the known descriptors so unexpected values fall back to the plain
 * "Certificate" label instead of being silently coerced (e.g. a prefix match
 * on "micromasters" would swallow data issues).
 */
const resolveKey = (
  programType?: string | null,
): ProgramTypeLabelKey | undefined => {
  const normalized = normalizeProgramType(programType)
  return Object.hasOwn(PROGRAM_TYPE_LABELS, normalized)
    ? (normalized as ProgramTypeLabelKey)
    : undefined
}

const resolveCertificateLabel = (
  programType?: string | null,
): CertificateLabel => {
  const key = resolveKey(programType)
  return key ? PROGRAM_TYPE_LABELS[key] : DEFAULT_LABEL
}

/**
 * Returns common display info for a certificate.
 */
export const getCertificateInfo = (
  programType?: string | null,
): { displayType: string } => ({
  displayType: resolveCertificateLabel(programType).displayType,
})

export const getCertificateTitle = (
  productName: string | null | undefined,
  fallbackTitle: string,
): string => productName?.trim() || fallbackTitle

const BADGE_REGISTERED_MARK_SCALE = 0.645

export type CertificateBadgeTypography = {
  fontSizePx: number
  lineHeightPx: number
  registeredMarkScale: number
}

const MICROMASTERS_BADGE_TYPOGRAPHY: CertificateBadgeTypography = {
  fontSizePx: 18,
  lineHeightPx: 26,
  registeredMarkScale: BADGE_REGISTERED_MARK_SCALE,
}

const DEFAULT_BADGE_TYPOGRAPHY: CertificateBadgeTypography = {
  fontSizePx: 24,
  lineHeightPx: 30,
  registeredMarkScale: BADGE_REGISTERED_MARK_SCALE,
}

export const getCertificateBadgeLines = (
  programType?: string | null,
): CertificateBadgeLines => resolveCertificateLabel(programType).badgeLines

/**
 * Badge typography for the certificate seal (Figma: 24px bold; MicroMasters 18px).
 */
export const getCertificateBadgeTypography = (
  programType?: string | null,
): CertificateBadgeTypography =>
  resolveKey(programType) === "micromasters"
    ? MICROMASTERS_BADGE_TYPOGRAPHY
    : DEFAULT_BADGE_TYPOGRAPHY

export enum CertificateType {
  Course = "course",
  Program = "program",
}

/* Unsure if I should use NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL or NEXT_PUBLIC_MITX_ONLINE_BASE_URL
 * The below matches my naive expectations but we need to confirm that since we need unauthenticated access
 */

const API_BASE_URL = env("NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL")

/* This is the Organization ID for MIT OpenLearning on LinkedIn as far as I can tell. We could parameterize this if needed */
const ORG_ID = 74540637

/*
 * This interface defines the structure of a VerifiableCredential (Open Badges v3.0).
 * While this type is not explicitly defined / unknown in our API, we can rely on its stability
 * because the structure and fields are mandated by the Open Badges v3.0 specification.
 *
 * References:
 * - https://www.imsglobal.org/spec/ob/v3p0#verifiablecredential
 * - https://www.imsglobal.org/spec/ob/v3p0#complete-openbadgecredential
 * - https://github.com/digitalcredentials/mit-learn-obv3-template/tree/main?tab=readme-ov-file#recommended-properties-for-obv3
 *
 * We may type it on the API in a later revision.
 */
export interface VerifiableCredential {
  id: string
  type: string[]
  proof?: {
    type: string
    created: string
    proofValue: string
    cryptosuite: string
    proofPurpose: string
    verificationMethod: string
  }
  issuer: {
    id: string
    name: string
    type: string[]
    image?: {
      id: string
      type: string
      caption?: string
    }
  }
  "@context": string[]
  validFrom: string
  validUntil: string
  credentialSubject: {
    type: string[]
    identifier: Array<{
      salt: string
      type: string
      hashed: boolean
      identityHash: string
      identityType: string
    }>
    achievement: {
      id: string
      name: string
      type: string[]
      image?: {
        id: string
        type: string
        caption?: string
      }
      criteria?: {
        narrative: string
      }
      description: string
      achievementType: string
    }
    activityEndDate?: string
    activityStartDate?: string
  }
}

/*
The ID in a verifiable credential is prefixed with "urn:uuid:",
so we strip that out for reference outside of our systems
*/
export const getIDFromVerifiableCredential = (
  verifiableCredentialJson: VerifiableCredential,
): string => {
  return verifiableCredentialJson["id"].substring(9)
}

export const getVerifiableCredentialDownloadAPIURL = (
  verifiableCredentialJson: VerifiableCredential,
): string => {
  const type =
    verifiableCredentialJson["credentialSubject"]["achievement"][
      "achievementType"
    ].toLowerCase()
  const certId = getIDFromVerifiableCredential(verifiableCredentialJson)
  return `${API_BASE_URL}/api/v2/verifiable_${type}_credential/${certId}/download`
}

export const getVerifiableCredentialLinkedInURL = (
  verifiableCredentialJson: VerifiableCredential,
): string => {
  const certId = getIDFromVerifiableCredential(verifiableCredentialJson)
  const credentialName =
    verifiableCredentialJson["credentialSubject"]["achievement"]["name"]
  const issueYear = new Date(
    verifiableCredentialJson["validFrom"],
  ).getFullYear()
  const issueMonth =
    new Date(verifiableCredentialJson["validFrom"]).getMonth() + 1

  const certUrl = getVerifiableCredentialDownloadAPIURL(
    verifiableCredentialJson,
  )
  /* TODO: Should I link to the certificate page instead of the download URL? */
  const linkedinUrl = new URL(LINKEDIN_ADD_TO_PROFILE_BASE_URL)
  linkedinUrl.searchParams.set("startTask", "CERTIFICATION_NAME")
  linkedinUrl.searchParams.set("name", credentialName)
  linkedinUrl.searchParams.set("organizationId", ORG_ID.toString())
  linkedinUrl.searchParams.set("issueYear", issueYear.toString())
  linkedinUrl.searchParams.set("issueMonth", issueMonth.toString())
  linkedinUrl.searchParams.set("certId", certId)
  linkedinUrl.searchParams.set("certUrl", certUrl)
  return linkedinUrl.toString()
}

export const getCertificateLinkedInUrl = (
  certificateType: CertificateType,
  certificateData: V2ProgramCertificate | V2CourseRunCertificate,
  pageUrl: string,
): string => {
  const credentialName =
    certificateType === CertificateType.Course
      ? (certificateData as V2CourseRunCertificate).course_run.course.title
      : (certificateData as V2ProgramCertificate).program.title
  const certId = certificateData.uuid
  const linkedinUrl = new URL(LINKEDIN_ADD_TO_PROFILE_BASE_URL)
  linkedinUrl.searchParams.set("startTask", "CERTIFICATION_NAME")
  linkedinUrl.searchParams.set("name", credentialName)
  linkedinUrl.searchParams.set("certId", certId)
  linkedinUrl.searchParams.set("certUrl", pageUrl)
  linkedinUrl.searchParams.set("organizationId", ORG_ID.toString())
  return linkedinUrl.toString()
}
