"use client"

import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { Section, SectionInner } from "./SectionLayout"
import { clientLogos as copy } from "./copy"

const Band = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

const Inner = styled(SectionInner)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "40px",
})

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.red,
  textAlign: "center",
  margin: 0,
}))

const Logos = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "32px 48px",
  listStyle: "none",
  margin: 0,
  padding: 0,
  width: "100%",
  [theme.breakpoints.down("md")]: {
    justifyContent: "center",
  },
}))

const Logo = styled.li({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  img: {
    maxWidth: "100%",
    height: "auto",
  },
})

const ClientLogosSection: React.FC = () => (
  <Band aria-labelledby="client-logos-heading">
    <Inner>
      <Heading id="client-logos-heading">{copy.eyebrow}</Heading>
      <Logos>
        {copy.logos.map((logo) => (
          <Logo key={logo.name}>
            <Image
              src={logo.src}
              alt={logo.name}
              width={logo.width}
              height={logo.height}
            />
          </Logo>
        ))}
      </Logos>
    </Inner>
  </Band>
)

export default ClientLogosSection
