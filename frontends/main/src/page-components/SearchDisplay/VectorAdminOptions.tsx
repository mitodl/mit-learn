import * as React from "react"
import { useAdminSearchParams } from "api/hooks/adminSearchParams"
import { useAppSearchParams } from "@/common/useAppSearchParams"
import { AdminTitleContainer, ExplanationContainer } from "./adminStyles"
import SliderInput from "./SliderInput"
import type { VectorScoreTuningParam } from "./vectorSearchParams"

type VectorControl = {
  urlParam: VectorScoreTuningParam
  label: string
  min: number
  max: number
  step: number
  explanation: string
}

/**
 * Score formula weights the vector endpoint accepts, in the order they are
 * applied: the cutoff, then the boost and the penalties that rescore what
 * survives it. Ranges are in score units -- similarity scores are bounded and
 * sit in a narrow band, unlike the unbounded OpenSearch scores the percent
 * based controls tune.
 */
const VECTOR_CONTROLS: VectorControl[] = [
  {
    urlParam: "score_cutoff",
    label: "Minimum Score Cutoff",
    min: 0,
    max: 1,
    step: 0.01,
    explanation:
      "Minimum similarity score for a result to be displayed. The server " +
      "raises anything below the minimum allowed for the search mode. Only " +
      "affects results if there is a search term.",
  },
  {
    urlParam: "program_boost",
    label: "Program Score Boost",
    min: 0,
    max: 1,
    step: 0.05,
    explanation:
      "Score added to a program before ranking, scaled down as relevance " +
      "drops so a weak match is not boosted over a strong one. 0 disables " +
      "the boost.",
  },
  {
    urlParam: "staleness_penalty",
    label: "Resource Score Staleness Penalty",
    min: 0,
    max: 0.5,
    step: 0.01,
    explanation:
      "Score subtracted from a resource once it is as old as the staleness " +
      "horizon, ramped linearly by age. Resources with an upcoming run are " +
      "never stale. 0 disables the penalty.",
  },
  {
    urlParam: "staleness_horizon_years",
    label: "Staleness Horizon (years)",
    min: 0,
    max: 50,
    step: 1,
    explanation:
      "Age at which a resource takes the full staleness penalty. A shorter " +
      "horizon penalizes recent resources more steeply. 0 disables the " +
      "penalty.",
  },
  {
    urlParam: "completeness_penalty",
    label: "Incompleteness Penalty",
    min: 0,
    max: 0.5,
    step: 0.01,
    explanation:
      "Score subtracted from an OCW course with completeness = 0. Partially " +
      "complete courses have a linear penalty proportional to the degree of " +
      "incompleteness. 0 disables the penalty.",
  },
]

/**
 * The admin params endpoint has no serializer, so the generated client types
 * its response as void. Same cast SearchDisplay makes for the OpenSearch
 * controls.
 */
type VectorAdminDefaults = Record<VectorScoreTuningParam, number>

/**
 * Relevance controls for the vector search endpoint, rendered in the admin
 * panel while hybrid search is active. Each slider writes its URL param, which
 * HybridSearchDisplay forwards to the search request; the starting value is
 * the server's configured default.
 *
 * `setSearchParams` takes the control name first, like the OpenSearch sliders
 * do -- SearchDisplay's wrapper reports it to PostHog.
 */
const VectorAdminOptions: React.FC<{
  setSearchParams: (
    name: string,
    fn: (prev: URLSearchParams) => URLSearchParams,
  ) => void
}> = ({ setSearchParams }) => {
  const searchParams = useAppSearchParams()
  const { data, isLoading } = useAdminSearchParams(true)
  const defaults = data as VectorAdminDefaults | void | undefined

  if (!defaults || isLoading) {
    return null
  }

  return (
    <div data-testid="vector-admin-options">
      {VECTOR_CONTROLS.map(
        ({ urlParam, label, min, max, step, explanation }) => (
          <div key={urlParam}>
            <AdminTitleContainer>{label}</AdminTitleContainer>
            <SliderInput
              currentValue={
                searchParams.get(urlParam) !== null
                  ? Number(searchParams.get(urlParam))
                  : defaults[urlParam]
              }
              setSearchParams={setSearchParams}
              urlParam={urlParam}
              label={label}
              min={min}
              max={max}
              step={step}
            />
            <ExplanationContainer>{explanation}</ExplanationContainer>
          </div>
        ),
      )}
    </div>
  )
}

export default VectorAdminOptions
