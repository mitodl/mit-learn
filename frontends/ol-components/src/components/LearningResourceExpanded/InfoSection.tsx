import React from "react"
import styled from "@emotion/styled"
import ISO6391 from "iso-639-1"
import {
  RemixiconComponentType,
  RiVerifiedBadgeLine,
  RiTimeLine,
  RiCalendarLine,
  RiListOrdered2,
  RiPriceTag3Line,
  RiDashboard3Line,
  RiGraduationCapLine,
  RiTranslate2,
  RiPresentationLine,
  RiAwardFill,
} from "@remixicon/react"
import { LearningResource, ResourceTypeEnum } from "api"
import {
  formatDurationClockTime,
  formatRunDate,
  getLearningResourcePrices,
  showStartAnytime,
} from "ol-utilities"
import { theme } from "../ThemeProvider/ThemeProvider"

const SeparatorContainer = styled.span({
  padding: "0 8px",
  color: theme.custom.colors.silverGray,
})

const Separator: React.FC = () => <SeparatorContainer>|</SeparatorContainer>

const InfoItems = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const InfoItemContainer = styled.div({
  display: "flex",
  alignSelf: "stretch",
  alignItems: "center",
  gap: "16px",
  ...theme.typography.subtitle3,
  color: theme.custom.colors.black,
  svg: {
    color: theme.custom.colors.silverGrayDark,
    width: "20px",
    height: "20px",
    flexShrink: 0,
  },
  [theme.breakpoints.down("sm")]: {
    gap: "12px",
  },
})

const IconContainer = styled.div({
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
})

const InfoLabel = styled.div`
  width: 85px;
  flex-shrink: 0;
`

const InfoValue = styled.div`
  ${{ ...theme.typography.body3 }}
  color: ${theme.custom.colors.darkGray2};
  flex-grow: 1;
`

const PriceDisplay = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "8px",
})

const Certificate = styled.div({
  display: "flex",
  gap: "4px",
  borderRadius: "4px",
  padding: "4px 8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.lightGray1,
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.subtitle3,
  svg: {
    width: "16px",
    height: "16px",
  },
})

type InfoSelector = (resource: LearningResource) => React.ReactNode

type InfoItemConfig = {
  label: string | ((resource: LearningResource) => string)
  Icon: RemixiconComponentType | null
  selector: InfoSelector
}[]

const INFO_ITEMS: InfoItemConfig = [
  {
    label: (resource: LearningResource) => {
      const asTaughtIn = resource ? showStartAnytime(resource) : false
      const label = asTaughtIn ? "As taught in:" : "Start Date:"
      return label
    },
    Icon: RiCalendarLine,
    selector: (resource: LearningResource) => {
      const asTaughtIn = resource ? showStartAnytime(resource) : false
      if (
        [ResourceTypeEnum.Course, ResourceTypeEnum.Program].includes(
          resource.resource_type as "course" | "program",
        )
      ) {
        const runDates =
          resource.runs
            ?.sort((a, b) => {
              if (a?.start_date && b?.start_date) {
                return Date.parse(a.start_date) - Date.parse(b.start_date)
              }
              return 0
            })
            .map((run, index) => {
              const totalRuns = resource.runs?.length || 0
              return (
                <React.Fragment key={`run-${run.id}`}>
                  {formatRunDate(run, asTaughtIn)}
                  {index < totalRuns - 1 && <Separator />}
                </React.Fragment>
              )
            }) ?? []
        return runDates
      } else return null
    },
  },
  {
    label: "Price:",
    Icon: RiPriceTag3Line,
    selector: (resource: LearningResource) => {
      const prices = getLearningResourcePrices(resource)

      return (
        <PriceDisplay>
          <div>{prices.course.display}</div>
          {resource.certification && (
            <Certificate>
              <RiAwardFill />
              {prices.certificate.display
                ? "Earn a certificate:"
                : "Certificate included"}
              <span>{prices.certificate.display}</span>
            </Certificate>
          )}
        </PriceDisplay>
      )
    },
  },
  {
    label: "Topics:",
    Icon: RiPresentationLine,
    selector: (resource: LearningResource) => {
      const { topics } = resource
      if (!topics?.length) {
        return null
      }

      return topics.map((topic, index) => {
        return (
          <React.Fragment key={`topic-${index}`}>
            {topic.name}
            {index < topics.length - 1 && <Separator />}
          </React.Fragment>
        )
      })
    },
  },
  {
    label: "Level:",
    Icon: RiDashboard3Line,
    selector: (resource: LearningResource) => {
      const totalRuns = resource.runs?.length || 0
      const levels = resource.runs?.map((run, index) => {
        const level = run?.level?.[0]?.name
        if (!level) {
          return null
        }
        return (
          <React.Fragment key={`level-${index}`}>
            {run?.level?.[0]?.name}
            {index < totalRuns - 1 && <Separator />}
          </React.Fragment>
        )
      })
      if (levels?.every((level) => level === null)) {
        return null
      }
      return levels
    },
  },

  {
    label: "Instructors:",
    Icon: RiGraduationCapLine,
    selector: (resource: LearningResource) => {
      const instructorNames: string[] = []
      resource.runs?.forEach((run) => {
        run.instructors?.forEach((instructor) => {
          if (instructor.full_name) {
            instructorNames.push(instructor.full_name)
          }
        })
      })
      const uniqueInstructors = Array.from(new Set(instructorNames))
      if (uniqueInstructors.length === 0) {
        return null
      }
      const totalInstructors = uniqueInstructors.length
      const instructors = uniqueInstructors.map((instructor, index) => {
        return (
          <React.Fragment key={`instructor-${index}`}>
            {instructor}
            {index < totalInstructors - 1 && <Separator />}
          </React.Fragment>
        )
      })
      return instructors
    },
  },

  {
    label: "Languages:",
    Icon: RiTranslate2,
    selector: (resource: LearningResource) => {
      const runLanguages: string[] = []
      resource.runs?.forEach((run) => {
        run.languages?.forEach((language) => {
          runLanguages.push(language)
        })
      })
      const uniqueLanguages = Array.from(new Set(runLanguages))
      if (uniqueLanguages.length === 0) {
        return null
      }
      const totalLanguages = uniqueLanguages.length
      return uniqueLanguages.map((language, index) => {
        return (
          <React.Fragment key={`language-${index}`}>
            {ISO6391.getName(language.substring(0, 2))}
            {index < totalLanguages - 1 && <Separator />}
          </React.Fragment>
        )
      })
    },
  },

  {
    label: "Duration:",
    Icon: RiTimeLine,
    selector: (resource: LearningResource) => {
      if (resource.resource_type === ResourceTypeEnum.Video) {
        return resource.video.duration
          ? formatDurationClockTime(resource.video.duration)
          : null
      }
      if (resource.resource_type === ResourceTypeEnum.PodcastEpisode) {
        return resource.podcast_episode.duration
          ? formatDurationClockTime(resource.podcast_episode.duration)
          : null
      }
      return null
    },
  },

  {
    label: "Offered By:",
    Icon: RiVerifiedBadgeLine,
    selector: (resource: LearningResource) => {
      return resource.offered_by?.name || null
    },
  },

  {
    label: "Date Posted:",
    Icon: RiCalendarLine,
    selector: () => {
      // TODO Not seeing any value for this in the API schema for VideoResource. Last modified date is closest available, though likely relates to the data record
      return null
    },
  },

  {
    label: "Number of Courses:",
    Icon: RiListOrdered2,
    selector: (resource: LearningResource) => {
      if (resource.resource_type === ResourceTypeEnum.Program) {
        return resource.program.course_count
      }
      return null
    },
  },
]

type InfoItemProps = {
  label: string
  Icon: RemixiconComponentType | null
  value: React.ReactNode
}

const InfoItem = ({ label, Icon, value }: InfoItemProps) => {
  if (!value) {
    return null
  }
  return (
    <InfoItemContainer>
      <IconContainer>{Icon && <Icon />}</IconContainer>
      <InfoLabel>{label}</InfoLabel>
      <InfoValue>{value}</InfoValue>
    </InfoItemContainer>
  )
}

const InfoSection = ({ resource }: { resource?: LearningResource }) => {
  if (!resource) {
    return null
  }

  const infoItems = INFO_ITEMS.map(({ label, Icon, selector }) => ({
    label: typeof label === "function" ? label(resource) : label,
    Icon,
    value: selector(resource),
  })).filter(({ value }) => value !== null && value !== "")

  if (infoItems.length === 0) {
    return null
  }

  return (
    <InfoItems data-testid="drawer-info-items">
      {infoItems.map((props, index) => (
        <InfoItem key={index} {...props} />
      ))}
    </InfoItems>
  )
}

export default InfoSection
