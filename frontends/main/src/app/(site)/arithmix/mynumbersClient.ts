"use client"

// The mynumbers components use client-only React APIs (e.g. createContext) but
// the package does not mark them with "use client". Re-exporting them from this
// "use client" module turns them into client references so they can be rendered
// from the server-component pages.
export { Arithmix, ExplainerPage } from "mynumbers"
