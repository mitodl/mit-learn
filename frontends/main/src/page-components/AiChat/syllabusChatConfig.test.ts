import { factories } from "api/test-utils"
import { ResourceTypeEnum, ResourceTypeGroupEnum } from "api"
import {
  buildSyllabusChatRequestBody,
  getSyllabusChatProps,
  SYLLABUS_STARTERS,
} from "./syllabusChatConfig"

describe("syllabusChatConfig", () => {
  test("buildSyllabusChatRequestBody for course", () => {
    const resource = factories.learningResources.course({
      readable_id: "course-v1:MITx+TEST",
    })

    const body = buildSyllabusChatRequestBody(resource, [
      { content: "hello" },
      { content: "What is this course about?" },
    ])

    expect(body).toEqual({
      collection_name: "content_files",
      message: "What is this course about?",
      course_id: "course-v1:MITx+TEST",
    })
  })

  test("buildSyllabusChatRequestBody for program includes related_courses", () => {
    const resource = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Program,
      resource_type_group: ResourceTypeGroupEnum.Program,
      readable_id: "program-v1:MITx+TEST",
      children: [
        { readable_id: "course-v1:MITx+A" },
        { readable_id: "course-v1:MITx+B" },
      ],
    })

    const body = buildSyllabusChatRequestBody(resource, [{ content: "hi" }])

    expect(body).toEqual({
      collection_name: "content_files",
      message: "hi",
      course_id: "program-v1:MITx+TEST",
      related_courses: ["course-v1:MITx+A", "course-v1:MITx+B"],
    })
  })

  test("getSyllabusChatProps uses course starters", () => {
    const resource = factories.learningResources.course()

    expect(getSyllabusChatProps(resource).conversationStarters).toEqual(
      SYLLABUS_STARTERS[ResourceTypeGroupEnum.Course],
    )
  })
})
