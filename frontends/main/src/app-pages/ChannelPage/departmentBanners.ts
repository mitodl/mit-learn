/**
 * The artwork behind each department's title, and where the design puts it.
 *
 * Data rather than rendering: this file says which photograph a department
 * gets and how it is framed, and `ChannelRedesignTemplate` says how a frame
 * is drawn. Kept apart because the two change for different reasons -- a
 * department is added or its placement retuned far more often than the hero
 * itself moves -- and because the list grows one department at a time.
 */
import type { StaticImageData } from "next/image"
import architectureBanner from "@/public/images/backgrounds/architecture.jpg"
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
 * Where a department's own artwork sits, where the design states it
 * differently from the hero's own defaults.
 *
 * Those defaults are one photograph's: the design wrote them around a 4:3
 * picture, and they only hold for another of the same shape. A department
 * whose artwork is a different shape states its own frame, and gives the
 * three that say where the picture goes; the rest of the hero is unchanged.
 */
type BannerPlacement = {
  /** The left edge of the band the picture is drawn in. */
  left?: string
  /** `background-size` and `background-position` within it. */
  size?: string
  position?: string
  /**
   * Given together where the design states the picture's own box instead: how
   * far it is lifted above the hero, how wide it is drawn, and the shape it
   * keeps while being drawn that wide.
   */
  top?: string
  width?: string
  aspectRatio?: string
  /**
   * How far the box has to reach whatever its shape works out to, so that a
   * hero taller than the one the design was drawn on is still covered rather
   * than left with a strip of white under the picture.
   */
  minHeight?: string
  /**
   * The white wash, where the design angles it differently for this
   * photograph.
   *
   * It is drawn per department rather than once, because how far the white
   * may sweep across depends on where the picture starts: a wash written for
   * one that begins a third of the way across closes over one that begins
   * further right. Only the hero that carries a Featured row takes it -- the
   * short one is held back by a rule of its own, which no design states.
   */
  scrim?: string
}

type DepartmentBanner = BannerPlacement & { image: StaticImageData }

/**
 * HST under both the names it goes by.
 *
 * The design frame is titled Health Sciences and Technology, which is what
 * the department calls itself. The channel slug is not that: it is built from
 * the department name the backend holds, and `DEPARTMENTS` has HST down as
 * Medical Engineering and Science, so `medical-engineering-and-science` is
 * the slug that exists today and the only one that can match.
 *
 * Keyed under both rather than the one, because which of them is right is a
 * question for the backend's department list, not for the artwork: should HST
 * ever be recorded under the name it answers to, the banner follows it rather
 * than quietly going out.
 */
const HEALTH_SCIENCES_AND_TECHNOLOGY: Record<string, DepartmentBanner> =
  Object.fromEntries(
    ["medical-engineering-and-science", "health-sciences-and-technology"].map(
      (slug) => [
        slug,
        {
          image: healthSciencesAndTechnologyBanner,
          left: "27.63%",
          top: "-35.03%",
          width: "81.78%",
          /* The design's box, in the pixels it is drawn at -- not the
             photograph's own shape, which is what makes this one a pull. */
          aspectRatio: "1371 / 923",
          minHeight: "139.07%",
          size: "100% 100%",
        },
      ],
    ),
  )

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
 */
const DEPARTMENT_BANNERS: Partial<Record<string, DepartmentBanner>> = {
  architecture: { image: architectureBanner },
  /**
   * Media Arts states its own box, and has to: the design gives this one the
   * hero's full width from 22.21% across, lifted 13.96% above the top, at
   * 1676x756 -- the 2.215 this photograph is, not the 4:3 the values above
   * were written around. Left on those it is drawn half as wide again as the
   * hero and hangs off the right.
   *
   * The shape is the photograph's, so the width settles the height; the floor
   * is the design's 113.93%, which is the same 756 on the hero it was drawn
   * on and keeps a taller one covered. `cover` is what takes up the
   * difference, by cropping the sides rather than stretching.
   */
  "media-arts-and-sciences": {
    image: mediaArtsAndSciencesBanner,
    left: "12.21%",
    top: "-13.96%",
    width: "100%",
    aspectRatio: "1440 / 650",
    minHeight: "113.93%",
    size: "cover",
    /* From the picture's own left edge, which is where the design starts it.
       Left to the default it would be pinned to the right instead, and what
       `cover` trimmed to fill a taller box would come off the front of the
       picture rather than the back. */
    position: "0% 50%",
  },
  /**
   * Urban Studies states a box again, and a third shape: 72.9% of the hero
   * wide and 122.68% of it tall, from 29.42% across and 25.63% above the top,
   * which is the 3:2 this photograph is.
   *
   * Its floor is the stated height rather than the hero's, because the design
   * does not take this one to the bottom: 122.68 less the 25.63 it is lifted
   * leaves the picture ending at 97.05%, and the wash is white down there in
   * any case.
   */
  "urban-studies-and-planning": {
    image: urbanStudiesAndPlanningBanner,
    left: "25.42%",
    top: "-25.63%",
    width: "75.9%",
    aspectRatio: "900 / 600",
    minHeight: "122.68%",
    size: "cover",
    position: "0% 50%",
  },
  /**
   * Aeronautics is drawn in a box 70.22% of the hero wide and lifted 5.47%
   * above it, at the 1.84 this photograph is. It starts further across than
   * the rest, and further left than the design's own 38.13%, which clipped an
   * eighth of the picture off the hero's right edge.
   *
   * Which is why it is also the one that states its own wash: the shared one
   * is angled for a picture beginning a third of the way across and reaches
   * white around 46% of the way over this building's top, where the design's
   * own angle leaves it near a quarter. The building is what the hero is for,
   * so the design's wash comes with the design's placement.
   *
   * The photograph is a cut-out -- the sky was transparent -- flattened onto
   * the white it is drawn against, which is what the hero is behind it.
   */
  "aeronautics-and-astronautics": {
    image: aeronauticsAndAstronauticsBanner,
    left: "30.13%",
    top: "-5.47%",
    width: "70.22%",
    aspectRatio: "1291 / 703",
    minHeight: "96.51%",
    size: "cover",
    position: "0% 50%",
    scrim:
      "linear-gradient(193.64deg, rgba(255, 255, 255, 0) 1.8914%, rgb(255, 255, 255) 50.795%)",
  },
  /**
   * Biological Engineering is the one the design does not lift at all -- the
   * top is a rounding error from zero, so the picture sits on the hero's own
   * top edge and runs off the bottom instead, at the 1.65 this photograph is.
   *
   * Its wash is the design's too, shallower again than Aeronautics' and
   * reaching white later, which is what keeps the building standing where
   * this one begins.
   */
  "biological-engineering": {
    image: biologicalEngineeringBanner,
    left: "41.51%",
    top: "0.02%",
    width: "60.02%",
    aspectRatio: "1840 / 1118",
    minHeight: "82.32%",
    size: "cover",
    position: "0% 50%",
    scrim:
      "linear-gradient(199.205deg, rgba(255, 255, 255, 0) 0%, rgb(255, 255, 255) 53.919%)",
  },
  /**
   * Chemical Engineering is drawn in the frame Architecture's numbers came
   * from -- the same box, the same lift, the shared wash -- and so would need
   * nothing stated here at all, but for the photograph.
   *
   * It is a 3:2, and that box is 4:3. The design resolves the two by pulling
   * the picture to fit, which leaves the building an eighth taller than it
   * stands; `100% 100%` is that, and is why this is the one entry that does
   * not keep its photograph's own shape.
   *
   * The alternative is `size: "cover"`, which holds the shape and takes the
   * difference off the sides instead -- at the cost of the framing, since it
   * crops in far enough to move the skyline across.
   */
  "chemical-engineering": {
    image: chemicalEngineeringBanner,
    left: "28.88%",
    top: "-28.85%",
    width: "71.1%",
    aspectRatio: "4 / 3",
    minHeight: "134.59%",
    size: "100% 100%",
  },
  /**
   * Civil and Environmental is given the hero's whole width from a quarter of
   * the way across, so a quarter of the photograph hangs off the right and is
   * clipped -- which is the design's framing: the building runs out of the
   * frame rather than standing inside it. The wash is the shared one.
   */
  "civil-and-environmental-engineering": {
    image: civilAndEnvironmentalEngineeringBanner,
    left: "17.97%",
    top: "-21.49%",
    width: "100%",
    aspectRatio: "1431 / 728",
    minHeight: "128.41%",
    size: "cover",
    position: "0% 50%",
  },
  /**
   * Electrical Engineering is the one whose frame is not the height of the
   * others: its title is long enough to take two lines, which gives that
   * design a hero 40px deeper than the rest. The percentages below are shares
   * of that deeper hero, so the two that are read against a height -- the
   * lift and the floor -- land a few pixels off on a hero whose title fits on
   * one line, and the shape, which is read against the width, does not move.
   *
   * Its wash is the shared one. The design states a degree and a half more,
   * which works out at a percentage point of white across the building and is
   * not worth a wash of its own.
   */
  "electrical-engineering-and-computer-science": {
    image: electricalEngineeringAndComputerScienceBanner,
    left: "22.85%",
    top: "-45.55%",
    width: "81.78%",
    aspectRatio: "840 / 600",
    minHeight: "139.07%",
    size: "cover",
    position: "0% 50%",
  },
  /**
   * Health Sciences and Technology, which is drawn to its frame's box rather
   * than its photograph's shape for the same reason Chemical Engineering is:
   * the design pulls a 1.57 picture into a 1.48 box. It is the milder of the
   * two -- five and a half percent against twelve and a half.
   */
  ...HEALTH_SCIENCES_AND_TECHNOLOGY,
  /**
   * Materials Science is the tidiest of them: its left edge and its width add
   * up to the hero exactly, so the picture ends where the hero does and
   * nothing is clipped off the side. The photograph is already the shape of
   * the box it is given, so nothing is pulled either, and the wash is the
   * shared one.
   */
  "materials-science-and-engineering": {
    image: materialsScienceAndEngineeringBanner,
    left: "32.83%",
    top: "-8.67%",
    width: "68.17%",
    aspectRatio: "800 / 562",
    minHeight: "117.33%",
    size: "cover",
    position: "0% 50%",
  },
  /**
   * Mechanical Engineering is drawn in the same 4:3 box Architecture's
   * numbers describe and ends at the hero's right edge as Materials Science
   * does, but sits lower in the frame than either -- it is lifted half what
   * Architecture is, which is what keeps the pediment and the steps in view
   * rather than the sky above them.
   *
   * The only one of these whose artwork is larger than the box it is drawn
   * in, so it is the only one that loses nothing to being scaled up.
   */
  "mechanical-engineering": {
    image: mechanicalEngineeringBanner,
    left: "28.94%",
    top: "-17.26%",
    width: "71.06%",
    aspectRatio: "4 / 3",
    minHeight: "134.53%",
    size: "cover",
    position: "0% 50%",
  },
  /**
   * Nuclear Science is given half again the width of the narrowest of these
   * and runs a sixth of itself off the right of the hero, which is the only
   * way the row of buildings reads as a row rather than as one building.
   *
   * Its artwork arrived at 4096 wide and eight megabytes, which is four
   * times the box it is drawn in; it is stored at the 2048 the rest of the
   * larger ones use.
   */
  "nuclear-science-and-engineering": {
    image: nuclearScienceAndEngineeringBanner,
    left: "28.07%",
    top: "-34.43%",
    width: "87.36%",
    aspectRatio: "2048 / 1249",
    minHeight: "134.42%",
    size: "cover",
    position: "0% 50%",
  },
}

export { DEPARTMENT_BANNERS }
export type { BannerPlacement, DepartmentBanner }
