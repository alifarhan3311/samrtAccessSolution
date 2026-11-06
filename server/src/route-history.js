// Previous saved loading for the same machine, regardless of which agent loaded it.
function previousTotalBillsAdded(job, history) {
  const before = new Date(job.dueAt).getTime();
  const previous = history.filter(item => String(item.terminal) === String(job.terminal?._id || job.terminal)
    && String(item._id) !== String(job._id) && item.status !== 'cancelled'
    && item.routeCashLoaded != null && Number.isFinite(Number(item.routeCashLoaded))
    && (new Date(item.dueAt).getTime() < before
      || (new Date(item.dueAt).getTime() === before && item.createdAt && job.createdAt
        && new Date(item.createdAt).getTime() < new Date(job.createdAt).getTime())))
    .sort((a, b) => new Date(b.dueAt) - new Date(a.dueAt)
      || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
  return previous ? (Number(previous.routeExistingCash) || 0) + Number(previous.routeCashLoaded) : 0;
}
module.exports = { previousTotalBillsAdded };
