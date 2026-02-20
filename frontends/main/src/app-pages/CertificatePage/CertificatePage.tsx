"use client"

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

const Outer = styled.div(({ theme }) => ({
  maxWidth: "1306px",
  minWidth: "1200px",
  border: `4px solid ${theme.custom.colors.silverGray}`,
  padding: "24px",
  backgroundColor: theme.custom.colors.white,
  marginTop: "50px",
  margin: "0 auto",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      padding: 0,
      border: "none",
      maxWidth: "unset",
      minWidth: "unset",
    },
    [theme.breakpoints.down("md")]: {
      padding: 0,
      border: "none",
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
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  padding: "64px",
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
  top: 0,
  right: "67px",
  width: "230px",
  height: "391px",
  textAlign: "center",
  padding: "81px 34px",
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

const BadgeText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.white,
  position: "absolute",
  top: "169px",
  right: "26px",
  width: "175px",
  textAlign: "center",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      fontSize: theme.typography.pxToRem(16),
      lineHeight: "150%",
      fontWeight: theme.typography.fontWeightMedium,
      top: "53px",
      right: "18px",
      width: "119px",
    },
    [theme.breakpoints.down("md")]: {
      width: "130px",
      position: "absolute",
      top: "50px",
      right: "50%",
      transform: "translateX(50%)",
    },
  },
}))

const Certification = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  maxWidth: "850px",
  ".MuiTypography-h4": {
    fontWeight: theme.typography.fontWeightLight,
    color: theme.custom.colors.silverGrayDark,
  },
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      ".MuiTypography-h4": {
        fontSize: theme.typography.pxToRem(16),
      },
    },
    [theme.breakpoints.down("md")]: {
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

const AchievementText = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightLight,
  fontSize: theme.typography.pxToRem(20),
  lineHeight: theme.typography.pxToRem(26),
  color: theme.custom.colors.silverGrayDark,
  strong: {
    fontWeight: theme.typography.fontWeightBold,
  },
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      fontSize: theme.typography.pxToRem(16),
      lineHeight: theme.typography.pxToRem(24),
    },
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(18),
      marginTop: "16px",
    },
  },
}))

const PrintBreak = styled.br({
  display: "none",
  "@media print": {
    display: "block",
  },
})

const CourseInfo = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  ".MuiTypography-h4": {
    fontWeight: theme.typography.fontWeightLight,
    color: theme.custom.colors.silverGrayDark,
  },
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      ".MuiTypography-h2": {
        fontSize: theme.typography.pxToRem(28),
        lineHeight: theme.typography.pxToRem(36),
      },
      ".MuiTypography-h4": {
        fontSize: theme.typography.pxToRem(16),
        lineHeight: theme.typography.pxToRem(20),
      },
    },
    [theme.breakpoints.down("md")]: {
      ".MuiTypography-h2": {
        fontSize: theme.typography.pxToRem(18),
        lineHeight: theme.typography.pxToRem(26),
        fontWeight: theme.typography.fontWeightMedium,
      },
      ".MuiTypography-h4": {
        fontSize: theme.typography.pxToRem(14),
        lineHeight: theme.typography.pxToRem(18),
        color: theme.custom.colors.darkGray1,
      },
    },
  },
}))

const Spacer = styled.div(({ theme }) => ({
  height: "30px",
  [theme.breakpoints.down("lg")]: {
    display: "none",
  },
}))

const Signatories = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "40px",
  width: "100%",
  "@media screen": {
    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
      gap: "24px",
    },
  },
  "@media print": {
    position: "absolute",
    left: "46px",
    bottom: "100px",
  },
}))

const Signatory = styled.div(({ theme }) => ({
  flex: "1 1 0",
  minWidth: 0,
  span: {
    display: "block",
  },
  ".MuiTypography-body1": {
    color: theme.custom.colors.silverGrayDark,
  },
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      ".MuiTypography-body1": {
        fontSize: theme.typography.pxToRem(12),
        lineHeight: theme.typography.pxToRem(16),
      },
      ".MuiTypography-body1:last-child": {
        marginTop: "8px",
      },
    },
    [theme.breakpoints.down("md")]: {
      ".MuiTypography-body1": {
        color: theme.custom.colors.darkGray1,
        fontSize: theme.typography.pxToRem(14),
        lineHeight: theme.typography.pxToRem(18),
      },
      borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
      paddingBottom: "24px",
      p: {
        marginTop: "8px",
      },
    },
  },
}))

const Signature = styled.img(({ theme }) => ({
  width: "auto",
  height: "60px",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      height: "54px",
    },
    [theme.breakpoints.down("md")]: {
      height: "40px",
    },
  },
}))

const SignatoryName = styled(Typography)(({ theme }) => ({
  marginBottom: "8px",
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      fontSize: theme.typography.pxToRem(18),
      lineHeight: theme.typography.pxToRem(26),
      fontWeight: theme.typography.fontWeightMedium,
    },
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.pxToRem(16),
      lineHeight: "150%",
      marginTop: "16px",
    },
  },
}))

const CertificateId = styled(Typography)(({ theme }) => ({
  span: {
    color: theme.custom.colors.silverGrayDark,
  },
  "@media screen": {
    [theme.breakpoints.down("lg")]: {
      fontSize: theme.typography.pxToRem(12),
      lineHeight: theme.typography.pxToRem(16),
    },
    [theme.breakpoints.down("md")]: {
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(20),
      span: {
        display: "block",
      },
    },
  },
  "@media print": {
    position: "absolute",
    left: "46px",
    bottom: "30px",
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
  displayType,
  userName,
  shortDisplayType,
  ceus,
  signatories,
  startDate,
  endDate,
  uuid,
}: {
  title: string
  displayType: string
  userName?: string
  shortDisplayType: string
  ceus?: string
  signatories: SignatoryItem[]
  startDate?: string | null
  endDate?: string | null
  uuid: string
}) => {
  return (
    <Outer>
      <Inner>
        <Logo src={OpenLearningLogo} alt="MIT Open Learning" />
        <PrintLogo src={OpenLearningLogo.src} alt="MIT Open Learning" />
        <Badge>
          <BadgeText variant="h4">{displayType}</BadgeText>
        </Badge>
        <Certification>
          <Typography variant="h4">This is to certify that</Typography>
          <NameText variant="h1">{userName}</NameText>
          <AchievementText>
            has successfully completed all requirements of the <PrintBreak />
            <strong>Universal Artificial Intelligence</strong>{" "}
            {shortDisplayType}:
          </AchievementText>
        </Certification>
        <CourseInfo>
          <Typography variant="h2">{title}</Typography>
          {ceus ? (
            <Typography variant="h4">
              Awarded {ceus} Continuing Education Units (CEUs)
            </Typography>
          ) : null}
          {startDate && endDate && (
            <Typography variant="h4">
              <NoSSR>
                {formatDate(startDate)} - {formatDate(endDate)}
              </NoSSR>
            </Typography>
          )}
          {ceus ? null : <Spacer />}
        </CourseInfo>
        <Signatories>
          {signatories?.map((signatory, index) => (
            <Signatory key={index}>
              <Signature
                src={
                  signatory.signature_image.startsWith("http")
                    ? signatory.signature_image
                    : `${process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL}${signatory.signature_image}`
                }
                alt={signatory.name}
                crossOrigin="anonymous"
              />
              <SignatoryName variant="h3">{signatory.name}</SignatoryName>
              {signatory.title_1 && (
                <Typography variant="body1">{signatory.title_1}</Typography>
              )}
              {signatory.title_2 && (
                <Typography variant="body1">{signatory.title_2}</Typography>
              )}
              {signatory.title_3 && (
                <Typography variant="body1">{signatory.title_3}</Typography>
              )}
              {signatory.organization && (
                <Typography variant="body1">
                  {signatory.organization}
                </Typography>
              )}
            </Signatory>
          ))}
        </Signatories>
        <CertificateId variant="body1">
          Valid Certificate ID: <span>{uuid}</span>
        </CertificateId>
      </Inner>
    </Outer>
  )
}

const CourseCertificate = ({
  certificate,
}: {
  certificate: V2CourseRunCertificate
}) => {
  const title = certificate.course_run.course.title

  const displayType = "Module Certificate"

  const userName = certificate.user.name

  const shortDisplayType = "module"

  const signatories = certificate.certificate_page.signatory_items

  const startDate = certificate.course_run.start_date

  const endDate = certificate.course_run.end_date

  return (
    <Certificate
      title={title}
      displayType={displayType}
      userName={userName}
      shortDisplayType={shortDisplayType}
      signatories={signatories}
      startDate={startDate}
      endDate={endDate}
      uuid={certificate.uuid}
    />
  )
}

const ProgramCertificate = ({
  certificate,
}: {
  certificate: V2ProgramCertificate
}) => {
  const title = certificate.program.title

  const displayType = `${certificate.program.program_type} Certificate`

  const userName = certificate.user.name

  const shortDisplayType = `${certificate.program.program_type} program`

  const ceus = certificate.certificate_page.CEUs

  const signatories = certificate.certificate_page.signatory_items

  const startDate = certificate.program.start_date

  const endDate = certificate.program.end_date

  return (
    <Certificate
      title={title}
      displayType={displayType}
      userName={userName}
      shortDisplayType={shortDisplayType}
      ceus={ceus}
      signatories={signatories}
      startDate={startDate}
      endDate={endDate}
      uuid={certificate.uuid}
    />
  )
}

export enum CertificateType {
  Course = "course",
  Program = "program",
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
      cert_uuid: uuid,
    }),
    enabled: certificateType === CertificateType.Course,
  })

  const {
    data: programCertificateData,
    isLoading: isProgramLoading,
    isError: isProgramError,
  } = useQuery({
    ...certificateQueries.programCertificatesRetrieve({
      cert_uuid: uuid,
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
  const [shareAnchorEl, setShareAnchorEl] = useState<HTMLDivElement | null>(
    null,
  )
  const shareButtonRef = (node: HTMLDivElement | null) => {
    setShareAnchorEl(node)
  }

  if (isCourseLoading || isProgramLoading) {
    return <Page />
  }

  // MITx Online returns 500 for non-existent certificates. We can assume not found.
  if (isCourseError || isProgramError) {
    return notFound()
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

  const title =
    certificateType === CertificateType.Course
      ? courseCertificateData?.course_run.course.title
      : programCertificateData?.program.title

  const displayType =
    certificateType === CertificateType.Course
      ? "Module Certificate"
      : `${programCertificateData?.program.program_type} Certificate`

  const certificateData =
    certificateType === CertificateType.Course
      ? courseCertificateData
      : programCertificateData

  const isCertificateForCurrentUser = userData?.id === certificateData?.user.id

  const verifiableCredential = isCertificateForCurrentUser
    ? certificateData?.verifiable_credential_json
    : null

  return (
    <Page>
      <SharePopover
        open={shareOpen}
        title={`${title} Certificate issued by MIT Open Learning`}
        anchorEl={shareAnchorEl}
        onClose={() => setShareOpen(false)}
        pageUrl={pageUrl}
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
          <CourseCertificate certificate={courseCertificateData!} />
        ) : (
          <ProgramCertificate certificate={programCertificateData!} />
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
