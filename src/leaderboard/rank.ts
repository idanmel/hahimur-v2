/** Standard competition ranking ("1224") for rows already sorted by value, descending. */
export function competitionRanks<T>(rows: T[], value: (row: T) => number): number[] {
  const ranks: number[] = []
  for (let i = 0; i < rows.length; i++) {
    ranks.push(i > 0 && value(rows[i]) === value(rows[i - 1]) ? ranks[i - 1] : i + 1)
  }
  return ranks
}
