import { useState, useEffect, useRef } from 'react'

export interface CountdownState {
  /** Formatted countdown string "MM:SS". Empty string when not active. */
  display: string
  /** Remaining seconds (0 when expired). */
  remainingSeconds: number
  /** True once the countdown has reached 00:00. */
  isExpired: boolean
  /** True when fewer than 2 minutes remain (warning threshold). */
  isWarning: boolean
}

const WARNING_THRESHOLD_SECONDS = 120 // 2 minutes

/**
 * Ticks down from the given `endTime` ISO string every second.
 * Returns a `CountdownState` object; `isExpired` flips to `true` when
 * the timer hits 00:00 and fires the optional `onExpire` callback once.
 */
export function useTrialCountdown(
  endTime: string | undefined | null,
  onExpire?: () => void
): CountdownState {
  const computeRemaining = (): number => {
    if (!endTime) return 0
    return Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000))
  }

  const [remainingSeconds, setRemainingSeconds] = useState<number>(computeRemaining)
  const onExpireRef = useRef(onExpire)
  const expiredFiredRef = useRef(false)

  // Keep callback ref fresh without resetting the timer
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  // Reset whenever endTime changes
  useEffect(() => {
    expiredFiredRef.current = false
    setRemainingSeconds(computeRemaining())

    if (!endTime) return

    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = Math.max(0, prev - 1)
        if (next === 0 && !expiredFiredRef.current) {
          expiredFiredRef.current = true
          // Fire asynchronously to avoid setState-inside-setState
          setTimeout(() => onExpireRef.current?.(), 0)
        }
        return next
      })
    }, 1000)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTime])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const display = endTime
    ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : ''

  return {
    display,
    remainingSeconds,
    isExpired: !!endTime && remainingSeconds === 0,
    isWarning: remainingSeconds > 0 && remainingSeconds <= WARNING_THRESHOLD_SECONDS,
  }
}
