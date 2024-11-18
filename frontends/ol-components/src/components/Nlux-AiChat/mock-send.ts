import { StreamSend, StreamingAdapterObserver } from "@nlux/react"

const LIST = `
Some nice courses:
- Classical Mechanics
- Introduction to Computer Science
- Organic Chemistry
`

const LIPSUMS = [
  [
    "Lorem ipsum dolor sit amet",
    "consectetur **adipiscing** elit",
    "sed do eiusmod tempor [incididunt](https://mit.edu) ut labore et dolore magna aliqua. ",
    LIST,
  ],
  [
    "Ut enim ad [minim](https://mit.edu) veniam,",
    "quis nostrud **exercitation** ullamco laboris nisi ut",
    "aliquip ex ea commodo consequat.",
    LIST,
  ],
  [
    "Duis aute irure dolor in **reprehenderit** in voluptate",
    "velit esse [cillum](https://mit.edu) dolore eu fugiat nulla pariatur.",
    "Excepteur sint occaecat cupidatat non proident,",
    "sunt in culpa qui officia deserunt mollit anim id est laborum.",
  ],
]

const rand = (min: number, max: number) => {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const mockApi = function GET() {
  let timerId: NodeJS.Timeout
  const lipsum = LIPSUMS[rand(0, LIPSUMS.length - 1)]
  const texts = lipsum.map((text) => `${text} `)

  const num = texts.length
  let i = 0

  const body = new ReadableStream({
    start(controller) {
      timerId = setInterval(() => {
        const msg = new TextEncoder().encode(texts[i])
        controller.enqueue(msg)
        i++
      }, 500)
      setTimeout(
        () => {
          this.cancel?.()
          try {
            controller.close()
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_e) {
            // Pass
          }
        },
        num * 500 + 100,
      )
    },
    cancel() {
      if (timerId) {
        clearInterval(timerId)
      }
    },
  })

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  })
}

// Function to send query to the server and receive a stream of chunks as response
export const send: StreamSend = async (
  _prompt: string,
  observer: StreamingAdapterObserver,
) => {
  const response = await mockApi()

  if (response.status !== 200) {
    observer.error(new Error("Failed to connect to the server"))
    return
  }

  if (!response.body) {
    return
  }

  // Read a stream of server-sent events
  // and feed them to the observer as they are being generated
  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    const content = textDecoder.decode(value)
    if (content) {
      observer.next(content)
    }
  }

  observer.complete()
}
