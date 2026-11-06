const test = require('node:test');
const assert = require('node:assert/strict');
const { previousTotalBillsAdded } = require('../src/route-history');

test('previous loading uses the latest prior entry for this terminal across agents', () => {
  const job = {_id:'current', terminal:{_id:'machine'}, dueAt:'2026-11-06'};
  const history = [
    {_id:'older',terminal:'machine',dueAt:'2026-11-03',routeExistingCash:2,routeCashLoaded:50},
    {_id:'prior',terminal:'machine',dueAt:'2026-11-05',routeExistingCash:4,routeCashLoaded:100},
    {_id:'future',terminal:'machine',dueAt:'2026-11-07',routeCashLoaded:500},
    {_id:'other',terminal:'different',dueAt:'2026-11-05',routeCashLoaded:900},
    {_id:'cancelled',terminal:'machine',dueAt:'2026-11-05T20:00:00Z',status:'cancelled',routeCashLoaded:800},
    {_id:'empty',terminal:'machine',dueAt:'2026-11-05T22:00:00Z',routeCashLoaded:null}
  ];
  assert.equal(previousTotalBillsAdded(job, history), 104);
  assert.equal(previousTotalBillsAdded(job, []), 0);
});

test('explicit zero loading is a saved entry, not a missing value', () => {
  assert.equal(previousTotalBillsAdded({_id:'current',terminal:'a',dueAt:'2026-11-06'}, [{_id:'previous',terminal:'a',dueAt:'2026-11-05',routeCashLoaded:0,routeExistingCash:3}]),3);
});

test('an earlier saved assignment on the same route date can be the previous loading', () => {
  const job = {_id:'current',terminal:'a',dueAt:'2026-11-06',createdAt:'2026-11-06T12:00:00Z'};
  const history = [{_id:'prior',terminal:'a',dueAt:job.dueAt,createdAt:'2026-11-06T09:00:00Z',routeCashLoaded:50,routeExistingCash:5},
    {_id:'later',terminal:'a',dueAt:job.dueAt,createdAt:'2026-11-06T15:00:00Z',routeCashLoaded:200}];
  assert.equal(previousTotalBillsAdded(job, history),55);
});

test('dispatch values preserve CAD/bill units and the requested signed day-total formula', async () => {
  const { routeDispatchValues } = await import('../../src/route-dispatch-values.mjs');
  const job = {terminal:{official:{cashBalance:1960}},previousTotalBillsAdded:150,routeExistingCash:31,routeCashLoaded:50,cashToLoad:1000};
  assert.deepEqual(routeDispatchValues(job), {processingAmount:1960,processingBills:98,currentBills:31,addBills:50,expectedBills:50,expectedAmount:1000,totalBillsAdded:81,previousTotalBillsAdded:150,dayTotal:21});
  assert.equal(routeDispatchValues({...job,previousTotalBillsAdded:0}).dayTotal,-129);
  assert.equal(routeDispatchValues({...job,routeCashToLoad:0}).expectedAmount,0);
  assert.equal(routeDispatchValues({...job,terminal:{official:{cashBalance:43}}}).processingBills,2.15);
});

test('route note preserves explicit blank and original dispatch notes', async () => {
  const { routeNote } = await import('../../src/route-dispatch-values.mjs');
  assert.equal(routeNote({routeNote:'',events:[{note:'Area route: North — Old'}]}),'');
  assert.equal(routeNote({events:[{note:'Area route: North — Visit store'}]}),'Visit store');
});

test('print pages hold 15 machines without dropping, repeating, or adding an empty page', async () => {
  const { routePrintPages } = await import('../../src/route-dispatch-values.mjs');
  for (const size of [0, 1, 14, 15, 16, 30, 31, 265]) {
    const rows = Array.from({ length: size }, (_, index) => index);
    const pages = routePrintPages(rows);
    assert.equal(pages.length, Math.ceil(size / 15));
    assert.deepEqual(pages.flat(), rows);
    assert.ok(pages.every(page => page.length > 0 && page.length <= 15));
  }
});
