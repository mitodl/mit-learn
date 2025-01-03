import React from "react"
import type { Meta, StoryObj } from "@storybook/react"
import { LearningResourceExpandedV1 } from "./LearningResourceExpandedV1"
import { factories } from "api/test-utils"
import { ResourceTypeEnum as LRT } from "api"
import invariant from "tiny-invariant"
import Drawer from "@mui/material/Drawer"
import { BrowserRouter } from "react-router-dom"

const _makeResource = factories.learningResources.resource

const makeResource: typeof _makeResource = (overrides) => {
  const resource = _makeResource(overrides)
  invariant(resource.image)
  resource.image.url = "/mitres_hso_001.jpg"
  return resource
}

const meta: Meta<typeof LearningResourceExpandedV1> = {
  title: "smoot-design/LearningResourceExpandedV1",
  component: LearningResourceExpandedV1,
  args: {
    imgConfig: {
      width: 385,
      height: 200,
    },
  },
  argTypes: {
    resource: {
      options: ["Loading", ...Object.values(LRT)],
      mapping: {
        Loading: undefined,
        [LRT.Course]: makeResource({ resource_type: LRT.Course }),
        [LRT.Program]: makeResource({ resource_type: LRT.Program }),
        [LRT.Video]: makeResource({
          resource_type: LRT.Video,
          url: "https://www.youtube.com/watch?v=-E9hf5RShzQ",
        }),
        [LRT.VideoPlaylist]: makeResource({
          resource_type: LRT.VideoPlaylist,
        }),
        [LRT.Podcast]: makeResource({ resource_type: LRT.Podcast }),
        [LRT.PodcastEpisode]: makeResource({
          resource_type: LRT.PodcastEpisode,
        }),
        [LRT.LearningPath]: makeResource({
          resource_type: LRT.LearningPath,
        }),
      },
    },
  },
  render: (args) => {
    return (
      <BrowserRouter>
        <Drawer open={true} anchor="right">
          <LearningResourceExpandedV1 {...args} />
        </Drawer>
      </BrowserRouter>
    )
  },
}

export default meta

type Story = StoryObj<typeof LearningResourceExpandedV1>

export const Course: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      runs: [factories.learningResources.run()],
    }),
  },
}

export const CourseMultipleRuns: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      runs: [
        factories.learningResources.run(),
        factories.learningResources.run(),
        factories.learningResources.run(),
      ],
    }),
  },
}

export const LearningPath: Story = {
  args: {
    resource: makeResource({ resource_type: LRT.LearningPath }),
  },
}

export const Program: Story = {
  args: {
    resource: makeResource({ resource_type: LRT.Program }),
  },
}

export const Podcast: Story = {
  args: {
    resource: makeResource({ resource_type: LRT.Podcast }),
  },
}

export const PodcastEpisode: Story = {
  args: {
    resource: makeResource({ resource_type: LRT.PodcastEpisode }),
  },
}

export const Video: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Video,
      url: "https://www.youtube.com/watch?v=4A9bGL-_ilA",
    }),
  },
}

export const VideoPlaylist: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.VideoPlaylist,
    }),
  },
}

export const Loading: Story = {
  args: {
    resource: undefined,
  },
}

export const PricingVariant1: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "Free course with paid certificate option",
      resource_prices: [
        { amount: "0", currency: "USD" },
        { amount: "49", currency: "USD" },
      ],
      free: true,
      certification: true,
    }),
  },
}

export const AsTaughtIn: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      availability: "anytime",
      runs: [factories.learningResources.run()],
    }),
  },
}

export const AsTaughtInMultipleRuns: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      availability: "anytime",
      runs: [
        factories.learningResources.run({
          semester: "Fall",
          year: 2023,
        }),
        factories.learningResources.run(),
      ],
    }),
  },
}

export const PricingVariant2: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "Certificated course with range of prices",
      prices: ["950", "999"],
      free: false,
      certification: true,
    }),
  },
}

export const PricingVariant3: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "Course with range of prices, not certificated",
      prices: ["950", "999"],
      free: false,
      certification: false,
    }),
  },
}

export const PricingVariant4: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title:
        "The course has a zero price option, but is marked not free (prices not ingested correctly)",
      prices: ["0", "999"],
      free: false,
      certification: false,
    }),
  },
}

export const PricingVariant5: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "Zero price returned, but free flag is false",
      prices: ["0"],
      free: false,
      certification: false,
    }),
  },
}

export const PricingVariant6: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "Free course, no certificate",
      prices: ["0"],
      free: true,
      certification: false,
    }),
  },
}

export const PricingVariant7: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "Course with no certificate, not free",
      prices: ["500"],
      free: false,
      certification: false,
    }),
  },
}

export const PricingVariant8: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "No prices available, no certificate, not free",
      prices: [],
      free: false,
      certification: false,
    }),
  },
}

export const PricingVariant9: Story = {
  args: {
    resource: makeResource({
      resource_type: LRT.Course,
      title: "No prices available, no certificate, free",
      prices: [],
      free: true,
      certification: false,
    }),
  },
}
