import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlocked, parseBlocklist } from '../src/lib/blocklist.js';

test('plain domain blocks itself and subdomains only', () => {
  const list = ['example.com'];
  assert.ok(isBlocked('example.com', list));
  assert.ok(isBlocked('mail.example.com', list));
  assert.ok(isBlocked('EXAMPLE.com.', list));
  assert.ok(!isBlocked('notexample.com', list));
  assert.ok(!isBlocked('example.com.evil.net', list));
});

test('wildcard blocks only subdomains', () => {
  const list = ['*.example.com'];
  assert.ok(isBlocked('a.example.com', list));
  assert.ok(!isBlocked('example.com', list));
  assert.ok(!isBlocked('badexample.com', list));
});

test('empty inputs never block', () => {
  assert.ok(!isBlocked('', ['example.com']));
  assert.ok(!isBlocked('example.com', []));
  assert.ok(!isBlocked('example.com', null));
});

test('parseBlocklist splits on whitespace/commas and drops junk', () => {
  assert.deepEqual(parseBlocklist('a.com, b.org\n\n  https://c.net/x  not valid'), ['a.com', 'b.org', 'c.net', 'not', 'valid']);
  assert.deepEqual(parseBlocklist('<script>alert(1)</script>'), []);
});
