'use strict';

const memberBaseNestjsModule = require('..');
const assert = require('assert').strict;

assert.strictEqual(memberBaseNestjsModule(), 'Hello from memberBaseNestjsModule');
console.info('memberBaseNestjsModule tests passed');
