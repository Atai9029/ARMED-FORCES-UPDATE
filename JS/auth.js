/* ══════════════════════════════════════════════════════════════
   ARMED FORCES · AUTH MODULE v2  (sql.js SQLite)
   ▸ Автоматически вшивает модальное окно входа на ЛЮБУЮ страницу
   ▸ Работает из корня, header_/, transports/ — путь авто-определяется
   ▸ База данных SQLite хранится в localStorage
══════════════════════════════════════════════════════════════ */

/* ══ Константы ══ */
const AF_DB_KEY   = 'af_sqlite_db';
const AF_SESS_KEY = 'af_session';

/* Определяем префикс по имени папки — работает и локально и на сервере */
const _root = (
  location.pathname.includes('/transports/') ||
  location.pathname.includes('/header_/')
) ? '../' : './';

let _db  = null;
let _SQL = null;

/* ══════════════════════════════════════════════════════════════
   1. БАЗА ДАННЫХ
══════════════════════════════════════════════════════════════ */

async function initDB() {
  if (_db) return _db;
  _SQL = await initSqlJs({
    locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
  });
  const saved = localStorage.getItem(AF_DB_KEY);
  if (saved) {
    _db = new _SQL.Database(Uint8Array.from(atob(saved), c => c.charCodeAt(0)));
  } else {
    _db = new _SQL.Database();
  }
  _db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callsign TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rank TEXT NOT NULL DEFAULT 'РЕКРУТ',
    created TEXT NOT NULL
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS login_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ts TEXT NOT NULL
  )`);
  saveDB();
  return _db;
}

function saveDB() {
  if (!_db) return;
  localStorage.setItem(AF_DB_KEY, btoa(String.fromCharCode(..._db.export())));
}

async function hashPassword(p) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function registerUser(callsign, email, password, rank = 'РЕКРУТ') {
  const db = await initDB();
  try {
    db.run(`INSERT INTO users (callsign,email,password,rank,created) VALUES (?,?,?,?,?)`,
      [callsign.trim().toUpperCase(), email.trim().toLowerCase(),
       await hashPassword(password), rank, new Date().toISOString()]);
    saveDB();
    return { ok: true };
  } catch(e) {
    return { ok: false, error: e.message.includes('UNIQUE')
      ? `Такой ${e.message.includes('callsign') ? 'позывной' : 'email'} уже существует`
      : e.message };
  }
}

async function loginUser(email, password) {
  const db   = await initDB();
  const hash = await hashPassword(password);
  const res  = db.exec(
    `SELECT id,callsign,email,rank,created FROM users WHERE email=? AND password=?`,
    [email.trim().toLowerCase(), hash]
  );
  if (!res.length || !res[0].values.length)
    return { ok: false, error: 'Неверный email или пароль' };
  const [id, callsign, em, rank, created] = res[0].values[0];
  db.run(`INSERT INTO login_log (user_id,ts) VALUES (?,?)`, [id, new Date().toISOString()]);
  saveDB();
  const session = { id, callsign, email: em, rank, created };
  sessionStorage.setItem(AF_SESS_KEY, JSON.stringify(session));
  return { ok: true, user: session };
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(AF_SESS_KEY)); } catch { return null; }
}

function logoutUser() {
  sessionStorage.removeItem(AF_SESS_KEY);
  /* Если мы на странице профиля — уходим на главную, иначе просто обновляем navbar */
  if (location.pathname.includes('profile.html')) {
    location.href = _root + 'index.html';
  } else {
    updateNavAuth();
    _afToast('Вы вышли из системы', 'err');
  }
}

function requireAuth(to) {
  if (!getSession()) { location.href = to || `${_root}login.html`; return false; }
  return true;
}

async function getUserStats(userId) {
  const db = await initDB();
  const l  = db.exec(`SELECT COUNT(*) FROM login_log WHERE user_id=?`, [userId]);
  const u  = db.exec(`SELECT COUNT(*) FROM users`);
  return { logins: l[0]?.values[0][0]??0, totalUsers: u[0]?.values[0][0]??0 };
}

/* ══════════════════════════════════════════════════════════════
   2. МОДАЛЬНОЕ ОКНО — вшивается в DOM автоматически
══════════════════════════════════════════════════════════════ */

function _injectModal() {
  if (document.getElementById('afLoginModal')) return;

  /* Стили модалки (автономные, не зависят от Bootstrap) */
  const style = document.createElement('style');
  style.textContent = `
    #afLoginModal {
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(4,6,8,.88); backdrop-filter:blur(6px);
      align-items:center; justify-content:center;
    }
    #afLoginModal.af-open { display:flex; }
    #afModalCard {
      background:#141b1f; border:1px solid #1e2d35;
      width:100%; max-width:420px; margin:1rem;
      position:relative; animation:afSlideUp .3s ease;
      --corner:12px;
      clip-path:polygon(var(--corner) 0,100% 0,100% calc(100% - var(--corner)),
        calc(100% - var(--corner)) 100%,0 100%,0 var(--corner));
    }
    #afModalCard::before {
      content:''; position:absolute; top:0; left:var(--corner); right:0;
      height:2px; background:linear-gradient(90deg,#00ff88,transparent);
    }
    @keyframes afSlideUp {
      from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)}
    }
    .af-modal-head {
      padding:1.6rem 1.8rem 1rem;
      border-bottom:1px solid #1e2d35;
      display:flex; align-items:center; justify-content:space-between;
    }
    .af-modal-title {
      font-family:'Oswald',sans-serif; font-size:1.1rem;
      letter-spacing:3px; color:#fff; text-transform:uppercase;
    }
    .af-modal-title span { color:#00ff88; }
    .af-close-btn {
      background:none; border:none; color:#6b7f88; font-size:1.4rem;
      cursor:pointer; line-height:1; padding:0;
      transition:color .2s;
    }
    .af-close-btn:hover { color:#e03030; }
    .af-modal-body { padding:1.4rem 1.8rem; }
    .af-tabs {
      display:flex; border-bottom:1px solid #1e2d35; margin-bottom:1.4rem;
    }
    .af-tab {
      flex:1; background:none; border:none; color:#6b7f88; cursor:pointer;
      font-family:'Oswald',sans-serif; font-size:.8rem; letter-spacing:2px;
      padding:.6rem; text-transform:uppercase; transition:color .2s;
      border-bottom:2px solid transparent; margin-bottom:-1px;
    }
    .af-tab.active { color:#00ff88; border-bottom-color:#00ff88; }
    .af-pane { display:none; } .af-pane.active { display:block; }
    .af-lbl {
      display:block; font-family:'Oswald',sans-serif; font-size:.72rem;
      letter-spacing:2px; color:#6b7f88; text-transform:uppercase; margin-bottom:.35rem;
    }
    .af-lbl-prefix { color:#00ff88; font-family:monospace; }
    .af-field { position:relative; margin-bottom:1rem; }
    .af-field i.fi {
      position:absolute; left:.8rem; top:50%; transform:translateY(-50%);
      color:#6b7f88; font-size:.95rem; pointer-events:none; transition:color .2s;
    }
    .af-field:focus-within i.fi { color:#00ff88; }
    .af-inp {
      width:100%; background:#0f1518; border:1px solid #1e2d35;
      color:#d4dfe4; font-family:'Rajdhani',sans-serif; font-size:.97rem;
      padding:.58rem 2.5rem .58rem 2.4rem; outline:none;
      transition:border-color .2s,box-shadow .2s; border-radius:0;
    }
    .af-inp::placeholder { color:#6b7f88; opacity:.7; }
    .af-inp:focus { border-color:#00ff88; box-shadow:0 0 0 3px rgba(0,255,136,.1); }
    .af-inp.err { border-color:#e03030; }
    .af-eye {
      position:absolute; right:.7rem; top:50%; transform:translateY(-50%);
      background:none; border:none; color:#6b7f88; cursor:pointer; padding:0;
      transition:color .2s;
    }
    .af-eye:hover { color:#00ff88; }
    .af-select {
      width:100%; background:#0f1518; border:1px solid #1e2d35;
      color:#d4dfe4; font-family:'Rajdhani',sans-serif; font-size:.97rem;
      padding:.58rem 1rem; outline:none; border-radius:0;
      transition:border-color .2s; cursor:pointer; margin-bottom:1rem;
      -webkit-appearance:none; appearance:none;
    }
    .af-select:focus { border-color:#00ff88; }
    .af-select option { background:#0f1518; }
    .af-alert {
      font-family:'Oswald',sans-serif; font-size:.78rem; letter-spacing:1px;
      padding:.6rem .8rem; margin-bottom:.9rem;
      display:none; align-items:center; gap:.5rem; border-left:2px solid;
    }
    .af-alert.show { display:flex; }
    .af-alert.err  { border-color:#e03030; background:rgba(224,48,48,.08); color:#e03030; }
    .af-alert.ok   { border-color:#00ff88; background:rgba(0,255,136,.08); color:#00ff88; }
    .af-btn {
      width:100%; background:transparent; border:1px solid #00ff88; color:#00ff88;
      font-family:'Oswald',sans-serif; letter-spacing:3px; text-transform:uppercase;
      font-size:.92rem; padding:.68rem; cursor:pointer;
      transition:background .25s,color .25s,box-shadow .25s;
      display:flex; align-items:center; justify-content:center; gap:.5rem;
      border-radius:0; margin-top:.2rem;
    }
    .af-btn:hover:not(:disabled) {
      background:#00ff88; color:#000; box-shadow:0 0 20px rgba(0,255,136,.3);
    }
    .af-btn:disabled { opacity:.5; cursor:not-allowed; }
    .af-spin {
      display:none; width:16px; height:16px;
      border:2px solid rgba(0,255,136,.3); border-top-color:#00ff88;
      border-radius:50%; animation:afSpin .6s linear infinite;
    }
    .af-btn.loading .af-spin { display:block; }
    .af-btn.loading .af-btxt { display:none; }
    @keyframes afSpin { to{transform:rotate(360deg)} }
    .af-switch {
      text-align:center; font-size:.8rem; color:#6b7f88;
      margin-top:1rem; font-family:'Rajdhani',sans-serif;
    }
    .af-switch a {
      color:#00ff88; text-decoration:none; font-family:'Oswald',sans-serif;
      font-size:.78rem; letter-spacing:1px;
    }
    .af-switch a:hover { text-decoration:underline; }
    .af-strength { display:flex; gap:3px; margin:.3rem 0 .2rem; }
    .af-strength span {
      flex:1; height:3px; background:#1e2d35; transition:background .3s;
    }
    .af-strength.s1 span:nth-child(1) { background:#e03030; }
    .af-strength.s2 span:nth-child(-n+2) { background:#f0a500; }
    .af-strength.s3 span:nth-child(-n+3) { background:#00ccff; }
    .af-strength.s4 span { background:#00ff88; }
    .af-hint { font-size:.72rem; color:#6b7f88; margin-bottom:.6rem; }
    .af-hint.ok  { color:#00ff88; }
    .af-hint.err { color:#e03030; }
    .af-check {
      display:flex; align-items:flex-start; gap:.5rem;
      font-size:.8rem; color:#6b7f88; margin-bottom:1rem;
    }
    .af-check input { accent-color:#00ff88; margin-top:2px; flex-shrink:0; }
    .af-check a { color:#00ff88; }
    .af-modal-foot {
      padding:.8rem 1.8rem; border-top:1px solid #1e2d35;
      display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:.5rem;
    }
    .af-foot-link {
      font-family:'Oswald',sans-serif; font-size:.7rem; letter-spacing:1.5px;
      color:#6b7f88; text-decoration:none; transition:color .2s;
    }
    .af-foot-link:hover { color:#00ff88; }

    /* Навбар: кнопка войти + бейдж */
    .af-nav-btn {
      background:transparent; border:1px solid #00ff88; color:#00ff88;
      font-family:'Oswald',sans-serif; font-size:.75rem; letter-spacing:2px;
      text-transform:uppercase; padding:.3rem .9rem; cursor:pointer;
      transition:background .2s,color .2s; white-space:nowrap;
    }
    .af-nav-btn:hover { background:#00ff88; color:#000; }
    .af-badge {
      font-family:'Oswald',sans-serif; font-size:.75rem; letter-spacing:2px;
      color:#00ff88; border:1px solid #00ff88; padding:.3rem .8rem;
      cursor:pointer; transition:background .2s,color .2s; white-space:nowrap;
      text-decoration:none; display:inline-flex; align-items:center; gap:.35rem;
    }
    .af-badge:hover { background:#00ff88; color:#000; }
    .af-logout-btn {
      background:transparent; border:1px solid #e03030; color:#e03030;
      font-family:'Oswald',sans-serif; font-size:.72rem; letter-spacing:1.5px;
      padding:.3rem .7rem; cursor:pointer; transition:background .2s,color .2s;
      white-space:nowrap;
    }
    .af-logout-btn:hover { background:#e03030; color:#fff; }
    .af-nav-group { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
  `;
  document.head.appendChild(style);

  /* HTML модального окна */
  const modal = document.createElement('div');
  modal.id = 'afLoginModal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.innerHTML = `
  <div id="afModalCard">
    <!-- Шапка -->
    <div class="af-modal-head">
      <div class="af-modal-title">
        <i class="bi bi-shield-lock" style="color:#00ff88;margin-right:.5rem"></i>
        ARMED<span> FORCES</span> · ВХОД
      </div>
      <button class="af-close-btn" onclick="afCloseModal()" aria-label="Закрыть">✕</button>
    </div>

    <!-- Тело -->
    <div class="af-modal-body">
      <!-- Табы: Войти / Регистрация -->
      <div class="af-tabs">
        <button class="af-tab active" id="afTabLogin" onclick="afSwitchTab('login')">
          <i class="bi bi-box-arrow-in-right me-1"></i>Войти
        </button>
        <button class="af-tab" id="afTabReg" onclick="afSwitchTab('reg')">
          <i class="bi bi-person-plus me-1"></i>Регистрация
        </button>
      </div>

      <!-- ═══ Форма ВХОДА ═══ -->
      <div id="afPaneLogin" class="af-pane active">
        <div class="af-alert err" id="afLoginErr">
          <i class="bi bi-exclamation-triangle"></i>
          <span id="afLoginErrTxt"></span>
        </div>

        <label class="af-lbl"><span class="af-lbl-prefix">// </span>EMAIL</label>
        <div class="af-field">
          <i class="bi bi-envelope-at fi"></i>
          <input type="email" id="afLEmail" class="af-inp"
                 placeholder="agent@darknet.mil" autocomplete="email"
                 onkeydown="if(event.key==='Enter')afDoLogin()"/>
        </div>

        <label class="af-lbl"><span class="af-lbl-prefix">// </span>ПАРОЛЬ</label>
        <div class="af-field">
          <i class="bi bi-lock fi"></i>
          <input type="password" id="afLPass" class="af-inp"
                 placeholder="••••••••" autocomplete="current-password"
                 onkeydown="if(event.key==='Enter')afDoLogin()"/>
          <button class="af-eye" onclick="afToggleEye('afLPass','afLEye')">
            <i class="bi bi-eye" id="afLEye"></i>
          </button>
        </div>

        <button class="af-btn" id="afBtnLogin" onclick="afDoLogin()">
          <div class="af-spin"></div>
          <span class="af-btxt"><i class="bi bi-box-arrow-in-right me-1"></i>ВОЙТИ В СИСТЕМУ</span>
        </button>

        <div class="af-switch" style="margin-top:.8rem">
          Нет аккаунта?
          <a href="javascript:void(0)" onclick="afSwitchTab('reg')">ЗАРЕГИСТРИРОВАТЬСЯ</a>
        </div>
      </div>

      <!-- ═══ Форма РЕГИСТРАЦИИ ═══ -->
      <div id="afPaneReg" class="af-pane">
        <div class="af-alert err" id="afRegErr">
          <i class="bi bi-shield-x"></i>
          <span id="afRegErrTxt"></span>
        </div>
        <div class="af-alert ok"  id="afRegOk">
          <i class="bi bi-shield-check"></i>
          <span id="afRegOkTxt"></span>
        </div>

        <label class="af-lbl"><span class="af-lbl-prefix">// </span>ПОЗЫВНОЙ <span style="color:#e03030">*</span></label>
        <div class="af-field">
          <i class="bi bi-person-badge fi"></i>
          <input type="text" id="afRCall" class="af-inp"
                 placeholder="GHOST / COBRA / ALPHA-7" maxlength="30"
                 oninput="afValCall()"/>
        </div>

        <label class="af-lbl"><span class="af-lbl-prefix">// </span>EMAIL <span style="color:#e03030">*</span></label>
        <div class="af-field">
          <i class="bi bi-envelope-at fi"></i>
          <input type="email" id="afREmail" class="af-inp"
                 placeholder="agent@darknet.mil"
                 oninput="afValEmail()"/>
        </div>

        <label class="af-lbl"><span class="af-lbl-prefix">// </span>ЗВАНИЕ</label>
        <select id="afRRank" class="af-select">
          <option value="РЕКРУТ">🔰 Рекрут</option>
          <option value="ОПЕРАТИВНИК">⚡ Оперативник</option>
          <option value="Ветеран Диванных Войск">🎯 Ветеран Диванных Войск</option>
          <option value="АГЕНТ">🕵️ Агент</option>
          <option value="БРОКЕР">💼 Брокер</option>
        </select>

        <label class="af-lbl"><span class="af-lbl-prefix">// </span>ПАРОЛЬ <span style="color:#e03030">*</span></label>
        <div class="af-field">
          <i class="bi bi-lock fi"></i>
          <input type="password" id="afRPass" class="af-inp"
                 placeholder="Минимум 6 символов" autocomplete="new-password"
                 oninput="afStrength()"/>
          <button class="af-eye" onclick="afToggleEye('afRPass','afREye1')">
            <i class="bi bi-eye" id="afREye1"></i>
          </button>
        </div>
        <div class="af-strength" id="afStrBar">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="af-hint" id="afStrHint">Введите пароль</div>

        <label class="af-lbl"><span class="af-lbl-prefix">// </span>ПОДТВЕРЖДЕНИЕ</label>
        <div class="af-field">
          <i class="bi bi-lock-fill fi"></i>
          <input type="password" id="afRPass2" class="af-inp"
                 placeholder="Повторите пароль" autocomplete="new-password"
                 oninput="afValPass2()"/>
          <button class="af-eye" onclick="afToggleEye('afRPass2','afREye2')">
            <i class="bi bi-eye" id="afREye2"></i>
          </button>
        </div>
        <div class="af-hint" id="afP2Hint"></div>

        <div class="af-check">
          <input type="checkbox" id="afRAgree">
          <label for="afRAgree">Принимаю <a href="#">условия NDA</a> и соглашение о конфиденциальности</label>
        </div>

        <button class="af-btn" id="afBtnReg" onclick="afDoRegister()"
                style="border-color:#00ff88;color:#00ff88">
          <div class="af-spin"></div>
          <span class="af-btxt"><i class="bi bi-person-plus me-1"></i>ЗАВЕРБОВАТЬСЯ</span>
        </button>

        <div class="af-switch">
          Уже в системе?
          <a href="javascript:void(0)" onclick="afSwitchTab('login')">ВОЙТИ</a>
        </div>
      </div>

    </div><!-- /af-modal-body -->

    <!-- Подвал модалки -->
    <div class="af-modal-foot">
      <a class="af-foot-link" href="${_root}register.html">
        <i class="bi bi-arrow-up-right-square me-1"></i>Полная страница регистрации
      </a>
      <a class="af-foot-link" href="${_root}login.html">
        <i class="bi bi-arrow-up-right-square me-1"></i>Полная страница входа
      </a>
    </div>
  </div><!-- /afModalCard -->
  `;
  document.body.appendChild(modal);

  /* Закрытие кликом по фону */
  modal.addEventListener('click', e => { if (e.target === modal) afCloseModal(); });
  /* Закрытие по Escape */
  document.addEventListener('keydown', e => { if (e.key === 'Escape') afCloseModal(); });
}

/* ══════════════════════════════════════════════════════════════
   3. УПРАВЛЕНИЕ МОДАЛКОЙ
══════════════════════════════════════════════════════════════ */

function afOpenModal(tab) {
  _injectModal();
  document.getElementById('afLoginModal').classList.add('af-open');
  document.body.style.overflow = 'hidden';
  if (tab) afSwitchTab(tab);
  /* Фокус на первое поле */
  setTimeout(() => {
    const f = document.getElementById(tab === 'reg' ? 'afRCall' : 'afLEmail');
    if (f) f.focus();
  }, 100);
}

function afCloseModal() {
  const m = document.getElementById('afLoginModal');
  if (m) {
    m.classList.remove('af-open');
    document.body.style.overflow = '';
  }
}

function afSwitchTab(tab) {
  document.getElementById('afPaneLogin').classList.toggle('active', tab === 'login');
  document.getElementById('afPaneReg').classList.toggle('active',   tab === 'reg');
  document.getElementById('afTabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('afTabReg').classList.toggle('active',    tab === 'reg');
}

/* ══════════════════════════════════════════════════════════════
   4. ЛОГИКА ВХОДА (в модалке)
══════════════════════════════════════════════════════════════ */

let _failCount = 0;

async function afDoLogin() {
  const errEl = document.getElementById('afLoginErr');
  const errTx = document.getElementById('afLoginErrTxt');
  errEl.classList.remove('show');

  const email = document.getElementById('afLEmail').value.trim();
  const pass  = document.getElementById('afLPass').value;
  if (!email || !pass) {
    errTx.textContent = 'Заполните email и пароль';
    errEl.classList.add('show'); return;
  }

  const btn = document.getElementById('afBtnLogin');
  btn.classList.add('loading'); btn.disabled = true;
  await new Promise(r => setTimeout(r, 600));

  const result = await loginUser(email, pass);
  btn.classList.remove('loading'); btn.disabled = false;

  if (result.ok) {
    afCloseModal();
    /* Редирект на профиль */
    window.location.href = _root + 'profile.html';
  } else {
    _failCount++;
    errTx.textContent = _failCount >= 4
      ? `${result.error} · Попытка ${_failCount}`
      : result.error;
    errEl.classList.add('show');
    /* Встряска поля */
    const pi = document.getElementById('afLPass');
    pi.classList.add('err');
    pi.style.animation = 'none'; pi.offsetHeight;
    pi.style.animation = 'afShake .3s ease';
    setTimeout(() => { pi.style.animation=''; pi.classList.remove('err'); pi.value=''; }, 400);
  }
}

/* ══════════════════════════════════════════════════════════════
   5. ЛОГИКА РЕГИСТРАЦИИ (в модалке)
══════════════════════════════════════════════════════════════ */

function afValCall() {
  const v = document.getElementById('afRCall').value.trim();
  document.getElementById('afRCall').classList.toggle('err', v.length > 0 && v.length < 2);
  return v.length >= 2;
}
function afValEmail() {
  const v = document.getElementById('afREmail').value.trim();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  document.getElementById('afREmail').classList.toggle('err', v.length > 0 && !ok);
  return ok;
}
function afStrength() {
  const v = document.getElementById('afRPass').value;
  const bar = document.getElementById('afStrBar');
  const h   = document.getElementById('afStrHint');
  bar.className = 'af-strength';
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/[0-9!@#$%^&*]/.test(v)) s++;
  if (s > 0) {
    bar.classList.add('s'+s);
    h.textContent = ['','СЛАБЫЙ','СРЕДНИЙ','ХОРОШИЙ','НАДЁЖНЫЙ'][s];
    h.className = 'af-hint ' + (s < 2 ? 'err' : 'ok');
  } else {
    h.textContent = 'Введите пароль'; h.className = 'af-hint';
  }
  return s;
}
function afValPass2() {
  const p1 = document.getElementById('afRPass').value;
  const p2 = document.getElementById('afRPass2').value;
  const h  = document.getElementById('afP2Hint');
  const i2 = document.getElementById('afRPass2');
  if (!p2) { i2.classList.remove('err'); h.textContent=''; return false; }
  const ok = p1 === p2;
  i2.classList.toggle('err', !ok);
  h.textContent = ok ? '✓ Совпадают' : '⚠ Не совпадают';
  h.className   = 'af-hint ' + (ok ? 'ok' : 'err');
  return ok;
}

async function afDoRegister() {
  document.getElementById('afRegErr').classList.remove('show');
  document.getElementById('afRegOk').classList.remove('show');

  if (!afValCall())  { _afRegErr('Позывной: минимум 2 символа'); return; }
  if (!afValEmail()) { _afRegErr('Некорректный email'); return; }
  if (afStrength() < 1) { _afRegErr('Пароль слишком короткий'); return; }
  if (!afValPass2()) { _afRegErr('Пароли не совпадают'); return; }
  if (!document.getElementById('afRAgree').checked) {
    _afRegErr('Примите условия NDA'); return;
  }

  const callsign = document.getElementById('afRCall').value;
  const email    = document.getElementById('afREmail').value;
  const rank     = document.getElementById('afRRank').value;
  const pass     = document.getElementById('afRPass').value;

  const btn = document.getElementById('afBtnReg');
  btn.classList.add('loading'); btn.disabled = true;
  await new Promise(r => setTimeout(r, 700));

  const result = await registerUser(callsign, email, pass, rank);
  btn.classList.remove('loading'); btn.disabled = false;

  if (result.ok) {
    document.getElementById('afRegOkTxt').textContent =
      `✓ АККАУНТ "${callsign.toUpperCase()}" СОЗДАН — ВЫПОЛНЯЕТСЯ ВХОД...`;
    document.getElementById('afRegOk').classList.add('show');
    await loginUser(email, pass);
    setTimeout(() => {
      afCloseModal();
      /* Переходим на страницу профиля */
      window.location.href = _root + 'profile.html';
    }, 1000);
  } else {
    _afRegErr(result.error);
  }
}

function _afRegErr(msg) {
  document.getElementById('afRegErrTxt').textContent = msg;
  document.getElementById('afRegErr').classList.add('show');
}

/* ══════════════════════════════════════════════════════════════
   6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
══════════════════════════════════════════════════════════════ */

function afToggleEye(inputId, iconId) {
  const inp = document.getElementById(inputId);
  const ico = document.getElementById(iconId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  ico.className = inp.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
}

/* Toast-уведомление */
function _afToast(msg, type) {
  let t = document.getElementById('afToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'afToast';
    t.style.cssText = `
      position:fixed; bottom:1.5rem; right:1.5rem; z-index:10000;
      font-family:'Oswald',sans-serif; font-size:.8rem; letter-spacing:2px;
      padding:.7rem 1.2rem; border:1px solid; display:none;
      animation:afSlideUp .3s ease; max-width:320px;
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.borderColor  = type === 'ok' ? '#00ff88' : '#e03030';
  t.style.color        = type === 'ok' ? '#00ff88' : '#e03030';
  t.style.background   = type === 'ok' ? 'rgba(0,255,136,.1)' : 'rgba(224,48,48,.1)';
  t.style.display      = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 3500);
}

/* ══════════════════════════════════════════════════════════════
   7. НАВБАР — вставка кнопки/бейджа в ЛЮБУЮ страницу
══════════════════════════════════════════════════════════════ */

function updateNavAuth() {
  _injectModal();
  const sess = getSession();

  /* === Bootstrap navbar === */
  let area = document.getElementById('navAuthArea');
  if (area) {
    if (sess) {
      area.innerHTML = `
        <li class="nav-item">
          <div class="af-nav-group">
            <a class="af-badge" href="${_root}profile.html" title="Личное дело">
              <i class="bi bi-person-check"></i>${sess.callsign}
            </a>
            <button class="af-logout-btn" onclick="logoutUser()">
              <i class="bi bi-box-arrow-right"></i> Выход
            </button>
          </div>
        </li>`;
    } else {
      area.innerHTML = `
        <li class="nav-item">
          <button class="af-nav-btn" onclick="afOpenModal('login')">
            <i class="bi bi-person-lock me-1"></i>ВОЙТИ
          </button>
        </li>`;
    }
    return;
  }

  /* === Простой <header> (transports, buy) === */
  const simpleNav = document.querySelector('header nav, header .nav, .header nav');
  if (simpleNav) {
    let existing = simpleNav.querySelector('.af-simple-auth');
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'af-simple-auth';
      existing.style.marginLeft = '.5rem';
      simpleNav.appendChild(existing);
    }
    if (sess) {
      existing.innerHTML = `
        <a class="af-badge" href="${_root}profile.html" style="font-size:.75rem">
          <i class="bi bi-person-check"></i>${sess.callsign}
        </a>
        <button class="af-logout-btn" onclick="logoutUser()" style="margin-left:.4rem;font-size:.72rem">
          Выход
        </button>`;
    } else {
      existing.innerHTML = `
        <button class="af-nav-btn" onclick="afOpenModal('login')" style="font-size:.72rem">
          <i class="bi bi-person-lock me-1"></i>ВОЙТИ
        </button>`;
    }
  }
}

/* Стиль анимации shake добавляем глобально */
const _shakeStyle = document.createElement('style');
_shakeStyle.textContent = `
  @keyframes afShake {
    0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)}
    40%{transform:translateX(7px)} 60%{transform:translateX(-4px)}
    80%{transform:translateX(4px)}
  }
`;
document.head.appendChild(_shakeStyle);

/* ══ Auth nav init on DOMContentLoaded ══ */
document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  updateNavAuth();
});
