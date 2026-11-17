"use client"

import React from "react"
import HeroSection from "./HeroSection"
import InitiativesSection from "./InitiativesSection"
import LetterSection from "./LetterSection"
import TestimonialSection from "./TestimonialSection"
import ImpactMetricsSection from "./ImpactMetricsSection"
import ImpactReportsSection from "./ImpactReportsSection"

/**
 * The support (giving) page: ways to support MIT Open Learning, with the
 * letter, testimonial, metrics and reports that make the case for it. Sections
 * are siblings in this directory.
 */
const SupportPage: React.FC = () => (
  <>
    <HeroSection />
    <InitiativesSection />
    <LetterSection />
    <TestimonialSection />
    <ImpactMetricsSection />
    <ImpactReportsSection />
  </>
)

export default SupportPage
