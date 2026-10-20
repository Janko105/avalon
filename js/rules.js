// Čista logika igre Avalon – bez DOM-a, da bi mogla da se testira u Node-u.

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

export const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };

export const TEAM_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

export const ROLES = {
  merlin: {
    name: 'Merlin',
    team: 'good',
    desc: 'Znaš ko su zli. Pomozi dobrima, ali pazi – ako Ubica na kraju pogodi ko si, zli pobeđuju.',
  },
  persival: {
    name: 'Persival',
    team: 'good',
    desc: 'Znaš ko je Merlin. Čuvaj ga i ne otkrivaj ga zlima.',
  },
  loyal: {
    name: 'Lojalni sluga Artura',
    team: 'good',
    desc: 'Ne znaš ništa posebno. Prati igru i otkrij ko su izdajnici.',
  },
  assassin: {
    name: 'Ubica',
    team: 'evil',
    desc: 'Ako dobri osvoje 3 misije, ti biraš koga ubijaš. Pogodiš li Merlina – zli pobeđuju.',
  },
  morgana: {
    name: 'Morgana',
    team: 'evil',
    desc: 'Persival te vidi kao mogućeg Merlina. Pretvaraj se da si Merlin.',
  },
  mordred: {
    name: 'Mordred',
    team: 'evil',
    desc: 'Merlin te ne vidi. Iskoristi to.',
  },
  oberon: {
    name: 'Oberon',
    team: 'evil',
    desc: 'Ti ne znaš ostale zle, a ni oni tebe. Merlin te vidi.',
  },
  minion: {
    name: 'Mordredov sluga',
    team: 'evil',
    desc: 'Sabotiraj misije i ne daj se otkriti.',
  },
};

export const OPTIONAL_ROLES = ['merlin', 'persival', 'morgana', 'mordred', 'oberon'];

export function isEvil(role) {
  return ROLES[role].team === 'evil';
}

export function failsNeeded(playerCount, missionIndex) {
  return playerCount >= 7 && missionIndex === 3 ? 2 : 1;
}

// options: { merlin, persival, morgana, mordred, oberon } (boolean)
// Merlin automatski uključuje Ubicu.
export function buildRoleList(playerCount, options) {
  const evilCount = EVIL_COUNT[playerCount];
  const goodCount = playerCount - evilCount;
  const good = [];
  const evil = [];
  if (options.merlin) {
    good.push('merlin');
    evil.push('assassin');
  }
  if (options.persival) good.push('persival');
  if (options.morgana) evil.push('morgana');
  if (options.mordred) evil.push('mordred');
  if (options.oberon) evil.push('oberon');
  while (good.length < goodCount) good.push('loyal');
  while (evil.length < evilCount) evil.push('minion');
  return [...good, ...evil];
}

export function validateSetup(playerCount, options) {
  const errors = [];
  const warnings = [];
  if (!(playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS)) {
    errors.push(`Potrebno je ${MIN_PLAYERS}–${MAX_PLAYERS} igrača.`);
    return { ok: false, errors, warnings, good: 0, evil: 0 };
  }
  const evilCount = EVIL_COUNT[playerCount];
  const special = (options.merlin ? 1 : 0) + (options.morgana ? 1 : 0) +
    (options.mordred ? 1 : 0) + (options.oberon ? 1 : 0);
  if (special > evilCount) {
    errors.push(`Sa ${playerCount} igrača ima samo ${evilCount} zlih, a izabrano je ${special} zlih uloga` +
      (options.merlin ? ' (Merlin uvek dovodi Ubicu).' : '.'));
  }
  if (options.persival && !options.merlin) {
    errors.push('Persival nema smisla bez Merlina.');
  }
  if (options.morgana && !options.persival) {
    warnings.push('Morgana bez Persivala nema posebnu moć.');
  }
  return { ok: errors.length === 0, errors, warnings, good: playerCount - evilCount, evil: evilCount };
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Vraća niz uloga, po jedna za svakog igrača (isti redosled kao igrači).
export function assignRoles(playerCount, options, rng = Math.random) {
  return shuffle(buildRoleList(playerCount, options), rng);
}

// Šta igrač na poziciji `index` vidi tokom noći.
// Vraća { text, players: [indeksi], note }.
export function knowledge(roles, index) {
  const role = roles[index];
  const others = roles.map((r, i) => i).filter((i) => i !== index);
  const has = (r) => roles.includes(r);

  if (role === 'merlin') {
    return {
      text: 'Zli igrači:',
      players: others.filter((i) => isEvil(roles[i]) && roles[i] !== 'mordred'),
      note: has('mordred') ? 'Mordred je u igri i sakriven je od tebe.' : '',
    };
  }
  if (role === 'persival') {
    const seen = others.filter((i) => roles[i] === 'merlin' || roles[i] === 'morgana');
    return {
      text: has('morgana') ? 'Jedan od njih je Merlin, a drugi Morgana:' : 'Merlin je:',
      players: seen,
      note: '',
    };
  }
  if (role === 'oberon') {
    return { text: '', players: [], note: 'Ne znaš ko su ostali zli.' };
  }
  if (isEvil(role)) {
    return {
      text: 'Tvoji zli saveznici:',
      players: others.filter((i) => isEvil(roles[i]) && roles[i] !== 'oberon'),
      note: has('oberon') ? 'Oberon je u igri, ali ga ne vidiš.' : '',
    };
  }
  return { text: '', players: [], note: '' };
}

// votes: niz 'success' | 'fail'
export function missionOutcome(votes, playerCount, missionIndex) {
  const fails = votes.filter((v) => v === 'fail').length;
  return { fails, failed: fails >= failsNeeded(playerCount, missionIndex) };
}

// results: niz { failed } za odigrane misije
// Vraća 'ongoing' | 'good' (3 uspeha) | 'evil' (3 neuspeha)
export function missionsStatus(results) {
  const failed = results.filter((r) => r.failed).length;
  const passed = results.length - failed;
  if (failed >= 3) return 'evil';
  if (passed >= 3) return 'good';
  return 'ongoing';
}

// Gospa od Jezera se koristi posle 2., 3. i 4. misije (indeksi 1–3).
export function ladyAfterMission(missionIndex) {
  return missionIndex >= 1 && missionIndex <= 3;
}

export function ladyTargets(playerCount, pastHolders) {
  const out = [];
  for (let i = 0; i < playerCount; i++) if (!pastHolders.includes(i)) out.push(i);
  return out;
}
