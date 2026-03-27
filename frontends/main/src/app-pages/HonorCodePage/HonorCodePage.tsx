"use client"

import {
  Breadcrumbs,
  Container,
  Typography,
  TypographyProps,
  styled,
} from "ol-components"
import * as urls from "@/common/urls"
import React from "react"

const PageContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  padding: "40px 84px 80px 84px",
  [theme.breakpoints.down("md")]: {
    padding: "40px 24px 80px 24px",
  },
}))

const BannerContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingBottom: "16px",
})

const BannerContainerInner = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  justifyContent: "center",
})

const Header = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    alignSelf: "stretch",
    color: theme.custom.colors.black,
  }),
)

const BodyContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  alignSelf: "stretch",
  gap: "20px",
})

const BodyText = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    alignSelf: "stretch",
    color: theme.custom.colors.black,
  }),
)

const UnorderedList = styled.ul(({ theme }) => ({
  alignSelf: "stretch",
  ...theme.typography.body1,
  marginTop: "10px",
}))

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME

const HonorCodePage: React.FC = () => {
  return (
    <Container>
      <PageContainer>
        <BannerContainer>
          <BannerContainerInner>
            <Breadcrumbs
              variant="light"
              ancestors={[{ href: urls.HOME, label: "Home" }]}
              current="Honor Code"
            />
            <Header component="h1" variant="h2">
              {SITE_NAME}'s Honor Code and Academic Integrity Statement
            </Header>
          </BannerContainerInner>
        </BannerContainer>
        <BodyContainer>
          <BodyText variant="body1">
            Academic integrity is the cornerstone of scholarship and the
            foundation of the MIT community. As a member of the MIT community,
            you are expected to pursue your studies with purpose, honesty, and
            responsibility. This means trusting the value of your own intellect,
            showcasing your true abilities, and properly acknowledging the
            contributions of others. At MIT, we assume that you are here for a
            serious purpose and expect high standards of personal conduct.
          </BodyText>
          <BodyText component="h2" variant="h4">
            The Honor Code Pledge
          </BodyText>
          <BodyText variant="body1">
            By enrolling in any MIT course or program on {SITE_NAME}, you agree
            to the following:
          </BodyText>
          <UnorderedList>
            <li>
              <strong>Original Work:</strong> I will complete all tests, exams,
              and assignments on my own, ensuring that the work I submit is my
              own original creation.
            </li>
            <li>
              <strong>Authorized Collaboration:</strong> I will not collaborate
              with others on any assignment unless such collaboration is
              explicitly permitted by the instructor. I am responsible for
              understanding the specific collaboration policy for each course or
              program, as the accepted level of collaboration varies from course
              to course.
            </li>
            <li>
              <strong>Artificial Intelligence:</strong> I will not utilize
              generative artificial intelligence (AI) tools (e.g., ChatGPT,
              Claude, or similar) to complete assignments unless the course
              teaching team has given explicit permission. If I am unsure if a
              tool is permitted, I will consult the teaching team before use.
            </li>
            <li>
              <strong>Account Security:</strong> I will maintain only one user
              account and will not permit anyone else to use my username or
              password. I will not impersonate any other student or arrange for
              someone to impersonate me.
            </li>
            <li>
              <strong>Fair Competition:</strong> I will not engage in any
              activity that would dishonestly improve my results or improve/hurt
              the results of others. This includes facilitating academic
              dishonesty by assisting others in cheating.
            </li>
            <li>
              <strong>Protecting Assessment Integrity:</strong> I will not post,
              share, or distribute answers to problems, exam questions, or any
              other materials being used to assess learner performance.
            </li>
          </UnorderedList>
          <BodyText component="h2" variant="h4">
            Standards of Conduct
          </BodyText>
          <BodyText variant="body1">
            To uphold the integrity of MIT's credential and certificates, you
            must avoid the following prohibited behaviors:
          </BodyText>
          <UnorderedList>
            <li>
              <strong>Plagiarism:</strong> Using someone else's words, ideas,
              data, or research without giving appropriate credit.
            </li>
            <li>
              <strong>Cheating:</strong> Taking unfair advantage through the use
              of unauthorized materials, copying from other students, or
              falsifying data.
            </li>
            <li>
              <strong>Unauthorized Collaboration:</strong> Working with others
              beyond the extent specifically approved by the instructor.
            </li>
            <li>
              <strong>Self-Plagiarism:</strong> Submitting the same or
              substantially the same work for multiple courses without prior
              instructor permission.
            </li>
          </UnorderedList>
          <BodyText component="h2" variant="h4">
            Consequences of Violations
          </BodyText>
          <BodyText variant="body1">
            MIT takes allegations of academic misconduct seriously. If you are
            found in violation of this Honor Code or the MIT Academic Integrity
            policy, you may be subject to one or more of the following actions
            at the sole discretion of MIT:
          </BodyText>
          <UnorderedList>
            <li>Receiving a zero or no credit for an assignment or exam.</li>
            <li>A reduced or failing grade for the entire course.</li>
            <li>Withholding or revocation of any certificate earned.</li>
            <li>Unenrollment from the course or program without a refund.</li>
            <li>Termination of access to {SITE_NAME} Site.</li>
          </UnorderedList>
          <BodyText component="h2" variant="h4">
            Commitment to Clarity
          </BodyText>
          <BodyText variant="body1">
            If these policies are unclear, <strong>ask the instructor</strong>.
            Ignorance of these policies is not an excuse for academic
            dishonesty.
          </BodyText>
          <BodyText variant="body1">
            <em>
              This statement is reviewed periodically. By accessing MIT learning
              sites, you signify your agreement to the most current version of
              these standards.
            </em>
          </BodyText>
        </BodyContainer>
      </PageContainer>
    </Container>
  )
}

export default HonorCodePage
