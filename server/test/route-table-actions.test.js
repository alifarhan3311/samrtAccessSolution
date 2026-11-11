const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('row actions appear next to each machine on screen and are absent from print and ordinary-agent views', async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: Table } = await server.ssrLoadModule('/src/RouteDispatchTable.jsx');
    const props = {
      groups: [{ jobs: [{_id:'one',terminalId:'TEST1',cashToLoad:20},{_id:'two',terminalId:'TEST2',cashToLoad:40}] }],
      date:'2026-11-12',agentName:'Preview',canEdit:()=>true,onChange:()=>{},onSave:()=>{}
    };
    const html = renderToStaticMarkup(React.createElement(Table, {
      ...props, renderActions: job => React.createElement('button', null, `Reassign ${job.terminalId}`)
    }));
    const [screen, print] = html.split('route-dispatch-print-pages');
    assert.equal((screen.match(/dispatch-row-actions/g) || []).length, 2);
    assert.ok(screen.includes('Reassign TEST1'));
    assert.ok(screen.includes('Reassign TEST2'));
    assert.ok(!print.includes('Reassign'));
    assert.ok(!print.includes('Actions'));
    assert.ok(!print.includes('has-row-actions'));
    const agent = renderToStaticMarkup(React.createElement(Table, props));
    assert.ok(!agent.includes('dispatch-row-actions'));
    // Planned bills (8th column) never include CAD, including the balance and printed rows.
    const tables = html.match(/<table[\s\S]*?<\/table>/g);
    for (const table of tables) {
      const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(match => match[1]);
      for (const row of rows.filter(row => row.includes('TEST1') || row.includes('TEST2'))) {
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
        assert.ok(!cells[7].includes('$'));
        assert.ok(cells[4].includes('$'), 'Processing Data still displays dollars');
      }
      const balance = rows.find(row => row.includes('>Balance<'));
      const totals = [...balance.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
      assert.equal(totals[3], '3 bills');
    }
  } finally { await server.close(); }
});
