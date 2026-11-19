"use client"

import React from "react"
import { styled } from "ol-components"
import HeroSection from "./HeroSection"
import InitiativesSection from "./InitiativesSection"
import LetterSection from "./LetterSection"
import TestimonialSection from "./TestimonialSection"
import ImpactMetricsSection from "./ImpactMetricsSection"
import ImpactReportsSection from "./ImpactReportsSection"

/**
 * On phones the sections below the hero are separated by 40px of white, as
 * in the mobile design; elsewhere they sit edge to edge.
 */
const Body = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    flexDirection: "column",
    gap: "40px",
    backgroundColor: theme.custom.colors.white,
  },
}))

/**
 * The support (giving) page: ways to support MIT Open Learning, with the
 * letter, testimonial, metrics and reports that make the case for it. Sections
 * are siblings in this directory.
 */
const SupportPage: React.FC = () => (
  <>
    <HeroSection />
    <Body>
      <InitiativesSection />
      <LetterSection />
      <TestimonialSection />
      <ImpactMetricsSection />
      <ImpactReportsSection />
    </Body>
  </>
)

export default SupportPage
