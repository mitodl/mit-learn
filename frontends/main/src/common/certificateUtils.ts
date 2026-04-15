/**
 * Returns common display info for a certificate.
 */
export const getCertificateInfo = (): { displayType: string } => {
  return {
    displayType: "Certificate",
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
