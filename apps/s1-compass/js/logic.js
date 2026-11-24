// Every admission and comparison rule the app applies, as pure functions (tested in tests/logic.test.mjs).
// Historical cut-offs are comparisons, never chances of admission; a missing value is never zero.

export const YEARS = [2024, 2025];
export const MAX_CHOICES = 6;
export const HCL_RANK = { D: 3, M: 2, P: 1, none: 0 };
export const HCL_PRIORITY_MAX_AL = 14;

export const INTERESTS = [
  { id: 'robotics_and_making', label: 'Robotics and making' },
  { id: 'coding_and_computing', label: 'Coding and computers' },
  { id: 'research_and_inquiry', label: 'Science and research' },
  { id: 'environment_and_sustainability', label: 'Nature and the environment' },
  { id: 'sports', label: 'Sports' },
  { id: 'outdoor_activities', label: 'Outdoors and adventure' },
  { id: 'music', label: 'Music' },
  { id: 'drama_dance_and_performance', label: 'Drama and dance' },
  { id: 'arts_and_design', label: 'Art and design' },
  { id: 'communication_and_media', label: 'Media and public speaking' },
  { id: 'language_and_culture', label: 'Languages and culture' },
  { id: 'leadership', label: 'Leading a team' },
  { id: 'community_service', label: 'Helping the community' },
  { id: 'global_exposure', label: 'The wider world' },
  { id: 'enterprise', label: 'Business ideas' },
  { id: 'vocational_and_work_experience', label: 'Hands-on work skills' },
  { id: 'boarding', label: 'Living at school' },
];
export const INTEREST_LABEL = Object.fromEntries(INTERESTS.map(i => [i.id, i.label]));

// CCA names that speak to an interest, so a school page can put "your" CCAs first.
const CCA_HINTS = {
  robotics_and_making: /robot|maker|design and tech|engineering|aero/i,
  coding_and_computing: /infocomm|computing|coding|media|robot|digital/i,
  research_and_inquiry: /science|research|math|astronom/i,
  environment_and_sustainability: /environment|nature|green|garden/i,
  sports: null, // any physical sport
  outdoor_activities: /outdoor|adventure|scout|guide|climb|canoe|sail|kayak|dragon boat/i,
  music: /band|choir|orchestra|ensemble|music|guzheng|angklung|pipe|drum|guitar|string/i,
  drama_dance_and_performance: /drama|dance|wushu|theatre|debat/i,
  arts_and_design: /art|craft|photo|design|film|digital media|calligraphy/i,
  communication_and_media: /media|debat|journal|photo|film|broadcast|drama|literary/i,
  language_and_culture: /chinese|malay|tamil|culture|calligraphy|language|indian|wushu/i,
  leadership: /cadet|scout|guide|brigade|police|civil defence|ncc|npcc|ncdcc|red cross|leader/i,
  community_service: /red cross|st john|service|volunteer|interact|leo/i,
  global_exposure: /global|model united|international/i,
  enterprise: /enterprise|business|entrepreneur/i,
};

export const BAND = {
  ahead: { label: 'Better than both past cut-offs', short: 'Better than both' },
  mixed: { label: 'Close to past cut-offs', short: 'Close' },
  behind: { label: 'Past cut-offs were stricter', short: 'Stricter' },
  none: { label: 'No comparable cut-off', short: 'No comparison' },
  special: { label: 'Applies separately', short: 'Own admission' },
};

// ------------------------------------------------------------------ score and posting group

export function isAL(v) {
  return Number.isInteger(v) && v >= 1 && v <= 8;
}

export function totalAL(subjects) {
  if (!subjects) return null;
  const vals = ['el', 'math', 'sci', 'mt'].map(k => subjects[k]);
  return vals.every(isAL) ? vals.reduce((a, b) => a + b, 0) : null;
}

/**
 * The posting groups a score allows (MOE bands). el and math are the English and Maths ALs when known.
 * Returns { groups, choose, condition }: condition is 'met', 'not_met' or 'unknown' for AL 26-30, else null.
 */
export function postingGroups(al, el = null, math = null) {
  if (!Number.isInteger(al) || al < 4 || al > 30) return { groups: [], choose: false, condition: null, valid: false };
  if (al <= 20) return { groups: [3], choose: false, condition: null, valid: true };
  if (al <= 22) return { groups: [3, 2], choose: true, condition: null, valid: true };
  if (al <= 24) return { groups: [2], choose: false, condition: null, valid: true };
  if (al === 25) return { groups: [2, 1], choose: true, condition: null, valid: true };
  if (!isAL(el) || !isAL(math)) return { groups: [1], choose: false, condition: 'unknown', valid: true };
  const met = el <= 7 && math <= 7;
  return { groups: met ? [1] : [], choose: false, condition: met ? 'met' : 'not_met', valid: true };
}

export const PG_INFO = {
  3: { name: 'Posting Group 3', level: 'G3', text: 'You start most subjects at G3, the most demanding level.' },
  2: { name: 'Posting Group 2', level: 'G2', text: 'You start most subjects at G2. You can take some subjects at G3 if you did well in them.' },
  1: { name: 'Posting Group 1', level: 'G1', text: 'You start most subjects at G1, with smaller steps and more support. You can take some subjects at G2 or G3.' },
};

// ------------------------------------------------------------------ schools and choices

/** SAP schools need Chinese (or Higher Chinese) at PSLE. Unknown counts as fine; only a clear "no" rules them out. */
export function isSapOk(school, chinese) {
  return !school.sap || chinese !== 'no';
}

/** Whether a student could list this school at all: gender and SAP language. */
export function isEligible(school, student) {
  return isGenderOk(school, student.gender) && isSapOk(school, student.chinese);
}

/**
 * What each posting group a score allows would lead to: counts of choices by band, and whether any
 * IP choice is within reach (not stricter in both years). { [pg]: { ahead, mixed, behind, none, ipReachable } }
 */
export function groupPreview(schools, student, affiliations = []) {
  const out = {};
  for (const pg of student.groups?.groups || [student.pg]) {
    const counts = { ahead: 0, mixed: 0, behind: 0, none: 0, ipReachable: false };
    for (const c of allChoices(schools.filter(s => isEligible(s, student)), { ...student, pg }, affiliations)) {
      counts[c.cmp.band] += 1;
      if (c.option.prog === 'IP' && c.cmp.band !== 'behind' && c.cmp.band !== 'none') counts.ipReachable = true;
    }
    out[pg] = counts;
  }
  return out;
}

export function isGenderOk(school, gender) {
  if (!gender || school.gender === 'coed') return true;
  return (school.gender === 'boys' && gender === 'boy') || (school.gender === 'girls' && gender === 'girl');
}

export function isAffiliated(school, primaryId, affiliations) {
  if (!primaryId) return false;
  return affiliations.some(([p, s]) => p === primaryId && s === school.id);
}

/** The choices a student in posting group pg can list at this school: [{ key, prog, route, code }]. */
export function schoolOptions(school, pg) {
  if (!pg) return [];
  if (!school.ordinary) return [];
  const opts = [];
  const ip = school.cutoffs.find(c => c.route === 'IP');
  if (pg === 3 && ip) opts.push({ key: `${school.id}|IP`, prog: 'IP', route: 'IP', code: ip.code });
  const route = `PG${pg}`;
  const sec = school.cutoffs.find(c => c.prog === 'SEC' && c.route === route) || school.cutoffs.find(c => c.prog === 'SEC');
  const directPg1 = school.admission === 'direct_application_and_s1_posting';
  if (directPg1 ? pg === 1 : sec) opts.push({ key: `${school.id}|SEC`, prog: 'SEC', route, code: sec?.code ?? school.code });
  return opts;
}

function recordFor(school, route, year, affiliated) {
  const recs = school.cutoffs.filter(c => c.route === route && c.y === year);
  if (affiliated) {
    const aff = recs.find(c => c.aff && c.status !== 'affiliation_not_applicable');
    if (aff) return aff;
  }
  return recs.find(c => !c.aff) || null;
}

/**
 * Compare one student score with one historical record.
 * result: better | tie | worse | open (vacancies remained) | none_posted | missing
 */
export function compareYear(al, hcl, rec) {
  if (!rec) return { result: 'missing' };
  if (rec.status === 'vacancy_convention') return { result: 'open', rec };
  if (rec.status === 'no_students_posted') return { result: 'none_posted', rec };
  if (rec.status !== 'published_cutoff' || !Number.isInteger(rec.cop)) return { result: 'missing', rec };
  if (al < rec.cop) return { result: 'better', rec };
  if (al > rec.cop) return { result: 'worse', rec };
  if (rec.copHcl && al <= HCL_PRIORITY_MAX_AL) {
    const s = HCL_RANK[hcl];
    if (s === undefined) return { result: 'tie', rec, hclUnknown: true };
    const c = HCL_RANK[rec.copHcl];
    return { result: s > c ? 'better' : s === c ? 'tie' : 'worse', rec, hclDecided: true };
  }
  return { result: 'tie', rec };
}

/**
 * Compare a student with one choice at a school across both years.
 * Returns { band, years: {2024, 2025}, buffer, partial, open, affiliated }.
 * buffer = min(COP 2024, COP 2025) - AL when both years have a numeric published cut-off, else null.
 */
export function compareOption(school, option, student, affiliations = []) {
  const affiliated = isAffiliated(school, student.primaryId, affiliations);
  const years = {};
  for (const y of YEARS) years[y] = compareYear(student.al, student.hcl, recordFor(school, option.route, y, affiliated));
  const known = YEARS.map(y => years[y].result).filter(r => ['better', 'tie', 'worse', 'open'].includes(r));
  let band = 'none';
  if (known.length) {
    const good = known.filter(r => r === 'better' || r === 'open').length;
    const bad = known.filter(r => r === 'worse').length;
    band = good === known.length ? 'ahead' : bad === known.length ? 'behind' : 'mixed';
  }
  const numeric = YEARS.map(y => years[y].rec).filter(r => r && r.status === 'published_cutoff' && Number.isInteger(r.cop));
  const buffer = numeric.length === YEARS.length ? Math.min(...numeric.map(r => r.cop)) - student.al : null;
  return {
    band,
    years,
    buffer,
    partial: known.length === 1,
    open: known.includes('open'),
    affiliated: affiliated && YEARS.some(y => years[y].rec?.aff),
  };
}

/** Every choice a student could list, with its comparison: [{ school, option, cmp }]. */
export function allChoices(schools, student, affiliations) {
  const out = [];
  for (const school of schools) {
    for (const option of schoolOptions(school, student.pg)) {
      out.push({ school, option, cmp: compareOption(school, option, student, affiliations) });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the six choices

/**
 * Check an ordered list of choices against the posting rules and MOE's advice.
 * choices: [{ school, option, cmp }] in the student's order. Returns [{ level, id, text }].
 * level: error (breaks a rule), warn (worth fixing), ok, info.
 */
export function checkPlan(choices, student, affiliations = [], { available = null } = {}) {
  const out = [];
  const n = choices.length;
  if (n === 0) {
    out.push({ level: 'info', id: 'empty', text: 'Add schools from the list or a school page. You can list up to six.' });
    return out;
  }
  if (n > MAX_CHOICES) out.push({ level: 'error', id: 'too_many', text: `You have ${n} choices. You can submit up to ${MAX_CHOICES}.` });

  const seen = new Map();
  for (const c of choices) {
    const k = `${c.option.route}|${c.option.code}`;
    if (seen.has(k)) out.push({ level: 'error', id: 'duplicate', text: `${c.school.name} (${c.option.prog}) is listed twice.` });
    seen.set(k, true);
  }
  for (const c of choices) {
    if (!isGenderOk(c.school, student.gender)) {
      out.push({ level: 'error', id: 'gender', text: `${c.school.name} is a ${c.school.gender === 'boys' ? "boys'" : "girls'"} school.` });
    }
    if (!isSapOk(c.school, student.chinese)) {
      out.push({ level: 'error', id: 'sap', text: `${c.school.name} is a SAP school, which needs Chinese at PSLE.` });
    }
    if (c.option.route !== 'IP' && c.option.route !== `PG${student.pg}`) {
      out.push({ level: 'error', id: 'posting_group', text: `${c.school.name} was added for a different posting group. Remove it and add it again.` });
    }
  }

  // Affiliation counts only when the school is first (IP first, then SEC of the same school, also keeps it).
  const affiliatedIds = [...new Set(choices.filter(c => isAffiliated(c.school, student.primaryId, affiliations)).map(c => c.school.id))];
  for (const id of affiliatedIds) {
    // An IP choice first and the same school's SEC choice second keeps the SEC affiliation too.
    const sec = choices.findIndex(c => c.school.id === id && c.option.prog === 'SEC');
    const ok = choices[0].school.id === id && (sec <= 0 || (sec === 1 && choices[0].option.prog === 'IP'));
    const name = choices.find(c => c.school.id === id).school.name;
    out.push(ok
      ? { level: 'ok', id: 'affiliation', text: `${name} is first, so your affiliation counts.` }
      : { level: 'warn', id: 'affiliation', text: `Your affiliation to ${name} counts only if it is your first choice.` });
  }

  const ahead = choices.filter(c => c.cmp.band === 'ahead').length;
  const behind = choices.filter(c => c.cmp.band === 'behind').length;
  if (available === 0) {
    out.push({ level: 'warn', id: 'balance_none', text: `No school had past cut-offs less stringent than AL ${student.al} in Posting Group ${student.pg}, so every choice is a stretch.` });
  } else if (ahead >= 2) {
    out.push({ level: 'ok', id: 'balance', text: `${ahead} of your choices had past cut-offs less stringent than your score. MOE suggests two or three.` });
  } else {
    out.push({ level: 'warn', id: 'balance', text: `${ahead === 0 ? 'None' : 'Only one'} of your choices had past cut-offs less stringent than your score. MOE suggests including two or three.` });
  }
  if (behind === n) out.push({ level: 'warn', id: 'all_behind', text: 'Every choice had stricter past cut-offs than your score. If none of them can take you, you are posted to a school with places left.' });
  if (n < MAX_CHOICES && n > 0) out.push({ level: 'info', id: 'count', text: `You have ${n} of ${MAX_CHOICES}. Using all six helps, as long as you would be happy at each school.` });
  return out;
}

// ------------------------------------------------------------------ interests

/** How rare each interest tag is (0..1); a rare match says more than one every school shares. */
export function tagWeights(schools) {
  const counts = {};
  for (const s of schools) for (const t of s.tags) counts[t] = (counts[t] || 0) + 1;
  const w = {};
  for (const i of INTERESTS) w[i.id] = 1 - (counts[i.id] || 0) / schools.length + 0.15;
  return w;
}

export function interestMatches(school, interests) {
  return interests.filter(i => school.tags.includes(i));
}

export function interestScore(school, interests, weights) {
  return interestMatches(school, interests).reduce((sum, t) => sum + (weights[t] ?? 1), 0);
}

export function ccaMatchesInterest(cca, interests) {
  return interests.some(i => {
    if (i === 'sports') return cca.c === 'Physical sports';
    const re = CCA_HINTS[i];
    return re ? re.test(cca.n) : false;
  });
}

// ------------------------------------------------------------------ distance and travel

export function distanceKm(a, b) {
  const R = 6371;
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The next weekday at hh:mm in Singapore (UTC+8, no daylight saving), as a Date. */
export function nextSchoolMorning(now = new Date(), hh = 7, mm = 15) {
  const sg = new Date(now.getTime() + 8 * 3600e3);
  let y = sg.getUTCFullYear(), m = sg.getUTCMonth(), d = sg.getUTCDate() + 1;
  for (;;) {
    const day = new Date(Date.UTC(y, m, d)).getUTCDay();
    if (day !== 0 && day !== 6) break;
    d += 1;
  }
  return new Date(Date.UTC(y, m, d, hh - 8, mm));
}

export function googleMapsDirUrl(origin, school, mode = 'transit') {
  const p = new URLSearchParams({ api: '1', destination: `${school.name}, Singapore ${school.postal ?? ''}`.trim(), travelmode: mode });
  if (origin) p.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${p}`;
}

export function formatMinutes(min) {
  if (min == null) return '';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A cut-off as people read it: "20", "6 (M)" with a Higher Chinese grade, "30*" when vacancies remained. */
export function copText(rec) {
  if (!rec) return '—';
  if (rec.status === 'vacancy_convention') return `${rec.cop}*`;
  if (rec.status === 'no_students_posted') return 'none posted';
  if (rec.status !== 'published_cutoff' || rec.cop == null) return '—';
  return rec.copHcl ? `${rec.cop} (${rec.copHcl})` : String(rec.cop);
}
