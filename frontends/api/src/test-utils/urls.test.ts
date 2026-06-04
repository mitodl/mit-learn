import { configureApiClients, resetApiClientsForTests } from "../runtime"
import * as urls from "./urls"

describe("Learn test URL builders", () => {
  beforeEach(() => {
    resetApiClientsForTests()
  })

  test("learningResources.list uses runtime config", () => {
    configureApiClients({
      learn: {
        baseUrl: "https://runtime.learn.example.edu",
        csrfCookieName: "csrftoken",
        withCredentials: true,
      },
      mitxonline: {
        baseUrl: "https://runtime.mitx.example.edu",
        csrfCookieName: "mitxcsrftoken",
        withCredentials: false,
      },
    })

    expect(urls.learningResources.list()).toBe(
      "https://runtime.learn.example.edu/api/v1/learning_resources/",
    )
  })
})
