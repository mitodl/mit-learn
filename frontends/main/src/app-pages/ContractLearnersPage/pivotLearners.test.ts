import { factories } from "api/analytics-test-utils"
import { pivotLearners } from "./pivotLearners"

describe("pivotLearners", () => {
  test("groups a learner's enrollments into one entry keyed by course run", () => {
    const [learner] = pivotLearners([
      factories.learnerProgress({
        learner_id: "a",
        email: "a@example.com",
        courserun_readable_id: "run-1",
      }),
      factories.learnerProgress({
        learner_id: "a",
        email: "a@example.com",
        courserun_readable_id: "run-2",
      }),
    ])

    expect([...learner.enrollments.keys()]).toEqual(["run-1", "run-2"])
  })

  test("merges enrollments that share an email under different learner IDs", () => {
    const learners = pivotLearners([
      factories.learnerProgress({
        learner_id: "a",
        email: "Aisha.Novak@example.edu",
        courserun_readable_id: "run-1",
      }),
      factories.learnerProgress({
        learner_id: "b",
        email: "aisha.novak@example.edu",
        courserun_readable_id: "run-2",
      }),
    ])

    expect(learners).toHaveLength(1)
    expect([...learners[0].enrollments.keys()]).toEqual(["run-1", "run-2"])
  })

  test("keeps learners without an email apart by learner ID", () => {
    expect(
      pivotLearners([
        factories.learnerProgress({ learner_id: "a", email: null }),
        factories.learnerProgress({ learner_id: "b", email: null }),
      ]),
    ).toHaveLength(2)
  })

  test("counts the runs a learner needs attention in", () => {
    const [learner] = pivotLearners([
      factories.learnerProgress({
        learner_id: "a",
        email: "a@example.com",
        needs_attention: false,
      }),
      factories.learnerProgress({
        learner_id: "a",
        email: "a@example.com",
        courserun_readable_id: "run-2",
        needs_attention: true,
      }),
    ])

    expect(learner.needsAttentionCount).toBe(1)
  })

  test("sorts by name, then email, with unnamed learners last", () => {
    const keys = pivotLearners([
      factories.learnerProgress({
        learner_id: "1",
        full_name: null,
        email: null,
      }),
      factories.learnerProgress({
        learner_id: "2",
        full_name: "Zoe",
        email: "zoe@example.com",
      }),
      factories.learnerProgress({
        learner_id: "3",
        full_name: "Amy",
        email: "amy@example.com",
      }),
      factories.learnerProgress({
        learner_id: "4",
        full_name: null,
        email: "mid@example.com",
      }),
    ]).map((learner) => learner.key)

    expect(keys).toEqual([
      "amy@example.com",
      "mid@example.com",
      "zoe@example.com",
      "1",
    ])
  })
})
