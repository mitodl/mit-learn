"use client"

import React from "react"
// Not currently linked to. See https://github.com/mitodl/hq/issues/4639
import {
  Breadcrumbs,
  Container,
  Typography,
  TypographyProps,
  styled,
  Link,
} from "ol-components"
import * as urls from "@/common/urls"

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
  gap: "10px",
})

const BodyText = styled(Typography)(({ theme }) => ({
  alignSelf: "stretch",
  color: theme.custom.colors.black,
}))

const UnorderedList = styled.ul(({ theme }) => ({
  alignSelf: "stretch",
  ...theme.typography.body1,
  marginTop: "10px",
}))

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME

const TermsPage: React.FC = () => {
  return (
    <Container>
      <PageContainer>
        <BannerContainer>
          <BannerContainerInner>
            <Breadcrumbs
              variant="light"
              ancestors={[{ href: urls.HOME, label: "Home" }]}
              current="Terms of Service"
            />
            <Header component="h1" variant="h3">
              Terms of Service
            </Header>
          </BannerContainerInner>
        </BannerContainer>
        <BodyContainer>
          <BodyText variant="body1">
            Welcome to {SITE_NAME} – the Massachusetts Institute of Technology's
            single online platform for accessing all of MIT's non-degree
            learning resources. Through {SITE_NAME}, learners across the globe
            can search and browse courses, programs, and various educational
            materials from across MIT, including Universal AI, MITx, MIT
            OpenCourseWare, MIT Professional Education, MIT Sloan Executive
            Education, MIT xPRO, and other departments across the Institute
            ("Offerings").
          </BodyText>
          <BodyText variant="body1">
            Please read these Terms of Service ("TOS") and the {SITE_NAME}{" "}
            <Link href={urls.PRIVACY} color="red" size="large">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href={urls.PRIVACY} color="red" size="large">
              Honor Code
            </Link>{" "}
            prior to registering for a {SITE_NAME} account or using any portion
            of the {SITE_NAME} website ("Site"), including accessing any
            Offering.
          </BodyText>
          <BodyText variant="body1">
            These TOS, the Privacy Policy, and the Honor Code are agreements
            (the "Agreements") between you and MIT setting forth the terms under
            which you may access, and use the Site, and participate in any MIT
            Learn offering. By using the Site, you accept and agree to be
            legally bound by the Agreements, whether or not you are a registered
            user. If you do not understand or do not wish to be bound by the
            terms of the Agreements, you should not use the Site. As used in
            this Terms of Service, "we," "us," and "our" refer to {SITE_NAME}.
          </BodyText>
          <BodyText variant="body1">
            We reserve the right to modify these TOS at any time without advance
            notice. Any changes to these TOS will be effective immediately upon
            posting on this page, with an updated effective date. By accessing
            the Site after any changes have been made, you signify your
            agreement on a prospective basis to the modified TOS. Be sure to
            return to this page periodically to ensure familiarity with the most
            current version of these TOS.
          </BodyText>

          <Header component="h1" variant="h3">
            Rules for Online Conduct
          </Header>
          <BodyText variant="body1">
            You agree that you are responsible for your own use of the Site and
            any Offerings you select. You agree that you will use the Site in
            compliance with these TOS, the Honor Code, and all applicable local,
            state, national and international laws, rules and regulations,
            including copyright laws, any laws regarding the transmission of
            technical data exported from your country of residence, and all
            United States export control laws.
          </BodyText>
          <BodyText variant="body1">
            As a condition of your use of the {SITE_NAME}, you will not use the
            Site or any Offering in any manner intended to damage, disable,
            overburden, or impair any {SITE_NAME} server(s) or the network(s)
            connected to any {SITE_NAME} server, or to interfere with any other
            party's use and enjoyment of the Site. You may not attempt to gain
            unauthorized access to the Site, other accounts, computer systems,
            or networks connected to any {SITE_NAME} server through hacking,
            password mining, or any other means. You may not obtain or attempt
            to obtain any materials or information stored on the Site, its
            servers, or associated computers through any means not intentionally
            made available through the Site.
          </BodyText>
          <BodyText variant="body1">
            Furthermore, you agree not to scrape, or otherwise download in bulk,
            any Site or Offering content, including but not limited to a list or
            directory of users on the system, on-line textbooks, user
            information, or videos. You agree not to misrepresent or attempt to
            misrepresent your identity while using the Site or in any Offering.
            You will not publish, post, or distribute Site or Offering content
            outside of the Site platform.
          </BodyText>

          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            YOU ARE STRICTLY PROHIBITED FROM POSTING THE FOLLOWING TYPES OF
            CONTENT ON THE SITE OR IN ANY OFFERING:
          </BodyText>

          <UnorderedList>
            <li>Content that defames, harasses, or threatens others;</li>
            <li>
              Content that discusses illegal activities with the intent to
              commit them;
            </li>
            <li>
              Content that infringes another's intellectual property, including,
              but not limited to, copyrights or trademarks;
            </li>
            <li>
              Profane, pornographic, obscene, indecent, or unlawful content;
            </li>
            <li>Advertising or any form of commercial solicitation;</li>
            <li>Content related to partisan political activities;</li>
            <li>
              Viruses, Trojan horses, worms, time bombs, corrupted files,
              malware, spyware, or any other similar software that may damage
              the operation of another's computer or property; and
            </li>
            <li>
              Content that contains intentionally inaccurate information or that
              is posted with the intent of misleading others.
            </li>
          </UnorderedList>

          <Header component="h1" variant="h3">
            User Accounts and Authority
          </Header>
          <BodyText variant="body1">
            In order to create a user account ("User Account") and to
            participate fully in Site activities, you must provide certain
            information about yourself. You agree that you will never share
            access to or access information for your User Account with any third
            party for any reason. In setting up your User Account, you may be
            prompted to enter additional optional information. You represent
            that all information provided by you is accurate and current. You
            agree to maintain and update your information to keep it accurate
            and current.
          </BodyText>
          <BodyText variant="body1">
            We care about the confidentiality and security of your personal
            information. Please see our Privacy Policy for more information
            about what information about you we collect and how we use that
            information.
          </BodyText>
          <BodyText variant="body1">
            You understand and agree that MIT may, in its sole discretion and at
            any time, terminate your username and password or any account
            created on this Site for a violation of these TOS. You understand
            and agree that MIT may take any of these actions without prior
            notice to you. You understand and agree that MIT shall not have any
            liability to you or any other person for any termination of your
            access to the Site, Offerings, or its content.
          </BodyText>

          <Header component="h1" variant="h3">
            Your Right to Use Content on the Site
          </Header>
          <BodyText variant="body1">
            For the purposes of these TOS, the term "Site Content" includes all
            content posted to the Site or through any Offering contained on the
            Site, including but not limited to texts, exams, video, images, and
            other instructional materials provided in connection with the
            modules / courses offered on the Site, as well as User Postings
            posted by other users.
          </BodyText>
          <BodyText variant="body1">
            Unless otherwise indicated, all content on the Site and in the
            various Offerings is protected by United States and foreign
            copyright laws, and you may engage only in personal, noncommercial
            use of the Site Content. You may not otherwise reproduce,
            retransmit, distribute, display, publish, commercially exploit or
            otherwise make available any content in print, electronic, or any
            other medium. You may not record any portion of any module / course.
            Any additional presentation of any module / course or of materials
            derived from any module / course is also strictly prohibited.
          </BodyText>
          <BodyText variant="body1">
            Certain reference documents, digital textbooks, figures,
            photographs, articles, and other information in the Offerings are
            used with the permission of third parties, and your use of that
            information may be subject to certain additional rules and
            conditions, which will be posted along with the information. By
            using this Site, you agree to abide by all such rules and
            conditions.
          </BodyText>
          <BodyText variant="body1">
            You agree to retain all copyright and other notices on any content
            you obtain from the Site or in any Offering. All rights in the Site
            and its content, if not expressly granted, are reserved.
          </BodyText>

          <Header component="h1" variant="h3">
            User Postings
          </Header>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            User Representations and Warranties.
          </BodyText>
          <BodyText variant="body1">
            By submitting or distributing your User Postings, you affirm,
            represent, and warrant (1) that you have the necessary rights,
            licenses, consents, and/or permissions to reproduce and publish the
            User Postings and to authorize {SITE_NAME} and its users to
            reproduce, modify, publish, and otherwise use and distribute your
            User Postings in a manner consistent with the licenses granted by
            you below, and (2) that neither your submission of your User
            Postings nor the exercise of the licenses granted below will
            infringe or violate the rights of any third party. You, and not we,
            are solely responsible for your User Postings and the consequences
            of posting or publishing them.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            License Grant to {SITE_NAME}.
          </BodyText>
          <BodyText variant="body1">
            By submitting or distributing your User Postings, you hereby grant
            to us a worldwide, non-exclusive, transferable, assignable,
            sublicensable, fully paid-up, royalty-free, perpetual, irrevocable
            right and license to host, transfer, display, perform, reproduce,
            modify, distribute, re-distribute, relicense, and otherwise use,
            make available, and exploit your User Postings, in whole or in part,
            in any form and in any media formats and through any media channels
            now known or hereafter developed.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            License Grant to {SITE_NAME} Users.
          </BodyText>
          <BodyText variant="body1">
            By submitting or distributing your User Postings, you hereby grant
            to users of the Site a non-exclusive license to access and use your
            User Postings in connection with their uses of the Site for their
            own personal, noncommercial purposes.
          </BodyText>

          <Header component="h1" variant="h3">
            Certificates of Completion
          </Header>
          <BodyText variant="body1">
            Generally, we may offer a micro-, macro-credential, or certificate
            for completion of certain learning material, including courses
            and/or modules, to learners if, in our judgment, they have
            satisfactorily demonstrated completion of the required content. More
            information on certificates for particular Offerings is made
            available on each Offering page.
          </BodyText>

          <Header component="h1" variant="h3">
            ID Verified Proctoring
          </Header>
          <BodyText variant="body1">
            For certain Offerings, you may be required to pay a fee and complete
            the ID verification process for verified Proctoring. In order to
            authenticate your identity for verified Proctoring, you will be
            prompted to take a webcam photo of yourself, as well as a photo of
            an acceptable form of photo ID (described below). Although these
            items are collected by {SITE_NAME} in accordance with these TOS and
            the Privacy Policy, you should be aware that the actual
            authentication of your identity is performed by a {SITE_NAME}
            third-party service provider and this information will be used only
            for the purpose of verifying your identity. Acceptable forms of
            photo ID's are:
          </BodyText>
          <UnorderedList>
            <li>Government or State-issued driver's license</li>
            <li>Passport</li>
            <li>National ID card</li>
            <li>
              State or Province ID card (including cards issued by motor vehicle
              agencies)
            </li>
          </UnorderedList>
          <BodyText variant="body1">
            In order to be accepted by {SITE_NAME}, your photo ID must:
          </BodyText>

          <UnorderedList>
            <li>
              Contain your full name exactly (excluding hyphens, accents, and
              spaces);
            </li>
            <li>Contain a relatively current photograph of yourself</li>
            <li>
              Be an original document; photocopied documents cannot be accepted;
              and
            </li>
            <li>Be current and valid; expired documents cannot be accepted.</li>
          </UnorderedList>

          <BodyText variant="body1">
            Unfortunately, if you do not possess a photo ID meeting the criteria
            described above, {SITE_NAME} is unable to validate your identity for
            ID verified proctoring.
          </BodyText>

          <Header component="h1" variant="h3">
            Registration
          </Header>
          <BodyText variant="body1" style={{ textDecorationLine: "underline" }}>
            REGISTRATION AND ENROLLMENT:
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Registration process.
          </BodyText>
          <BodyText variant="body1">
            In order to participate in a course / module, individual learners
            must create (register) an account on the Site and also complete the
            course enrollment process for the particular Offering. There is no
            cost to register an account.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Entrance Survey.
          </BodyText>
          <BodyText variant="body1">
            We may request you to provide some personal information via a short
            voluntary module entrance survey.
          </BodyText>
          <BodyText variant="body1" style={{ textDecorationLine: "underline" }}>
            REGISTRATION, ENROLLMENT, PAYMENT, AND REFUNDS:
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Enrollment deadlines.
          </BodyText>
          <BodyText variant="body1">
            The deadline for enrollment varies by Offering and will be posted in
            the Offering information. Please note that once enrollment has
            closed, no late enrollments will be generally granted.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Payment.
          </BodyText>
          <BodyText variant="body1">
            Although the majority of the content on the Site is free, some
            Offerings may require payment to access specific material and/or
            earn a certificate. The deadline for payment varies by Offering and
            will be posted in the information.
          </BodyText>
          <BodyText variant="body1">
            The processing of your payment information is done by a third party
            ("Vendor") and you will be re-routed to a secure website to complete
            the payment transaction. You are responsible for paying all fees and
            any applicable taxes from any taxing authority. All payments shall
            be made in U.S. Dollars. The privacy statement posted at the payment
            landing page operated by Vendor will govern the submission and
            processing of your payment details. Please familiarize yourself with
            those terms prior to initiating a transaction.
          </BodyText>
          <BodyText variant="body1">
            Once your payment transaction is completed, you will be re-routed to
            an {SITE_NAME} confirmation page and will receive a confirmation
            email with your name, order number, and the payment amount. This
            email may originate from Vendor. Please retain this email for your
            records.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Refunds.
          </BodyText>
          <BodyText variant="body1">
            You may be eligible for a refund for certain Offerings if you
            request such a refund during the applicable refund period. For more
            information, please visit the Offering page for details on our
            refund process.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Enrollment code and Coupon Codes.
          </BodyText>
          <BodyText variant="body1">
            Any applicable enrollment code or coupon code must be entered at the
            time of Certificate purchase in order to receive a discount. No
            discounts can be applied after the purchase request has been
            submitted. Offers cannot be combined for additional discounts.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Transfers / Substitutions / Deferments.
          </BodyText>
          <BodyText variant="body1">
            Admission and fees paid may not generally be deferred to a
            subsequent session, transferred to another course, or learner. If
            you determine you are unable to participate in any particular
            Offering, please review our Transfers / Substitutions / Deferments
            policy associated with the Offering.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            No Other Enrollment.
          </BodyText>
          <BodyText variant="body1">
            When you register for, take, or complete a module / course through
            {SITE_NAME}, you will not be an applicant for admission to, or
            enrolled in, any degree program of MIT. You will not be entitled to
            use any of the resources of MIT beyond the online modules / courses
            provided on the Site, nor will you be eligible to receive the
            privileges or benefits provided to students enrolled in degree
            programs of MIT. You may not imply or state in any manner, written
            or oral, that MIT or {SITE_NAME} is granting academic credit for
            enrollment in this professional module / course. None of the modules
            / courses offered through {SITE_NAME} award academic credit or
            degrees.
          </BodyText>
          <Header component="h1" variant="h3">
            Trademarks
          </Header>
          <BodyText variant="body1">
            The {SITE_NAME} names, logos and seals are trademarks ("Trademarks")
            of MIT. You may not use any of these Trademarks, or any variations
            thereof, without MIT's prior written consent. You may not use any of
            these Trademarks, or any variations thereof, for promotional
            purposes, or in any way that deliberately or inadvertently claims,
            suggests or, in MIT's sole judgment, gives the appearance or
            impression of a relationship with or endorsement by MIT.
          </BodyText>
          <BodyText variant="body1">
            All trademarks not owned by MIT that appear on the Site or through
            the services made available on or through the Site are the property
            of their respective owners.
          </BodyText>
          <BodyText variant="body1">
            Nothing contained on the Site should be construed as granting, by
            implication, estoppel or otherwise, any license or right to use any
            trademark or Trademark displayed on the Site without the written
            permission of its owner.
          </BodyText>

          <Header component="h1" variant="h3">
            Digital Millennium Copyright Act
          </Header>
          <BodyText variant="body1">
            Copyright owners who believe their material has been infringed on
            the Site should contact our designated copyright agent at{" "}
            <Link href="mailto:dmca-agent@mit.edu" size="large" color="black">
              dmca-agent@mit.edu
            </Link>
            .
          </BodyText>
          <BodyText variant="body1">Notification must include:</BodyText>
          <UnorderedList>
            <li>
              Identification of the copyrighted work, or, in the case of
              multiple works at the same location, a representative list of such
              works at that site.
            </li>
            <li>
              Identification of the material that is claimed to be infringing or
              to be the subject of infringing activity. You must include
              sufficient information for us to locate the material (e.g., URL,
              IP address, computer name).
            </li>
            <li>
              Information for us to be able to contact the complaining party
              (e.g., email address, phone number). A statement that the
              complaining party believes that the use of the material has not
              been authorized by the copyright owner or an authorized agent.
            </li>
          </UnorderedList>
          <Header component="h1" variant="h3">
            Disclaimers of Warranty / Limitations of Liabilities
          </Header>
          <BodyText variant="body1">
            THE SITE AND ANY INFORMATION, CONTENT, OR SERVICES MADE AVAILABLE ON
            OR THROUGH THE SITE ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTY OF ANY KIND (EXPRESS, IMPLIED, OR OTHERWISE), INCLUDING,
            WITHOUT LIMITATION, ANY IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, EXCEPT
            INSOFAR AS ANY SUCH IMPLIED WARRANTIES MAY NOT BE DISCLAIMED UNDER
            APPLICABLE LAW.
          </BodyText>
          <BodyText variant="body1">
            {SITE_NAME} AND COLLABORATORS (AS HEREINAFTER DEFINED) DO NOT
            WARRANT THAT THE SITE WILL OPERATE IN AN UNINTERRUPTED OR ERROR-FREE
            MANNER, THAT THE SITE IS FREE OF VIRUSES OR OTHER HARMFUL
            COMPONENTS, OR THAT THE MODULES OR CONTENT PROVIDED WILL MEET YOUR
            NEEDS OR EXPECTATIONS.
          </BodyText>
          <BodyText variant="body1">
            {SITE_NAME} AND COLLABORATORS ALSO MAKE NO WARRANTY ABOUT THE
            ACCURACY, COMPLETENESS, TIMELINESS, OR QUALITY OF THE SITE OR ANY
            MODULES OR CONTENT, OR THAT ANY PARTICULAR MODULES OR CONTENT WILL
            CONTINUE TO BE MADE AVAILABLE. "COLLABORATORS" MEANS MIT, THE
            ENTITIES PROVIDING INFORMATION, CONTENT, OR SERVICES FOR THE SITE,
            THE MODULE INSTRUCTORS AND THEIR STAFFS.
          </BodyText>
          <BodyText variant="body1">
            USE OF THE SITE, AND THE CONTENT AND SERVICES OBTAINED FROM OR
            THROUGH THE SITE, IS AT YOUR OWN RISK. YOUR ACCESS TO OR DOWNLOAD OF
            INFORMATION, MATERIALS, OR DATA THROUGH THE SITE OR ANY REFERENCE
            SITES IS AT YOUR OWN DISCRETION AND RISK, AND YOU WILL BE SOLELY
            RESPONSIBLE FOR ANY DAMAGE TO YOUR PROPERTY (INCLUDING YOUR COMPUTER
            SYSTEM) OR LOSS OF DATA THAT RESULTS FROM THE DOWNLOAD OR USE OF
            SUCH MATERIAL OR DATA, UNLESS OTHERWISE EXPRESSLY PROVIDED FOR IN
            THE UNIVERSAL AI PRIVACY POLICY.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            User Postings Disclaimer.
          </BodyText>
          <BodyText variant="body1">
            You understand that when using the Site, you will be exposed to User
            Postings from a variety of sources and that neither {SITE_NAME} nor
            Collaborator are responsible for the accuracy, usefulness,
            reliability, or intellectual property rights of or relating to such
            User Postings. You further understand and acknowledge that you may
            be exposed to User Postings that are inaccurate, offensive,
            defamatory, indecent, or objectionable and you agree to waive, and
            hereby do waive, any legal or equitable rights or remedies you have
            or may have against {SITE_NAME} or Collaborators with respect
            thereto. Neither {SITE_NAME} nor Collaborators endorse any User
            Postings or any opinion, recommendation, or advice expressed
            therein. Neither MIT Learn nor Collaborators have any obligation to
            monitor any User Postings or any other user communications through
            the Site.
          </BodyText>
          <BodyText variant="body1">
            However, we reserve the right to review User Postings and to
            exercise our sole discretion to edit or remove, in whole or in part,
            any User Posting at any time and for any reason, or to allow
            Collaborators to do so. Without limiting the foregoing, upon
            receiving notice from a user or a content owner that a User Posting
            allegedly does not conform to these Terms, we may investigate the
            allegation and determine in our sole discretion whether to remove
            the User Posting, which we reserve the right to do at any time and
            without notice.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Minors.
          </BodyText>
          <BodyText variant="body1">
            The {SITE_NAME} site and {SITE_NAME} Modules / Courses are not
            intended for children under 13 years of age, and no one under age 13
            may provide any personal information to us or through the Site. We
            do not knowingly collect personal information from children under
            age 13. If you are under 13, do not use or provide any information
            on our Site or on or through our services. If we learn that we have
            collected personal information from a child under age 13, we will
            delete it.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Links to Other Sites.
          </BodyText>
          <BodyText variant="body1">
            The Site may include hyperlinks to sites maintained or controlled by
            others. {SITE_NAME} and Collaborators are not responsible for and do
            not routinely screen, approve, review, or endorse the contents of or
            use of any of the products or services that may be offered at these
            sites. If you decide to access linked third-party websites, you do
            so at your own risk.
          </BodyText>
          <BodyText variant="body1">
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, YOU AGREE THAT
            NEITHER {SITE_NAME} NOR COLLABORATORS WILL BE LIABLE TO YOU FOR ANY
            LOSS OR DAMAGES, EITHER ACTUAL OR CONSEQUENTIAL, ARISING OUT OF OR
            RELATING TO THESE TERMS OF SERVICE, OR YOUR (OR ANY THIRD PARTY'S)
            USE OF OR INABILITY TO USE THE SITE, OR YOUR PLACEMENT OF CONTENT ON
            THE SITE, OR YOUR RELIANCE UPON INFORMATION OBTAINED FROM OR THROUGH
            THE SITE, WHETHER YOUR CLAIM IS BASED IN CONTRACT, TORT, STATUTE OR
            OTHER LAW.
          </BodyText>
          <BodyText variant="body1">
            IN PARTICULAR, TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW,
            NEITHER {SITE_NAME} NOR COLLABORATORS WILL HAVE ANY LIABILITY FOR
            ANY CONSEQUENTIAL, INDIRECT, PUNITIVE, SPECIAL, EXEMPLARY, OR
            INCIDENTAL DAMAGES, WHETHER FORESEEABLE OR UNFORESEEABLE, AND
            WHETHER OR NOT
            {SITE_NAME} OR COLLABORATORS HAVE BEEN NEGLIGENT OR OTHERWISE AT
            FAULT (INCLUDING, BUT NOT LIMITED TO, CLAIMS FOR DEFAMATION, ERRORS,
            LOSS OF PROFITS, LOSS OF DATA, OR INTERRUPTION IN AVAILABILITY OF
            DATA).
          </BodyText>
          <BodyText variant="body1">
            CERTAIN STATE LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR
            THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY
            TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS, EXCLUSIONS, OR
            LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MIGHT HAVE ADDITIONAL
            RIGHTS.
          </BodyText>

          <Header component="h1" variant="h3">
            Indemnification
          </Header>
          <BodyText variant="body1">
            You agree to defend, hold harmless, and indemnify {SITE_NAME}, and
            their respective subsidiaries, affiliates, officers, faculty,
            students, fellows, governing board members, agents, and employees
            from and against any third party claims, actions or demands arising
            out of, resulting from or in any way related to your use of the Site
            or in any Offering, including any liability or expense arising from
            any and all claims, losses, damages (actual and consequential),
            suits, judgments, litigation costs, and attorneys' fees, of every
            kind and nature. In such a case, {SITE_NAME} or a Participant will
            provide you with written notice of such claim, suit, or action.
          </BodyText>

          <Header component="h1" variant="h3">
            Miscellaneous
          </Header>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Termination Rights:
          </BodyText>
          <BodyText variant="body1">
            You agree that we may, at our own discretion, terminate your use of
            the Site or your participation in any Offering for any reason or no
            reason upon notice to you. You will not be entitled to a refund if
            we terminate your use of or participation in the Site or Offering
            for a material breach of any of these terms and you fail to cure
            such breach within 30 days of receiving written notice from us about
            the breach. We reserve the right at any time in our sole discretion
            to cancel, postpone, reschedule, or alter the format of any Offering
            provided offered through {SITE_NAME}, or to cease providing any part
            or all of the Site content or related services. If you no longer
            desire to participate in the Site, you may terminate your access at
            any time. The rights granted to you hereunder will terminate upon
            any termination of your access and right to use the Site, but the
            other provisions of these Terms will survive any such termination.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Entire Agreement.
          </BodyText>
          <BodyText variant="body1">
            These TOS, the Honor Code, and the Privacy Policy together
            constitute the entire agreement between you and {SITE_NAME} with
            respect to your use of the Site and its Offerings, superseding any
            prior agreements between you and MIT regarding your use of the Site.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Waiver and Severability of TOS.
          </BodyText>
          <BodyText variant="body1">
            Our failure to exercise or enforce any right or provision of these
            TOS shall not constitute a waiver of such right or provision. If any
            provision of these TOS is found by a court of competent jurisdiction
            to be invalid, the parties nevertheless agree that the court should
            endeavor to give effect to the parties' intentions as reflected in
            the provision, and the other provisions of these TOS shall remain in
            full force and effect.
          </BodyText>
          <BodyText variant="body1" style={{ fontWeight: "bold" }}>
            Choice of Law/Forum Selection.
          </BodyText>
          <BodyText variant="body1">
            You agree that these TOS and any claim or dispute arising out of or
            relating to these TOS or any Offering from or through the Site will
            be governed by the laws of the Commonwealth of Massachusetts,
            excluding its conflicts of laws provisions. You agree that all such
            claims and disputes will be heard and resolved exclusively in the
            federal or state courts located in and serving Cambridge,
            Massachusetts, U.S.A. You consent to the personal jurisdiction of
            those courts for this purpose, and you waive, and agree not to
            assert, any objection to such proceedings in those courts (including
            any defense or objection for lack of proper jurisdiction or venue or
            inconvenience of forum).
          </BodyText>
          <BodyText variant="body1">
            These terms of service were last updated on June 9, 2025.
          </BodyText>
        </BodyContainer>
      </PageContainer>
    </Container>
  )
}

export default TermsPage
