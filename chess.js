/* ============================================================
   对弈 · 国际象棋
   引擎(规则/AI) + 界面 全部在本文件
   ============================================================ */

/* ---------------- 常量 ---------------- */
const W = 'w', B = 'b';
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const NAME  = { p: '兵', n: '马', b: '象', r: '车', q: '后', k: '王' };
const VAL   = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const KNIGHT_D = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_D   = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_D = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_D   = [[-1,0],[1,0],[0,-1],[0,1]];

const sq = (r, c) => r * 8 + c;
const rowOf = i => i >> 3;
const colOf = i => i & 7;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = c => (c === W ? B : W);
const sqName = i => 'abcdefgh'[colOf(i)] + (8 - rowOf(i));

/* ---------------- 局面 ---------------- */
function initialBoard() {
  const back = ['r','n','b','q','k','b','n','r'];
  const bd = new Array(64).fill(null);
  let id = 0;
  for (let c = 0; c < 8; c++) {
    bd[sq(0,c)] = { id: ++id, color: B, type: back[c] };
    bd[sq(1,c)] = { id: ++id, color: B, type: 'p' };
    bd[sq(6,c)] = { id: ++id, color: W, type: 'p' };
    bd[sq(7,c)] = { id: ++id, color: W, type: back[c] };
  }
  return bd;
}
function initialState() {
  return { turn: W, cast: { w: { k: true, q: true }, b: { k: true, q: true } },
           ep: -1, half: 0, full: 1 };
}
const cloneBd = bd => bd.map(p => (p ? { ...p } : null));
const cloneSt = st => ({ turn: st.turn, cast: { w: { ...st.cast.w }, b: { ...st.cast.b } },
                        ep: st.ep, half: st.half, full: st.full });

/* ---------------- 攻击判断 ---------------- */
function isAttacked(bd, t, by) {
  const r = rowOf(t), c = colOf(t);
  // 兵
  const pr = by === W ? r + 1 : r - 1;
  if (inside(pr, c - 1)) { const p = bd[sq(pr, c - 1)]; if (p && p.color === by && p.type === 'p') return true; }
  if (inside(pr, c + 1)) { const p = bd[sq(pr, c + 1)]; if (p && p.color === by && p.type === 'p') return true; }
  // 马
  for (const [dr, dc] of KNIGHT_D) {
    const rr = r + dr, cc = c + dc;
    if (!inside(rr, cc)) continue;
    const p = bd[sq(rr, cc)];
    if (p && p.color === by && p.type === 'n') return true;
  }
  // 王
  for (const [dr, dc] of KING_D) {
    const rr = r + dr, cc = c + dc;
    if (!inside(rr, cc)) continue;
    const p = bd[sq(rr, cc)];
    if (p && p.color === by && p.type === 'k') return true;
  }
  // 斜线（象/后）
  for (const [dr, dc] of BISHOP_D) {
    let rr = r + dr, cc = c + dc;
    while (inside(rr, cc)) {
      const p = bd[sq(rr, cc)];
      if (p) { if (p.color === by && (p.type === 'b' || p.type === 'q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  // 直线（车/后）
  for (const [dr, dc] of ROOK_D) {
    let rr = r + dr, cc = c + dc;
    while (inside(rr, cc)) {
      const p = bd[sq(rr, cc)];
      if (p) { if (p.color === by && (p.type === 'r' || p.type === 'q')) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}
function kingSq(bd, color) {
  for (let i = 0; i < 64; i++) { const p = bd[i]; if (p && p.color === color && p.type === 'k') return i; }
  return -1;
}
const inCheck = (bd, st, color) => isAttacked(bd, kingSq(bd, color), other(color));

/* ---------------- 伪合法着法 ---------------- */
function genPseudo(bd, st, color) {
  const ms = [];
  const push = (from, to, extra) => ms.push(Object.assign({ from, to }, extra || {}));
  for (let i = 0; i < 64; i++) {
    const p = bd[i];
    if (!p || p.color !== color) continue;
    const r = rowOf(i), c = colOf(i);

    if (p.type === 'p') {
      const dir = color === W ? -1 : 1;
      const startR = color === W ? 6 : 1;
      const promoR = color === W ? 0 : 7;
      const r1 = r + dir;
      if (inside(r1, c) && !bd[sq(r1, c)]) {
        if (r1 === promoR) for (const q of ['q','r','b','n']) push(i, sq(r1, c), { promo: q });
        else {
          push(i, sq(r1, c));
          const r2 = r + dir * 2;
          if (r === startR && !bd[sq(r2, c)]) push(i, sq(r2, c), { double: true });
        }
      }
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (!inside(r1, cc)) continue;
        const t = sq(r1, cc);
        const tp = bd[t];
        if (tp && tp.color !== color) {
          if (r1 === promoR) for (const q of ['q','r','b','n']) push(i, t, { promo: q });
          else push(i, t);
        } else if (t === st.ep) {
          push(i, t, { ep: true });
        }
      }
    } else if (p.type === 'n' || p.type === 'k') {
      const ds = p.type === 'n' ? KNIGHT_D : KING_D;
      for (const [dr, dc] of ds) {
        const rr = r + dr, cc = c + dc;
        if (!inside(rr, cc)) continue;
        const t = sq(rr, cc), tp = bd[t];
        if (!tp || tp.color !== color) push(i, t);
      }
      // 王车易位
      if (p.type === 'k') {
        const opp = other(color);
        const home = color === W ? 60 : 4;
        if (i === home && !isAttacked(bd, home, opp)) {
          const ks = color === W ? st.cast.w.k : st.cast.b.k;
          const qs = color === W ? st.cast.w.q : st.cast.b.q;
          if (ks && !bd[home+1] && !bd[home+2] &&
              bd[home+3] && bd[home+3].type === 'r' && bd[home+3].color === color &&
              !isAttacked(bd, home+1, opp) && !isAttacked(bd, home+2, opp))
            push(home, home+2, { castle: 'K' });
          if (qs && !bd[home-1] && !bd[home-2] && !bd[home-3] &&
              bd[home-4] && bd[home-4].type === 'r' && bd[home-4].color === color &&
              !isAttacked(bd, home-1, opp) && !isAttacked(bd, home-2, opp))
            push(home, home-2, { castle: 'Q' });
        }
      }
    } else {
      const ds = p.type === 'b' ? BISHOP_D : p.type === 'r' ? ROOK_D : BISHOP_D.concat(ROOK_D);
      for (const [dr, dc] of ds) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          const t = sq(rr, cc), tp = bd[t];
          if (!tp) push(i, t);
          else { if (tp.color !== color) push(i, t); break; }
          rr += dr; cc += dc;
        }
      }
    }
  }
  return ms;
}

/* ---------------- 执行 / 撤销着法（原地修改） ---------------- */
function applyMove(bd, st, m) {
  const u = { cap: null, capSq: -1, ep: st.ep,
              cast: { w: { ...st.cast.w }, b: { ...st.cast.b } },
              half: st.half, full: st.full };
  const p = bd[m.from];
  bd[m.from] = null;

  if (m.ep) {
    const cs = m.to + (p.color === W ? 8 : -8);
    u.cap = bd[cs]; u.capSq = cs; bd[cs] = null;
  } else if (bd[m.to]) {
    u.cap = bd[m.to]; u.capSq = m.to;
  }
  bd[m.to] = m.promo ? { id: p.id, color: p.color, type: m.promo } : p;

  if (m.castle === 'K') { bd[m.to - 1] = bd[m.to + 1]; bd[m.to + 1] = null; }
  if (m.castle === 'Q') { bd[m.to + 1] = bd[m.to - 2]; bd[m.to - 2] = null; }

  // 易位权
  if (p.type === 'k') { st.cast[p.color].k = false; st.cast[p.color].q = false; }
  const rookStart = { '63': ['w','k'], '56': ['w','q'], '7': ['b','k'], '0': ['b','q'] };
  if (rookStart[m.from]) { const [cc, side] = rookStart[m.from]; st.cast[cc][side] = false; }
  if (u.capSq >= 0 && rookStart[u.capSq]) { const [cc, side] = rookStart[u.capSq]; st.cast[cc][side] = false; }

  st.ep = m.double ? m.from + (p.color === W ? -8 : 8) : -1;
  st.half = (p.type === 'p' || u.cap) ? 0 : st.half + 1;
  if (st.turn === B) st.full++;
  st.turn = other(st.turn);
  return u;
}
function unapplyMove(bd, st, m, u) {
  st.turn = other(st.turn);
  if (st.turn === B) st.full--;
  st.half = u.half; st.ep = u.ep; st.cast = u.cast;

  let p = bd[m.to];
  if (m.promo) p = { id: p.id, color: p.color, type: 'p' };
  bd[m.to] = null;
  bd[m.from] = p;

  if (u.capSq >= 0) bd[u.capSq] = u.cap;
  if (m.castle === 'K') { bd[m.to + 1] = bd[m.to - 1]; bd[m.to - 1] = null; }
  if (m.castle === 'Q') { bd[m.to - 2] = bd[m.to + 1]; bd[m.to + 1] = null; }
}

/* ---------------- 合法着法 ---------------- */
function legalMoves(bd, st, color) {
  color = color || st.turn;
  const out = [];
  for (const m of genPseudo(bd, st, color)) {
    const u = applyMove(bd, st, m);
    if (!isAttacked(bd, kingSq(bd, color), other(color))) out.push(m);
    unapplyMove(bd, st, m, u);
  }
  return out;
}

/* ---------------- SAN 记录 ---------------- */
function toSan(bd, st, m) {
  const p = bd[m.from];
  let s;
  if (m.castle === 'K') s = 'O-O';
  else if (m.castle === 'Q') s = 'O-O-O';
  else {
    const isCap = !!bd[m.to] || !!m.ep;
    if (p.type === 'p') {
      s = (isCap ? 'abcdefgh'[colOf(m.from)] + 'x' : '') + sqName(m.to);
      if (m.promo) s += '=' + m.promo.toUpperCase();
    } else {
      // 消歧
      const rivals = legalMoves(bd, st, p.color).filter(x =>
        x.from !== m.from && bd[x.from] && bd[x.from].type === p.type && x.to === m.to);
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some(x => colOf(x.from) === colOf(m.from));
        const sameRank = rivals.some(x => rowOf(x.from) === rowOf(m.from));
        dis = !sameFile ? 'abcdefgh'[colOf(m.from)]
            : !sameRank ? String(8 - rowOf(m.from))
            : sqName(m.from);
      }
      s = p.type.toUpperCase() + dis + (isCap ? 'x' : '') + sqName(m.to);
    }
  }
  // 将军 / 将杀
  const u = applyMove(bd, st, m);
  const opp = st.turn;
  if (inCheck(bd, st, opp)) s += legalMoves(bd, st, opp).length ? '+' : '#';
  unapplyMove(bd, st, m, u);
  return s;
}

/* ---------------- 引擎导出（供测试） ---------------- */
function perft(bd, st, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(bd, st, st.turn)) {
    const u = applyMove(bd, st, m);
    n += perft(bd, st, depth - 1);
    unapplyMove(bd, st, m, u);
  }
  return n;
}

/* ============================================================
   AI —— negamax + alpha-beta + 子力位置表
   ============================================================ */
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
      5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
      5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30,
      -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
      -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10,
      -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
      -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10,
      -5,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10,
      -10,0,0,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
};
const MATE = 1e6;

function evaluate(bd, st) {
  let e = 0;
  for (let i = 0; i < 64; i++) {
    const p = bd[i];
    if (!p) continue;
    const v = VAL[p.type] + (p.color === W ? PST[p.type][i] : PST[p.type][(7 - rowOf(i)) * 8 + colOf(i)]);
    e += p.color === W ? v : -v;
  }
  return st.turn === W ? e : -e;
}
function orderMoves(bd, ms) {
  return ms.map(m => {
    const p = bd[m.from], t = bd[m.to];
    let s = 0;
    if (m.promo) s += 900;
    if (t) s += 10 * VAL[t.type] - VAL[p.type];
    else if (m.ep) s += 100;
    return { m, s };
  }).sort((a, b) => b.s - a.s).map(x => x.m);
}
function search(bd, st, depth, alpha, beta, ply) {
  if (depth === 0) return evaluate(bd, st);
  const ms = legalMoves(bd, st, st.turn);
  if (!ms.length) return inCheck(bd, st, st.turn) ? -MATE + ply : 0;
  if (st.half >= 100) return 0;
  let best = -Infinity;
  for (const m of orderMoves(bd, ms)) {
    const u = applyMove(bd, st, m);
    const v = -search(bd, st, depth - 1, -beta, -alpha, ply + 1);
    unapplyMove(bd, st, m, u);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
function bestMove(bd, st, depth) {
  const ms = orderMoves(bd, legalMoves(bd, st, st.turn));
  if (!ms.length) return null;
  let alpha = -Infinity, best = [], bestV = -Infinity;
  for (const m of ms) {
    const u = applyMove(bd, st, m);
    const v = -search(bd, st, depth - 1, -Infinity, -alpha, 1);
    unapplyMove(bd, st, m, u);
    if (v > bestV) { bestV = v; best = [m]; }
    else if (v === bestV) best.push(m);
    if (v > alpha) alpha = v;
  }
  return best[Math.floor(Math.random() * best.length)];
}

/* ============================================================
   对局管理
   ============================================================ */
class Game {
  constructor() { this.newGame(); }
  newGame() {
    this.bd = initialBoard();
    this.st = initialState();
    this.undoStack = [];
    this.sans = [];
    this.captured = [];   // {piece, by}
    this.over = null;     // {type, winner?, reason}
    this.lastMove = null;
  }
  legal() { return legalMoves(this.bd, this.st, this.st.turn); }
  move(m) {
    const san = toSan(this.bd, this.st, m);
    const before = { bd: cloneBd(this.bd), st: cloneSt(this.st),
                     last: this.lastMove, cap: this.captured.length };
    const u = applyMove(this.bd, this.st, m);
    if (u.cap) this.captured.push({ piece: u.cap, by: other(u.cap.color) });
    this.sans.push(san);
    this.undoStack.push(before);
    this.lastMove = { from: m.from, to: m.to };
    this.checkOver();
    return san;
  }
  undo() {
    const b = this.undoStack.pop();
    if (!b) return false;
    this.bd = b.bd; this.st = b.st;
    this.sans.pop();
    this.captured.length = b.cap;
    this.lastMove = b.last;
    this.over = null;
    return true;
  }
  checkOver() {
    const turn = this.st.turn;
    if (!legalMoves(this.bd, this.st, turn).length) {
      this.over = inCheck(this.bd, this.st, turn)
        ? { type: 'mate', winner: other(turn) }
        : { type: 'stalemate' };
      return;
    }
    if (this.st.half >= 100) { this.over = { type: 'draw', reason: '50 回合规则' }; return; }
    // 子力不足
    let minors = 0, heavy = false;
    for (const p of this.bd) {
      if (!p || p.type === 'k') continue;
      if (p.type === 'p' || p.type === 'r' || p.type === 'q') heavy = true;
      else minors++;
    }
    if (!heavy && minors <= 1) this.over = { type: 'draw', reason: '子力不足' };
  }
}

/* ============================================================
   界面
   ============================================================ */
if (typeof document !== 'undefined') {
  const $ = s => document.querySelector(s);
  const boardEl = $('#board');
  const piecesEl = $('#pieces');
  const statusEl = $('#status-text');
  const turnDotEl = $('#turn-dot');
  const movesEl = $('#moves-body');
  const capWEl = $('#cap-w'), capBEl = $('#cap-b');
  const advEl = $('#adv');
  const overlayEl = $('#overlay');
  const promoEl = $('#promo');

  const game = new Game();
  let mode = 'pvp';          // pvp | ai | bot
  let level = 2;             // AI 搜索深度
  let flipped = false;
  let selected = -1;
  let hints = [];            // 当前选中子的合法着法
  let thinking = false;
  let pendingPromo = null;
  let loopToken = 0;         // 自动对局循环令牌

  const pieceEls = new Map(); // id -> el

  /* ---------- 棋盘格子 ---------- */
  function buildSquares() {
    boardEl.querySelectorAll('.sq').forEach(e => e.remove());
    for (let n = 0; n < 64; n++) {
      const i = flipped ? 63 - n : n;
      const d = document.createElement('div');
      d.className = 'sq ' + ((rowOf(i) + colOf(i)) % 2 ? 'dark' : 'light');
      d.dataset.idx = i;
      const r = rowOf(i), c = colOf(i);
      if (c === (flipped ? 7 : 0)) { const s = document.createElement('span'); s.className = 'coord rank'; s.textContent = 8 - r; d.appendChild(s); }
      if (r === (flipped ? 0 : 7)) { const s = document.createElement('span'); s.className = 'coord file'; s.textContent = 'abcdefgh'[c]; d.appendChild(s); }
      boardEl.insertBefore(d, piecesEl);
    }
  }
  const sqEl = i => boardEl.querySelector(`.sq[data-idx="${i}"]`);

  /* ---------- 棋子渲染 ---------- */
  function posOf(i) {
    let r = rowOf(i), c = colOf(i);
    if (flipped) { r = 7 - r; c = 7 - c; }
    return `translate(${c * 100}%, ${r * 100}%)`;
  }
  function renderPieces() {
    piecesEl.querySelectorAll('.die').forEach(e => e.remove());
    const seen = new Set();
    for (let i = 0; i < 64; i++) {
      const p = game.bd[i];
      if (!p) continue;
      seen.add(p.id);
      let el = pieceEls.get(p.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'piece';
        el.dataset.color = p.color;
        el.textContent = GLYPH[p.type];
        el.style.transform = posOf(i);
        el.classList.add('spawn');
        piecesEl.appendChild(el);
        pieceEls.set(p.id, el);
      } else {
        el.textContent = GLYPH[p.type];
        el.style.transform = posOf(i);
      }
      el.style.zIndex = selected === i ? 5 : 1;
    }
    for (const [id, el] of pieceEls) {
      if (!seen.has(id)) { el.classList.add('die'); pieceEls.delete(id); setTimeout(() => el.remove(), 220); }
    }
  }

  /* ---------- 高亮 ---------- */
  function clearMarks() {
    boardEl.querySelectorAll('.sel,.hint,.hint-cap,.last,.check').forEach(e =>
      e.classList.remove('sel','hint','hint-cap','last','check'));
  }
  function renderMarks() {
    clearMarks();
    if (game.lastMove) {
      for (const i of [game.lastMove.from, game.lastMove.to]) sqEl(i)?.classList.add('last');
    }
    if (selected >= 0) {
      sqEl(selected)?.classList.add('sel');
      for (const m of hints) {
        const e = sqEl(m.to);
        if (!e) continue;
        e.classList.add(game.bd[m.to] || m.ep ? 'hint-cap' : 'hint');
      }
    }
    if (!game.over && inCheck(game.bd, game.st, game.st.turn)) {
      sqEl(kingSq(game.bd, game.st.turn))?.classList.add('check');
    }
  }

  /* ---------- 侧栏 ---------- */
  function renderStatus() {
    const t = game.st.turn;
    turnDotEl.className = 'turn-dot ' + t;
    const cn = c => (c === W ? '白方' : '黑方');
    if (game.over) {
      if (game.over.type === 'mate') statusEl.textContent = `将杀 · ${cn(game.over.winner)}胜`;
      else if (game.over.type === 'stalemate') statusEl.textContent = '逼和 · 和棋';
      else statusEl.textContent = `和棋 · ${game.over.reason}`;
    } else if (thinking) {
      statusEl.textContent = cn(t) + '思考中…';
    } else {
      statusEl.textContent = cn(t) + '行棋' +
        (inCheck(game.bd, game.st, t) ? ' · 将军' : '');
    }
  }
  function renderMoves() {
    movesEl.innerHTML = '';
    for (let i = 0; i < game.sans.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'mv-row';
      row.innerHTML = `<span class="mv-no">${i / 2 + 1}.</span>
        <span class="mv w">${game.sans[i]}</span>
        <span class="mv b">${game.sans[i + 1] || ''}</span>`;
      movesEl.appendChild(row);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
  }
  function renderCaptures() {
    const mat = { w: 0, b: 0 };
    capWEl.innerHTML = ''; capBEl.innerHTML = '';
    for (const { piece, by } of game.captured) {
      const s = document.createElement('span');
      s.className = 'cap-piece ' + piece.color;
      s.textContent = GLYPH[piece.type];
      (by === W ? capWEl : capBEl).appendChild(s);
      if (by === W) mat.w += VAL[piece.type]; else mat.b += VAL[piece.type];
    }
    const d = Math.round((mat.w - mat.b) / 100);
    advEl.textContent = d === 0 ? '' : (d > 0 ? `白 +${d}` : `黑 +${-d}`);
  }
  function renderOverlay() {
    if (!game.over) { overlayEl.classList.remove('show'); return; }
    const cn = c => (c === W ? '白方' : '黑方');
    let title, sub;
    if (game.over.type === 'mate') { title = '将杀'; sub = `${cn(game.over.winner)}获胜`; }
    else if (game.over.type === 'stalemate') { title = '逼和'; sub = '无子可动 · 和棋'; }
    else { title = '和棋'; sub = game.over.reason; }
    overlayEl.querySelector('.ov-title').textContent = title;
    overlayEl.querySelector('.ov-sub').textContent = sub;
    overlayEl.classList.add('show');
  }
  function renderAll() { renderPieces(); renderMarks(); renderStatus(); renderMoves(); renderCaptures(); renderOverlay(); }

  /* ---------- 自动走子 ---------- */
  function aiTurn() {
    thinking = true; renderStatus();
    const token = loopToken;
    setTimeout(() => {
      if (token !== loopToken) return;
      const m = bestMove(game.bd, game.st, level);
      thinking = false;
      if (m) { game.move(m); renderAll(); }
    }, 120);
  }
  // 双机器人：双方轮流由 AI 走子，带观战节奏延迟
  function botLoop() {
    if (mode !== 'bot' || game.over || thinking) return;
    thinking = true; renderStatus();
    const token = loopToken;
    setTimeout(() => {
      if (token !== loopToken || mode !== 'bot') { if (token === loopToken) { thinking = false; renderStatus(); } return; }
      const m = bestMove(game.bd, game.st, level);
      if (!m) { thinking = false; game.checkOver(); renderAll(); return; }
      thinking = false;
      game.move(m);
      renderAll();
      if (!game.over) setTimeout(botLoop, 350);
    }, 420);
  }

  /* ---------- 交互 ---------- */
  function commit(m) {
    selected = -1; hints = [];
    game.move(m);
    renderAll();
    if (!game.over && mode === 'ai' && game.st.turn === B) aiTurn();
  }
  function tryMove(from, to) {
    const cands = hints.filter(m => m.to === to);
    if (!cands.length) return false;
    if (cands.length > 1 && cands[0].promo) { showPromo(from, to); return true; }
    commit(cands[0]);
    return true;
  }
  function showPromo(from, to) {
    pendingPromo = { from, to };
    promoEl.querySelectorAll('.promo-opt').forEach(b => {
      b.textContent = GLYPH[b.dataset.promo];
      b.dataset.color = game.st.turn;
    });
    promoEl.classList.add('show');
  }
  function onSquareClick(i) {
    if (thinking || game.over || pendingPromo) return;
    if (mode === 'bot') return;
    if (mode === 'ai' && game.st.turn === B) return;
    const p = game.bd[i];
    if (selected >= 0 && tryMove(selected, i)) return;
    if (p && p.color === game.st.turn) {
      selected = i;
      hints = legalMoves(game.bd, game.st, p.color).filter(m => m.from === i);
    } else {
      selected = -1; hints = [];
    }
    renderMarks(); renderPieces();
  }
  boardEl.addEventListener('click', e => {
    const cell = e.target.closest('.sq');
    if (cell) onSquareClick(+cell.dataset.idx);
  });
  promoEl.addEventListener('click', e => {
    const b = e.target.closest('.promo-opt');
    if (!b || !pendingPromo) return;
    const m = hints.find(x => x.from === pendingPromo.from && x.to === pendingPromo.to && x.promo === b.dataset.promo);
    pendingPromo = null;
    promoEl.classList.remove('show');
    if (m) commit(m);
  });

  /* ---------- 控制 ---------- */
  function reset() {
    loopToken++;
    game.newGame(); selected = -1; hints = []; thinking = false;
    renderAll();
    if (mode === 'bot') botLoop();
  }
  $('#btn-new').addEventListener('click', reset);
  $('#btn-again').addEventListener('click', reset);
  $('#btn-undo').addEventListener('click', () => {
    if (thinking) return;
    loopToken++;
    game.undo();
    if ((mode === 'ai' || mode === 'bot') && game.st.turn === B) game.undo();
    selected = -1; hints = [];
    renderAll();
    if (mode === 'bot') botLoop();
  });
  $('#btn-flip').addEventListener('click', () => { flipped = !flipped; buildSquares(); renderAll(); });

  document.querySelectorAll('.seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      if (seg.id === 'seg-mode') {
        mode = b.dataset.mode;
        $('#level-row').classList.toggle('off', mode === 'pvp');
        reset();
      } else {
        level = +b.dataset.level;
      }
    });
  });

  /* ---------- 启动 ---------- */
  buildSquares();
  renderAll();
}

/* ---------------- 测试导出 ---------------- */
if (typeof module !== 'undefined') {
  module.exports = { initialBoard, initialState, legalMoves, applyMove, unapplyMove,
                     toSan, perft, Game, bestMove, isAttacked, inCheck, sq, sqName };
}
