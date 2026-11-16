import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTrialCountdown } from './useTrialCountdown'

describe('useTrialCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty display and 0 seconds when endTime is null', () => {
    const { result } = renderHook(() => useTrialCountdown(null))
    expect(result.current.display).toBe('')
    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.isExpired).toBe(false)
    expect(result.current.isWarning).toBe(false)
  })

  it('formats MM:SS correctly', () => {
    const endTime = new Date(Date.now() + 9 * 60 * 1000 + 30 * 1000).toISOString() // 9m30s
    const { result } = renderHook(() => useTrialCountdown(endTime))
    // Initial render may be 9:29 or 9:30 depending on ms; just check format
    expect(result.current.display).toMatch(/^\d{2}:\d{2}$/)
    expect(result.current.remainingSeconds).toBeGreaterThanOrEqual(9 * 60 + 29)
  })

  it('ticks down every second', () => {
    const endTime = new Date(Date.now() + 5000).toISOString() // 5 seconds
    const { result } = renderHook(() => useTrialCountdown(endTime))

    expect(result.current.remainingSeconds).toBe(5)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.remainingSeconds).toBe(4)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.remainingSeconds).toBe(3)
  })

  it('sets isWarning when fewer than 120 seconds remain', () => {
    const endTime = new Date(Date.now() + 90 * 1000).toISOString() // 90 seconds
    const { result } = renderHook(() => useTrialCountdown(endTime))
    expect(result.current.isWarning).toBe(true)
    expect(result.current.isExpired).toBe(false)
  })

  it('isWarning is false when more than 120 seconds remain', () => {
    const endTime = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min
    const { result } = renderHook(() => useTrialCountdown(endTime))
    expect(result.current.isWarning).toBe(false)
  })

  it('sets isExpired and fires onExpire callback when timer reaches 00:00', async () => {
    const onExpire = vi.fn()
    const endTime = new Date(Date.now() + 2000).toISOString() // 2 seconds

    const { result } = renderHook(() => useTrialCountdown(endTime, onExpire))
    expect(result.current.isExpired).toBe(false)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.isExpired).toBe(false)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.isExpired).toBe(true)
    expect(result.current.display).toBe('00:00')

    // onExpire fires asynchronously via setTimeout(0) — advance just 1 ms
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('fires onExpire only once even after multiple ticks past zero', async () => {
    const onExpire = vi.fn()
    const endTime = new Date(Date.now() + 1000).toISOString()

    renderHook(() => useTrialCountdown(endTime, onExpire))

    // Advance past expiry tick by tick, then drain the deferred setTimeout(0)
    act(() => { vi.advanceTimersByTime(2000) }) // tick past 0
    await act(async () => { vi.advanceTimersByTime(1) }) // drain setTimeout(0)

    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('resets properly when endTime prop changes', () => {
    let endTime = new Date(Date.now() + 3000).toISOString()
    const { result, rerender } = renderHook(
      ({ et }: { et: string }) => useTrialCountdown(et),
      { initialProps: { et: endTime } }
    )

    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.remainingSeconds).toBe(1)

    // Set a fresh 10-second endTime
    endTime = new Date(Date.now() + 10000).toISOString()
    rerender({ et: endTime })

    expect(result.current.remainingSeconds).toBe(10)
    expect(result.current.isExpired).toBe(false)
  })
})
