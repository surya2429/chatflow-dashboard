// dunning.ts — what happens when a renewal can't be collected.
//
// Policy (one place, so it can be read, tested and changed):
//   • up to 4 attempts in total: the failed automatic debit, then 3 retries
//   • a retry every 48–72 hours: +48h, +72h, +72h  → attempts at day 0, 2, 5, 8
//   • the plan keeps working while we collect (grace), and is suspended if the
//     9-day window closes without payment
//
// What an "attempt" is, honestly: Razorpay's automatic debit retries follow its own
// fixed schedule (daily for 3 days) and can't be reconfigured. Our attempts are
// COLLECTION requests on the schedule above — a Razorpay payment link the customer
// is emailed and texted, which they can pay in a tap (and authenticate with their
// bank). Razorpay's own retries still run alongside; if one of them succeeds, we
// notice and stop.

export interface DunningPolicy {
  maxAttempts: number
  windowDays: number
  /** hours between attempt n and n+1 (so length = maxAttempts - 1) */
  retryAfterHours: number[]
}

export const DUNNING_POLICY: DunningPolicy = {
  maxAttempts: 4,
  windowDays: 9,
  retryAfterHours: [48, 72, 72],
}

/** Throws if a policy breaks the rules it is meant to satisfy. */
export function assertPolicy(p: DunningPolicy): void {
  if (p.maxAttempts < 3 || p.maxAttempts > 4) throw new Error('dunning: 3–4 attempts')
  if (p.retryAfterHours.length !== p.maxAttempts - 1) throw new Error('dunning: one gap per retry')
  if (p.retryAfterHours.some((h) => h < 48 || h > 72)) throw new Error('dunning: gaps must be 48–72 hours')
  const last = p.retryAfterHours.reduce((a, b) => a + b, 0)
  if (last > p.windowDays * 24) throw new Error('dunning: the last attempt must fall inside the window')
}

/** Unix-seconds time of each attempt, given when the first one failed. */
export function attemptTimes(startedAt: number, p: DunningPolicy = DUNNING_POLICY): number[] {
  const times = [startedAt]
  for (const h of p.retryAfterHours) times.push(times[times.length - 1]! + h * 3600)
  return times
}

export const deadlineFor = (startedAt: number, p: DunningPolicy = DUNNING_POLICY) => startedAt + p.windowDays * 86400
