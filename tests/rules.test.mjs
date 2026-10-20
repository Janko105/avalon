import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/rules.js';

const ALL = { merlin: true, persival: true, morgana: true, mordred: true, oberon: true };
const NONE = { merlin: false, persival: false, morgana: false, mordred: false, oberon: false };

test('podela ima tačan broj zlih za 5–10 igrača', () => {
  for (let n = 5; n <= 10; n++) {
    for (let k = 0; k < 50; k++) {
      const roles = R.assignRoles(n, { merlin: true, persival: true, morgana: true });
      assert.equal(roles.length, n);
      assert.equal(roles.filter(R.isEvil).length, R.EVIL_COUNT[n]);
      for (const r of ['merlin', 'persival', 'assassin', 'morgana']) assert.ok(roles.includes(r), `${n}: ${r}`);
    }
  }
});

test('bez specijalnih uloga samo obični sluge', () => {
  const roles = R.buildRoleList(6, NONE);
  assert.deepEqual(roles.filter((r) => r === 'loyal').length, 4);
  assert.deepEqual(roles.filter((r) => r === 'minion').length, 2);
});

test('validacija: previše zlih uloga', () => {
  assert.equal(R.validateSetup(5, ALL).ok, false);
  assert.equal(R.validateSetup(9, ALL).ok, false);
  assert.equal(R.validateSetup(10, ALL).ok, true);
  assert.equal(R.validateSetup(5, { merlin: true, persival: true, morgana: true }).ok, true);
  assert.equal(R.validateSetup(5, { merlin: true, morgana: true, mordred: true }).ok, false);
  assert.equal(R.validateSetup(7, { merlin: true, morgana: true, mordred: true }).ok, true);
});

test('validacija: Persival traži Merlina, broj igrača', () => {
  assert.equal(R.validateSetup(6, { persival: true }).ok, false);
  assert.equal(R.validateSetup(4, NONE).ok, false);
  assert.equal(R.validateSetup(11, NONE).ok, false);
});

test('Merlin vidi zle osim Mordreda, vidi Oberona', () => {
  const roles = ['merlin', 'loyal', 'mordred', 'oberon', 'assassin', 'persival', 'loyal', 'loyal', 'morgana', 'loyal'];
  const k = R.knowledge(roles, 0);
  assert.deepEqual(k.players, [3, 4, 8]);
  assert.ok(k.note);
});

test('zli se vide međusobno, ali ne Oberona; Oberon ne vidi nikoga', () => {
  const roles = ['merlin', 'loyal', 'mordred', 'oberon', 'assassin', 'persival', 'loyal', 'loyal', 'morgana', 'loyal'];
  assert.deepEqual(R.knowledge(roles, 2).players, [4, 8]);
  assert.deepEqual(R.knowledge(roles, 4).players, [2, 8]);
  assert.deepEqual(R.knowledge(roles, 3).players, []);
});

test('Persival vidi Merlina i Morganu', () => {
  const roles = ['morgana', 'loyal', 'persival', 'merlin', 'assassin'];
  assert.deepEqual(R.knowledge(roles, 2).players, [0, 3]);
  const noMorgana = ['minion', 'loyal', 'persival', 'merlin', 'assassin'];
  assert.deepEqual(R.knowledge(noMorgana, 2).players, [3]);
});

test('lojalni sluga ne vidi nikoga', () => {
  assert.deepEqual(R.knowledge(['loyal', 'merlin', 'assassin', 'minion', 'loyal'], 0).players, []);
});

test('4. misija sa 7+ igrača traži 2 pada', () => {
  assert.equal(R.missionOutcome(['fail', 'success', 'success', 'success'], 7, 3).failed, false);
  assert.equal(R.missionOutcome(['fail', 'fail', 'success', 'success'], 7, 3).failed, true);
  assert.equal(R.missionOutcome(['fail', 'success', 'success'], 6, 3).failed, true);
  assert.equal(R.missionOutcome(['fail', 'success', 'success'], 7, 2).failed, true);
  assert.equal(R.missionOutcome(['success', 'success'], 5, 0).fails, 0);
});

test('kraj igre', () => {
  const s = { failed: false };
  const f = { failed: true };
  assert.equal(R.missionsStatus([s, f, s]), 'ongoing');
  assert.equal(R.missionsStatus([s, f, s, s]), 'good');
  assert.equal(R.missionsStatus([f, s, f, f]), 'evil');
  assert.equal(R.missionsStatus([f, f, s, s, f]), 'evil');
});

test('Gospa od Jezera', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(R.ladyAfterMission), [false, true, true, true, false]);
  assert.deepEqual(R.ladyTargets(5, [2]), [0, 1, 3, 4]);
  assert.deepEqual(R.ladyTargets(5, [2, 4, 0]), [1, 3]);
});

test('veličine timova po zvaničnoj tabeli', () => {
  assert.deepEqual(R.TEAM_SIZES[5], [2, 3, 2, 3, 3]);
  assert.deepEqual(R.TEAM_SIZES[7], [2, 3, 3, 4, 4]);
  assert.deepEqual(R.TEAM_SIZES[10], [3, 4, 4, 5, 5]);
});

test('vođa ide redom i vraća se na početak', () => {
  assert.equal(R.nextLeader(0, 5), 1);
  assert.equal(R.nextLeader(4, 5), 0);
  assert.equal(R.nextLeader(9, 10), 0);
});

test('Gospa počinje desno od prvog vođe', () => {
  assert.equal(R.ladyStartHolder(3, 7), 2);
  assert.equal(R.ladyStartHolder(0, 7), 6);
});
