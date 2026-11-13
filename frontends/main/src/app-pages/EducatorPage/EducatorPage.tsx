"use client"

import React from "react"
import dynamic from "next/dynamic"
import HeroSection from "./HeroSection"
import SelectedCoursesSection from "./SelectedCoursesSection"
import LicensingBanner from "./LicensingBanner"
import TeachingPracticesSection from "./TeachingPracticesSection"
import SupportShareSection from "./SupportShareSection"
import StayConnectedSection from "./StayConnectedSection"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

/**
 * The educator landing page: OCW courses and teaching media for instructors
 * who want to reuse MIT materials. Sections are siblings in this directory.
 */
const EducatorPage: React.FC = () => (
  <>
    <LearningResourceDrawer />
    <HeroSection />
    <SelectedCoursesSection />
    <LicensingBanner />
    <TeachingPracticesSection />
    <SupportShareSection />
    <StayConnectedSection />
  </>
)

export default EducatorPage
