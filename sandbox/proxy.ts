import express from "express"
import type { Request, Response } from "express"
import { createProxyMiddleware } from "http-proxy-middleware"

const PROXY_TARGET = "rc.learn.mit.edu"

const app = express()

const callsCount = {}

app.use((req, res, next) => {
  const isServer = !req.headers.origin
  const querystring = req.originalUrl.split("?")[1] || ""

  const hash = `${isServer ? "SERVER" : "CLIENT"}: ${req.method}-${req.path}${querystring ? `?${querystring}` : ""}`

  callsCount[hash] = (callsCount[hash] || 0) + 1

  console.info({
    message: "Proxying request",
    callsCount: callsCount[hash],
    route: hash,
  })

  // Get metadata for a learning resource when page loaded with drawer open
  // e.g. http://learn.odl.local:8062/?resource=17261
  if (
    isServer &&
    req.method === "GET" &&
    req.path === "/api/v1/learning_resources/17261/"
  ) {
    console.info({
      message: "Simulating ECONNRESET",
      callsCount: callsCount[hash],
      route: hash,
    })
    req.socket.destroy(new Error("ECONNRESET"))
    return
  }

  // Resource carousel, only for SSR requests (origin header is populated in calls from the browser)
  if (
    isServer &&
    req.method === "GET" &&
    req.path === "/api/v1/featured/"
    // callsCount[hash] < 4
  ) {
    console.info({
      message: "Simulating ECONNRESET",
      callsCount: callsCount[hash],
      route: hash,
    })
    req.socket.destroy(new Error("ECONNRESET"))
    return
  }

  // Resource carousel
  // Error for first 3 calls
  if (
    req.method === "GET" &&
    req.path === "/api/v1/featured/" &&
    callsCount[hash] < 3
  ) {
    console.info({
      message: "Simulating ECONNRESET",
      callsCount: callsCount[hash],
      route: hash,
    })
    req.socket.destroy(new Error("ECONNRESET"))
    return
  }

  next()
})

const proxyMiddleware = createProxyMiddleware<Request, Response>({
  target: `https://api.${PROXY_TARGET}`,
  changeOrigin: true,
  logger: console,
  on: {
    proxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("origin", `https://${PROXY_TARGET}`)
      proxyReq.setHeader(
        "User-Agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      )
    },
    proxyRes: (proxyRes, req, res) => {
      proxyRes.headers["Access-Control-Allow-Origin"] =
        "http://learn.odl.local:8062"
      proxyRes.headers["Access-Control-Allow-Credentials"] = "true"
      proxyRes.headers["Access-Control-Allow-Headers"] =
        "X-CSRF-Token,x-csrftoken,sentry-trace,baggage,content-type"
    },
  },
})

app.use("/", proxyMiddleware)

app.listen(process.env.PORT)

console.info(`Listening on ${process.env.PORT}`)
