import { PHASE_PRODUCTION_BUILD } from "next/constants"

/**
 * This returns true DURING the production build. In other words:
 *
 * - false during development, (`next dev`)
 * - true during production build (`next build`)
 * - false when running the production server (`next start`)
 *
 * Avoid using this. Our code usually should not care whether it is running
 * during the build phase, and it's unclear whether this is part of NextJS's
 * public API.
 */
export const dangerouslyDetectProductionBuildPhase = () => {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
}
