import { factories } from "api/test-utils"
import {
  ResourceTypeEnum,
  ResourceTypeGroupEnum,
  type LearningResource,
} from "api"
import {
  buildSyllabusChatRequestBody,
  getSyllabusChatId,
  getSyllabusChatProps,
  SYLLABUS_STARTERS,
} from "./syllabusChatConfig"

describe("syllabusChatConfig", () => {
  test("buildSyllabusChatRequestBody for course", () => {
    const resource = factories.learningResources.course({
      readable_id: "course-v1:MITx+TEST",
      platform: { code: "mitxonline" },
    })

    const body = buildSyllabusChatRequestBody(resource, [
      { content: "hello" },
      { content: "What is this course about?" },
    ])

    expect(body).toEqual({
      collection_name: "content_files",
      message: "What is this course about?",
      course_id: "course-v1:MITx+TEST",
      platform: "mitxonline",
    })
  })

  test("buildSyllabusChatRequestBody omits platform when unknown", () => {
    const resource = factories.learningResources.course({
      readable_id: "course-v1:MITx+TEST",
      platform: null,
    })

    const body = buildSyllabusChatRequestBody(resource, [{ content: "hi" }])

    expect(body).toEqual({
      collection_name: "content_files",
      message: "hi",
      course_id: "course-v1:MITx+TEST",
    })
  })

  test("buildSyllabusChatRequestBody for program includes related_courses", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Program,
      resource_type_group: ResourceTypeGroupEnum.Program,
      readable_id: "program-v1:MITx+TEST",
      platform: { code: "xpro" },
      // The generated schema types `children` as a single object, but the API
      // returns an array at runtime (serializer uses many=True).
      children: [
        { readable_id: "course-v1:MITx+A" },
        { readable_id: "course-v1:MITx+B" },
      ] as unknown as LearningResource["children"],
    })

    const body = buildSyllabusChatRequestBody(resource, [{ content: "hi" }])

    expect(body).toEqual({
      collection_name: "content_files",
      message: "hi",
      course_id: "program-v1:MITx+TEST",
      platform: "xpro",
      related_courses: ["course-v1:MITx+A", "course-v1:MITx+B"],
    })
  })

  test.each([
    {
      platform: { code: "mitxonline" },
      expected: "mitxonline-course-v1:MITx+TEST",
    },
    { platform: { code: "xpro" }, expected: "xpro-course-v1:MITx+TEST" },
    { platform: null, expected: "course-v1:MITx+TEST" },
  ])(
    "getSyllabusChatId distinguishes same-readable_id courses by platform",
    ({ platform, expected }) => {
      const resource = factories.learningResources.course({
        readable_id: "course-v1:MITx+TEST",
        platform,
      })

      expect(getSyllabusChatId(resource)).toBe(expected)
      expect(getSyllabusChatProps(resource).chatId).toBe(expected)
    },
  )

  test("getSyllabusChatProps uses course starters", () => {
    const resource = factories.learningResources.course()

    expect(getSyllabusChatProps(resource).conversationStarters).toEqual(
      SYLLABUS_STARTERS[ResourceTypeGroupEnum.Course],
    )
  })
})
