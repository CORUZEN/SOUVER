/**
 * Calculate a proportional multiplier for a given stage based on business days.
 * Used to adjust monthly weight targets for weekly progress tracking.
 */

export interface StageTargetWeek {
  key: string
  businessDays?: string[]
}

export function getStageTargetMultiplier(
  stage: string,
  cycleWeeks?: StageTargetWeek[]
): number {
  if (!cycleWeeks || cycleWeeks.length === 0) {
    const stageOrder = ['W1', 'W2', 'W3', 'CLOSING']
    const idx = stageOrder.indexOf(stage)
    if (idx < 0) return 1
    return (idx + 1) / stageOrder.length
  }

  const operationalStages = ['W1', 'W2', 'W3', 'CLOSING']
  const operationalWeeks = cycleWeeks
    .filter((w) => operationalStages.includes(w.key))
    .sort(
      (a, b) =>
        operationalStages.indexOf(a.key) - operationalStages.indexOf(b.key)
    )

  let totalBusinessDays = 0
  const cumulativeDaysByStage = new Map<string, number>()

  for (const week of operationalWeeks) {
    const days = Array.isArray(week.businessDays) ? week.businessDays.length : 0
    totalBusinessDays += days
    cumulativeDaysByStage.set(week.key, totalBusinessDays)
  }

  if (totalBusinessDays === 0) return 1

  const cumulativeDays = cumulativeDaysByStage.get(stage) ?? totalBusinessDays
  return cumulativeDays / totalBusinessDays
}
