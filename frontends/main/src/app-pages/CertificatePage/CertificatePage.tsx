"use client"

import React from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Link, Typography, styled } from "ol-components"
import backgroundImage from "@/public/images/backgrounds/error_page_background.svg"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { useQuery } from "@tanstack/react-query"
import OpenLearningLogo from "@/public/images/mit-open-learning-logo.svg"
import CertificateBadgeDesktop from "@/public/images/certificate-badge-desktop.svg"
import CertificateBadgeMobile from "@/public/images/certificate-badge-mobile.svg"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { formatDate, NoSSR } from "ol-utilities"

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
    textAlign: "left",
    margin: "24px 0",
    span: {
      fontSize: theme.typography.pxToRem(24),
      lineHeight: theme.typography.pxToRem(30),
    },
  },
}))

const Certificate = styled.div(({ theme }) => ({
  maxWidth: "1306px",
  minWidth: "1200px",
  border: `4px solid ${theme.custom.colors.silverGray}`,
  padding: "24px 23px",
  backgroundColor: theme.custom.colors.white,
  marginTop: "50px",
  margin: "0 auto",
  [theme.breakpoints.down("lg")]: {
    padding: 0,
    border: "none",
    maxWidth: "unset",
    minWidth: "unset",
  },
}))

const Inner = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  padding: "67px",
  display: "flex",
  flexDirection: "column",
  gap: "56px",
  position: "relative",
  [theme.breakpoints.down("lg")]: {
    padding: "40px",
    gap: "40px",
  },
  [theme.breakpoints.down("md")]: {
    border: `2px solid ${theme.custom.colors.lightGray2}`,
    padding: "24px 16px",
    gap: "24px",
    textAlign: "center",
  },
}))

const Logo = styled(Image)(({ theme }) => ({
  width: "260px",
  height: "auto",
  [theme.breakpoints.down("lg")]: {
    width: "230px",
    height: "59px",
  },
  [theme.breakpoints.down("md")]: {
    width: "129px",
    margin: "0 auto",
  },
}))

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
}))

const BadgeText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.white,
  position: "absolute",
  top: "169px",
  right: "26px",
  width: "175px",
  textAlign: "center",
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
}))

const NameText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  display: "block",
  [theme.breakpoints.down("lg")]: {
    fontSize: theme.typography.pxToRem(34),
    lineHeight: theme.typography.pxToRem(40),
  },
  [theme.breakpoints.down("md")]: {
    fontSize: theme.typography.pxToRem(24),
    lineHeight: theme.typography.pxToRem(30),
    marginTop: "4px",
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
  [theme.breakpoints.down("lg")]: {
    fontSize: theme.typography.pxToRem(16),
    lineHeight: theme.typography.pxToRem(24),
  },
  [theme.breakpoints.down("md")]: {
    fontSize: theme.typography.pxToRem(14),
    lineHeight: theme.typography.pxToRem(18),
    marginTop: "16px",
  },
}))

const CourseInfo = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  ".MuiTypography-h4": {
    fontWeight: theme.typography.fontWeightLight,
    color: theme.custom.colors.silverGrayDark,
  },
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
  gap: "16px",
  width: "100%",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "24px",
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
}))

const Signature = styled.img(({ theme }) => ({
  width: "auto",
  height: "60px",
  [theme.breakpoints.down("lg")]: {
    height: "54px",
  },
  [theme.breakpoints.down("md")]: {
    height: "40px",
  },
}))

const SignatoryName = styled(Typography)(({ theme }) => ({
  marginBottom: "8px",
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
}))

const CertificateId = styled(Typography)(({ theme }) => ({
  span: {
    color: theme.custom.colors.silverGrayDark,
  },
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

enum CertificateType {
  Course = "course",
  Program = "program",
}

const CertificatePage: React.FC = () => {
  const { certificateType, uuid } = useParams<{
    certificateType: CertificateType
    uuid: string
  }>()

  console.log("certificateType", certificateType)
  console.log("uuid", uuid)

  const { data: courseCertData, isLoading: isCourseLoading } = useQuery({
    ...certificateQueries.courseCertificatesRetrieve({
      cert_uuid: uuid,
    }),
    enabled: certificateType === CertificateType.Course,
  })

  const { data: programCertData, isLoading: isProgramLoading } = useQuery({
    ...certificateQueries.programCertificatesRetrieve({
      cert_uuid: uuid,
    }),
    enabled: certificateType === CertificateType.Program,
  })

  // const data =
  //   certificateType === CertificateType.Course
  //     ? courseCertData
  //     : programCertData

  const isLoading = isCourseLoading || isProgramLoading

  console.log("isLoading", isLoading)
  console.log("courseCertData", courseCertData)
  console.log("programCertData", programCertData)

  if (isLoading) {
    return <Page />
  }

  const title =
    certificateType === CertificateType.Course
      ? courseCertData?.course_run?.course?.title
      : programCertData?.program?.title

  const displayType =
    certificateType === CertificateType.Course
      ? "Module Certificate"
      : `${programCertData?.program?.program_type} Certificate`

  const userName =
    certificateType === CertificateType.Course
      ? courseCertData?.user?.name
      : programCertData?.user?.name

  const shortDisplayType =
    certificateType === CertificateType.Course
      ? "module"
      : programCertData?.program?.program_type === "Series"
        ? "series"
        : `${programCertData?.program?.program_type} program`

  const ceus =
    certificateType === CertificateType.Course
      ? null
      : programCertData?.certificate_page?.CEUs

  const signatories =
    certificateType === CertificateType.Course
      ? courseCertData?.certificate_page?.signatory_items
      : programCertData?.certificate_page?.signatory_items

  const startDate =
    certificateType === CertificateType.Course
      ? courseCertData?.course_run?.start_date
      : programCertData?.program?.start_date

  const endDate =
    certificateType === CertificateType.Course
      ? courseCertData?.course_run?.end_date
      : programCertData?.program?.end_date

  return (
    <Page>
      <Title>
        <Typography variant="h3">
          {/* TODO The designs show "Series Certificate" but .certificate_page.title includes "Certificate for..."
           * Can we add the program/course/run name to the API? */}
          <strong>{title}</strong> {displayType}
        </Typography>
      </Title>
      <Certificate>
        <Inner>
          <Logo src={OpenLearningLogo} alt="MIT Open Learning" />
          <Badge>
            <BadgeText variant="h4">{displayType}</BadgeText>
          </Badge>
          <Certification>
            <Typography variant="h4">This is to certify that</Typography>
            <NameText variant="h1">{userName}</NameText>
            <AchievementText>
              has successfully completed all requirements of the{" "}
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
            {/* TODO The design shows 3 signatories but Wagtail supports up to 5 */}
            {signatories?.map((signatory, index) => (
              <Signatory key={index}>
                <Signature
                  src={`${process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL}${signatory.signature_image}`}
                  alt={signatory.name}
                />
                <SignatoryName variant="h3">{signatory.name}</SignatoryName>
                <Typography variant="body1">{signatory.title_1}</Typography>
                <Typography variant="body1">{signatory.title_2}</Typography>
                {/* TODO The design shows 3 title but Wagtail supports up to 2 */}
                <Typography variant="body1">
                  {signatory.organization}
                </Typography>
              </Signatory>
            ))}
          </Signatories>
          <CertificateId variant="body1">
            Valid Certificate ID: <span>{uuid}</span>
          </CertificateId>
        </Inner>
      </Certificate>
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
