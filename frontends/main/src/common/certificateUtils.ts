import type {
  V2ProgramCertificate,
  V2CourseRunCertificate,
} from "@mitodl/mitxonline-api-axios/v2"

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

// TODO: I strongly suspect that this is not the right way to generate this.
// Should I be doing something with the API client to derive the url? Need to talk to someone who knows more about Learn frontend arch.
export const getCertificateDownloadAPIURL = (
  verifiableCredentialJson: VerifiableCredential,
): string => {
  const type =
    verifiableCredentialJson["credentialSubject"]["achievement"][
      "achievementType"
    ].toLowerCase()
  const certId = verifiableCredentialJson["id"].substring(9)
  return `https://mitxonline.mit.edu/api/v2/verifiable_${type}_credential/${certId}/download`
}

export const getVerifiableCredentialLinkedInURL = (
  verifiableCredentialJson: VerifiableCredential,
): string => {
  const certId = verifiableCredentialJson["id"].substring(9)
  const credentialName =
    verifiableCredentialJson["credentialSubject"]["achievement"]["name"]
  const orgName = verifiableCredentialJson["issuer"]["name"]
  const issueYear = new Date(
    verifiableCredentialJson["validFrom"],
  ).getFullYear()
  const issueMonth =
    new Date(verifiableCredentialJson["validFrom"]).getMonth() + 1

  const certUrl = getCertificateDownloadAPIURL(verifiableCredentialJson)
  return encodeURI(
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${credentialName}&organizationName=${orgName}&issueYear=${issueYear}&issueMonth=${issueMonth}&certId=${certId}&certUrl=${certUrl}`,
  )
}

export const getCertificateLinkedInUrl = (
  certificateType: CertificateType,
  certificateData: V2ProgramCertificate | V2CourseRunCertificate,
  pageUrl: string,
): string => {
  const credentialName =
    certificateType === CertificateType.Course
      ? certificateData.course_run.course.title
      : certificateData.program.title
  const certId = certificateData.uuid
  return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${credentialName}&certId=${certId}&certUrl=${pageUrl}`
}
