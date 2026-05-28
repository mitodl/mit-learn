import { configureApiClients, resetApiClientsForTests } from "../../runtime"
import * as urls from "./urls"

describe("MITx test URL builders", () => {
  beforeEach(() => {
    resetApiClientsForTests()
  })

  test("programs.programDetail uses runtime config", () => {
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

    expect(urls.programs.programDetail(7)).toBe(
      "https://runtime.mitx.example.edu/api/v2/programs/7/",
    )
  })
})
