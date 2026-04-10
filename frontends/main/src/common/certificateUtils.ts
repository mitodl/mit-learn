/**
 * Returns common display info for a certificate.
 */
export const getCertificateInfo = (): { displayType: string } => {
  return {
    displayType: "Certificate",
  }
}

export const getVerifiableCredentialLinkedInURL = (
  verifiableCredentialJson: object,
): string => {
  // TODO: Need to decide if we want to use this as the cert ID.
  const certId = verifiableCredentialJson["id"].substring(9)
  const credentialName =
    verifiableCredentialJson["credentialSubject"]["achievement"]["name"]
  const orgName = verifiableCredentialJson["issuer"]["name"]
  const issueYear = new Date(
    verifiableCredentialJson["validFrom"],
  ).getFullYear()
  const issueMonth =
    new Date(verifiableCredentialJson["validFrom"]).getMonth() + 1
  // TODO: Need to figure out which URL we want to link.
  // Also need to parameterize on whether or not its a course or a program cert if we go w/ the VC download API
  const certUrl = `https://mitxonline.mit.edu/api/v2/verifiable_course_credential/${certId}/download`
  return encodeURI(
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${credentialName}&organizationName=${orgName}&issueYear=${issueYear}&issueMonth=${issueMonth}&certId=${certId}&certUrl=${certUrl}`,
  )
}
