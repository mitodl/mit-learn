import React from "react"
import Image from "next/image"
import { Dialog, Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import VerifyIcon from "@/public/images/icons/verify.svg"

const Content = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const InfoPanel = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  padding: "16px",
  marginTop: "28px",
  borderRadius: "8px",
  boxShadow:
    "0 3px 8px 0 rgba(37, 38, 43, 0.12), 0 2px 4px 0 rgba(37, 38, 43, 0.10)",
}))

const Info = styled.dl({
  display: "flex",
  flexDirection: "row",
  gap: "16px",
  alignItems: "stretch",
  marginBottom: "28px",
})

const InfoColumn = styled.dl(({ theme }) => ({
  flexGrow: 2,
  alignSelf: "stretch",
  ":last-child": {
    borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
    paddingLeft: "16px",
    flexGrow: 1,
  },
}))

const InfoTerm = styled.dt(({ theme }) => ({
  ...theme.typography.subtitle2,
  textWrap: "nowrap",
}))

const InfoDetail = styled.dd(({ theme }) => ({
  ...theme.typography.body2,
  margin: "0 0 16px 0",
}))

const Verify = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  paddingTop: "16px",
}))

const StyledButtonLink = styled(ButtonLink)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

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

export const DigitalCredentialDialog = ({
  verifiableCredential,
  open,
  onClose,
}: {
  verifiableCredential: VerifiableCredential
  open: boolean
  onClose: () => void
}) => {
  const { issuer, validFrom, validUntil, credentialSubject } =
    verifiableCredential
  const { identifier, achievement } = credentialSubject
  return (
    <Dialog
      open={open}
      title="Download Digital Credential"
      confirmText="Download Digital Credential"
      onClose={onClose}
      onConfirm={() => {
        const jsonString = JSON.stringify(verifiableCredential, null, 2)
        const blob = new Blob([jsonString], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "digital-credential.json"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }}
      contentCss={{
        overflow: "visible",
        margin: "24px 28px",
      }}
    >
      <Content>
        <Typography variant="body2">
          A <strong>Digital Credential</strong> is a portable, digitally-signed
          file describing your achievement, that you can add to social profiles
          and digital resumes.
        </Typography>

        <Typography variant="body2">
          Learners choose this option if they need to add a verified credential
          to a social profile like LinkedIn.
        </Typography>

        <InfoPanel>
          <Typography variant="subtitle1">Digital Credential</Typography>
          <Info>
            <InfoColumn>
              <InfoTerm>Issuer:</InfoTerm>
              <InfoDetail>{issuer.name}</InfoDetail>
              <InfoTerm>Issuance Date:</InfoTerm>
              <InfoDetail>
                {validFrom ? new Date(validFrom).toLocaleDateString() : "N/A"}
              </InfoDetail>
              <InfoTerm>Expiration Date:</InfoTerm>
              <InfoDetail>
                {validFrom ? new Date(validUntil).toLocaleDateString() : "N/A"}
              </InfoDetail>
            </InfoColumn>
            <InfoColumn>
              <InfoTerm>Issued To:</InfoTerm>
              <InfoDetail>{identifier[0].identityHash}</InfoDetail>
              <InfoTerm>Description:</InfoTerm>
              <InfoDetail>{achievement.description}</InfoDetail>
              <InfoTerm>Criteria:</InfoTerm>
              <InfoDetail>{achievement.criteria?.narrative}</InfoDetail>
            </InfoColumn>
          </Info>
          <Verify>
            <StyledButtonLink
              variant="secondary"
              size="large"
              href="https://verifierplus.org/"
              target="_blank"
              endIcon={<Image src={VerifyIcon} alt="" aria-hidden />}
            >
              Verify Credential
            </StyledButtonLink>
          </Verify>
        </InfoPanel>
      </Content>
    </Dialog>
  )
}
