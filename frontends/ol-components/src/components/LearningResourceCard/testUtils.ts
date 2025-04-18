import { DeliveryEnum, DeliveryEnumDescriptions, ResourceTypeEnum } from "api"
import { factories } from "api/test-utils"

const _makeResource = factories.learningResources.resource

const makeResource: typeof _makeResource = (overrides) => {
  const resource = _makeResource(overrides)
  if (resource.image) {
    resource.image.url =
      "https://ocw.mit.edu/courses/res-hso-001-mit-haystack-observatory-k12-stem-lesson-plans/mitres_hso_001.jpg"
  }
  if (resource.resource_type === ResourceTypeEnum.Video) {
    resource.url = "https://www.youtube.com/watch?v=4A9bGL-_ilA"
  }
  return resource
}

const resources = {
  withoutImage: makeResource({ image: null }),
  course: makeResource({
    resource_type: ResourceTypeEnum.Course,
  }),
  program: makeResource({
    resource_type: ResourceTypeEnum.Program,
  }),
  video: makeResource({
    resource_type: ResourceTypeEnum.Video,
    url: "https://www.youtube.com/watch?v=-E9hf5RShzQ",
  }),
  videoPlaylist: makeResource({
    resource_type: ResourceTypeEnum.VideoPlaylist,
  }),
  podcast: makeResource({
    resource_type: ResourceTypeEnum.Podcast,
  }),
  podcastEpisode: makeResource({
    resource_type: ResourceTypeEnum.PodcastEpisode,
  }),
  learningPath: makeResource({
    resource_type: ResourceTypeEnum.LearningPath,
  }),
}

const sameDataRun = factories.learningResources.run({
  delivery: [
    {
      code: DeliveryEnum.Online,
      name: DeliveryEnumDescriptions.online,
    },
  ],
  resource_prices: [
    { amount: "0", currency: "USD" },
    { amount: "100", currency: "USD" },
  ],
})
const courses = {
  free: {
    noCertificate: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: true,
      certification: false,
      resource_prices: [{ amount: "0", currency: "USD" }],
    }),
    withCertificateOnePrice: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: true,
      certification: true,
      certification_type: {
        code: "completion",
        name: "Certificate of Completion",
      },
      resource_prices: [
        { amount: "0", currency: "USD" },
        { amount: "49", currency: "USD" },
      ],
    }),
    withCertificatePriceRange: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: true,
      certification: true,
      certification_type: {
        code: "completion",
        name: "Certificate of Completion",
      },
      resource_prices: [
        { amount: "0", currency: "USD" },
        { amount: "99", currency: "USD" },
        { amount: "49", currency: "USD" },
      ],
    }),
    multipleRuns: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [
        factories.learningResources.run(),
        factories.learningResources.run(),
        factories.learningResources.run(),
        factories.learningResources.run(),
      ],
      free: true,
      certification: false,
      prices: ["0"],
    }),
    anytime: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [
        factories.learningResources.run({
          year: 2022,
          semester: "Spring",
        }),
      ],
      free: true,
      certification: false,
      prices: ["0"],
      availability: "anytime",
    }),
    dated: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: true,
      certification: false,
      prices: ["0"],
      availability: "dated",
    }),
  },
  unknownPrice: {
    noCertificate: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: false,
      certification: false,
      resource_prices: [],
    }),
    withCertificate: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: false,
      certification: true,
      certification_type: {
        code: "completion",
        name: "Certificate of Completion",
      },
      resource_prices: [],
    }),
  },
  paid: {
    withoutCertificate: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: false,
      certification: false,
      resource_prices: [{ amount: "49", currency: "USD" }],
    }),
    withCerticateOnePrice: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: false,
      certification: true,
      certification_type: {
        code: "completion",
        name: "Certificate of Completion",
      },
      resource_prices: [{ amount: "49", currency: "USD" }],
    }),
    withCertificatePriceRange: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [factories.learningResources.run()],
      free: false,
      certification: true,
      certification_type: {
        code: "completion",
        name: "Certificate of Completion",
      },
      resource_prices: [
        { amount: "49", currency: "USD" },
        { amount: "99", currency: "USD" },
      ],
    }),
  },
  start: {
    anytime: makeResource({
      resource_type: ResourceTypeEnum.Course,
      availability: "anytime",
    }),
    dated: makeResource({
      resource_type: ResourceTypeEnum.Course,
      availability: "dated",
    }),
  },
  multipleRuns: {
    sameData: makeResource({
      resource_type: ResourceTypeEnum.Course,
      free: true,
      certification: true,
      runs: [
        factories.learningResources.run({
          delivery: sameDataRun.delivery,
          resource_prices: sameDataRun.resource_prices,
          location: sameDataRun.location,
        }),
        factories.learningResources.run({
          delivery: sameDataRun.delivery,
          resource_prices: sameDataRun.resource_prices,
          location: sameDataRun.location,
        }),
        factories.learningResources.run({
          delivery: sameDataRun.delivery,
          resource_prices: sameDataRun.resource_prices,
          location: sameDataRun.location,
        }),
        factories.learningResources.run({
          delivery: sameDataRun.delivery,
          resource_prices: sameDataRun.resource_prices,
          location: sameDataRun.location,
        }),
      ],
    }),
    differentData: makeResource({
      resource_type: ResourceTypeEnum.Course,
      runs: [
        factories.learningResources.run({
          delivery: [
            {
              code: DeliveryEnum.Online,
              name: DeliveryEnumDescriptions.online,
            },
          ],
          resource_prices: [
            { amount: "0", currency: "USD" },
            { amount: "100", currency: "USD" },
          ],
        }),
        factories.learningResources.run({
          delivery: [
            {
              code: DeliveryEnum.Online,
              name: DeliveryEnumDescriptions.online,
            },
          ],
          resource_prices: [
            { amount: "0", currency: "USD" },
            { amount: "100", currency: "USD" },
          ],
        }),
        factories.learningResources.run({
          delivery: [
            {
              code: DeliveryEnum.InPerson,
              name: DeliveryEnumDescriptions.in_person,
            },
          ],
          resource_prices: [{ amount: "150", currency: "USD" }],
          location: "Earth",
        }),
        factories.learningResources.run({
          delivery: [
            {
              code: DeliveryEnum.InPerson,
              name: DeliveryEnumDescriptions.in_person,
            },
          ],
          resource_prices: [{ amount: "150", currency: "USD" }],
          location: "Earth",
        }),
      ],
    }),
  },
  multipleFormats: makeResource({
    resource_type: ResourceTypeEnum.Course,
    location: "Earth",
    delivery: [
      {
        code: DeliveryEnum.Online,
        name: DeliveryEnumDescriptions.online,
      },
      {
        code: DeliveryEnum.InPerson,
        name: DeliveryEnumDescriptions.in_person,
      },
    ],
    runs: [
      factories.learningResources.run({
        delivery: sameDataRun.delivery,
        resource_prices: sameDataRun.resource_prices,
        location: sameDataRun.location,
      }),
    ],
  }),
  singleFormat: makeResource({
    resource_type: ResourceTypeEnum.Course,
    delivery: [
      {
        code: DeliveryEnum.Online,
        name: DeliveryEnumDescriptions.online,
      },
    ],
    runs: [
      factories.learningResources.run({
        delivery: sameDataRun.delivery,
        resource_prices: sameDataRun.resource_prices,
        location: sameDataRun.location,
      }),
    ],
  }),
}

const resourceArgType = {
  options: ["Loading", "Without Image", ...Object.values(ResourceTypeEnum)],
  mapping: {
    Loading: null,
    "Without Image": resources.withoutImage,
    [ResourceTypeEnum.Course]: resources.course,
    [ResourceTypeEnum.Program]: resources.program,
    [ResourceTypeEnum.Video]: resources.video,
    [ResourceTypeEnum.VideoPlaylist]: resources.videoPlaylist,
    [ResourceTypeEnum.Podcast]: resources.podcast,
    [ResourceTypeEnum.PodcastEpisode]: resources.podcastEpisode,
    [ResourceTypeEnum.LearningPath]: resources.learningPath,
  },
}

export { resourceArgType, resources, courses }
