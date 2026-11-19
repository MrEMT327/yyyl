import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { COMMON_WEAPONS } from '../src/fixed-parts/common-weapons.js';

test('every common weapon has an original inventory icon', () => {
  assert.equal(Object.keys(COMMON_WEAPONS).length, 20);
  for (const id of Object.keys(COMMON_WEAPONS)) {
    const path = new URL(`../public/art/weapon-original/${id}.png`, import.meta.url);
    assert(statSync(path).size > 1000, `${id} is missing its inventory icon`);
  }
});
