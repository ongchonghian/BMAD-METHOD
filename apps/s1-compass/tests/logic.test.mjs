import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  postingGroups, totalAL, compareYear, compareOption, schoolOptions, checkPlan, nextSchoolMorning,
  distanceKm, isGenderOk, copText, allChoices,
} from '../js/logic.js';

const data = JSON.parse(readFileSync(new URL('../data/schools.json', import.meta.url)));
const byName = name => data.schools.find(s => s.name === name);

test('posting group bands follow the MOE table', () => {
  assert.deepEqual(postingGroups(4).groups, [3]);
  assert.deepEqual(postingGroups(20).groups, [3]);
  assert.deepEqual(postingGroups(21), { groups: [3, 2], choose: true, condition: null, valid: true });
  assert.deepEqual(postingGroups(24).groups, [2]);
  assert.deepEqual(postingGroups(25).groups, [2, 1]);
  assert.equal(postingGroups(27, 7, 7).condition, 'met');
  assert.deepEqual(postingGroups(27, 8, 7).groups, []);
  assert.equal(postingGroups(27).condition, 'unknown');
  assert.equal(postingGroups(3).valid, false);
  assert.equal(postingGroups(31).valid, false);
});

test('total AL needs all four subjects', () => {
  assert.equal(totalAL({ el: 3, math: 4, sci: 5, mt: 6 }), 18);
  assert.equal(totalAL({ el: 3, math: 4, sci: 5 }), null);
});

test('a score equal to the cut-off is a tie, and HCL decides at AL 14 or better', () => {
  const rec = { status: 'published_cutoff', cop: 10, copHcl: 'M' };
  assert.equal(compareYear(9, 'none', rec).result, 'better');
  assert.equal(compareYear(11, 'D', rec).result, 'worse');
  assert.equal(compareYear(10, 'D', rec).result, 'better');
  assert.equal(compareYear(10, 'M', rec).result, 'tie');
  assert.equal(compareYear(10, 'P', rec).result, 'worse');
  assert.equal(compareYear(10, undefined, rec).hclUnknown, true);
  assert.equal(compareYear(20, 'D', { status: 'published_cutoff', cop: 20, copHcl: null }).result, 'tie');
});

test('vacancies, no posting and missing records are never turned into numbers', () => {
  assert.equal(compareYear(29, 'none', { status: 'vacancy_convention', cop: 30 }).result, 'open');
  assert.equal(compareYear(10, 'none', { status: 'no_students_posted', cop: null }).result, 'none_posted');
  assert.equal(compareYear(10, 'none', null).result, 'missing');
  assert.equal(copText({ status: 'vacancy_convention', cop: 30 }), '30*');
  assert.equal(copText({ status: 'published_cutoff', cop: 6, copHcl: 'M' }), '6 (M)');
});

test('Admiralty PG3 compares against 20 (2024) and 22 (2025)', () => {
  const s = byName('Admiralty Secondary School');
  const [opt] = schoolOptions(s, 3);
  assert.equal(opt.prog, 'SEC');
  const student = { al: 18, pg: 3, hcl: 'none' };
  const cmp = compareOption(s, opt, student);
  assert.equal(cmp.band, 'ahead');
  assert.equal(cmp.buffer, 2);
  assert.equal(compareOption(s, opt, { ...student, al: 21 }).band, 'mixed');
  assert.equal(compareOption(s, opt, { ...student, al: 23 }).band, 'behind');
  assert.equal(compareOption(s, opt, { ...student, al: 23 }).buffer, -3);
});

test('dual-track schools offer IP and SEC to PG3 only; special admission schools offer none', () => {
  const dhs = byName('Dunman High School (Secondary)');
  assert.deepEqual(schoolOptions(dhs, 3).map(o => o.prog), ['IP']);
  const cedar = byName("Cedar Girls' Secondary School");
  assert.deepEqual(schoolOptions(cedar, 3).map(o => o.prog), ['IP', 'SEC']);
  assert.deepEqual(schoolOptions(cedar, 2).map(o => o.prog), ['SEC']);
  assert.deepEqual(schoolOptions(byName('School of the Arts, Singapore'), 3), []);
  assert.deepEqual(schoolOptions(byName('Crest Secondary School'), 1).map(o => o.prog), ['SEC']);
  assert.deepEqual(schoolOptions(byName('Crest Secondary School'), 3), []);
});

test('affiliated students are compared with the affiliated cut-off', () => {
  const [pri, sec] = data.affiliations.find(([, s]) => {
    const school = data.schools.find(x => x.id === s);
    return school.cutoffs.some(c => c.aff && c.route === 'PG3' && c.status === 'published_cutoff');
  });
  const school = data.schools.find(x => x.id === sec);
  const opt = schoolOptions(school, 3).find(o => o.prog === 'SEC');
  const cmp = compareOption(school, opt, { al: 20, pg: 3, hcl: 'none', primaryId: pri }, data.affiliations);
  assert.equal(cmp.affiliated, true);
  assert.equal(cmp.years[2024].rec.aff, true);
});

test('plan checks: duplicates, gender, balance and affiliation order', () => {
  const student = { al: 18, pg: 3, hcl: 'none', gender: 'boy', primaryId: null };
  const choices = allChoices(data.schools, student, data.affiliations).filter(c => c.option.prog === 'SEC');
  const ahead = choices.filter(c => c.cmp.band === 'ahead').slice(0, 2);
  const behind = choices.filter(c => c.cmp.band === 'behind').slice(0, 2);
  const ids = list => checkPlan(list, student).map(i => `${i.level}:${i.id}`);
  assert.ok(ids([...ahead, ...behind]).includes('ok:balance'));
  assert.ok(ids(behind).includes('warn:balance'));
  assert.ok(ids(behind).includes('warn:all_behind'));
  assert.ok(ids([ahead[0], ahead[0]]).includes('error:duplicate'));
  const girls = byName("Cedar Girls' Secondary School");
  const girlsChoice = { school: girls, option: schoolOptions(girls, 3)[1], cmp: { band: 'none' } };
  assert.ok(ids([girlsChoice]).includes('error:gender'));
  assert.ok(ids(choices.slice(0, 7)).includes('error:too_many'));
});

test('affiliation counts only first, or SEC second after the same school IP', () => {
  const school = byName("CHIJ St. Nicholas Girls' School (Secondary)");
  const [pri] = data.affiliations.find(([, s]) => s === school.id);
  const student = { al: 8, pg: 3, hcl: 'none', gender: 'girl', primaryId: pri };
  const opts = Object.fromEntries(schoolOptions(school, 3).map(o => [o.prog, { school, option: o, cmp: { band: 'ahead' } }]));
  const other = byName('Admiralty Secondary School');
  const otherChoice = { school: other, option: schoolOptions(other, 3)[0], cmp: { band: 'ahead' } };
  const level = list => checkPlan(list, student, data.affiliations).find(i => i.id === 'affiliation').level;
  assert.equal(level([opts.SEC, otherChoice]), 'ok');
  assert.equal(level([otherChoice, opts.SEC]), 'warn');
  if (opts.IP) {
    assert.equal(level([opts.IP, opts.SEC]), 'ok');
    assert.equal(level([opts.IP, otherChoice, opts.SEC]), 'warn');
  }
});

test('gender filter keeps co-ed schools for everyone', () => {
  assert.equal(isGenderOk({ gender: 'coed' }, 'girl'), true);
  assert.equal(isGenderOk({ gender: 'boys' }, 'girl'), false);
  assert.equal(isGenderOk({ gender: 'girls' }, null), true);
});

test('next school morning is a weekday at 07:15 Singapore time', () => {
  const fri = new Date('2026-11-27T02:00:00Z'); // Friday 10:00 SGT
  assert.equal(nextSchoolMorning(fri).toISOString(), '2026-11-29T23:15:00.000Z'); // Monday 07:15 SGT
  const sunNightUtc = new Date('2026-11-29T20:00:00Z'); // Monday 04:00 SGT
  assert.equal(nextSchoolMorning(sunNightUtc).toISOString(), '2026-11-30T23:15:00.000Z');
});

test('distance is roughly right across the island', () => {
  const km = distanceKm({ lat: 1.3521, lng: 103.6 }, { lat: 1.3521, lng: 104.0 });
  assert.ok(km > 44 && km < 45);
});

test('every school has coordinates and every school/year has an O-Level status', () => {
  for (const s of data.schools) {
    assert.ok(Number.isFinite(s.lat) && Number.isFinite(s.lng), s.name);
    assert.deepEqual(s.olevel.map(o => o.year), [2024, 2025], s.name);
  }
});
