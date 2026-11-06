// Presentation-only grouping. Existing route keys and permission checks stay unchanged.
export const navigationGroups = [
  { id: 'overview', label: 'Overview', keys: ['dashboard', 'notifications'] },
  { id: 'registry', label: 'ATM Registry', keys: ['terminals', 'import', 'history'] },
  { id: 'dispatch', label: 'Dispatch', keys: ['area', 'jobs'] },
  { id: 'daily', label: 'Daily Route & Tickets', keys: ['routesheet', 'tickets'] },
  { id: 'cash', label: 'Cash Management', keys: ['ledger', 'discrepancies'] },
  { id: 'documents', label: 'Documents', keys: ['atm'] },
  { id: 'administration', label: 'Administration', keys: ['agents', 'logs'] }
];

export function groupVisibleLinks(links) {
  return navigationGroups.map(group => ({
    ...group,
    links: group.keys.flatMap(key => links.filter(link => link[0] === key))
  })).filter(group => group.links.length);
}

export function backDestination(historyIndex, fallback) {
  return Number.isInteger(historyIndex) && historyIndex > 0 ? -1 : fallback;
}
