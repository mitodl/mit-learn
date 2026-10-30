/**
 * The artwork behind each department's title.
 *
 * Nothing but which photograph a department gets: the artwork arrives cut to
 * the diagonal the design draws and at one size for every department, so
 * there is no longer anything to say about where a picture goes. How it is
 * drawn is `HeroPhoto`, in `ChannelRedesignTemplate`.
 */
import type { StaticImageData } from "next/image"
import architectureBanner from "@/public/images/backgrounds/architecture.png"
import mediaArtsAndSciencesBanner from "@/public/images/backgrounds/media-arts-and-sciences.png"
import urbanStudiesAndPlanningBanner from "@/public/images/backgrounds/urban-studies-and-planning.png"
import aeronauticsAndAstronauticsBanner from "@/public/images/backgrounds/aeronautics-and-astronautics.png"
import biologicalEngineeringBanner from "@/public/images/backgrounds/biological-engineering.png"
import chemicalEngineeringBanner from "@/public/images/backgrounds/chemical-engineering.png"
import civilAndEnvironmentalEngineeringBanner from "@/public/images/backgrounds/civil-and-environmental-engineering.png"
import electricalEngineeringAndComputerScienceBanner from "@/public/images/backgrounds/electrical-engineering-and-computer-science.png"
import healthSciencesAndTechnologyBanner from "@/public/images/backgrounds/health-sciences-and-technology.png"
import materialsScienceAndEngineeringBanner from "@/public/images/backgrounds/materials-science-and-engineering.png"
import mechanicalEngineeringBanner from "@/public/images/backgrounds/mechanical-engineering.png"
import nuclearScienceAndEngineeringBanner from "@/public/images/backgrounds/nuclear-science-and-engineering.png"
import musicBanner from "@/public/images/backgrounds/music.png"
import politicalScienceBanner from "@/public/images/backgrounds/political-science.png"
import historyBanner from "@/public/images/backgrounds/history.png"
import literatureBanner from "@/public/images/backgrounds/literature.png"
import anthropologyBanner from "@/public/images/backgrounds/anthropology.png"
import economicsBanner from "@/public/images/backgrounds/economics.png"
import comparativeMediaStudiesWritingBanner from "@/public/images/backgrounds/comparative-media-studieswriting.png"
import globalStudiesAndLanguagesBanner from "@/public/images/backgrounds/global-studies-and-languages.png"
import linguisticsAndPhilosophyBanner from "@/public/images/backgrounds/linguistics-and-philosophy.png"
import scienceTechnologyAndSocietyBanner from "@/public/images/backgrounds/science-technology-and-society.png"
import theaterArtsBanner from "@/public/images/backgrounds/theater-arts.png"
import womensAndGenderStudiesBanner from "@/public/images/backgrounds/womens-and-gender-studies.png"
import sloanSchoolOfManagementBanner from "@/public/images/backgrounds/sloan-school-of-management.png"
import brainAndCognitiveSciencesBanner from "@/public/images/backgrounds/brain-and-cognitive-sciences.png"
import chemistryBanner from "@/public/images/backgrounds/chemistry.png"
import biologyBanner from "@/public/images/backgrounds/biology.png"
import earthAtmosphericAndPlanetarySciencesBanner from "@/public/images/backgrounds/earth-atmospheric-and-planetary-sciences.png"
import physicsBanner from "@/public/images/backgrounds/physics.png"
import dataSystemsAndSocietyBanner from "@/public/images/backgrounds/data-systems-and-society.png"
import mathematicsBanner from "@/public/images/backgrounds/mathematics.png"

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
 * HST appears under both the names it goes by. The design frame is titled
 * Health Sciences and Technology, which is what the department calls itself;
 * the channel slug comes from the department name the backend holds, and
 * `DEPARTMENTS` has HST down as Medical Engineering and Science, so
 * `medical-engineering-and-science` is the slug that exists today and the
 * only one that can match. Under both, the artwork follows the department if
 * that is ever corrected rather than quietly going out.
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
  "global-studies-and-languages": globalStudiesAndLanguagesBanner,
  history: historyBanner,
  "linguistics-and-philosophy": linguisticsAndPhilosophyBanner,
  literature: literatureBanner,
  music: musicBanner,
  "political-science": politicalScienceBanner,
  "science-technology-and-society": scienceTechnologyAndSocietyBanner,
  "theater-arts": theaterArtsBanner,
  "womens-and-gender-studies": womensAndGenderStudiesBanner,
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
