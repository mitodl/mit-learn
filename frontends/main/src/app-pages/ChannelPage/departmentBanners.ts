/**
 * The artwork behind each department's title.
 *
 * Nothing but which photograph a department gets: the artwork arrives cut to
 * the diagonal the design draws and at one size for every department, so
 * there is no longer anything to say about where a picture goes. How it is
 * drawn is `HeroPhoto`, in `ChannelRedesignTemplate`.
 */
import type { StaticImageData } from "next/image"
import architectureBanner from "@/public/images/backgrounds/architecture.webp"
import mediaArtsAndSciencesBanner from "@/public/images/backgrounds/media-arts-and-sciences.webp"
import urbanStudiesAndPlanningBanner from "@/public/images/backgrounds/urban-studies-and-planning.webp"
import aeronauticsAndAstronauticsBanner from "@/public/images/backgrounds/aeronautics-and-astronautics.webp"
import biologicalEngineeringBanner from "@/public/images/backgrounds/biological-engineering.webp"
import chemicalEngineeringBanner from "@/public/images/backgrounds/chemical-engineering.webp"
import civilAndEnvironmentalEngineeringBanner from "@/public/images/backgrounds/civil-and-environmental-engineering.webp"
import electricalEngineeringAndComputerScienceBanner from "@/public/images/backgrounds/electrical-engineering-and-computer-science.webp"
import healthSciencesAndTechnologyBanner from "@/public/images/backgrounds/health-sciences-and-technology.webp"
import materialsScienceAndEngineeringBanner from "@/public/images/backgrounds/materials-science-and-engineering.webp"
import mechanicalEngineeringBanner from "@/public/images/backgrounds/mechanical-engineering.webp"
import nuclearScienceAndEngineeringBanner from "@/public/images/backgrounds/nuclear-science-and-engineering.webp"
import musicBanner from "@/public/images/backgrounds/music.webp"
import politicalScienceBanner from "@/public/images/backgrounds/political-science.webp"
import historyBanner from "@/public/images/backgrounds/history.webp"
import literatureBanner from "@/public/images/backgrounds/literature.webp"
import anthropologyBanner from "@/public/images/backgrounds/anthropology.webp"
import economicsBanner from "@/public/images/backgrounds/economics.webp"
import comparativeMediaStudiesWritingBanner from "@/public/images/backgrounds/comparative-media-studieswriting.webp"
import globalStudiesAndLanguagesBanner from "@/public/images/backgrounds/global-studies-and-languages.webp"
import linguisticsAndPhilosophyBanner from "@/public/images/backgrounds/linguistics-and-philosophy.webp"
import scienceTechnologyAndSocietyBanner from "@/public/images/backgrounds/science-technology-and-society.webp"
import theaterArtsBanner from "@/public/images/backgrounds/theater-arts.webp"
import womensAndGenderStudiesBanner from "@/public/images/backgrounds/womens-and-gender-studies.webp"
import sloanSchoolOfManagementBanner from "@/public/images/backgrounds/sloan-school-of-management.webp"
import brainAndCognitiveSciencesBanner from "@/public/images/backgrounds/brain-and-cognitive-sciences.webp"
import chemistryBanner from "@/public/images/backgrounds/chemistry.webp"
import biologyBanner from "@/public/images/backgrounds/biology.webp"
import earthAtmosphericAndPlanetarySciencesBanner from "@/public/images/backgrounds/earth-atmospheric-and-planetary-sciences.webp"
import physicsBanner from "@/public/images/backgrounds/physics.webp"
import dataSystemsAndSocietyBanner from "@/public/images/backgrounds/data-systems-and-society.webp"
import mathematicsBanner from "@/public/images/backgrounds/mathematics.webp"

/**
 * The artwork behind a department's title, by department.
 *
 * Keyed on the channel's `name` -- the slug the route carries and the API
 * returns -- rather than the title, which is prose and punctuated. Nothing is
 * configured on these channels to read instead: every department's
 * `banner_background` is empty, so this is the only thing that decides.
 *
 * A department with no entry here draws no photograph and stands on the plain
 * white the topic pages do, so this fills in one department at a time.
 *
 * Four departments appear under both the names they go by. The design frames
 * are titled with the name the department uses for itself; the channel slug
 * comes from the department name the backend holds in `DEPARTMENTS`, and for
 * these four the two differ:
 *
 * | design frame                           | `DEPARTMENTS`                |
 * | -------------------------------------- | ---------------------------- |
 * | Health Sciences and Technology          | Medical Engineering and Science |
 * | Institute for Data, Systems and Society | Data, Systems, and Society   |
 * | Global Studies and Languages            | Global Languages             |
 * | Sloan School of Management              | Management                   |
 *
 * The slug the backend name makes is the only one that can match, so that is
 * the entry that draws; the design's name is kept beside it so the artwork
 * follows the department if the backend is ever corrected rather than quietly
 * going out.
 */
const DEPARTMENT_BANNERS: Partial<Record<string, StaticImageData>> = {
  architecture: architectureBanner,
  "media-arts-and-sciences": mediaArtsAndSciencesBanner,
  "urban-studies-and-planning": urbanStudiesAndPlanningBanner,
  "aeronautics-and-astronautics": aeronauticsAndAstronauticsBanner,
  "biological-engineering": biologicalEngineeringBanner,
  "chemical-engineering": chemicalEngineeringBanner,
  "civil-and-environmental-engineering": civilAndEnvironmentalEngineeringBanner,
  "electrical-engineering-and-computer-science":
    electricalEngineeringAndComputerScienceBanner,
  "medical-engineering-and-science": healthSciencesAndTechnologyBanner,
  "health-sciences-and-technology": healthSciencesAndTechnologyBanner,
  "materials-science-and-engineering": materialsScienceAndEngineeringBanner,
  "mechanical-engineering": mechanicalEngineeringBanner,
  "nuclear-science-and-engineering": nuclearScienceAndEngineeringBanner,
  anthropology: anthropologyBanner,
  "comparative-media-studieswriting": comparativeMediaStudiesWritingBanner,
  economics: economicsBanner,
  "global-languages": globalStudiesAndLanguagesBanner,
  "global-studies-and-languages": globalStudiesAndLanguagesBanner,
  history: historyBanner,
  "linguistics-and-philosophy": linguisticsAndPhilosophyBanner,
  literature: literatureBanner,
  music: musicBanner,
  "political-science": politicalScienceBanner,
  "science-technology-and-society": scienceTechnologyAndSocietyBanner,
  "theater-arts": theaterArtsBanner,
  "womens-and-gender-studies": womensAndGenderStudiesBanner,
  management: sloanSchoolOfManagementBanner,
  "sloan-school-of-management": sloanSchoolOfManagementBanner,
  biology: biologyBanner,
  "brain-and-cognitive-sciences": brainAndCognitiveSciencesBanner,
  chemistry: chemistryBanner,
  "earth-atmospheric-and-planetary-sciences":
    earthAtmosphericAndPlanetarySciencesBanner,
  mathematics: mathematicsBanner,
  physics: physicsBanner,
  "data-systems-and-society": dataSystemsAndSocietyBanner,
  "institute-for-data-systems-and-society": dataSystemsAndSocietyBanner,
}

export { DEPARTMENT_BANNERS }
