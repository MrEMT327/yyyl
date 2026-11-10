// Presentation order only: never reorder the saved task/achievement ledger.
// Weekly objectives award activity automatically, so callers can supply their
// completion rule instead of treating a full progress bar as a pending claim.
export function taskDisplayOrder(rows,completed=row=>Boolean(row.claimed)) {
  const priority=row=>completed(row)?2:!row.pending&&(row.claimable||row.canClaim)?0:1;
  return rows.map((row,index)=>({row,index,priority:priority(row)}))
    .sort((a,b)=>a.priority-b.priority||a.index-b.index)
    .map(entry=>entry.row);
}
