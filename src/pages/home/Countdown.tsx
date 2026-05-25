import { useState, useEffect, useRef, Fragment } from 'react'

interface Props {
  targetDate: Date
}

function getTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  }
}

function FlipUnit({ value, label }: { value: number; label: string }) {
  const [animKey, setAnimKey] = useState(0)
  const prevRef = useRef(value)

  useEffect(() => {
    if (value !== prevRef.current) {
      setAnimKey(k => k + 1)
      prevRef.current = value
    }
  }, [value])

  return (
    <div className="countdown__unit">
      <span key={animKey} className="countdown__value">
        {String(value).padStart(2, '0')}
      </span>
      <span className="countdown__label">{label}</span>
    </div>
  )
}

export default function Countdown({ targetDate }: Props) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const units = [
    { value: timeLeft.days, label: 'ימים' },
    { value: timeLeft.hours, label: 'שעות' },
    { value: timeLeft.minutes, label: 'דקות' },
    { value: timeLeft.seconds, label: 'שניות' },
  ]

  return (
    <div className="countdown" dir="ltr">
      {units.map(({ value, label }, i) => (
        <Fragment key={label}>
          <FlipUnit value={value} label={label} />
          {i < units.length - 1 && <span className="countdown__sep" aria-hidden>:</span>}
        </Fragment>
      ))}
    </div>
  )
}
