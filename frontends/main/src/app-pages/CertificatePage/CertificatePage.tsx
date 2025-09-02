"use client"

import React, { useRef } from "react"
import { useParams } from "next/navigation"
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
import { RiDownloadLine, RiPrinterLine } from "@remixicon/react"
import { useReactToPrint } from "react-to-print"
import { css } from "@emotion/react"
import { serializeStyles } from "@emotion/serialize"

const serializeEmotionStyles = () => {
  const mockTheme = {
    custom: {
      colors: {
        white: "#ffffff",
        black: "#000000",
        red: "#A31F34",
        silverGray: "#E5E5E5",
        silverGrayLight: "#F5F5F5",
        silverGrayDark: "#666666",
        darkGray1: "#333333",
        darkGray2: "#666666",
        lightGray2: "#E5E5E5",
      },
    },
    typography: {
      pxToRem: (px: number) => `${px / 16}rem`,
      fontWeightLight: 300,
      fontWeightMedium: 500,
      fontWeightBold: 700,
    },
    breakpoints: {
      down: (breakpoint: string) =>
        `@media (max-width: ${breakpoint === "sm" ? "600px" : breakpoint === "md" ? "960px" : "1280px"})`,
    },
  }

  const certificateStyles = serializeStyles([
    css`
      .certificate-print-container {
        max-width: 1306px;
        min-width: 1200px;
        border: 4px solid ${mockTheme.custom.colors.silverGray};
        padding: 24px 23px;
        background-color: ${mockTheme.custom.colors.white};
        margin-top: 50px;
        margin: 0 auto;
      }

      .certificate-inner {
        border: 1px solid ${mockTheme.custom.colors.silverGrayLight};
        padding: 67px;
        display: flex;
        flex-direction: column;
        gap: 56px;
        position: relative;
      }

      .certificate-logo {
        width: 260px;
        height: auto;
      }

      .certificate-badge {
        background-image: url(${CertificateBadgeDesktop.src});
        position: absolute;
        top: 0;
        right: 67px;
        width: 230px;
        height: 391px;
        text-align: center;
        padding: 81px 34px;
        background-repeat: no-repeat;
      }

      .certificate-badge-text {
        color: ${mockTheme.custom.colors.white};
        position: absolute;
        top: 169px;
        right: 26px;
        width: 175px;
        text-align: center;
      }

      .certificate-name {
        color: ${mockTheme.custom.colors.red};
        display: block;
        font-size: ${mockTheme.typography.pxToRem(48)};
        line-height: ${mockTheme.typography.pxToRem(56)};
        font-weight: ${mockTheme.typography.fontWeightBold};
      }

      .certificate-title {
        font-weight: ${mockTheme.typography.fontWeightLight};
        color: ${mockTheme.custom.colors.silverGrayDark};
        font-size: ${mockTheme.typography.pxToRem(24)};
        line-height: ${mockTheme.typography.pxToRem(32)};
      }

      .certificate-achievement {
        font-weight: ${mockTheme.typography.fontWeightLight};
        font-size: ${mockTheme.typography.pxToRem(20)};
        line-height: ${mockTheme.typography.pxToRem(26)};
        color: ${mockTheme.custom.colors.silverGrayDark};
      }

      .certificate-course-title {
        font-size: ${mockTheme.typography.pxToRem(32)};
        line-height: ${mockTheme.typography.pxToRem(40)};
        font-weight: ${mockTheme.typography.fontWeightMedium};
      }

      .certificate-signatories {
        display: flex;
        flex-direction: row;
        gap: 16px;
        width: 100%;
      }

      .certificate-signatory {
        flex: 1 1 0;
        min-width: 0;
      }

      .certificate-signature {
        width: auto;
        height: 60px;
      }

      .certificate-signatory-name {
        margin-bottom: 8px;
        font-size: ${mockTheme.typography.pxToRem(24)};
        line-height: ${mockTheme.typography.pxToRem(32)};
        font-weight: ${mockTheme.typography.fontWeightMedium};
      }

      .certificate-id {
        font-size: ${mockTheme.typography.pxToRem(14)};
        line-height: ${mockTheme.typography.pxToRem(20)};
      }
    `,
  ])

  return certificateStyles.styles
}

const printStyles = `
  @media print {
    body {
      margin: 0;
      padding: 0;
      background: white !important;
    }
    
    .no-print {
      display: none !important;
    }
    
    .certificate-print-container {
      background: white !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      max-width: none !important;
      min-width: none !important;
      page-break-inside: avoid;
    }
    
    .certificate-inner {
      page-break-inside: avoid;
    }
    
    svg {
      display: block !important;
      visibility: visible !important;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }
    
    * {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }
    
    .certificate-badge {
      background-image: url(${CertificateBadgeDesktop.src}) !important;
      background-size: contain !important;
      background-repeat: no-repeat !important;
      background-position: top right !important;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }
    
    ${serializeEmotionStyles()}
  }
`

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

console.log(
  "serializeEmotionStyles",
  css({
    backgroundImage: `url(${backgroundImage.src})`,
    backgroundAttachment: "fixed",
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
    display: "flow-root",
    flexGrow: 1,
    height: "100%",
    padding: "0 16px 90px",
  }),
)

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

const Buttons = styled.div(({ theme }) => ({
  display: "flex",
  gap: "12px",
  justifyContent: "center",
  marginBottom: "50px",
}))

const Certificate = styled.div(({ theme }) => ({
  maxWidth: "1306px",
  minWidth: "1200px",
  border: `4px solid ${theme.custom.colors.silverGray}`,
  padding: "24px 23px",
  backgroundColor: theme.custom.colors.black,
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

  const { data: courseCertData, isLoading: isCourseLoading } = useQuery({
    ...certificateQueries.courseCertificatesRetrieve({
      cert_uuid: uuid,
    }),
    enabled: certificateType === CertificateType.Course,
  })

  const contentRef = useRef<HTMLDivElement>(null)

  // const { data: courseCertData, isLoading: isCourseLoading } = useQuery({
  //   ...certificateQueries.courseCertificatesRetrieve({
  //     cert_uuid: uuid,
  //   }),
  //   enabled: certificateType === CertificateType.Course,
  // })

  // const { data: programCertData, isLoading: isProgramLoading } = useQuery({
  //   ...certificateQueries.programCertificatesRetrieve({
  //     cert_uuid: uuid,
  //   }),
  //   enabled: certificateType === CertificateType.Program,
  // })

  // const isLoading = isCourseLoading || isProgramLoading

  // if (isLoading) {
  //   return <Page />
  // }

  const courseCertData = null

  const programCertData = {
    user: {
      id: 2,
      username: "admin",
      name: "Test Admin",
      created_on: "2025-07-21T20:43:59.722355Z",
      updated_on: "2025-08-21T14:02:34.802327Z",
    },
    uuid: "603d5d51-7b16-4f4c-9083-33ae02868d39",
    is_revoked: false,
    certificate_page: {
      id: 39,
      meta: {
        type: "cms.CertificatePage",
        detail_url: "/api/v2/pages/39/",
        html_url:
          "http://localhost/programs/foundational-ai-modules/certificate-38/",
        slug: "certificate-38",
        show_in_menus: false,
        seo_title: "",
        search_description: "",
        first_published_at: "2025-08-05T19:41:27.373303Z",
        alias_of: null,
        locale: "en",
        live: true,
        last_published_at: null,
      },
      title: "Certificate For Foundational AI Modules",
      product_name: "Foundational AI Modules",
      CEUs: null,
      overrides: [],
      signatory_items: [
        {
          name: "c4103 University",
          title_1: "Congrats",
          title_2: "You did it!",
          organization: "OrganizationX",
          signature_image: "/media/original_images/signature.png",
        },
      ],
    },
    program: {
      title: "Foundational AI Modules",
      readable_id: "foundational-ai-modules",
      id: 2,
      courses: [16, 17],
      collections: [],
      requirements: {
        courses: {
          required: [16, 17],
          electives: [],
        },
        programs: {
          required: [],
          electives: [],
        },
      },
      req_tree: [
        {
          data: {
            node_type: "program_root",
            operator: null,
            operator_value: null,
            program: 2,
            course: null,
            required_program: null,
            title: "",
            elective_flag: false,
          },
          id: 2,
          children: [
            {
              data: {
                node_type: "operator",
                operator: "all_of",
                operator_value: null,
                program: 2,
                course: null,
                required_program: null,
                title: "Required Courses",
                elective_flag: false,
              },
              id: 3,
              children: [
                {
                  data: {
                    node_type: "course",
                    operator: null,
                    operator_value: null,
                    program: 2,
                    course: 16,
                    required_program: null,
                    title: null,
                    elective_flag: false,
                  },
                  id: 4,
                },
                {
                  data: {
                    node_type: "course",
                    operator: null,
                    operator_value: null,
                    program: 2,
                    course: 17,
                    required_program: null,
                    title: null,
                    elective_flag: false,
                  },
                  id: 5,
                },
              ],
            },
            {
              data: {
                node_type: "operator",
                operator: "all_of",
                operator_value: null,
                program: 2,
                course: null,
                required_program: null,
                title: "Elective Courses",
                elective_flag: true,
              },
              id: 6,
            },
          ],
        },
      ],
      page: {
        feature_image_src: "/static/images/mit-dome.png",
        page_url: "/programs/foundational-ai-modules/",
        financial_assistance_form_url: "",
        description:
          '<p data-block-key="206az">Earn a <b>Module Certificate</b> for each completed Foundational AI module.</p><p data-block-key="8i6rd">Complete all modules to receive a <b>Series Certificate</b>.</p>',
        live: true,
        length: "4 weeks",
        effort: null,
        price: "Zero Dollars",
      },
      program_type: "Series",
      certificate_type: "Certificate of Completion",
      departments: [
        {
          name: "UAI",
        },
      ],
      live: true,
      topics: [],
      availability: "anytime",
      start_date: null,
      end_date: null,
      enrollment_start: null,
      enrollment_end: null,
      required_prerequisites: false,
      duration: "4 weeks",
      min_weeks: null,
      max_weeks: null,
      time_commitment: null,
      min_weekly_hours: "4",
      max_weekly_hours: "4",
    },
    certificate_page_revision: 26,
  }

  const title =
    certificateType === CertificateType.Course
      ? courseCertData?.course_run?.course?.title
      : programCertData?.program?.title

  // Configure print function with styles
  const print = useReactToPrint({
    contentRef,
    pageStyle: printStyles,
    documentTitle: `${title} Certificate`,
  })

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
      <Title className="no-print">
        <Typography variant="h3">
          <strong>{title}</strong> {displayType}
        </Typography>
      </Title>
      <Buttons className="no-print">
        <Button variant="primary" startIcon={<RiDownloadLine />}>
          Download PDF
        </Button>
        <Button
          variant="bordered"
          startIcon={<RiPrinterLine />}
          onClick={print}
        >
          Print
        </Button>
      </Buttons>
      <Certificate ref={contentRef} className="certificate-print-container">
        <Inner className="certificate-inner">
          <Logo
            src={OpenLearningLogo}
            alt="MIT Open Learning"
            className="certificate-logo"
          />
          <Badge className="certificate-badge">
            <BadgeText variant="h4" className="certificate-badge-text">
              {displayType}
            </BadgeText>
          </Badge>
          <Certification>
            <Typography variant="h4" className="certificate-title">
              This is to certify that
            </Typography>
            <NameText variant="h1" className="certificate-name">
              {userName}
            </NameText>
            <AchievementText className="certificate-achievement">
              has successfully completed all requirements of the{" "}
              <strong>Universal Artificial Intelligence</strong>{" "}
              {shortDisplayType}:
            </AchievementText>
          </Certification>
          <CourseInfo>
            <Typography variant="h2" className="certificate-course-title">
              {title}
            </Typography>
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
          <Signatories className="certificate-signatories">
            {signatories?.map((signatory, index) => (
              <Signatory key={index} className="certificate-signatory">
                <Signature
                  src={
                    signatory.signature_image.startsWith("http")
                      ? signatory.signature_image
                      : `${process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL}${signatory.signature_image}`
                  }
                  alt={signatory.name}
                  className="certificate-signature"
                />
                <SignatoryName
                  variant="h3"
                  className="certificate-signatory-name"
                >
                  {signatory.name}
                </SignatoryName>
                <Typography variant="body1">{signatory.title_1}</Typography>
                <Typography variant="body1">{signatory.title_2}</Typography>
                <Typography variant="body1">
                  {signatory.organization}
                </Typography>
              </Signatory>
            ))}
          </Signatories>
          <CertificateId variant="body1" className="certificate-id">
            Valid Certificate ID: <span>{uuid}</span>
          </CertificateId>
        </Inner>
      </Certificate>
      <Note className="no-print">
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
