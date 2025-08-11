"use client"

import React from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { Link, Typography, styled } from "ol-components"
import backgroundImage from "@/public/images/backgrounds/error_page_background.svg"
import { certificateQueries } from "api/mitxonline-hooks/certificates"
import { useQuery } from "@tanstack/react-query"
import OpenLearningLogo from "@/public/images/mit-open-learning-logo.svg"
import MITLearnLogo from "@/public/images/mit-learn-logo-black.svg"
import MITLogo from "@/public/images/mit-logo-black.svg"
import CertificateRibbon from "@/public/images/certificate-ribbon.svg"
import CertificateBadge from "@/public/images/certificate-badge.svg"
import MITSeal from "@/public/images/mit-seal.svg"
import { coursesQueries } from "api/mitxonline-hooks/courses"
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
    paddingBottom: "24px",
  },
}))

const Title = styled(Typography)(({ theme }) => ({
  margin: "60px 160px 40px",
  textAlign: "center",
  span: {
    fontWeight: theme.typography.fontWeightLight,
    color: theme.custom.colors.darkGray2,
  },
  [theme.breakpoints.down("md")]: {
    textAlign: "left",
    margin: "24px 0 32px",
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
  [theme.breakpoints.down("md")]: {
    padding: 0,
    border: "none",
    maxWidth: "unset",
    minWidth: "unset",
    fontFamily: "Georgia, serif",
    "p, span": {
      fontFamily: "Georgia, serif",
    },
  },
}))

const Inner = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  padding: "67px",
  display: "flex",
  flexDirection: "column",
  gap: "56px",
  position: "relative",
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
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const MobileHeader = styled.div(({ theme }) => ({
  display: "none",
  [theme.breakpoints.down("md")]: {
    display: "block",
  },
}))

const MobileLogos = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "16px",
  alignItems: "center",
  justifyContent: "center",
  img: {
    fill: theme.custom.colors.black,
  },
}))

const MobileLearnLogo = styled.div(({ theme }) => ({
  borderRight: `1px solid ${theme.custom.colors.silverGray}`,
  paddingRight: "16px",
  position: "relative",
}))

const MobileMITLogo = styled.div(({ theme }) => ({
  padding: "0 8px",
}))

const OrganizationText = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(14),
  color: theme.custom.colors.darkGray1,
  textAlign: "center",
  marginTop: "12px",
}))

const Medallion = styled.div(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    position: "relative",
    height: "278px",
  },
}))

const BadgeText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.white,
  position: "absolute",
  top: "167px",
  right: "96px",
  width: "175px",
  textAlign: "center",
  [theme.breakpoints.down("md")]: {
    fontSize: theme.typography.pxToRem(16),
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.pxToRem(20),
    width: "130px",
    position: "absolute",
    top: "20px",
    right: "50%",
    transform: "translateX(50%)",
  },
}))

const Ribbon = styled.div(({ theme }) => ({
  backgroundImage: `url(${CertificateRibbon.src})`,
  position: "absolute",
  top: 0,
  right: "114px",
  width: "139px",
  height: "391px",
  [theme.breakpoints.down("md")]: {
    backgroundImage: "none",
    backgroundColor: theme.custom.colors.mitRed,
    width: "113px",
    height: "157px",
    right: "50%",
    transform: "translateX(50%)",
    borderRadius: "4px",
  },
}))

const Badge = styled.div(({ theme }) => ({
  backgroundImage: `url(${CertificateBadge.src})`,
  position: "absolute",
  top: "87px",
  right: "67px",
  width: "230px",
  height: "223px",
  textAlign: "center",
  padding: "81px 34px",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const Seal = styled(Image)(({ theme }) => ({
  width: "200px",
  height: "199px",
  top: "80px",
  display: "none",
  position: "absolute",
  right: "50%",
  transform: "translateX(50%)",
  [theme.breakpoints.down("md")]: {
    display: "block",
  },
}))

const Certification = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  maxWidth: "800px",
  ".MuiTypography-h4": {
    fontWeight: theme.typography.fontWeightLight,
    color: theme.custom.colors.silverGrayDark,
  },
  [theme.breakpoints.down("md")]: {
    gap: 0,
    ".MuiTypography-h4": {
      fontSize: theme.typography.pxToRem(16),
    },
  },
}))

const NameText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  display: "block",
  [theme.breakpoints.down("md")]: {
    fontSize: theme.typography.pxToRem(24),
    color: theme.custom.colors.black,
    lineHeight: "100%",
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
  [theme.breakpoints.down("md")]: {
    fontSize: theme.typography.pxToRem(14),
    lineHeight: theme.typography.pxToRem(20),
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
  [theme.breakpoints.down("md")]: {
    ".MuiTypography-h2": {
      fontSize: theme.typography.pxToRem(20),
      lineHeight: theme.typography.pxToRem(25),
    },
    ".MuiTypography-h4": {
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(20),
      color: theme.custom.colors.darkGray1,
    },
  },
}))

const DatesText = styled(Typography)(({ theme }) => ({
  "&&": {
    [theme.breakpoints.down("md")]: {
      color: theme.custom.colors.black,
    },
  },
}))

const Spacer = styled.div({
  height: "30px",
})

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
  [theme.breakpoints.down("md")]: {
    ".MuiTypography-body1": {
      color: theme.custom.colors.darkGray1,
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(20),
    },
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    paddingBottom: "24px",
  },
}))

const Signature = styled.img(({ theme }) => ({
  width: "auto",
  height: "60px",
  [theme.breakpoints.down("md")]: {
    height: "40px",
  },
}))

const SignatoryName = styled(Typography)(({ theme }) => ({
  marginBottom: "8px",
  [theme.breakpoints.down("md")]: {
    fontSize: theme.typography.pxToRem(14),
    lineHeight: "100%",
    marginTop: "16px",
  },
}))

const SignatoryOrganization = styled(Typography)({
  marginTop: "8px",
})

const CertificateId = styled(Typography)(({ theme }) => ({
  span: {
    color: theme.custom.colors.silverGrayDark,
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
  [theme.breakpoints.down("md")]: {
    margin: "32px 0 16px",
    fontSize: theme.typography.pxToRem(14),
    lineHeight: theme.typography.pxToRem(18),
    textAlign: "left",
    a: {
      fontSize: theme.typography.pxToRem(14),
    },
  },
}))

const CertificatePage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>()

  const { data, isLoading } = useQuery(
    certificateQueries.courseCertificatesRetrieve({
      cert_uuid: uuid,
    }),
  )

  // const { data: courseData } = useLearningResourcesDetail(data?.course_run)

  const { data: courseData } = useQuery(
    coursesQueries.coursesList({ id: [data?.course_run as number] }),
  )

  console.log("certificateData", isLoading, data)
  console.log("courseData", courseData)

  if (isLoading) {
    return <Page />
  }

  const course = courseData?.results[0]

  /* TODO: The certificate is providing the run ID, but not the course ID.
   * For now, we're pulling a course and grabbing the first run, but this is not correct.
   * course ID is needed on the certificate API
   */
  const run = course?.courseruns[0]

  return (
    <Page>
      <Title>
        <Typography variant="h3">
          {/* TODO The designs show "Series Certificate" but .certificate_page.title includes "Certificate for..."
           * Can we add the program/course/run name to the API? */}
          <strong>{data?.certificate_page.product_name}</strong>{" "}
          {course?.certificate_type}
        </Typography>
      </Title>
      <Certificate>
        <Inner>
          <Logo src={OpenLearningLogo} alt="MIT Open Learning" />
          <MobileHeader>
            <MobileLogos>
              <MobileLearnLogo>
                <Image
                  src={MITLearnLogo}
                  alt="MIT Learn Logo"
                  width={107}
                  height={18}
                />
              </MobileLearnLogo>
              <MobileMITLogo>
                <Image src={MITLogo} alt="MIT Logo" width={34} height={18} />
              </MobileMITLogo>
            </MobileLogos>
            <OrganizationText>
              Massachusetts Institute of Technology
            </OrganizationText>
          </MobileHeader>
          <Medallion>
            <Ribbon />
            <Badge />
            <BadgeText variant="h4">{course?.certificate_type}</BadgeText>
            <Seal src={MITSeal} alt="MIT Seal" />
          </Medallion>
          <Certification>
            <Typography variant="h4">This is to certify that</Typography>
            <NameText variant="h1">{data?.user.name}</NameText>
            {/* TODO Are all certificates for the full series? Is that the product name? These are being linked to from course runs (not necessarily full courses) */}
            <AchievementText>
              has successfully completed all requirements of the{" "}
              <strong>{data?.certificate_page.product_name}</strong> series:{" "}
              {/* TODO we need a type field that provides series|module|program */}
            </AchievementText>
          </Certification>
          <CourseInfo>
            <Typography variant="h2">{course?.title}</Typography>
            {/* CEUs are an xPRO feature that aren't in MITx Online yet */}
            {data?.certificate_page.CEUs ? (
              <Typography variant="h4">
                Awarded {data?.certificate_page.CEUs} Continuing Education Units
                (CEUs)
              </Typography>
            ) : null}
            {run?.start_date && run?.end_date && (
              <DatesText variant="h4">
                <NoSSR>
                  {formatDate(run?.start_date)} - {formatDate(run?.end_date)}
                </NoSSR>
              </DatesText>
            )}
            {data?.certificate_page.CEUs ? null : <Spacer />}
          </CourseInfo>
          <Signatories>
            {/* TODO The design shows 3 signatories but Wagtail supports up to 5 */}
            {data?.certificate_page?.signatory_items?.map(
              (signatory, index) => (
                <Signatory key={index}>
                  <Signature
                    src={`${process.env.NEXT_PUBLIC_MITX_ONLINE_BASE_URL}${signatory.signature_image}`}
                    alt={signatory.name}
                  />
                  <SignatoryName variant="h3">{signatory.name}</SignatoryName>
                  <Typography variant="body1">{signatory.title_1}</Typography>
                  <Typography variant="body1">{signatory.title_2}</Typography>
                  {/* TODO The design shows 3 title but Wagtail supports up to 2 */}
                  <SignatoryOrganization variant="body1">
                    {signatory.organization}
                  </SignatoryOrganization>
                </Signatory>
              ),
            )}
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
