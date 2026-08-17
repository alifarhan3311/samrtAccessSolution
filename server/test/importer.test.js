const test=require('node:test');const assert=require('node:assert/strict');const{findHeader}=require('../src/importer');
test('finds a header row after report metadata',()=>assert.equal(findHeader([['Report'],['Active Terminals',143],['Status','Terminal ID','Name']]),2));
test('rejects sheets without terminal identifier',()=>assert.equal(findHeader([['Report'],['Status','Machine']]),-1));
