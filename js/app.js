import * as R from './rules.js';

const STATE_KEY = 'avalon-state-v1';
const NAMES_KEY = 'avalon-players-v1';

const app = document.getElementById('app');
const header = document.getElementById('header');
const modalRoot = document.getElementById('modal');

let state = loadState() || freshState();

// ---------- Čuvanje ----------

function freshState() {
  return {
    screen: 'players',
    players: loadNames() || ['', '', '', '', ''],
    options: { merlin: true, persival: true, morgana: true, mordred: false, oberon: false, lady: false },
    error: '',
    game: null,
    modal: null,
  };
}

function loadNames() {
  try {
    const names = JSON.parse(localStorage.getItem(NAMES_KEY));
    return Array.isArray(names) && names.length ? names : null;
  } catch {
    return null;
  }
}

function saveNames() {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(state.players));
  } catch {}
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    if (!s || !s.screen) return null;
    // Stara verzija je Persivala čuvala kao 'percival'.
    if ('percival' in s.options) {
      s.options.persival = s.options.percival;
      delete s.options.percival;
    }
    if (s.game) s.game.roles = s.game.roles.map((r) => (r === 'percival' ? 'persival' : r));
    // Stara verzija nije pratila vođu.
    if (s.game && s.game.leader === undefined) {
      s.game.leader = 0;
      s.game.rejections = 0;
    }
    // Posle osvežavanja nikad ne prikazuj tajni ekran.
    if (s.game) {
      s.game.reveal.shown = false;
      s.game.vote.shown = false;
      s.game.vote.warn = false;
      if (s.game.lady) s.game.lady.shown = false;
      s.game.peek = { player: null, shown: false };
      if (s.screen === 'peek') s.screen = 'board';
    }
    s.modal = null;
    s.error = '';
    return s;
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {}
}

// ---------- Pomoćne ----------

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const name = (i) => esc(state.players[i]);
const count = () => state.players.length;

function teamLabel(role) {
  return R.isEvil(role) ? 'Zli – sluge Mordreda' : 'Dobri – vitezovi Artura';
}

function sideClass(role) {
  return R.isEvil(role) ? 'evil' : 'good';
}

function update(fn) {
  fn();
  saveState();
  render();
}

// ---------- Ekrani ----------

function passScreen({ who, eyebrow = 'Daj telefon igraču', sub = '', action, extra = '' }) {
  return `
    <section class="screen center pass">
      ${extra}
      <p class="eyebrow">${eyebrow}</p>
      <h1 class="big-name">${name(who)}</h1>
      ${sub ? `<p class="muted">${sub}</p>` : ''}
      <button class="btn primary" data-action="${action}">Ja sam ${name(who)} – prikaži</button>
      <p class="hint">Proveri da niko drugi ne gleda u ekran.</p>
    </section>`;
}

function roleCard(i) {
  const role = state.game.roles[i];
  const info = R.ROLES[role];
  const k = R.knowledge(state.game.roles, i);
  const seen = k.players.length
    ? `<ul class="seen">${k.players.map((p) => `<li>${name(p)}</li>`).join('')}</ul>`
    : '';
  return `
    <p class="eyebrow">${name(i)}, tvoja uloga je</p>
    <div class="role-card ${sideClass(role)}">
      <div class="role-sigil">${R.isEvil(role) ? '✦' : '⚜'}</div>
      <h1>${info.name}</h1>
      <p class="team-label">${teamLabel(role)}</p>
    </div>
    <p class="role-desc">${info.desc}</p>
    ${k.text || seen || k.note ? `
      <div class="knowledge">
        ${k.text ? `<p>${k.text}</p>` : ''}
        ${seen}
        ${k.note ? `<p class="muted small">${k.note}</p>` : ''}
      </div>` : ''}`;
}

function renderPlayers() {
  const n = count();
  return `
    <section class="screen">
      <h1>Igrači</h1>
      <p class="muted">Upiši imena redom kako sedite u krugu (${R.MIN_PLAYERS}–${R.MAX_PLAYERS} igrača).</p>
      <ol class="player-list">
        ${state.players.map((p, i) => `
          <li>
            <span class="num">${i + 1}</span>
            <input type="text" data-idx="${i}" value="${esc(p)}" placeholder="Ime igrača" maxlength="16" autocomplete="off" enterkeyhint="next">
            <button class="icon-btn" data-action="moveUp" data-idx="${i}" aria-label="Pomeri gore" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-action="removePlayer" data-idx="${i}" aria-label="Obriši" ${n <= R.MIN_PLAYERS ? 'disabled' : ''}>✕</button>
          </li>`).join('')}
      </ol>
      <button class="btn ghost" data-action="addPlayer" ${n >= R.MAX_PLAYERS ? 'disabled' : ''}>+ Dodaj igrača</button>
      ${state.error ? `<p class="error">${esc(state.error)}</p>` : ''}
      <div class="bottom">
        <button class="btn primary" data-action="toSetup">Dalje</button>
      </div>
    </section>`;
}

const ROLE_OPTIONS = [
  { key: 'merlin', label: 'Merlin + Ubica', hint: 'Merlin zna zle; Ubica na kraju pokušava da ga ubije.' },
  { key: 'persival', label: 'Persival', hint: 'Dobar. Vidi Merlina (i Morganu).' },
  { key: 'morgana', label: 'Morgana', hint: 'Zla. Persivalu izgleda kao Merlin.' },
  { key: 'mordred', label: 'Mordred', hint: 'Zli koga Merlin ne vidi.' },
  { key: 'oberon', label: 'Oberon', hint: 'Zli koji ne zna ostale zle, i oni ne znaju njega.' },
];

function renderSetup() {
  const n = count();
  const v = R.validateSetup(n, state.options);
  const lineup = v.ok ? R.buildRoleList(n, state.options) : [];
  const sizes = R.TEAM_SIZES[n];
  return `
    <section class="screen">
      <h1>Uloge</h1>
      <p class="muted">${n} igrača: <b class="good-text">${v.good} dobrih</b> i <b class="evil-text">${v.evil} zlih</b>.</p>
      <div class="options">
        ${ROLE_OPTIONS.map((o) => `
          <label class="option">
            <input type="checkbox" data-option="${o.key}" ${state.options[o.key] ? 'checked' : ''}>
            <span><b>${o.label}</b><small>${o.hint}</small></span>
          </label>`).join('')}
        <label class="option">
          <input type="checkbox" data-option="lady" ${state.options.lady ? 'checked' : ''}>
          <span><b>Gospa od Jezera</b><small>Posle 2., 3. i 4. misije držalac tajno proverava nečiju lojalnost.${n < 7 ? ' Preporučeno za 7+ igrača.' : ''}</small></span>
        </label>
      </div>
      ${v.errors.map((e) => `<p class="error">${esc(e)}</p>`).join('')}
      ${v.warnings.map((w) => `<p class="warning">${esc(w)}</p>`).join('')}
      ${lineup.length ? `
        <div class="lineup">
          ${lineup.map((r) => `<span class="chip ${sideClass(r)}">${R.ROLES[r].name}</span>`).join('')}
        </div>` : ''}
      <p class="muted small">Misije: ${sizes.map((s, i) => `${s}${R.failsNeeded(n, i) > 1 ? '*' : ''}`).join(' · ')}${n >= 7 ? ' &nbsp;(* treba 2 „Pada”)' : ''}</p>
      <div class="bottom row">
        <button class="btn ghost" data-action="toPlayers">Nazad</button>
        <button class="btn primary" data-action="startGame" ${v.ok ? '' : 'disabled'}>Podeli uloge</button>
      </div>
    </section>`;
}

function renderReveal() {
  const g = state.game;
  const i = g.reveal.index;
  if (!g.reveal.shown) {
    return passScreen({
      who: i,
      sub: `Podela uloga · ${i + 1} od ${count()}`,
      action: 'revealShow',
    });
  }
  return `
    <section class="screen center secret">
      ${roleCard(i)}
      <div class="bottom">
        <button class="btn primary" data-action="revealHide">Sakrij i dodaj dalje</button>
      </div>
    </section>`;
}

function renderLeader() {
  return `
    <section class="screen">
      <h1>Ko prvi bira tim?</h1>
      <p class="muted">Svi su videli uloge. Izaberi prvog vođu – posle njega vođa ide redom kako sedite.</p>
      <div class="pick-list">
        ${state.players.map((p, i) => `<button class="pick" data-action="pickLeader" data-idx="${i}">${esc(p)}</button>`).join('')}
      </div>
      <div class="bottom">
        <button class="btn ghost" data-action="randomLeader">Nasumično</button>
      </div>
    </section>`;
}

function rejectionDots() {
  const k = state.game.rejections;
  return `
    <div class="rejections">
      <span class="muted small">Neizglasani timovi zaredom</span>
      <span class="dots">${Array.from({ length: R.MAX_REJECTIONS }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span>
    </div>`;
}

function missionTrack() {
  const g = state.game;
  const n = count();
  return `
    <div class="track">
      ${R.TEAM_SIZES[n].map((size, i) => {
        const r = g.results[i];
        const cls = r ? (r.failed ? 'fail' : 'success') : i === g.mission ? 'current' : '';
        const two = R.failsNeeded(n, i) > 1;
        return `
          <div class="mission ${cls}">
            <span class="size">${r ? (r.failed ? '✕' : '✓') : size}</span>
            <span class="label">${i + 1}. misija</span>
            ${two ? '<span class="two">2 pada</span>' : ''}
          </div>`;
      }).join('')}
    </div>`;
}

function renderBoard() {
  const g = state.game;
  const size = R.TEAM_SIZES[count()][g.mission];
  const passed = g.results.filter((r) => !r.failed).length;
  const failed = g.results.length - passed;
  return `
    <section class="screen">
      <h1>Misija ${g.mission + 1}</h1>
      ${missionTrack()}
      <p class="score"><span class="good-text">Uspešne: ${passed}</span> · <span class="evil-text">Pale: ${failed}</span></p>
      <div class="leader-line">
        <span class="eyebrow">Vođa</span>
        <b>${name(g.leader)}</b>
        <span class="muted small">predlaže tim od ${size} igrača</span>
      </div>
      ${rejectionDots()}
      ${g.lady ? `<p class="lady-line">Gospa od Jezera: <b>${name(g.lady.holder)}</b></p>` : ''}
      ${g.results.length ? `
        <div class="history">
          ${g.results.map((r, i) => `
            <p><b>${i + 1}.</b> ${r.team.map(name).join(', ')} – <span class="${r.failed ? 'evil-text' : 'good-text'}">${r.failed ? 'pala' : 'uspela'}</span> (${r.fails} „Pada”)${r.leader !== undefined ? ` · vođa ${name(r.leader)}` : ''}</p>`).join('')}
        </div>` : ''}
      <div class="bottom">
        <button class="btn primary" data-action="toTeam">Tim izglasan – izaberi igrače</button>
        <button class="btn ghost" data-action="askReject">Tim nije izglasan</button>
      </div>
    </section>`;
}

function renderTeam() {
  const g = state.game;
  const size = R.TEAM_SIZES[count()][g.mission];
  const picked = g.team.length;
  return `
    <section class="screen">
      <h1>Tim za misiju ${g.mission + 1}</h1>
      <p class="muted">Vođa <b>${name(g.leader)}</b> – izaberi tačno ${size} igrača. Izabrano: <b>${picked}/${size}</b></p>
      ${R.failsNeeded(count(), g.mission) > 1 ? '<p class="warning">Ova misija pada tek sa 2 „Pada”.</p>' : ''}
      <div class="pick-list">
        ${state.players.map((p, i) => `
          <button class="pick ${g.team.includes(i) ? 'on' : ''}" data-action="toggleTeam" data-idx="${i}">${esc(p)}</button>`).join('')}
      </div>
      <div class="bottom row">
        <button class="btn ghost" data-action="toBoard">Nazad</button>
        <button class="btn primary" data-action="sendTeam" ${picked === size ? '' : 'disabled'}>Pošalji na misiju</button>
      </div>
    </section>`;
}

function renderVote() {
  const g = state.game;
  const v = g.vote;
  const who = g.team[v.index];
  if (!v.shown) {
    const extra = v.index > 0 ? '<p class="recorded">✓ Glas je zabeležen</p>' : '';
    const change = v.index === 0
      ? '<button class="btn link" data-action="changeTeam">Promeni tim</button>'
      : '';
    return passScreen({
      who,
      eyebrow: `Misija ${g.mission + 1} · daj telefon članu tima`,
      sub: `Glasanje ${v.index + 1} od ${g.team.length}`,
      action: 'voteShow',
      extra,
    }).replace('</section>', `${change}</section>`);
  }
  return `
    <section class="screen center secret">
      <p class="eyebrow">${name(who)}, tajni glas za misiju ${g.mission + 1}</p>
      <h1>Kako glasaš?</h1>
      <div class="vote-buttons">
        <button class="vote" data-action="vote" data-value="success">Prolazi</button>
        <button class="vote" data-action="vote" data-value="fail">Pada</button>
      </div>
      ${v.warn ? '<p class="warning">Lojalni vitezovi Artura uvek glasaju „Prolazi”.</p>' : ''}
    </section>`;
}

function renderResult() {
  const g = state.game;
  const res = g.result;
  const r = g.results[g.results.length - 1];
  const done = res.flipped >= res.cards.length;
  return `
    <section class="screen center">
      <p class="eyebrow">Misija ${g.results.length}</p>
      <h1>${done ? (r.failed ? 'Misija je pala' : 'Misija je uspela') : 'Rezultat misije'}</h1>
      <p class="muted">Stavi telefon na sto da svi vide.</p>
      <div class="cards">
        ${res.cards.map((c, i) => `
          <div class="card ${i < res.flipped ? 'flipped ' + c : ''}">
            <div class="face back">?</div>
            <div class="face front">${c === 'fail' ? 'Pada' : 'Prolazi'}</div>
          </div>`).join('')}
      </div>
      ${done ? `<p class="verdict ${r.failed ? 'evil-text' : 'good-text'}">${r.fails} × „Pada”${R.failsNeeded(count(), g.results.length - 1) > 1 ? ' (potrebno 2)' : ''}</p>` : ''}
      <div class="bottom">
        ${done
          ? '<button class="btn primary" data-action="afterResult">Dalje</button>'
          : '<button class="btn primary" data-action="flipCard">Otkrij kartu</button>'}
      </div>
    </section>`;
}

function renderLady() {
  const g = state.game;
  const l = g.lady;
  if (!l.shown) {
    return passScreen({
      who: l.holder,
      eyebrow: 'Gospa od Jezera · daj telefon igraču',
      sub: l.target === null ? 'Izaberi koga proveravaš.' : `Provera igrača ${name(l.target)}.`,
      action: 'ladyShow',
    });
  }
  if (l.target === null) {
    const targets = R.ladyTargets(count(), l.past);
    return `
      <section class="screen">
        <h1>Gospa od Jezera</h1>
        <p class="muted">${name(l.holder)}, čiju lojalnost proveravaš? Gospa zatim prelazi kod tog igrača.</p>
        <div class="pick-list">
          ${targets.map((i) => `<button class="pick" data-action="ladyPick" data-idx="${i}">${name(i)}</button>`).join('')}
        </div>
      </section>`;
  }
  const evil = R.isEvil(g.roles[l.target]);
  return `
    <section class="screen center secret">
      <p class="eyebrow">Gospa od Jezera otkriva</p>
      <h1 class="big-name">${name(l.target)}</h1>
      <div class="role-card ${evil ? 'evil' : 'good'}">
        <div class="role-sigil">${evil ? '✦' : '⚜'}</div>
        <h1>${evil ? 'Zao' : 'Dobar'}</h1>
      </div>
      <div class="bottom">
        <button class="btn primary" data-action="ladyDone">Sakrij</button>
      </div>
    </section>`;
}

function renderAssassin() {
  const g = state.game;
  const assassin = g.roles.indexOf('assassin');
  const evil = g.roles.map((_, i) => i).filter((i) => R.isEvil(g.roles[i]));
  const good = g.roles.map((_, i) => i).filter((i) => !R.isEvil(g.roles[i]));
  const t = g.assassinTarget;
  return `
    <section class="screen">
      <h1>Dobri su osvojili 3 misije!</h1>
      <p class="muted">Ali zli imaju još jednu šansu. Zli se otkrivaju i dogovaraju naglas ko je Merlin.</p>
      <p>Zli: ${evil.map((i) => `<b class="evil-text">${name(i)}</b>`).join(', ')}</p>
      <p>Ubica: <b class="evil-text">${name(assassin)}</b> – izaberi koga ubijaš.</p>
      <div class="pick-list">
        ${good.map((i) => `<button class="pick ${t === i ? 'on evil' : ''}" data-action="assassinPick" data-idx="${i}">${name(i)}</button>`).join('')}
      </div>
      <div class="bottom">
        <button class="btn danger" data-action="assassinConfirm" ${t === null ? 'disabled' : ''}>${t === null ? 'Izaberi metu' : `Ubij: ${name(t)}`}</button>
      </div>
    </section>`;
}

function renderEnd() {
  const g = state.game;
  const goodWon = g.winner === 'good';
  return `
    <section class="screen">
      <div class="banner ${goodWon ? 'good' : 'evil'}">
        <p class="eyebrow">Kraj igre</p>
        <h1>${goodWon ? 'Dobri pobeđuju!' : 'Zli pobeđuju!'}</h1>
        <p>${esc(g.reason)}</p>
      </div>
      ${missionTrack()}
      <h2>Uloge</h2>
      <ul class="roles-list">
        ${g.roles.map((r, i) => `
          <li class="${sideClass(r)}"><span>${name(i)}</span><b>${R.ROLES[r].name}</b></li>`).join('')}
      </ul>
      <div class="bottom">
        <button class="btn primary" data-action="newGame">Nova partija (isti igrači)</button>
        <button class="btn ghost" data-action="newPlayers">Promeni igrače</button>
      </div>
    </section>`;
}

function renderPeek() {
  const p = state.game.peek;
  if (p.player === null) {
    return `
      <section class="screen">
        <h1>Podseti me na ulogu</h1>
        <p class="muted">Ko želi ponovo da vidi svoju ulogu?</p>
        <div class="pick-list">
          ${state.players.map((pl, i) => `<button class="pick" data-action="peekPick" data-idx="${i}">${esc(pl)}</button>`).join('')}
        </div>
        <div class="bottom">
          <button class="btn ghost" data-action="toBoard">Nazad</button>
        </div>
      </section>`;
  }
  if (!p.shown) return passScreen({ who: p.player, action: 'peekShow' });
  return `
    <section class="screen center secret">
      ${roleCard(p.player)}
      <div class="bottom">
        <button class="btn primary" data-action="toBoard">Sakrij</button>
      </div>
    </section>`;
}

function renderModal() {
  if (!state.modal) return '';
  if (state.modal === 'reject') return renderRejectModal();
  if (state.modal === 'menu') {
    return `
      <div class="overlay" data-action="closeModal">
        <div class="dialog" data-stop>
          <h2>Meni</h2>
          ${state.screen === 'board' ? '<button class="btn ghost" data-action="openPeek">Podseti me na ulogu</button>' : ''}
          <button class="btn danger" data-action="askAbort">Prekini partiju</button>
          <button class="btn ghost" data-action="closeModal">Zatvori</button>
        </div>
      </div>`;
  }
  return `
    <div class="overlay" data-action="closeModal">
      <div class="dialog" data-stop>
        <h2>Prekinuti partiju?</h2>
        <p class="muted">Trenutna igra će biti izgubljena.</p>
        <button class="btn danger" data-action="abort">Da, prekini</button>
        <button class="btn ghost" data-action="closeModal">Ne, nastavi</button>
      </div>
    </div>`;
}

function renderRejectModal() {
  const g = state.game;
  const k = g.rejections + 1;
  const last = k >= R.MAX_REJECTIONS;
  return `
    <div class="overlay" data-action="closeModal">
      <div class="dialog" data-stop>
        <h2>Tim nije izglasan?</h2>
        ${last
          ? `<p class="warning">Ovo je ${R.MAX_REJECTIONS}. neizglasan tim zaredom – zli pobeđuju.</p>`
          : `<p class="muted">Vođa prelazi na <b>${name(R.nextLeader(g.leader, count()))}</b>. Neizglasanih zaredom: ${k}/${R.MAX_REJECTIONS}.</p>`}
        <button class="btn danger" data-action="rejectTeam">Da, tim nije izglasan</button>
        <button class="btn ghost" data-action="closeModal">Otkaži</button>
      </div>
    </div>`;
}

const SCREENS = {
  players: renderPlayers,
  setup: renderSetup,
  reveal: renderReveal,
  leader: renderLeader,
  board: renderBoard,
  team: renderTeam,
  vote: renderVote,
  result: renderResult,
  lady: renderLady,
  assassin: renderAssassin,
  end: renderEnd,
  peek: renderPeek,
};

function render() {
  const inGame = state.game && state.screen !== 'end';
  header.innerHTML = `
    <span class="logo">Avalon</span>
    ${inGame ? '<button class="icon-btn menu" data-action="openMenu" aria-label="Meni">☰</button>' : ''}`;
  app.innerHTML = SCREENS[state.screen]();
  modalRoot.innerHTML = renderModal();
  window.scrollTo(0, 0);
}

// ---------- Akcije ----------

function finishGame(winner, reason) {
  state.game.winner = winner;
  state.game.reason = reason;
  state.screen = 'end';
}

const actions = {
  addPlayer() {
    update(() => {
      if (count() < R.MAX_PLAYERS) state.players.push('');
      saveNames();
    });
    const inputs = app.querySelectorAll('input[data-idx]');
    inputs[inputs.length - 1]?.focus();
  },
  removePlayer({ idx }) {
    update(() => {
      if (count() > R.MIN_PLAYERS) state.players.splice(+idx, 1);
      saveNames();
    });
  },
  moveUp({ idx }) {
    const i = +idx;
    update(() => {
      [state.players[i - 1], state.players[i]] = [state.players[i], state.players[i - 1]];
      saveNames();
    });
  },
  toSetup() {
    update(() => {
      state.players = state.players.map((p) => p.trim());
      const names = state.players;
      const lower = names.map((p) => p.toLowerCase());
      if (names.some((p) => !p)) state.error = 'Svaki igrač mora imati ime.';
      else if (new Set(lower).size !== names.length) state.error = 'Imena moraju biti različita.';
      else if (names.length < R.MIN_PLAYERS || names.length > R.MAX_PLAYERS) state.error = `Potrebno je ${R.MIN_PLAYERS}–${R.MAX_PLAYERS} igrača.`;
      else {
        state.error = '';
        state.screen = 'setup';
      }
      saveNames();
    });
  },
  toPlayers() {
    update(() => (state.screen = 'players'));
  },
  startGame() {
    if (!R.validateSetup(count(), state.options).ok) return;
    update(() => {
      state.game = {
        roles: R.assignRoles(count(), state.options),
        results: [],
        mission: 0,
        leader: 0,
        rejections: 0,
        reveal: { index: 0, shown: false },
        team: [],
        vote: { index: 0, shown: false, warn: false, votes: [] },
        result: null,
        // Držalac Gospe se određuje kad se izabere prvi vođa.
        lady: state.options.lady ? { holder: 0, past: [], target: null, shown: false } : null,
        assassinTarget: null,
        peek: { player: null, shown: false },
        winner: null,
        reason: '',
      };
      state.screen = 'reveal';
    });
  },
  revealShow() {
    update(() => (state.game.reveal.shown = true));
  },
  revealHide() {
    update(() => {
      const r = state.game.reveal;
      r.shown = false;
      r.index++;
      if (r.index >= count()) state.screen = 'leader';
    });
  },
  pickLeader({ idx }) {
    update(() => {
      const g = state.game;
      g.leader = +idx;
      if (g.lady) {
        g.lady.holder = R.ladyStartHolder(g.leader, count());
        g.lady.past = [g.lady.holder];
      }
      state.screen = 'board';
    });
  },
  randomLeader() {
    actions.pickLeader({ idx: Math.floor(Math.random() * count()) });
  },
  askReject() {
    update(() => (state.modal = 'reject'));
  },
  rejectTeam() {
    update(() => {
      const g = state.game;
      state.modal = null;
      g.team = [];
      g.rejections++;
      if (g.rejections >= R.MAX_REJECTIONS) {
        finishGame('evil', `${R.MAX_REJECTIONS} timova zaredom nije izglasano.`);
        return;
      }
      g.leader = R.nextLeader(g.leader, count());
      state.screen = 'board';
    });
  },
  toBoard() {
    update(() => {
      state.game.peek = { player: null, shown: false };
      state.screen = 'board';
    });
  },
  toTeam() {
    update(() => {
      state.game.team = [];
      state.screen = 'team';
    });
  },
  toggleTeam({ idx }) {
    const i = +idx;
    const g = state.game;
    const size = R.TEAM_SIZES[count()][g.mission];
    update(() => {
      if (g.team.includes(i)) g.team = g.team.filter((x) => x !== i);
      else if (g.team.length < size) g.team.push(i);
    });
  },
  sendTeam() {
    update(() => {
      state.game.team.sort((a, b) => a - b);
      state.game.vote = { index: 0, shown: false, warn: false, votes: [] };
      state.screen = 'vote';
    });
  },
  changeTeam() {
    update(() => (state.screen = 'team'));
  },
  voteShow() {
    update(() => (state.game.vote.shown = true));
  },
  vote({ value }) {
    const g = state.game;
    const v = g.vote;
    const who = g.team[v.index];
    if (value === 'fail' && !R.isEvil(g.roles[who])) {
      update(() => (v.warn = true));
      return;
    }
    update(() => {
      v.votes.push(value);
      v.index++;
      v.shown = false;
      v.warn = false;
      if (v.index >= g.team.length) {
        const out = R.missionOutcome(v.votes, count(), g.mission);
        g.results.push({ team: g.team.slice(), fails: out.fails, failed: out.failed, leader: g.leader });
        g.result = { cards: R.shuffle(v.votes), flipped: 0 };
        v.votes = [];
        state.screen = 'result';
      }
    });
  },
  flipCard() {
    update(() => state.game.result.flipped++);
  },
  afterResult() {
    update(() => {
      const g = state.game;
      const finished = g.mission;
      const status = R.missionsStatus(g.results);
      g.team = [];
      g.leader = R.nextLeader(g.leader, count());
      g.rejections = 0;
      if (status === 'evil') return finishGame('evil', 'Tri misije su pale.');
      if (status === 'good') {
        if (g.roles.includes('merlin')) {
          g.assassinTarget = null;
          state.screen = 'assassin';
        } else {
          finishGame('good', 'Tri misije su uspele.');
        }
        return;
      }
      g.mission++;
      if (g.lady && R.ladyAfterMission(finished)) {
        g.lady.target = null;
        g.lady.shown = false;
        state.screen = 'lady';
      } else {
        state.screen = 'board';
      }
    });
  },
  ladyShow() {
    update(() => (state.game.lady.shown = true));
  },
  ladyPick({ idx }) {
    update(() => (state.game.lady.target = +idx));
  },
  ladyDone() {
    update(() => {
      const l = state.game.lady;
      l.past.push(l.target);
      l.holder = l.target;
      l.target = null;
      l.shown = false;
      state.screen = 'board';
    });
  },
  assassinPick({ idx }) {
    update(() => (state.game.assassinTarget = +idx));
  },
  assassinConfirm() {
    const g = state.game;
    if (g.assassinTarget === null) return;
    update(() => {
      const t = g.assassinTarget;
      if (g.roles[t] === 'merlin') finishGame('evil', `Ubica je ubio Merlina (${state.players[t]}).`);
      else finishGame('good', `Ubica je promašio – ${state.players[t]} nije Merlin.`);
    });
  },
  newGame() {
    update(() => {
      state.game = null;
      state.screen = 'setup';
    });
  },
  newPlayers() {
    update(() => {
      state.game = null;
      state.screen = 'players';
    });
  },
  openMenu() {
    update(() => (state.modal = 'menu'));
  },
  closeModal() {
    update(() => (state.modal = null));
  },
  askAbort() {
    update(() => (state.modal = 'abort'));
  },
  abort() {
    update(() => {
      state.modal = null;
      state.game = null;
      state.screen = 'setup';
    });
  },
  openPeek() {
    update(() => {
      state.modal = null;
      state.game.peek = { player: null, shown: false };
      state.screen = 'peek';
    });
  },
  peekPick({ idx }) {
    update(() => (state.game.peek.player = +idx));
  },
  peekShow() {
    update(() => (state.game.peek.shown = true));
  },
};

// ---------- Događaji ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-stop]');
  if (!el || el.hasAttribute('data-stop') || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el.dataset);
});

app.addEventListener('input', (e) => {
  const idx = e.target.dataset.idx;
  if (idx !== undefined && state.screen === 'players') {
    state.players[+idx] = e.target.value;
    saveNames();
    saveState();
  }
});

app.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || state.screen !== 'players') return;
  const inputs = [...app.querySelectorAll('input[data-idx]')];
  const next = inputs[inputs.indexOf(e.target) + 1];
  if (next) next.focus();
  else e.target.blur();
});

app.addEventListener('change', (e) => {
  const key = e.target.dataset.option;
  if (key) update(() => (state.options[key] = e.target.checked));
});

render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
