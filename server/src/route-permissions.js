const { z } = require('zod');
const routePermissionKeys = ['canViewAllDailyRoutes', 'canEditAllDailyRoutes'];
const permissionBoolean = z.preprocess(value => value === 'true' ? true : value === 'false' ? false : value, z.boolean().optional());
const canViewAllDailyRoutes = user => user.role !== 'agent' || user.canViewAllDailyRoutes === true || user.canEditAllDailyRoutes === true;
function routeAgentScope(user, requested) {
  if (user.role !== 'agent') return requested || undefined;
  const own = String(user._id || user.id);
  if (requested && String(requested) !== own && !canViewAllDailyRoutes(user)) throw Object.assign(new Error('You may only view your own daily route'), { status: 403, code: 'ROUTE_SCOPE_DENIED' });
  return requested || own;
}
function mayEditDailyRoute(user, job, fields) {
  if (user.role !== 'agent') return true;
  if (fields.includes('discrepancyStatus')) return false;
  if (user.canEditAllDailyRoutes === true) return true;
  return String(job.agent) === String(user._id || user.id) && fields.every(field => ['routeExistingCash','routeCashLoaded'].includes(field));
}
module.exports = { routePermissionKeys, permissionBoolean, canViewAllDailyRoutes, routeAgentScope, mayEditDailyRoute };
