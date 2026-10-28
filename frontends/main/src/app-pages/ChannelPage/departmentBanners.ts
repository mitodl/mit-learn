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
import mediaArtsAndSciencesBanner from "@/public/images/backgrounds/media-arts-and-sciences.jpg"
import urbanStudiesAndPlanningBanner from "@/public/images/backgrounds/urban-studies-and-planning.jpg"
import aeronauticsAndAstronauticsBanner from "@/public/images/backgrounds/aeronautics-and-astronautics.jpg"
import biologicalEngineeringBanner from "@/public/images/backgrounds/biological-engineering.jpg"
import chemicalEngineeringBanner from "@/public/images/backgrounds/chemical-engineering.jpg"
import civilAndEnvironmentalEngineeringBanner from "@/public/images/backgrounds/civil-and-environmental-engineering.jpg"
import electricalEngineeringAndComputerScienceBanner from "@/public/images/backgrounds/electrical-engineering-and-computer-science.jpg"
import healthSciencesAndTechnologyBanner from "@/public/images/backgrounds/health-sciences-and-technology.jpg"
import materialsScienceAndEngineeringBanner from "@/public/images/backgrounds/materials-science-and-engineering.jpg"
import mechanicalEngineeringBanner from "@/public/images/backgrounds/mechanical-engineering.jpg"
import nuclearScienceAndEngineeringBanner from "@/public/images/backgrounds/nuclear-science-and-engineering.jpg"

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
}

export { DEPARTMENT_BANNERS }
