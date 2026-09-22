const XLSX = require('xlsx');
const { Terminal, ImportRun, AgentJob, CashDiscrepancy } = require('./models');

const clean  = v => v == null ? '' : String(v).trim();
const num    = v => { const n = Number(String(v).replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : undefined; };
const status = v => {
  const c = clean(v).toLowerCase();
  if (/^inact/i.test(c)) return 'Inactive';
  if (/^act/i.test(c)) return 'Active';
  if (/^spare/i.test(c)) return 'Spare';
  if (/^pend/i.test(c)) return 'Pending';
  return 'Active';
};
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
  const st = status(pick(row, headers, [/^status$/i]));

  const rawComm = pick(row, headers, [/last\s*comm/i]);
  let commStr = '';
  if (rawComm instanceof Date && !isNaN(rawComm.getTime())) {
    const mm = String(rawComm.getMonth() + 1).padStart(2, '0');
    const dd = String(rawComm.getDate()).padStart(2, '0');
    const yy = String(rawComm.getFullYear()).slice(-2);
    const hh = String(rawComm.getHours()).padStart(2, '0');
    const min = String(rawComm.getMinutes()).padStart(2, '0');
    commStr = `${mm}/${dd}/${yy} ${hh}:${min}`;
  } else {
    commStr = clean(rawComm);
  }

  const rawWithdrawal = pick(row, headers, [/last\s*withdrawal/i]);
  let withdrawalDate = undefined;
  let withdrawalStr = clean(rawWithdrawal);
  if (rawWithdrawal instanceof Date && !isNaN(rawWithdrawal.getTime())) {
    withdrawalDate = rawWithdrawal;
    withdrawalStr = rawWithdrawal.toISOString().slice(0, 10);
  } else if (withdrawalStr && !/^(n\/?a|none|nil)$/i.test(withdrawalStr)) {
    const d = new Date(withdrawalStr);
    if (!isNaN(d.getTime())) {
      withdrawalDate = d;
    }
  }

  const wishAmountVal = num(pick(row, headers, [/wish\s*amount/i, /^wish$/i]));

  return {
    status:             st,
    tempName:           clean(pick(row, headers, [/temp\s*name/i])),
    name:               clean(pick(row, headers, [/^name$/i, /business/i, /location\s*name/i])),
    address:            clean(pick(row, headers, [/address/i])),
    city:               clean(pick(row, headers, [/^city$/i])),
    locationArea:       clean(pick(row, headers, [/location\s*area/i])),
    wishAmount:         wishAmountVal,
    cashBalance:        num(pick(row, headers, [/cash\s*balance/i, /^balance$/i])),
    cashLoading:        num(pick(row, headers, [/cash\s*loading/i, /cash\s*load/i])),
    agent:              clean(pick(row, headers, [/^agent$/i])),
    notesTask:          clean(pick(row, headers, [/notes?\s*\/\s*task/i, /^task$/i])),
    notes:              clean(pick(row, headers, [/^notes?$/i])),
    lastError:          clean(pick(row, headers, [/last\s*error/i])),
    lastCommunication:  commStr,
    lastWithdrawalAt:   withdrawalDate,
    lastWithdrawalDate: withdrawalStr,
    sourcePresent:      true,
    lastSyncedAt:       new Date(),
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
    locationArea:       clean(pick(row, headers, [/location\s*area/i])),
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

async function importWorkbook(buffer, fileName, userId, io) {
  const book  = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const hi = findHeader(rows);
  if (hi < 0) throw new Error('Could not locate a Terminal ID header row in this file.');

  const headers = rows[hi];
  // Extract data rows and valid terminal IDs
  const rawData = rows.slice(hi + 1);
  const data = [];
  const seen = new Set();
  
  for (const r of rawData) {
    const tid = clean(pick(r, headers, [/terminal\s*id/i])).toUpperCase();
    if (tid && !seen.has(tid)) {
      seen.add(tid);
      data.push({ row: r, terminalId: tid });
    }
  }

  const format = detectFormat(headers);
  const totals = { imported: data.length, new: 0, updated: 0, removed: 0, unchanged: 0, format };
  const changes = [];
  const importAlerts = [];

  // ── 1. PRE-FETCH ALL EXISTING TERMINALS IN BULK ──────────────────────
  const terminalIdsArray = Array.from(seen);
  const existingTerminalsList = await Terminal.find({ terminalId: { $in: terminalIdsArray } }).lean();
  const existingMap = new Map(existingTerminalsList.map(t => [t.terminalId, t]));

  const bulkOps = [];
  const discrepancyPromises = [];

  // ── 2. PROCESS ROWS IN MEMORY & PREPARE BULK OPERATIONS ──────────────
  for (const { row, terminalId } of data) {
    // Raw row stored for audit trail
    const raw = Object.fromEntries(headers.map((h, i) => [clean(h) || `column_${i + 1}`, row[i]]));
    
    // Extract only the fields this format provides
    const extracted = format === 'terminal_management'
      ? extractTerminalManagement(row, headers)
      : extractCanadaStatus(row, headers);

    const partialSet = toOfficialSet({ ...extracted, raw });
    const existing = existingMap.get(terminalId);

    if (!existing) {
      // New terminal
      const officialDoc = {
        status: extracted.status || 'Active', name: '', address: '', city: '', locationArea: '',
        sourcePresent: true, lastSyncedAt: new Date(),
        ...extracted, raw,
      };

      const needsSetup = officialDoc.status === 'Active' && (!officialDoc.wishAmount || officialDoc.wishAmount <= 0);

      const newDoc = {
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
        alert: {
          enabled: Boolean(officialDoc.wishAmount && officialDoc.wishAmount > 0),
          threshold: officialDoc.wishAmount || 0,
        }
      };

      bulkOps.push({ insertOne: { document: newDoc } });
      changes.push({ terminalId, type: 'new', format, after: extracted, setupRequired: needsSetup });
      totals.new++;

    } else {
      // Existing terminal — discrepancy checks
      if (format === 'canada_status' && extracted.cashBalance != null) {
        // Queue the discrepancy check for parallel execution later
        discrepancyPromises.push(
          checkDiscrepancies(terminalId, existing._id, extracted.cashBalance, null)
            .catch(e => { console.error('Discrepancy check error:', e.message); return null; })
        );
      }

      // Check if anything changed
      const changedFields = Object.entries(partialSet)
        .filter(([k, v]) => {
          const pathKeys = k.split('.');
          let existingVal = existing;
          for (const pk of pathKeys) existingVal = existingVal?.[pk];
          return String(existingVal ?? '') !== String(v ?? '');
        })
        .map(([k, v]) => {
          const pathKeys = k.split('.');
          let existingVal = existing;
          for (const pk of pathKeys) existingVal = existingVal?.[pk];
          return { field: k, previous: existingVal ?? '', current: v };
        });

      if (changedFields.length) {
        const nameChanged = changedFields.find(f => f.field === 'official.tempName' || f.field === 'official.name');
        if (nameChanged) {
          const newName = extracted.tempName || extracted.name;
          const oldName = existing.official?.tempName || existing.official?.name;
          if (newName && newName !== oldName) {
            const now = new Date();
            const arr = Array.isArray(existing.assignmentHistory) ? [...existing.assignmentHistory] : [];
            if (arr.length > 0) {
              const last = arr[arr.length - 1];
              if (!last.endedAt) last.endedAt = now;
            }
            arr.push({
              businessName: newName,
              address: extracted.address || existing.official?.address || '',
              city: extracted.city || existing.official?.city || '',
              paymentAmount: extracted.wishAmount || existing.official?.wishAmount || 0,
              note: 'Auto-assigned from official import',
              assignedAt: now,
              assignedBy: userId
            });
            partialSet.assignmentHistory = arr;
            partialSet['current.businessName'] = newName;
            if (extracted.address) partialSet['current.address'] = extracted.address;
            if (extracted.city) partialSet['current.city'] = extracted.city;
            partialSet['current.assignedAt'] = now;
          }
        }

        bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: partialSet } } });
        changes.push({ terminalId, type: 'updated', format, fields: changedFields });
        totals.updated++;
        // (Alert collection handled outside the loop now)
        if (format === 'canada_status' && extracted.cashBalance !== undefined) {
          const cashBalance = extracted.cashBalance;
          const wishAmount = existing.official?.wishAmount || existing.alert?.threshold || 0;
          const oldBalance = existing.official?.cashBalance;
          
          if (cashBalance === 0 && oldBalance !== 0) {
            importAlerts.push({
              type: 'error',
              title: 'Critical: Zero Balance',
              message: `Terminal ${terminalId} (${existing.official?.name || 'Unknown'}) is out of cash ($0)!`
            });
          } else if (wishAmount > 0 && cashBalance < wishAmount && (oldBalance === undefined || oldBalance >= wishAmount)) {
            importAlerts.push({
              type: 'warning',
              title: 'Low Cash Warning',
              message: `Terminal ${terminalId} dropped to $${cashBalance} (Wish: $${wishAmount})`
            });
          }
        }
      } else {
        totals.unchanged++;
      }
    }
  }

  // ── 3. EXECUTE BULK WRITE & PARALLEL DISCREPANCY CHECKS ──────────────
  if (bulkOps.length > 0) {
    await Terminal.bulkWrite(bulkOps, { ordered: false });
  }

  if (discrepancyPromises.length > 0) {
    const discrepancyResults = await Promise.all(discrepancyPromises);
    for (const disc of discrepancyResults) {
      if (disc) {
        changes.push({ terminalId: disc.terminalId, type: 'discrepancy', discrepancy: disc.discrepancy, expected: disc.expected, actual: disc.actual });
      }
    }
  }

  // ── 4. HANDLE REMOVED/MISSING TERMINALS ──────────────────────────────
  let removedItems = [];
  if (format === 'canada_status') {
    removedItems = await Terminal.find(
      { terminalId: { $nin: terminalIdsArray }, 'official.sourcePresent': true }
    ).select('terminalId official.name official.city').lean();

    if (removedItems.length > 0) {
      const removed = await Terminal.updateMany(
        { terminalId: { $nin: terminalIdsArray }, 'official.sourcePresent': true },
        { $set: { 'official.sourcePresent': false } }
      );
      totals.removed = removed.modifiedCount;
      changes.push(...removedItems.map(t => ({
        terminalId: t.terminalId, type: 'removed',
        name: t.official?.name, city: t.official?.city,
      })));
    }
  }

  // ── 5. RECORD IMPORT RUN ─────────────────────────────────────────────
  const discrepancyCount = changes.filter(c => c.type === 'discrepancy').length;
  totals.discrepancies = discrepancyCount;

  const run = await ImportRun.create({ fileName, importedBy: userId, totals, changes });

  if (discrepancyCount > 0) {
    if (io) io.emit('discrepancy_alert', { message: `${discrepancyCount} cash discrepancies detected during import.` });
    const discTerminalIds = changes.filter(c => c.type === 'discrepancy').map(c => c.terminalId);
    await CashDiscrepancy.updateMany(
      { terminalId: { $in: discTerminalIds }, importRunId: null },
      { $set: { importRunId: run._id } }
    );
  }

  if (io && importAlerts.length > 0) {
    if (importAlerts.length > 3) {
      io.emit('terminal_alert', {
        type: 'warning',
        title: 'Multiple Cash Alerts',
        message: `${importAlerts.length} terminals have dropped below their wish amount or reached zero balance.`
      });
    } else {
      importAlerts.forEach(a => io.emit('terminal_alert', a));
    }
  }

  return { runId: run.id, ...totals };
}

module.exports = { importWorkbook, findHeader };
