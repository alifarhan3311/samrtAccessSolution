const test = require('node:test');
const assert = require('node:assert/strict');
const { extractCanadaStatus, toOfficialSet } = require('../src/importer');

test('Canada status report updates cash and communication without clearing registry-only fields', () => {
  const headers = ['Terminal ID', 'Name', 'Address', 'Cash Balance', 'Last Error', 'Last Communication', 'Last Withdrawal Date'];
  const row = ['CA137514', 'PAAKIZA SUPERMARKET', '965 DUNDAS STREET W , ON', 3360, '', '10/22/26 12:06', '2026-10-21'];
  const fields = extractCanadaStatus(row, headers);
  const set = toOfficialSet(fields, true);
  assert.equal(set['official.cashBalance'], 3360);
  assert.equal(set['official.lastCommunication'], '10/22/26 12:06');
  for (const name of ['status', 'tempName', 'city', 'locationArea', 'wishAmount', 'cashLoading', 'agent', 'notesTask', 'notes']) {
    assert.equal(Object.hasOwn(set, `official.${name}`), false, `${name} must be preserved`);
  }
});

test('explicit zero cash balance remains zero', () => {
  const fields = extractCanadaStatus(['CA1', 0], ['Terminal ID', 'Cash Balance']);
  assert.equal(toOfficialSet(fields, true)['official.cashBalance'], 0);
});
