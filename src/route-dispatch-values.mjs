export const BILL_VALUE = 20;
export const MACHINES_PER_PRINT_PAGE = 15;
export function routePrintPages(rows) {
  return Array.from({ length: Math.ceil(rows.length / MACHINES_PER_PRINT_PAGE) }, (_, index) =>
    rows.slice(index * MACHINES_PER_PRINT_PAGE, (index + 1) * MACHINES_PER_PRINT_PAGE));
}
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function routeDispatchValues(job) {
  const processingAmount = number(job.terminal?.official?.cashBalance);
  const processingBills = processingAmount / BILL_VALUE;
  const currentBills = number(job.routeExistingCash);
  const addBills = number(job.routeCashLoaded);
  const expectedBills = job.routeCashToLoad == null ? number(job.cashToLoad) / BILL_VALUE : number(job.routeCashToLoad);
  return {
    processingAmount, processingBills, currentBills, addBills, expectedBills,
    expectedAmount: expectedBills * BILL_VALUE,
    totalBillsAdded: currentBills + addBills,
    previousTotalBillsAdded: number(job.previousTotalBillsAdded),
    dayTotal: number(job.previousTotalBillsAdded) - processingBills - currentBills
  };
}

export function routeNote(job) {
  if (job.routeNote != null) return job.routeNote;
  const note = job.events?.[0]?.note || '';
  if (note.includes(' — ')) return note.split(' — ').slice(1).join(' — ').trim();
  return /^(Area route:|Reassigned)/.test(note) ? '' : note.trim();
}
