import React from "react"
import { styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiInformation2Line } from "@remixicon/react"
import { TERMS } from "@/common/urls"
import { OPEN_LICENSE_ID } from "@/app-pages/TermsPage/TermsPage"
import { Section, SectionInner } from "./SectionLayout"

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  borderTop: `1px solid ${theme.custom.colors.darkGray2}`,
}))

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "32px",
  padding: "48px 0",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
    padding: "32px 0",
  },
}))

const IconBox = styled.div(({ theme }) => ({
  display: "flex",
  padding: "16px",
  border: `1px solid ${theme.custom.colors.darkGray2}`,
  borderRadius: "4px",
  color: theme.custom.colors.darkGray2,
  svg: { width: "28px", height: "28px" },
}))

const Text = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  flex: 1,
  minWidth: 0,
})

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.black,
  margin: 0,
}))

const Body = styled.p(({ theme }) => ({
  ...theme.typography.body1Loose,
  color: theme.custom.colors.black,
  margin: 0,
}))

const LicensingBanner: React.FC = () => (
  <Band>
    <Inner>
      <IconBox>
        <RiInformation2Line aria-hidden />
      </IconBox>
      <Text>
        <Heading>Using and adapting these resources</Heading>
        <Body>
          Free to view and often free to reuse. Check each course’s license;
          many OCW courses use CC BY-NC-SA 4.0.
        </Body>
      </Text>
      <ButtonLink
        variant="bordered"
        size="medium"
        href={`${TERMS}#${OPEN_LICENSE_ID}`}
      >
        Learn more about reuse and licensing
      </ButtonLink>
    </Inner>
  </Band>
)

export default LicensingBanner
