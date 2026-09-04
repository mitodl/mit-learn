"use client"

import React from "react"
import HeroSection from "./HeroSection"
import FeaturedProgramSection from "./FeaturedProgramSection"
import OfferingsSection from "./OfferingsSection"
import DeliveryFormatsSection from "./DeliveryFormatsSection"
import ContinuumSection from "./ContinuumSection"
import ClientLogosSection from "./ClientLogosSection"
import CaseStudiesSection from "./CaseStudiesSection"
import FaqSection from "./FaqSection"
import GetInTouchSection from "./GetInTouchSection"

/**
 * The "For Organizations" B2B landing page. Sections are siblings in this directory.
 *
 */
const OrganizationalLearningPage: React.FC = () => (
  <>
    <HeroSection />
    <FeaturedProgramSection />
    <OfferingsSection />
    <DeliveryFormatsSection />
    <ContinuumSection />
    <ClientLogosSection />
    <CaseStudiesSection />
    <FaqSection />
    <GetInTouchSection />
  </>
)

export default OrganizationalLearningPage
