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
const MITOL_SUPPORT_EMAIL = process.env.NEXT_PUBLIC_MITOL_SUPPORT_EMAIL

const PrivacyPage: React.FC = () => {
  return (
    <Container>
      <PageContainer>
        <BannerContainer>
          <BannerContainerInner>
            <Breadcrumbs
              variant="light"
              ancestors={[{ href: urls.HOME, label: "Home" }]}
              current="Privacy Policy"
            />
            <Header component="h1" variant="h3">
              Privacy Policy
            </Header>
          </BannerContainerInner>
        </BannerContainer>
        <BodyContainer>
          <BodyText component="h2" variant="h4">
            Introduction
          </BodyText>
          <BodyText variant="body1">
            {SITE_NAME} is committed to protecting the privacy of its global
            community of learners. This Privacy Policy explains how {SITE_NAME}{" "}
            (the "Site") collects, uses, and processes personal information
            about our learners. Please read this Privacy Policy prior to
            registering or using any portion of the Site, including accessing
            any module / course material or other electronic services.
          </BodyText>

          <BodyText component="h2" variant="h4">
            What personal information we may collect
          </BodyText>
          <BodyText variant="body1">
            We collect, use, store and transfer different kinds of personal
            information about you depending upon your interaction with the Site.
            We have grouped the type of personal information we collect as
            follows:
          </BodyText>
          <UnorderedList>
            <li>
              Biographic information – full name, gender, date of birth,
              username, country of residence, state (if country is US),
              education level, employer, title/position, household income, CV,
              company size, job function, industry, university name, enrollment
              status, anticipated degree, anticipated date of graduation,
              pre-retirement career, year of retirement, and other demographic
              info
            </li>
            <li>
              Demographics and Interests - Affinity categories, Product Purchase
              Interests, and Other Categories of interest
            </li>
            <li>
              Contact information – home and business addresses, phone numbers,
              email addresses, phone numbers, and social media information
            </li>
            <li>IP addresses</li>
            <li>Module / Course progress and performance</li>
            <li>
              Information that you provide such as submissions / prompts to AI
              tools
            </li>
          </UnorderedList>

          <BodyText component="h2" variant="h4">
            How we collect personal information about you
          </BodyText>
          <BodyText variant="body1">
            We collect information, including Personal Information, when you
            create and maintain a profile and user account, participate in{" "}
            {SITE_NAME} offerings, engage with {SITE_NAME}'s artificial
            intelligence tutors and guides, review application for financial
            assistance (if available), register/pay for a paid certificate, send
            us email messages, or complete an entrance or exit survey, and/or
            participate in our public forums and social media.
          </BodyText>
          <BodyText variant="body1">
            We also collect certain usage information about learner performance
            and patterns of learning. In addition, we track information
            indicating, among other things, which pages of our Site were
            visited, the order in which they were visited, when they were
            visited, and which hyperlinks and other user interface controls were
            used.
          </BodyText>
          <BodyText variant="body1">
            We also collect information when you fill out and submit contact
            forms, as well as from marketing data including how many emails you
            have received, opened, clicked, and unsubscribed from.
          </BodyText>
          <BodyText variant="body1">
            We may log the IP address, operating system, page visit behavior,
            and browser software used by each user of the Site, and we may be
            able to determine from an IP address a user's Internet Service
            Provider and the geographic location of his or her point of
            connectivity. Various web analytics tools, including Google
            Analytics, Google Analytics: Demographics and Interests, PostHog,
            and HubSpot, may be used to collect this information. Some of the
            information is collected through cookies (small text files placed on
            your computer that store information about you, which can be
            accessed by the Site). You should be able to control how and whether
            cookies will be accepted by your web browser. Most browsers offer
            instructions on how to reset the browser to reject cookies in the
            "Help" section of the toolbar. If you reject our cookies, many
            functions and conveniences of this Site may not work properly.
          </BodyText>
          <BodyText variant="body1">
            We do not collect financial information from you. When you register
            and pay for a course, you will be directed to our third-party
            payment processor, CyberSource, and the submission of your payment
            information will be subject to the terms of that third party
            processor's privacy statement,{" "}
            <a href="https://usa.visa.com/legal/privacy-policy.html">
              https://usa.visa.com/legal/privacy-policy.html
            </a>
            .
          </BodyText>

          <BodyText component="h2" variant="h4">
            How we may use your personal information
          </BodyText>
          <BodyText variant="body1">
            We collect, use and process your personal information (1) to process
            transactions requested by you and meet our contractual obligations;
            (2) to facilitate {SITE_NAME} legitimate interests, and/or (3) with
            your explicit consent, where applicable. Examples of the ways in
            which we use your personal information are as follows:
          </BodyText>
          <UnorderedList>
            <li>
              To enable us to provide, administer, and improve our modules /
              courses.
            </li>
            <li>
              To help us improve {SITE_NAME} offerings, both individually and in
              aggregate, and to individualize the experience and to evaluate the
              access and use of the Site and the impact of {SITE_NAME} on the
              worldwide educational community.
            </li>
            <li>
              For purposes of scientific research, particularly, for example, in
              the areas of cognitive science and education.
            </li>
            <li>
              For the purpose for which you specifically provided the
              information, for example, to respond to a specific inquiry or
              provide you with access to the specific module / course content
              and/or services you select.
            </li>
            <li>
              To track both individual and aggregate attendance, progress, and
              completion of an online module / course, and to analyze aggregate
              statistics on student performance and how students learn.
            </li>
            <li>
              To monitor and detect violations of the Honor Code and the Terms
              of Service, as well as other misuses and potential misuses of the
              Site.
            </li>
            <li>
              To publish information, but not Personal Information, gathered
              about {SITE_NAME} access, use, impact, and learner performance.
            </li>
            <li>
              To send you updates about online modules / courses offered by{" "}
              {SITE_NAME} or other MIT Open Learning events, to send you
              communications about products or services of {SITE_NAME},
              affiliates, or selected business partners that may be of interest
              to you, or to send you email messages about Site maintenance or
              updates.
            </li>
            <li>
              To archive this information and/or use it for future module /
              course recommendations or communications with you.
            </li>
            <li>
              To maintain and improve the functioning and security of the Site
              and our software, systems, and network.
            </li>
            <li>
              For purposes described elsewhere in this Privacy Policy
              (including, e.g., sharing with third parties).
            </li>
            <li>
              As otherwise described to you at the point of collection or
              pursuant to your consent.
            </li>
            <li>
              To authenticate your identity when you register for a module /
              course.
            </li>
            <li>To process refunds, as applicable.</li>
          </UnorderedList>
          <BodyText variant="body1">
            If you have concerns about any of these purposes, or how we
            communicate with you, please contact us at {MITOL_SUPPORT_EMAIL}. We
            will always respect a request by you to stop processing your
            personal information (subject to our legal obligations).
          </BodyText>

          <BodyText component="h2" variant="h4">
            When we share your personal information
          </BodyText>
          <BodyText variant="body1">
            We will share information we collect (including Personal
            Information) with third parties as follows:
          </BodyText>
          <UnorderedList>
            <li>
              With service providers or contractors that perform certain
              functions on our behalf, including processing information that you
              provide to us on the Site, processing purchases via third party
              providers, and other transactions through the Site, operating the
              Site or portions of it, providing or administering modules /
              courses, or in connection with other aspects {SITE_NAME}.
            </li>
            <li>
              With other visitors to the Site, to the extent that you submit
              comments, module / course work, or other information or content
              (collectively, "Postings") to a portion of the Site designed for
              public communications; and with other members of an {SITE_NAME}{" "}
              class of which you are a member, to the extent you submit Postings
              to a portion of the Site designed for viewing by those class
              members. We may provide your Postings to learners who later enroll
              in the same classes as you, within the context of the forums, the
              courseware, or otherwise. If we do re-post your Postings
              originally made to non-public portions of the Site, we will post
              them without your real name and email (except with your express
              permission), but we may use your username without your consent.
            </li>
            <li>
              For purposes of scientific research, particularly, for example, in
              the areas of cognitive science and education. However, we will
              only share Personal Information about you for this purpose to the
              extent doing so complies with applicable law and is limited to the
              Personal Information required to fulfill the purposes stated at
              the time of collection.
            </li>
            <li>
              To provide opportunities for you to communicate with other users
              who may have similar interests or educational goals. For instance,
              we may recommend specific study partners or connect potential
              student mentees and mentors. In such cases, we may use all
              information collected about you to determine who might be
              interested in communicating with you, but we will only provide
              other users your username, and not disclose your real name or
              email address, except with your express permission.
            </li>
            <li>
              To respond to subpoenas, court orders, or other legal process; to
              investigate, prevent, or take action regarding illegal activities,
              suspected fraud, or security or technical issues, or to enforce
              our Terms of Service, our Honor Code, or this Privacy Policy; as
              otherwise may be required by applicable law; or to protect our
              rights, property, or safety or those of others.
            </li>
            <li>
              As otherwise described to you at the point of collection or
              pursuant to your consent.
            </li>
            <li>
              To support integration with third party services. For example,
              videos and other content may be hosted on YouTube and other
              websites not controlled by us.
            </li>
          </UnorderedList>
          <BodyText variant="body1">
            In cases where we share or disclose your Personal Information: (1)
            the third-party recipients are required to handle the Personal
            Information in a confidential manner and to maintain adequate
            security to protect the information from loss, misuse, unauthorized
            access or disclosure, alteration, and destruction; and (2) we will
            only disclose and share the Personal Information that is required by
            the third party to fulfill the purpose stated at the time of
            collection. In addition, we may share aggregated information that
            does not personally identify you with the public and with third
            parties, including but not limited to researchers and business
            partners.
          </BodyText>

          <BodyText component="h2" variant="h4">
            How your information is stored and secured
          </BodyText>
          <BodyText variant="body1">
            {SITE_NAME} is designed to protect Personal Information in its
            possession or control. This is done through a variety of privacy and
            security policies, processes, and procedures, including
            administrative, physical, and technical safeguards that reasonably
            and appropriately protect the confidentiality, integrity, and
            availability of the Personal Information that it receives,
            maintains, or transmits. Nonetheless, no method of transmission over
            the Internet or method of electronic storage is 100% secure, and
            therefore we do not guarantee its absolute security.
          </BodyText>

          <BodyText component="h2" variant="h4">
            How long we keep your personal information
          </BodyText>
          <BodyText variant="body1">
            We consider your relationship with the {SITE_NAME} community to be
            lifelong. This means that we will maintain a record for you until
            such time as you tell us that you no longer wish us to keep in
            touch. Requests to delete your account or personal information can
            be sent to olprivacy@mit.edu. After such time, we will retain a core
            set of information for {SITE_NAME} legitimate purposes, such as
            archival, scientific and historical research and for the defense of
            potential legal claims.
          </BodyText>

          <BodyText component="h2" variant="h4">
            Data Protection and Access Rights
          </BodyText>
          <BodyText variant="body1">
            Depending upon your geographic location, you may have the right in
            certain circumstances to (1) access your personal information; (2)
            to correct or erase information; (3) restrict processing; and (4)
            object to communications, direct marketing, or profiling. To the
            extent applicable, the European Economic Area's General Data
            Protection Regulation (GDPR) provides further information about your
            rights. You also have the right to lodge complaints with your
            national or regional data protection authority.
          </BodyText>
          <BodyText variant="body1">
            If you are inclined to exercise these rights, we request an
            opportunity to discuss with you any concerns you may have. To
            protect the personal information we hold, we may also request
            further information to verify your identity when exercising these
            rights. Upon a request to erase information, we will maintain a core
            set of personal data to ensure we do not contact you inadvertently
            in the future, as well as any information necessary for MIT archival
            purposes. We may also need to retain some financial information for
            legal purposes, including US IRS compliance. In the event of an
            actual or threatened legal claim, we may retain your information for
            purposes of establishing, defending against or exercising our rights
            with respect to such claim.
          </BodyText>
          <BodyText variant="body1">
            By providing information directly to MIT, you consent to the
            transfer of your personal information outside of your location to
            the United States. You understand that the current laws and
            regulations of the United States may not provide the same level of
            protection as the data and privacy laws and regulations of other
            jurisdictions.
          </BodyText>
          <BodyText variant="body1">
            You are under no statutory or contractual obligation to provide any
            personal data to us. The controller for your personal information is
            MIT.
          </BodyText>
          <BodyText variant="body1">
            If you are in the EEA or UK and wish to assert any of your
            applicable GDPR rights, please contact dataprotection@mit.edu. You
            may also contact MIT's representatives listed below:
          </BodyText>
          <BodyText variant="h5">
            MIT Representative in the European Economic Area
          </BodyText>
          <BodyText variant="body1">
            <strong>J-PAL Europe</strong>
            <br />
            Email:{" "}
            <a href="mailto:jpaleurope@povertyactionlab.org">
              jpaleurope@povertyactionlab.org
            </a>
            <br />
            Address: 48 Boulevard Jourdan, 75014 Paris, France
          </BodyText>
          <BodyText variant="h5">
            MIT Representative in the United Kingdom
          </BodyText>
          <BodyText variant="body1">
            <strong>MIT Press UK</strong>
            <br />
            Address: 71 Queen Victoria Street, London, United Kingdom, EC4V 4BE
          </BodyText>

          <BodyText component="h2" variant="h4">
            Additional Information
          </BodyText>
          <BodyText variant="body1">
            We may change this Privacy Statement from time to time. If we make
            any significant changes in the way we treat your personal
            information we will make this clear on our MIT websites or by
            contacting you directly.
          </BodyText>
          <BodyText variant="body1">
            <strong>This policy was last updated on June 13, 2025.</strong>
          </BodyText>
        </BodyContainer>
      </PageContainer>
    </Container>
  )
}

export default PrivacyPage
