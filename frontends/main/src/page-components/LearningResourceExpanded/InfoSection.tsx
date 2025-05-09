import React, { useState } from "react"
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
  RiAwardLine,
  RiComputerLine,
  RiMapPinLine,
  RiCalendarScheduleLine,
} from "@remixicon/react"
import {
  CertificationTypeEnum,
  DeliveryEnum,
  LearningResource,
  ResourceTypeEnum,
} from "api"
import {
  allRunsAreIdentical,
  formatDurationClockTime,
  formatRunDate,
  getLearningResourcePrices,
  showStartAnytime,
  NoSSR,
} from "ol-utilities"
import { theme, Link } from "ol-components"
import DifferingRunsTable from "./DifferingRunsTable"

const SeparatorContainer = styled.span({
  padding: "0 8px",
  color: theme.custom.colors.silverGray,
})

/*
 * Pipe followed by zero-width space, ZWSP.
 * By doing
 * <ITEM><PIPE><ZWSP><ITEM><PIPE><ZWSP>...
 * without whitespace between <ITEM> and <PIPE>, we allow line
 * breaks after the pipe but not before it.
 */
const Separator: React.FC = () => (
  <SeparatorContainer aria-label=", ">|&#8203;</SeparatorContainer>
)

const InfoItems = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxWidth: "100%",
})

const InfoItemContainer = styled.div({
  display: "flex",
  alignSelf: "stretch",
  alignItems: "baseline",
  ...theme.typography.subtitle3,
  color: theme.custom.colors.black,
  svg: {
    color: theme.custom.colors.silverGrayDark,
    width: "20px",
    height: "20px",
    flexShrink: 0,
  },
})

const IconContainer = styled.span({
  transform: "translateY(25%)",
  svg: {
    display: "block",
  },
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
})

const InfoLabel = styled.div({
  marginLeft: "12px",
  width: "85px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    marginLeft: 0,
  },
})

const InfoValue = styled.div({
  display: "inline-block",
  color: theme.custom.colors.darkGray2,
  rowGap: ".2rem",
  ...theme.typography.body3,
})

const NoWrap = styled.span({
  whiteSpace: "nowrap",
})

const ShowMoreLink = styled(Link)({
  paddingLeft: "12px",
})

const ShowLessLink = styled(Link)({
  display: "flex",
  paddingTop: "4px",
})

const PriceDisplay = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
})

const Certificate = styled.div({
  display: "flex",
  alignItems: "center",
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
  [theme.breakpoints.down("sm")]: {
    padding: "4px 8px",
    ...theme.typography.subtitle4,
  },
})

type InfoSelector = (resource: LearningResource) => React.ReactNode

type InfoItemConfig = {
  label: string | ((resource: LearningResource) => string)
  Icon: RemixiconComponentType | null
  selector: InfoSelector
}[]

type InfoItemValueProps = {
  label: string | null
  index: number
  total: number
}

const InfoItemValue: React.FC<InfoItemValueProps> = ({
  label,
  index,
  total,
}) => {
  return (
    <>
      {label}
      {index < total - 1 && <Separator />}
    </>
  )
}

const totalRunsWithDates = (resource: LearningResource) => {
  return (
    resource.runs
      ?.map((run) => formatRunDate(run, showStartAnytime(resource)))
      .filter((date) => date !== null).length || 0
  )
}

const RunDates: React.FC<{ resource: LearningResource }> = ({ resource }) => {
  const [showingMore, setShowingMore] = useState(false)
  const sortedDates = resource.runs
    ?.sort((a, b) => {
      if (a?.start_date && b?.start_date) {
        return Date.parse(a.start_date) - Date.parse(b.start_date)
      }
      return 0
    })
    .map((run) => formatRunDate(run, showStartAnytime(resource)))
    .filter((date) => date !== null)
  const totalDates = sortedDates?.length || 0
  const showMore = totalDates > 2
  if (showMore) {
    const ShowHideLink = showingMore ? ShowLessLink : ShowMoreLink
    const showMoreLink = (
      <NoWrap>
        <ShowHideLink
          scroll={false}
          color="red"
          size="small"
          onClick={() => setShowingMore(!showingMore)}
        >
          {showingMore ? "Show less" : "Show more"}
        </ShowHideLink>
      </NoWrap>
    )
    return (
      <span data-testid="drawer-run-dates">
        {sortedDates?.slice(0, 2).map((runDate, index) => {
          return (
            <NoWrap key={`run-${index}`}>
              <InfoItemValue
                label={runDate}
                index={index}
                total={showingMore ? 3 : 2}
              />
            </NoWrap>
          )
        })}
        {!showingMore && showMoreLink}
        {showingMore &&
          sortedDates?.slice(2).map((runDate, index) => {
            return (
              <NoWrap key={`run-${index + 2}`}>
                <InfoItemValue
                  label={runDate}
                  index={index}
                  total={sortedDates.length - 2}
                />
              </NoWrap>
            )
          })}
        {showingMore && showMoreLink}
      </span>
    )
  } else {
    const runDates = sortedDates?.map((runDate, index) => {
      return (
        <NoWrap key={`run-${index}`}>
          <InfoItemValue
            label={runDate}
            index={index}
            total={sortedDates.length}
          />
        </NoWrap>
      )
    })
    return <span data-testid="drawer-run-dates">{runDates}</span>
  }
}

const shouldShowFormat = (resource: LearningResource) => {
  return (
    (resource.resource_type === ResourceTypeEnum.Course ||
      resource.resource_type === ResourceTypeEnum.Program) &&
    allRunsAreIdentical(resource) &&
    resource.delivery
  )
}

const INFO_ITEMS: InfoItemConfig = [
  {
    label: "Starts:",
    Icon: RiCalendarLine,
    selector: (resource: LearningResource) => {
      const anytime = showStartAnytime(resource)
      if (
        allRunsAreIdentical(resource) &&
        totalRunsWithDates(resource) > 0 &&
        !anytime
      ) {
        return (
          <NoSSR>
            <RunDates resource={resource} />
          </NoSSR>
        )
      } else if (anytime) {
        return <InfoItemValue label="Anytime" index={1} total={1} />
      } else return null
    },
  },
  {
    label: "Format:",
    Icon: RiComputerLine,
    selector: (resource: LearningResource) => {
      if (shouldShowFormat(resource)) {
        const totalFormats = resource.delivery?.length || 0
        return resource.delivery.map((format, index) => {
          return (
            <InfoItemValue
              key={`format-${index}`}
              label={format.name}
              index={index}
              total={totalFormats}
            />
          )
        })
      } else return null
    },
  },
  {
    label: "Location:",
    Icon: RiMapPinLine,
    selector: (resource: LearningResource) => {
      if (
        shouldShowFormat(resource) &&
        resource.delivery?.filter(
          (d) =>
            d.code === DeliveryEnum.InPerson || d.code === DeliveryEnum.Hybrid,
        ).length > 0 &&
        resource.location
      ) {
        return <InfoItemValue label={resource.location} index={1} total={1} />
      } else return null
    },
  },
  {
    label: "Price:",
    Icon: RiPriceTag3Line,
    selector: (resource: LearningResource) => {
      if (allRunsAreIdentical(resource)) {
        const prices = getLearningResourcePrices(resource)

        return (
          <PriceDisplay>
            <div>{resource.free ? "Free" : prices.course.display}</div>
            {resource.certification && resource.free ? (
              <>
                {prices.certificate.display ? (
                  <Certificate>
                    <RiAwardFill />
                    <span>Earn a certificate:</span>
                    <span>{prices.certificate.display}</span>
                  </Certificate>
                ) : (
                  <Certificate>
                    <RiAwardLine />
                    <span>Certificate</span>
                  </Certificate>
                )}
              </>
            ) : null}
          </PriceDisplay>
        )
      } else return null
    },
  },
  {
    label: "Certificate:",
    Icon: RiAwardLine,
    selector: (resource: LearningResource) => {
      return (resource.certification_type && !resource.free) ||
        (resource.free &&
          resource.certification_type?.code === CertificationTypeEnum.None) ? (
        <InfoItemValue
          label={resource.certification_type.name}
          index={1}
          total={1}
        />
      ) : null
    },
  },
  {
    label: "As taught in:",
    Icon: RiCalendarScheduleLine,
    selector: (resource: LearningResource) => {
      if (totalRunsWithDates(resource) > 0 && showStartAnytime(resource)) {
        return <RunDates resource={resource} />
      } else return null
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
          <InfoItemValue
            key={`topic-${index}`}
            label={topic.name}
            index={index}
            total={topics.length}
          />
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
          <InfoItemValue
            key={`level-${index}`}
            label={run?.level?.[0]?.name}
            index={index}
            total={totalRuns}
          />
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
          <InfoItemValue
            key={`instructor-${index}`}
            label={instructor}
            index={index}
            total={totalInstructors}
          />
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
          <InfoItemValue
            key={`language-${index}`}
            label={ISO6391.getName(language.substring(0, 2))}
            index={index}
            total={totalLanguages}
          />
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
      <IconContainer>{Icon && <Icon aria-hidden="true" />}</IconContainer>
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
    <>
      <DifferingRunsTable resource={resource} />
      <InfoItems data-testid="drawer-info-items">
        {infoItems
          .filter((props) => props.value !== null)
          .map((props, index) => (
            <InfoItem key={index} {...props} />
          ))}
      </InfoItems>
    </>
  )
}

export default InfoSection
