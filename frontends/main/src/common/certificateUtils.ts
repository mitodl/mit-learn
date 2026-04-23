import type {
  V2ProgramCertificate,
  V2CourseRunCertificate,
} from "@mitodl/mitxonline-api-axios/v2"

import { LINKEDIN_ADD_TO_PROFILE_BASE_URL } from "@/common/urls"

/**
 * Returns common display info for a certificate.
 */
export const getCertificateInfo = (): { displayType: string } => {
  return {
    displayType: "Certificate",
  }
}

export enum CertificateType {
  Course = "course",
  Program = "program",
}

/* Unsure if I should use NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL or NEXT_PUBLIC_MITX_ONLINE_BASE_URL
 * The below matches my naive expectations but we need to confirm that since we need unauthenticated access
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL

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

export const getVerifiableCredentialDownloadAPIURL = (
  verifiableCredentialJson: VerifiableCredential,
): string => {
  const type =
    verifiableCredentialJson["credentialSubject"]["achievement"][
      "achievementType"
    ].toLowerCase()
  const certId = verifiableCredentialJson["id"].substring(9)
  return `${API_BASE_URL}/api/v2/verifiable_${type}_credential/${certId}/download`
}

export const getVerifiableCredentialLinkedInURL = (
  verifiableCredentialJson: VerifiableCredential,
): string => {
  const certId = verifiableCredentialJson["id"].substring(9)
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
  return encodeURI(
    `${LINKEDIN_ADD_TO_PROFILE_BASE_URL}?startTask=CERTIFICATION_NAME&name=${credentialName}&organizationId=${ORG_ID}&issueYear=${issueYear}&issueMonth=${issueMonth}&certId=${certId}&certUrl=${certUrl}`,
  )
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
  return `${LINKEDIN_ADD_TO_PROFILE_BASE_URL}?startTask=CERTIFICATION_NAME&name=${credentialName}&certId=${certId}&certUrl=${pageUrl}&organizationId=${ORG_ID}`
}
