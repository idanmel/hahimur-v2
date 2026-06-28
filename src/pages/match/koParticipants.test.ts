import { knockoutParticipantScore } from './koParticipants'
import { orientPrediction } from '../../formView/knockout/koRounds'
import type { KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'

function makeUser(label: string, match: KnockoutMatch): User {
  return {
    label,
    knockoutStages: { r32: [match], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  } as unknown as User
}

const ko = (home: string, away: string, h = 1, a = 0, drawWinner?: 'home' | 'away'): KnockoutMatch =>
  ({ matchNum: 73, home, away, resolved: true, scores: { home: h, away: a, drawWinner } })

const actual: KnockoutMatch = { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true }

test('returns null for a bettor who did not predict both real teams', () => {
  const u = makeUser('לא משתתף', ko('Mexico', 'Canada'))
  expect(knockoutParticipantScore(actual, u)).toBeNull()
})

test('orients a straight prediction to the real home/away', () => {
  const u = makeUser('ישר', ko('South Korea', 'Canada', 2, 0))
  expect(knockoutParticipantScore(actual, u)).toEqual({ home: 2, away: 0, drawWinner: undefined })
})

test('flips a reversed prediction (and its draw winner) onto the real orientation', () => {
  // stored reversed: Canada 1 - South Korea 1, Canada advancing (drawWinner home)
  const u = makeUser('הפוך', ko('Canada', 'South Korea', 1, 1, 'home'))
  expect(knockoutParticipantScore(actual, u)).toEqual({ home: 1, away: 1, drawWinner: 'away' })
})

test('orientPrediction leaves an aligned fixture untouched', () => {
  expect(orientPrediction(ko('South Korea', 'Canada', 3, 1), actual)).toEqual({ home: 3, away: 1, drawWinner: undefined })
})

test('counts a bettor who predicted the pairing at a different slot in the same round', () => {
  // Reality routes South Korea × Canada through slot 83; this bettor predicted that
  // exact pairing but slotted it at 87 (different group finishes, same meeting). KO
  // scoring credits a pairing wherever its two teams meet, so they participate here too.
  const real: KnockoutMatch = { matchNum: 83, home: 'South Korea', away: 'Canada', resolved: true }
  const u = makeUser('סלוט אחר', { matchNum: 87, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 2, away: 1 } })
  expect(knockoutParticipantScore(real, u)).toEqual({ home: 2, away: 1, drawWinner: undefined })
})

test('does not count the same pairing predicted in a different round', () => {
  // Same two teams, but the bettor put their meeting in R16 (89), not R32 — a
  // different prediction, so it must not count toward this R32 fixture.
  const real: KnockoutMatch = { matchNum: 83, home: 'South Korea', away: 'Canada', resolved: true }
  const u = {
    label: 'סיבוב אחר',
    knockoutStages: {
      r32: [], qf: [], sf: [], thirdPlace: [], final: [],
      r16: [{ matchNum: 89, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 1, away: 0 } }],
    },
  } as unknown as User
  expect(knockoutParticipantScore(real, u)).toBeNull()
})
