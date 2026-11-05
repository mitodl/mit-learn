import React from "react"
import { styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import {
  RiFacebookFill,
  RiInstagramLine,
  RiLinkedinFill,
  RiTwitterXLine,
  RiYoutubeLine,
} from "@remixicon/react"
import { Section, SectionInner } from "./SectionLayout"
import { OCW_NEWSLETTER_URL, OCW_SOCIAL } from "./links"

const SOCIAL_LINKS = [
  { label: "Facebook", href: OCW_SOCIAL.facebook, icon: RiFacebookFill },
  { label: "Instagram", href: OCW_SOCIAL.instagram, icon: RiInstagramLine },
  { label: "X", href: OCW_SOCIAL.x, icon: RiTwitterXLine },
  { label: "YouTube", href: OCW_SOCIAL.youtube, icon: RiYoutubeLine },
  { label: "LinkedIn", href: OCW_SOCIAL.linkedin, icon: RiLinkedinFill },
]

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  gap: "24px",
  padding: "64px 0 80px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "40px",
    padding: "40px 0",
  },
}))

const Column = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  minWidth: 0,
})

const SocialColumn = styled(Column)(({ theme }) => ({
  flex: "0 0 519px",
  [theme.breakpoints.down("md")]: {
    flex: "initial",
  },
}))

const NewsletterColumn = styled(Column)({
  flex: 1,
})

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const SocialList = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "40px",
  listStyle: "none",
  margin: 0,
  padding: 0,
  [theme.breakpoints.down("sm")]: {
    gap: "16px",
  },
}))

const SocialLink = styled.a(({ theme }) => ({
  display: "flex",
  padding: "16px",
  border: `1px solid ${theme.custom.colors.silverGrayDark}`,
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.black,
  svg: { width: "24px", height: "24px" },
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
}))

const NewsletterForm = styled.form({
  display: "flex",
  borderRadius: "4px",
  overflow: "hidden",
})

const EmailInput = styled.input(({ theme }) => ({
  ...theme.typography.body1,
  flex: 1,
  minWidth: 0,
  padding: "16px 24px",
  lineHeight: 1.5,
  letterSpacing: "0.15px",
  color: theme.custom.colors.darkGray2,
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  borderRight: "none",
  borderRadius: "4px 0 0 4px",
  "&::placeholder": {
    color: theme.custom.colors.silverGray,
  },
}))

const SignUpButton = styled.button(({ theme }) => ({
  ...theme.typography.body1,
  flexShrink: 0,
  width: "202px",
  padding: "16px",
  lineHeight: 1.5,
  letterSpacing: "0.15px",
  color: theme.custom.colors.white,
  backgroundColor: theme.custom.colors.darkGray2,
  border: "none",
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.custom.colors.black,
  },
  [theme.breakpoints.down("sm")]: {
    width: "auto",
    padding: "16px 24px",
  },
}))

const StayConnectedSection: React.FC = () => (
  <Band>
    <Inner>
      <SocialColumn>
        <Heading>Stay connected with OCW</Heading>
        <SocialList>
          {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
            <li key={label}>
              <SocialLink href={href} target="_blank" rel="noopener noreferrer">
                <Icon aria-hidden />
                <VisuallyHidden>MIT OpenCourseWare on {label}</VisuallyHidden>
              </SocialLink>
            </li>
          ))}
        </SocialList>
      </SocialColumn>
      <NewsletterColumn>
        <Heading id="educator-newsletter-heading">
          Subscribe to the Newsletter
        </Heading>
        <NewsletterForm
          action={OCW_NEWSLETTER_URL}
          method="get"
          target="_blank"
          aria-labelledby="educator-newsletter-heading"
        >
          <EmailInput
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="Enter your email address"
            aria-label="Email address"
          />
          <SignUpButton type="submit">Sign Me Up</SignUpButton>
        </NewsletterForm>
      </NewsletterColumn>
    </Inner>
  </Band>
)

export default StayConnectedSection
