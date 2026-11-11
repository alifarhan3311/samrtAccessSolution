const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { permissionBoolean, canViewAllDailyRoutes, routeAgentScope, mayEditDailyRoute } = require('../src/route-permissions');

test('multipart permission false is false, not a truthy string', () => {
  const schema = z.object({ permission: permissionBoolean });
  assert.equal(schema.parse({permission:'false'}).permission, false);
  assert.equal(schema.parse({permission:'true'}).permission, true);
  assert.deepEqual(schema.parse({}), {});
  assert.throws(() => schema.parse({permission:'yes'}));
});

test('normal agent can only view own route and edit original two fields', () => {
  const agent = {role:'agent',_id:'self'};
  assert.equal(canViewAllDailyRoutes(agent),false);
  assert.equal(routeAgentScope(agent), 'self');
  assert.equal(routeAgentScope(agent, 'self'), 'self');
  assert.throws(() => routeAgentScope(agent,'other'), error => error.status === 403);
  assert.equal(mayEditDailyRoute(agent,{agent:'self'},['routeExistingCash','routeCashLoaded']),true);
  assert.equal(mayEditDailyRoute(agent,{agent:'other'},['routeCashLoaded']),false);
  assert.equal(mayEditDailyRoute(agent,{agent:'self'},['routeCashToLoad']),false);
});

test('view/print coordinator cannot edit another agent or approve a case', () => {
  const agent = {role:'agent',_id:'self',canViewAllDailyRoutes:true};
  assert.equal(routeAgentScope(agent,'other'),'other');
  assert.equal(mayEditDailyRoute(agent,{agent:'other'},['routeCashLoaded']),false);
  assert.equal(mayEditDailyRoute(agent,{agent:'other'},['discrepancyStatus']),false);
});

test('edit coordinator can edit route fields but not approve and revocation restores own-only scope', () => {
  const agent = {role:'agent',_id:'self',canViewAllDailyRoutes:true,canEditAllDailyRoutes:true};
  assert.equal(mayEditDailyRoute(agent,{agent:'other'},['routeCashToLoad','routeLoadTime','routeNote']),true);
  assert.equal(mayEditDailyRoute(agent,{agent:'other'},['discrepancyStatus']),false);
  agent.canViewAllDailyRoutes = false; agent.canEditAllDailyRoutes = false;
  assert.throws(() => routeAgentScope(agent,'other'));
  assert.equal(mayEditDailyRoute(agent,{agent:'other'},['routeCashLoaded']),false);
});

test('existing admin and user access remains unchanged', () => {
  for (const role of ['admin','user','manager']) {
    assert.equal(canViewAllDailyRoutes({role}),true);
    assert.equal(routeAgentScope({role},'other'),'other');
    assert.equal(mayEditDailyRoute({role},{agent:'other'},['routeNote']),true);
  }
});

test('existing agents default to no cross-agent permission', () => {
  const { User } = require('../src/models');
  const agent = new User({name:'Test',email:'test@example.test',role:'agent',passwordHash:'not-a-real-password'});
  assert.equal(agent.canViewAllDailyRoutes,false);
  assert.equal(agent.canEditAllDailyRoutes,false);
});
