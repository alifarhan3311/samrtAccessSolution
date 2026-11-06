import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationGroups, groupVisibleLinks, backDestination } from './navigation.mjs';

test('every existing page appears in exactly one navigation group', () => {
  const keys = navigationGroups.flatMap(group => group.keys);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([...keys].sort(), ['dashboard', 'notifications', 'terminals', 'tickets', 'area', 'jobs', 'routesheet', 'agents', 'ledger', 'discrepancies', 'history', 'logs', 'import', 'atm'].sort());
});

test('grouping never adds routes outside the current permission-filtered links', () => {
  const links = [['jobs', 'My jobs', 'x', '/jobs'], ['routesheet', 'Daily route', 'x', '/routesheet']];
  const grouped = groupVisibleLinks(links);
  assert.deepEqual(grouped.flatMap(group => group.links), links);
  assert.equal(grouped.length, 2);
  assert.deepEqual(groupVisibleLinks([]), []);
});

test('Back uses app history when present and safe in-app fallback for direct links', () => {
  assert.equal(backDestination(2, '/area'), -1);
  for (const index of [0, undefined, null, -1]) assert.equal(backDestination(index, '/area'), '/area');
});
