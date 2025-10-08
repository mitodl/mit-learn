const VERSION = process.env.NEXT_PUBLIC_VERSION || "unknown"
export async function GET() {
  return Response.json(
    {
      status: "ok",
      version: VERSION,
      timestamp: new Date().toISOString(), // easily tell if response is cached
    },
    { status: 200 },
  )
}
