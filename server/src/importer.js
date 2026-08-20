const XLSX = require('xlsx');
const { Terminal, ImportRun, AgentJob, CashDiscrepancy } = require('./models');

const clean  = v => v == null ? '' : String(v).trim();
const num    = v => { const n = Number(String(v).replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : undefined; };
const status = v => /^active$/i.test(clean(v)) ? 'Active' : /^inactive$/i.test(clean(v)) ? 'Inactive' : 'Unknown';
const date   = v => { if (!v) return undefined; const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? undefined : d; };

function findHeader(rows) {
  return rows.findIndex(r => r.some(c => /terminal\s*id/i.test(clean(c))));
}
function pick(row, headers, patterns) {
  const i = headers.findIndex(h => patterns.some(p => p.test(clean(h))));
  return i >= 0 ? row[i] : undefined;
}

// ── Format detection ──────────────────────────────────────────────────────────
// Returns 'terminal_management' or 'canada_status'
function detectFormat(headers) {
  const h = headers.map(c => clean(c).toLowerCase());
  const has = pattern => h.some(c => pattern.test(c));
  if (has(/total\s*cassette/) || has(/dispensed\s*amount/) || has(/last\s*settled/) || has(/withdrawal\s*count/)) {
    return 'terminal_management';
  }
  return 'canada_status'; // default / Canada Terminal Status
}

// ── Discrepancy threshold ─────────────────────────────────────────────────────
const DISCREPANCY_THRESHOLD = 50;

async function checkDiscrepancies(terminalId, terminalObjId, newCashBalance, runId) {
  const jobs = await AgentJob.find({
    terminalId,
    status: 'approved',
    _id: { $nin: await CashDiscrepancy.distinct('job', { terminalId }) }
  }).sort({ approvedAt: -1 }).limit(1).lean();

  if (!jobs.length) return null;
  const job = jobs[0];

  const loadEvent = [...job.events].reverse().find(e => e.status === 'cash_loaded');
  const cashLoadedByAgent = loadEvent?.cashLoaded ?? job.cashToLoad;

  const terminal = await Terminal.findById(terminalObjId).select('official.cashBalance').lean();
  const balanceBeforeJob = terminal?.official?.cashBalance ?? 0;

  const expectedBalance = balanceBeforeJob + cashLoadedByAgent;
  const discrepancy     = expectedBalance - newCashBalance;

  if (Math.abs(discrepancy) <= DISCREPANCY_THRESHOLD) return null;

  const rec = await CashDiscrepancy.create({
    terminalId, terminal: terminalObjId, job: job._id, agent: job.agent,
    importRunId: runId, balanceBeforeJob, cashLoadedByAgent,
    expectedBalance, actualBalance: newCashBalance, discrepancy, status: 'open',
  });
  return { terminalId, discrepancy, expected: expectedBalance, actual: newCashBalance };
}

// ── Field extractors per format ───────────────────────────────────────────────

/**
 * Canada Terminal Status file
 * Columns: Terminal ID | Name | Address | Cash Balance | Last Error |
 *          Last Communication | Last Withdrawal Date
 *
 * Returns only the fields this file provides — everything else is left untouched.
 */
function extractCanadaStatus(row, headers) {
  return {
    name:              clean(pick(row, headers, [/^name$/i, /business/i])),
    address:           clean(pick(row, headers, [/address/i])),
    cashBalance:       num(pick(row, headers, [/cash\s*balance/i, /^balance$/i])),
    lastError:         clean(pick(row, headers, [/last\s*error/i])),
    lastCommunication: clean(pick(row, headers, [/last\s*comm/i])),
    lastWithdrawalAt:  date(pick(row, headers, [/last\s*withdrawal/i])),
    sourcePresent:     true,
    lastSyncedAt:      new Date(),
  };
}

/**
 * Terminal Management file
 * Columns: Terminal ID | Location Name | Address | Last Trans Data |
 *          Last Trans Time | Total Cassette Value | Total Cassette Count |
 *          Last Settled Time | Withdrawal Count | Dispensed Amount | Model
 *
 * Returns only the fields this file provides — Cash Balance etc. are left untouched.
 */
function extractTerminalManagement(row, headers) {
  return {
    name:               clean(pick(row, headers, [/location\s*name/i, /^name$/i])),
    address:            clean(pick(row, headers, [/address/i])),
    lastTransData:      clean(pick(row, headers, [/last\s*trans\s*dat/i])),
    lastTransTime:      date(pick(row, headers, [/last\s*trans\s*time/i])),
    totalCassetteValue: num(pick(row, headers, [/total\s*cassette\s*value/i])),
    totalCassetteCount: num(pick(row, headers, [/total\s*cassette\s*count/i])),
    lastSettledTime:    date(pick(row, headers, [/last\s*settled/i])),
    withdrawalCount:    num(pick(row, headers, [/withdrawal\s*count/i])),
    dispensedAmount:    num(pick(row, headers, [/dispensed\s*amount/i])),
    terminalModel:      clean(pick(row, headers, [/^model$/i])),
    sourcePresent:      true,
    lastSyncedAt:       new Date(),
  };
}

// ── Convert partial official fields to dotted $set paths ─────────────────────
// e.g. { cashBalance: 500 } → { 'official.cashBalance': 500 }
function toOfficialSet(fields) {
  const set = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== '') set[`official.${k}`] = v;
  }
  return set;
}

// ── Main export ───────────────────────────────────────────────────────────────
async function importWorkbook(buffer, fileName, userId) {
  const book  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const hi = findHeader(rows);
  if (hi < 0) throw new Error('Could not locate a Terminal ID header row in this file.');

  const headers = rows[hi];
  const data    = rows.slice(hi + 1).filter(r => clean(pick(r, headers, [/terminal\s*id/i])));
  const format  = detectFormat(headers);

  const seen    = [];
  const changes = [];
  const totals  = { imported: data.length, new: 0, updated: 0, removed: 0, unchanged: 0, format };

  for (const row of data) {
    const terminalId = clean(pick(row, headers, [/terminal\s*id/i])).toUpperCase();
    if (!terminalId) continue;
    seen.push(terminalId);

    // Raw row stored for audit trail
    const raw = Object.fromEntries(headers.map((h, i) => [clean(h) || `column_${i + 1}`, row[i]]));

    // Extract only the fields this format provides
    const extracted = format === 'terminal_management'
      ? extractTerminalManagement(row, headers)
      : extractCanadaStatus(row, headers);

    // Build partial dotted-path $set (won't overwrite fields from the other format)
    const partialSet = toOfficialSet({ ...extracted, raw });

    const existing = await Terminal.findOne({ terminalId });

    if (!existing) {
      // ── New terminal ──────────────────────────────────────────────────────
      // On first insert we need a full official object; fill missing fields with defaults
      const officialDoc = {
        status: 'Unknown', name: '', address: '', city: '', locationArea: '',
        sourcePresent: true, lastSyncedAt: new Date(),
        ...extracted, raw,
      };

      // Preserve wishAmount if set (only Canada Status carries it; Terminal Management doesn't)
      const needsSetup = !officialDoc.wishAmount || officialDoc.wishAmount <= 0;

      await Terminal.create({
        terminalId,
        official: officialDoc,
        original: {
          businessName: officialDoc.name,
          address:      officialDoc.address,
          city:         officialDoc.city || '',
        },
        current: {
          businessName: officialDoc.tempName || officialDoc.name,
          address:      officialDoc.address,
          city:         officialDoc.city || '',
        },
        setupRequired: needsSetup,
        setupReason:   needsSetup ? 'New terminal requires Wish Amount and operational setup' : undefined,
      });

      changes.push({ terminalId, type: 'new', format, after: extracted, setupRequired: needsSetup });
      totals.new++;

    } else {
      // ── Existing terminal — partial update ────────────────────────────────

      // Discrepancy check only when Canada Status file brings a new cashBalance
      if (format === 'canada_status' && extracted.cashBalance != null) {
        try {
          const disc = await checkDiscrepancies(terminalId, existing._id, extracted.cashBalance, null);
          if (disc) changes.push({ terminalId, type: 'discrepancy', discrepancy: disc.discrepancy, expected: disc.expected, actual: disc.actual });
        } catch (e) { console.error('Discrepancy check error:', e.message); }
      }

      // Only update if something actually changed
      const changedFields = Object.entries(partialSet)
        .filter(([k, v]) => String(existing.getPath ? existing.getPath(k) : '') !== String(v ?? ''))
        .map(([k, v]) => ({ field: k, previous: existing.getPath?.(k) ?? '', current: v }));

      await Terminal.updateOne({ _id: existing._id }, { $set: partialSet });

      if (changedFields.length) {
        changes.push({ terminalId, type: 'updated', format, fields: changedFields });
        totals.updated++;
      } else {
        totals.unchanged++;
      }
    }
  }

  // Terminals absent from this file → mark sourcePresent false (Canada Status only)
  // Terminal Management is a supplementary file — we don't use it to mark terminals as removed
  let removedItems = [];
  if (format === 'canada_status') {
    removedItems = await Terminal.find(
      { terminalId: { $nin: seen }, 'official.sourcePresent': true }
    ).select('terminalId official.name official.city').lean();

    const removed = await Terminal.updateMany(
      { terminalId: { $nin: seen }, 'official.sourcePresent': true },
      { $set: { 'official.sourcePresent': false } }
    );
    totals.removed = removed.modifiedCount;
    changes.push(...removedItems.map(t => ({
      terminalId: t.terminalId, type: 'removed',
      name: t.official?.name, city: t.official?.city,
    })));
  }

  const discrepancyCount = changes.filter(c => c.type === 'discrepancy').length;
  totals.discrepancies = discrepancyCount;

  const run = await ImportRun.create({ fileName, importedBy: userId, totals, changes });

  // Backfill importRunId on discrepancies that were created with null runId
  if (discrepancyCount > 0) {
    const discTerminalIds = changes.filter(c => c.type === 'discrepancy').map(c => c.terminalId);
    await CashDiscrepancy.updateMany(
      { terminalId: { $in: discTerminalIds }, importRunId: null },
      { $set: { importRunId: run._id } }
    );
  }

  return { runId: run.id, ...totals };
}

module.exports = { importWorkbook, findHeader };
