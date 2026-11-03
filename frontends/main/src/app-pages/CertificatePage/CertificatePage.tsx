"use client"

import { env } from "@/env"
import React, { useRef, useEffect, useCallback, useState } from "react"
import { notFound } from "next/navigation"
import Image from "next/image"
import { Link, Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import backgroundImage from "@/public/images/backgrounds/error_page_background.svg"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { useQuery } from "@tanstack/react-query"
import OpenLearningLogo from "@/public/images/mit-open-learning-logo.svg"
import CertificateBadgeDesktop from "@/public/images/certificate-badge-desktop.svg"
import CertificateBadgeMobile from "@/public/images/certificate-badge-mobile.svg"
import { formatDate, NoSSR } from "ol-utilities"
import { RiDownloadLine, RiPrinterLine, RiShareLine } from "@remixicon/react"
import type {
  V2ProgramCertificate,
  V2CourseRunCertificate,
  SignatoryItem,
} from "@mitodl/mitxonline-api-axios/v2"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import SharePopover from "@/components/SharePopover/SharePopover"
import { DigitalCredentialDialog } from "./DigitalCredentialDialog"
import {
  getCertificateInfo,
  getCertificateTitle,
  getCertificateBadgeLines,
  getCertificateBadgeTypography,
  getVerifiableCredentialLinkedInURL,
  getCertificateLinkedInUrl,
  getVerifierPlusViewerURL,
  CertificateType,
} from "@/common/certificateUtils"

const Page = styled.div(({ theme }) => ({
  backgroundImage: `url(${backgroundImage.src})`,
  backgroundAttachment: "fixed",
  backgroundRepeat: "no-repeat",
  backgroundSize: "contain",
  display: "flow-root",
  flexGrow: 1,
  height: "100%",
  padding: "0 16px 90px",
  [theme.breakpoints.down("sm")]: {
    backgroundImage: "none",
    padding: "0 40px 40px",
  },
}))

const Title = styled(Typography)(({ theme }) => ({
  margin: "60px 160px 40px",
  textAlign: "center",
  span: {
    fontWeight: theme.typography.fontWeightLight,
    color: theme.custom.colors.darkGray2,
  },
  [theme.breakpoints.down("lg")]: {
    span: {
      fontSize: theme.typography.pxToRem(26),
      lineHeight: theme.typography.pxToRem(30),
    },
  },
  [theme.breakpoints.down("md")]: {
    margin: "24px 0",
    span: {
      fontSize: theme.typography.pxToRem(24),
      lineHeight: theme.typography.pxToRem(30),
    },
  },
}))

const Buttons = styled.div(({ theme }) => ({
  display: "flex",
  gap: "12px",
  justifyContent: "center",
  width: "fit-content",
  margin: "0 auto 50px auto",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    width: "100%",
    maxWidth: "460px",
    marginBottom: "32px",
  },
}))

/* The desktop certificate mirrors the Figma frame: 1414 x 1093px, which is
 * US Letter landscape, so the web view and the PDF share the same proportions.
 */
const Outer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  maxWidth: "1414px",
  minWidth: "1200px",
  aspectRatio: "1414 / 1093",
  padding: "32px",
  backgroundColor: theme.custom.colors.white,
  margin: "0 auto",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      padding: 0,
      maxWidth: "unset",
      minWidth: "unset",
      aspectRatio: "unset",
    },
    [theme.breakpoints.down("md")]: {
      padding: 0,
      maxWidth: "460px",
      minWidth: "unset",
    },
  },
  "@media print": {
    boxSizing: "border-box",
    width: "21cm",
    height: "29.7cm",
  },
}))

const Inner = styled.div(({ theme }) => ({
  flex: 1,
  border: `2px solid ${theme.custom.colors.silverGray}`,
  // Figma draws the stroke inside the frame, so content sits 64px from the outer edge
  padding: "62px",
  display: "flex",
  flexDirection: "column",
  gap: "64px",
  position: "relative",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      padding: "40px",
    },
    [theme.breakpoints.down("md")]: {
      border: `2px solid ${theme.custom.colors.lightGray2}`,
      padding: "24px 16px",
      gap: "24px",
      textAlign: "center",
    },
  },
  "@media print": {
    height: "100%",
    boxSizing: "border-box",
    gap: "52px",
    padding: "46px",
  },
}))

const Logo = styled(Image)(({ theme }) => ({
  width: "260px",
  height: "auto",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      width: "230px",
      height: "59px",
    },
    [theme.breakpoints.down("md")]: {
      width: "129px",
      margin: "0 auto",
    },
  },
  "@media print": {
    display: "none !important",
  },
}))

const PrintLogo = styled.img({
  display: "none",
  "@media print": {
    width: "260px",
    height: "auto",
    display: "block",
  },
})

const Badge = styled.div(({ theme }) => ({
  backgroundImage: `url(${CertificateBadgeDesktop.src})`,
  position: "absolute",
  // Offsets are measured from the outer edge of Inner's 2px border
  top: "-2px",
  right: "46px",
  width: "230px",
  height: "360px",
  textAlign: "center",
  backgroundRepeat: "no-repeat",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      backgroundImage: `url(${CertificateBadgeMobile.src})`,
      top: "24px",
      right: "40px",
      width: "156px",
      height: "191px",
    },
    [theme.breakpoints.down("md")]: {
      position: "relative",
      height: "191px",
      top: 0,
      right: 0,
      margin: "0 auto",
    },
  },
}))

const BadgeLabelRoot = styled.div<{
  $fontSizePx: number
  $lineHeightPx: number
}>(({ theme, $fontSizePx, $lineHeightPx }) => ({
  color: theme.custom.colors.white,
  position: "absolute",
  left: "50%",
  // Center of the seal's inner disc
  top: "177px",
  transform: "translate(-50%, -50%)",
  width: "175px",
  textAlign: "center",
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.pxToRem($fontSizePx),
  lineHeight: theme.typography.pxToRem($lineHeightPx),
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      fontSize: theme.typography.pxToRem(16),
      lineHeight: theme.typography.pxToRem(24),
      top: "77px",
      width: "119px",
    },
    [theme.breakpoints.down("md")]: {
      width: "130px",
    },
  },
}))

const BadgeRegisteredMark = styled.span<{ $scale: number }>(({ $scale }) => ({
  fontSize: `${$scale}em`,
  lineHeight: 1,
  verticalAlign: "super",
}))

const CertificateBadgeLabel = ({
  programType,
}: {
  programType?: string | null
}) => {
  const lines = getCertificateBadgeLines(programType)
  const typography = getCertificateBadgeTypography(programType)

  return (
    <BadgeLabelRoot
      data-testid="certificate-badge-label"
      $fontSizePx={typography.fontSizePx}
      $lineHeightPx={typography.lineHeightPx}
    >
      <div>
        {lines.primary}
        {lines.registeredMark ? (
          <BadgeRegisteredMark $scale={typography.registeredMarkScale}>
            ®
          </BadgeRegisteredMark>
        ) : null}
      </div>
      {lines.secondary ? <div>{lines.secondary}</div> : null}
    </BadgeLabelRoot>
  )
}

const Certification = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  // Keeps the name clear of the stamp; the name wraps instead of shrinking
  paddingRight: "230px",
  ".MuiTypography-h4": {
    color: theme.custom.colors.silverGrayDark,
  },
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      paddingRight: "180px",
      ".MuiTypography-h4": {
        fontSize: theme.typography.pxToRem(16),
        lineHeight: theme.typography.pxToRem(20),
      },
    },
    [theme.breakpoints.down("md")]: {
      paddingRight: 0,
      gap: 0,
      ".MuiTypography-h4": {
        fontSize: theme.typography.pxToRem(16),
        fontWeight: theme.typography.fontWeightMedium,
        lineHeight: "150%",
        color: theme.custom.colors.silverGrayDark,
      },
    },
  },
}))

const NameText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  display: "block",
  fontSize: theme.typography.pxToRem(48),
  lineHeight: theme.typography.pxToRem(60),
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      fontSize: theme.typography.pxToRem(34),
      lineHeight: theme.typography.pxToRem(40),
    },
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.pxToRem(24),
      lineHeight: theme.typography.pxToRem(30),
      marginTop: "4px",
    },
  },
}))

/* Course info lines that sit around the title: 18/26 regular */
const CourseInfoText = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightRegular,
  fontSize: theme.typography.pxToRem(18),
  lineHeight: theme.typography.pxToRem(26),
  color: theme.custom.colors.silverGrayDark,
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      fontSize: theme.typography.pxToRem(16),
      lineHeight: theme.typography.pxToRem(24),
    },
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(18),
    },
  },
}))

const CourseTitle = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.pxToRem(18),
      lineHeight: theme.typography.pxToRem(26),
    },
  },
}))

const CourseInfo = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  // Fills the remaining height so the signatures sit at the bottom
  flexGrow: 1,
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      gap: "8px",
    },
  },
}))

const SignatureFooter = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  paddingTop: "24px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      borderTop: "none",
      paddingTop: 0,
      gap: "24px",
    },
  },
}))

const Signatories = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "16px 12px",
  width: "100%",
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
      gap: "24px",
    },
  },
}))

const Signatory = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  width: "296px",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      width: "calc((100% - 36px) / 4)",
      minWidth: "200px",
    },
    [theme.breakpoints.down("md")]: {
      width: "100%",
      minWidth: 0,
      borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
      paddingBottom: "24px",
    },
  },
}))

const SignatoryText = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  ".MuiTypography-body2": {
    color: theme.custom.colors.silverGrayDark,
  },
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      ".MuiTypography-body2": {
        color: theme.custom.colors.darkGray1,
      },
    },
  },
}))

const Signature = styled.img(({ theme }) => ({
  display: "block",
  width: "auto",
  maxWidth: "100%",
  height: "40px",
  objectFit: "contain",
  objectPosition: "left",
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      margin: "0 auto",
      objectPosition: "center",
    },
  },
}))

const SignatoryName = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.pxToRem(16),
      lineHeight: "150%",
      marginTop: "12px",
    },
  },
}))

const CertificateId = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
  span: {
    color: theme.custom.colors.silverGrayDark,
  },
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      span: {
        display: "block",
      },
    },
  },
}))

const Note = styled(Typography)(({ theme }) => ({
  margin: "48px 0 64px 0",
  textAlign: "center",
  fontSize: theme.typography.pxToRem(16),
  a: {
    color: theme.custom.colors.red,
    textDecoration: "underline",
    fontSize: theme.typography.pxToRem(16),
  },
  [theme.breakpoints.down("lg")]: {
    fontSize: theme.typography.pxToRem(14),
    lineHeight: theme.typography.pxToRem(18),
    a: {
      fontSize: theme.typography.pxToRem(14),
    },
  },
  [theme.breakpoints.down("md")]: {
    margin: "32px 0 16px",
    textAlign: "left",
  },
}))

const PrintContainer = styled.div({
  pageBreakInside: "avoid",
  "@page": {
    size: "A4 landscape",
    margin: "1cm",

    // Safari
    height: "21cm",
    width: "29.7cm",
  },
  "@media print": {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    boxSizing: "border-box",
    svg: {
      display: "block",
      visibility: "visible",
      printColorAdjust: "exact",
      WebkitPrintColorAdjust: "exact",
    },
    img: {
      display: "block",
      visibility: "visible",
      maxWidth: "100%",
      height: "auto",
      pageBreakInside: "avoid",
    },
    ".certificate-signature": {
      display: "block",
      visibility: "visible",
      width: "auto",
      height: "60px",
      maxWidth: "200px",
      objectFit: "contain",
    },
    "*": {
      printColorAdjust: "exact",
      WebkitPrintColorAdjust: "exact",
    },
    ".no-print": {
      display: "none",
    },
  },
})

const Certificate = ({
  title,
  badgeProgramType,
  userName,
  ceus,
  signatories,
  issueDate,
  uuid,
}: {
  title: string
  badgeProgramType?: string | null
  userName?: string
  ceus?: string
  signatories: SignatoryItem[]
  issueDate?: string | null
  uuid: string
}) => {
  return (
    <Outer>
      <Inner>
        <Logo src={OpenLearningLogo} alt="MIT Open Learning" />
        <PrintLogo src={OpenLearningLogo.src} alt="MIT Open Learning" />
        <Badge data-testid="certificate-badge">
          <CertificateBadgeLabel programType={badgeProgramType} />
        </Badge>
        <Certification>
          <Typography variant="h4">This is to certify that</Typography>
          <NameText variant="h1">{userName}</NameText>
        </Certification>
        <CourseInfo>
          <CourseInfoText>
            has successfully completed all requirements of:
          </CourseInfoText>
          <CourseTitle variant="h3">{title}</CourseTitle>
          {ceus ? (
            <CourseInfoText>
              Awarded {ceus} Continuing Education Units (CEUs)
            </CourseInfoText>
          ) : null}
          {issueDate && (
            <CourseInfoText>
              Awarded on <NoSSR>{formatDate(issueDate, "MMMM D, YYYY")}</NoSSR>
            </CourseInfoText>
          )}
        </CourseInfo>
        <SignatureFooter>
          <Signatories>
            {signatories?.map((signatory, index) => (
              <Signatory key={index}>
                <Signature
                  src={
                    signatory.signature_image.startsWith("http")
                      ? signatory.signature_image
                      : `${env("NEXT_PUBLIC_MITX_ONLINE_BASE_URL")}${signatory.signature_image}`
                  }
                  alt={signatory.name}
                  crossOrigin="anonymous"
                />
                <SignatoryText>
                  <SignatoryName variant="h5">{signatory.name}</SignatoryName>
                  {signatory.title_1 && (
                    <Typography variant="body2">{signatory.title_1}</Typography>
                  )}
                  {signatory.title_2 && (
                    <Typography variant="body2">{signatory.title_2}</Typography>
                  )}
                  {signatory.title_3 && (
                    <Typography variant="body2">{signatory.title_3}</Typography>
                  )}
                  {signatory.organization && (
                    <Typography variant="body2">
                      {signatory.organization}
                    </Typography>
                  )}
                </SignatoryText>
              </Signatory>
            ))}
          </Signatories>
          <CertificateId variant="body2">
            Valid Credential ID: <span>{uuid}</span>
          </CertificateId>
        </SignatureFooter>
      </Inner>
    </Outer>
  )
}

const CourseCertificate = ({
  certificate,
  title,
}: {
  certificate: V2CourseRunCertificate
  title: string
}) => {
  const userName = certificate.user.name

  const ceus = certificate.certificate_page.CEUs

  const signatories = certificate.certificate_page.signatory_items
  const issueDate = certificate?.issue_date

  return (
    <Certificate
      title={title}
      userName={userName}
      ceus={ceus}
      signatories={signatories}
      issueDate={issueDate}
      uuid={certificate.uuid}
    />
  )
}

const ProgramCertificate = ({
  certificate,
  title,
}: {
  certificate: V2ProgramCertificate
  title: string
}) => {
  const userName = certificate.user.name

  const ceus = certificate.certificate_page.CEUs

  const signatories = certificate.certificate_page.signatory_items

  const issueDate = certificate?.issue_date

  return (
    <Certificate
      title={title}
      badgeProgramType={certificate?.program?.program_type}
      userName={userName}
      ceus={ceus}
      signatories={signatories}
      issueDate={issueDate}
      uuid={certificate.uuid}
    />
  )
}

const CertificatePage: React.FC<{
  certificateType: CertificateType
  uuid: string
  pageUrl: string
}> = ({ certificateType, uuid, pageUrl }) => {
  const [digitalCredentialDialogOpen, setDigitalCredentialDialogOpen] =
    useState(false)

  const { data: userData } = useQuery(mitxUserQueries.me())

  const {
    data: courseCertificateData,
    isLoading: isCourseLoading,
    isError: isCourseError,
  } = useQuery({
    ...certificateQueries.courseCertificatesRetrieve({
      uuid,
    }),
    enabled: certificateType === CertificateType.Course,
  })

  const {
    data: programCertificateData,
    isLoading: isProgramLoading,
    isError: isProgramError,
  } = useQuery({
    ...certificateQueries.programCertificatesRetrieve({
      uuid,
    }),
    enabled: certificateType === CertificateType.Program,
  })

  const contentRef = useRef<HTMLDivElement>(null)

  const print = useCallback(async () => {
    const pdfUrl = `/certificate/${certificateType}/${uuid}/pdf`
    fetch(pdfUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const iframe = document.createElement("iframe")
        iframe.style.display = "none"
        iframe.src = url
        document.body.appendChild(iframe)
        iframe.onload = () => {
          iframe.contentWindow?.print()
        }
      })
  }, [certificateType, uuid])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "p") {
        event.preventDefault()
        print()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [print])

  const [shareOpen, setShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLDivElement>(null)

  if (isCourseLoading || isProgramLoading) {
    return <Page />
  }

  // MITx Online returns 500 for non-existent certificates. We can assume not found.
  if (isCourseError || isProgramError) {
    return notFound()
  }

  let title = ""
  if (certificateType === CertificateType.Course) {
    title = getCertificateTitle(
      courseCertificateData?.certificate_page?.product_name,
      courseCertificateData?.course_run.course.title ?? "",
    )
  } else {
    title = getCertificateTitle(
      programCertificateData?.certificate_page?.product_name,
      programCertificateData?.program.title ?? "",
    )
  }

  const download = async () => {
    const res = await fetch(`/certificate/${certificateType}/${uuid}/pdf`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title} Certificate issued by MIT Open Learning.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const { displayType } = getCertificateInfo(
    programCertificateData?.program?.program_type,
  )

  const certificateData =
    certificateType === CertificateType.Course
      ? courseCertificateData
      : programCertificateData

  const isCertificateForCurrentUser = userData?.id === certificateData?.user.id

  const verifiableCredential = isCertificateForCurrentUser
    ? certificateData?.verifiable_credential_json
    : null

  const linkedInAddToProfileUrl = verifiableCredential
    ? getVerifiableCredentialLinkedInURL(verifiableCredential)
    : getCertificateLinkedInUrl(certificateType, certificateData!, pageUrl)

  const sharePageUrl = verifiableCredential
    ? getVerifierPlusViewerURL(verifiableCredential)
    : pageUrl

  return (
    <Page>
      <SharePopover
        open={shareOpen}
        title={`${title} Certificate issued by MIT Open Learning`}
        anchorEl={shareButtonRef.current}
        onClose={() => setShareOpen(false)}
        pageUrl={sharePageUrl}
        linkedInHrefOverride={linkedInAddToProfileUrl}
      />
      {verifiableCredential ? (
        <DigitalCredentialDialog
          verifiableCredential={verifiableCredential}
          open={digitalCredentialDialogOpen}
          onClose={() => setDigitalCredentialDialogOpen(false)}
        />
      ) : null}
      <Title>
        <Typography variant="h3">
          <strong>{title}</strong> {displayType}
        </Typography>
      </Title>
      {isCertificateForCurrentUser ? (
        <Buttons ref={shareButtonRef}>
          <Button
            variant="primary"
            startIcon={<RiDownloadLine />}
            onClick={download}
          >
            Download PDF
          </Button>
          {verifiableCredential ? (
            <Button
              variant="bordered"
              startIcon={<RiDownloadLine />}
              onClick={() => setDigitalCredentialDialogOpen(true)}
            >
              Download Digital Credential
            </Button>
          ) : null}
          <Button
            variant="bordered"
            startIcon={<RiShareLine />}
            onClick={() => setShareOpen(true)}
          >
            Share
          </Button>
          <Button
            variant="bordered"
            startIcon={<RiPrinterLine />}
            onClick={print}
          >
            Print
          </Button>
        </Buttons>
      ) : null}
      <PrintContainer ref={contentRef}>
        {certificateType === CertificateType.Course ? (
          <CourseCertificate
            certificate={courseCertificateData!}
            title={title}
          />
        ) : (
          <ProgramCertificate
            certificate={programCertificateData!}
            title={title}
          />
        )}
      </PrintContainer>
      <Note>
        <strong>Note:</strong> The name displayed on your certificate is based
        on your{" "}
        <Link href="/dashboard/profile" color="red">
          Profile
        </Link>{" "}
        information.
      </Note>
    </Page>
  )
}

export default CertificatePage
