import { useMemo } from 'react'
import type { PredictionsState } from './types'
import { GROUP_MATCHES, ALL_GROUP_LETTERS } from './groups'
import { calculateStandings } from './standings'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from '../predictionsView/thirdPlace/thirdPlace'
import { resolveRound32, resolveKnockout } from '../predictionsView/knockout/knockout'

export function useTournament(predictions: PredictionsState) {
  return useMemo(() => {
    const allGroupData = ALL_GROUP_LETTERS
      .filter(l => l in GROUP_MATCHES)
      .map(l => {
        const matches = GROUP_MATCHES[l] ?? []
        const { standings, tiedTeams } = calculateStandings(matches, predictions)
        const allFilled = matches.length > 0 && matches.every(m => {
          const s = predictions[m.id]
          return s && s.home !== null && s.away !== null
        })
        return { group: l as string, standings, tiedTeams, allFilled, isComplete: allFilled && tiedTeams.size === 0 }
      })

    const groupsWithTies = new Set<string>()
    const completedGroups = new Set<string>()
    for (const d of allGroupData) {
      if (d.allFilled && d.tiedTeams.size > 0) groupsWithTies.add(d.group)
      if (d.isComplete) completedGroups.add(d.group)
    }

    const thirdPlaceQual = qualifyBestThirdPlace(getThirdPlaceTeams(allGroupData))
    const round32Matches = resolveRound32(allGroupData, thirdPlaceQual)
    const knockout = resolveKnockout(round32Matches, predictions)

    const finalPred = predictions['104']
    let finalWinner: string | null = null
    if (knockout.final.resolved && finalPred && finalPred.home !== null && finalPred.away !== null) {
      if (finalPred.home > finalPred.away) finalWinner = knockout.final.home
      else if (finalPred.away > finalPred.home) finalWinner = knockout.final.away
      else if (finalPred.drawWinner === 'home') finalWinner = knockout.final.home
      else if (finalPred.drawWinner === 'away') finalWinner = knockout.final.away
    }

    return {
      allGroupData,
      groupsWithTies,
      completedGroups,
      thirdPlaceQual,
      allGroupsFilled: allGroupData.every(d => d.allFilled),
      round32Matches,
      knockout,
      finalWinner,
    }
  }, [predictions])
}
