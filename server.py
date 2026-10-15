"""PURR-OGRAM: The ConvergeIT Quest - booth server (Tech Innovators Society).

Serves the game and a password-protected /admin page. Only needs Python 3 (no installs).

    python server.py              play at http://localhost:8000, manage prizes at http://localhost:8000/admin
    python server.py --lan        also reachable from phones/tablets on the same Wi-Fi
    python server.py --port 9000  use another port

Admin sign-in page: /admin/login (the game opens it when staff type the admin code or tap the hidden spot).
Username "admin", default password "techis2026" (change it on the /admin page, or set the
ADMIN_PASSWORD environment variable, which always wins). Sign-ins last 12 hours or until signed out.

Data on this machine:
    data/wheel.json    prizes, staff PIN, hashed admin password
    data/players.json  every player's name, best scores and prizes (never cleared by the game)

Online backup (optional): set SHEETS_URL and SHEETS_KEY (see tools/google-sheets-sync.gs), either as
environment variables (Render) or in a sheets.env file next to this script (laptop). Test with:
    python server.py --check-sheets
Every change is pushed to the Google Sheet, retried until it succeeds, and on startup the server
reloads players and prize settings from the Sheet. This keeps records safe on hosts like Render
whose disk is wiped on every restart.

Environment variables (all optional): PORT, ADMIN_PASSWORD, STAFF_PIN, SHEETS_URL, SHEETS_KEY.
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import posixpath
import re
import secrets
import socket
import threading
import time
import urllib.request
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / 'data' / 'wheel.json'
PLAYERS_FILE = ROOT / 'data' / 'players.json'
ADMIN_PAGE = ROOT / 'admin' / 'admin.html'
LOGIN_PAGE = ROOT / 'admin' / 'login.html'


def load_env_file(path):
    """Reads KEY=VALUE lines (e.g. SHEETS_URL, SHEETS_KEY) for running on a laptop. Real env vars win."""
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        key, sep, value = line.strip().partition('=')
        if sep and key and not key.startswith('#'):
            os.environ.setdefault(key.strip(), value.strip().strip('"\''))


load_env_file(ROOT / 'sheets.env')

ADMIN_USER = 'admin'
DEFAULT_PASSWORD = 'techis2026'
ENV_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
DEFAULT_PIN = os.environ.get('STAFF_PIN', '2026')
SHEETS_URL = os.environ.get('SHEETS_URL', '').strip()
SHEETS_KEY = os.environ.get('SHEETS_KEY', '').strip()
PULL_EVERY = 60  # seconds between Sheet reads, so the laptop and the iPad see each other's players
BEHIND_PROXY = bool(os.environ.get('RENDER') or os.environ.get('BEHIND_PROXY'))

DEFAULT_PRIZES = [
    {'label': 'STICKER', 'weight': 3},
    {'label': 'CANDY', 'weight': 3},
    {'label': 'BUTTON PIN', 'weight': 2},
    {'label': 'BOOKMARK', 'weight': 2},
    {'label': 'KEYCHAIN', 'weight': 1},
    {'label': 'MYSTERY PRIZE', 'weight': 1},
]
MAX_PRIZES, MAX_LABEL, MAX_WEIGHT = 8, 18, 100
# Characters the game's pixel font can draw.
NOT_DRAWABLE = re.compile(r"[^A-Z0-9 .,!?:\-+/'\"()%><=*#&_~^♥]")
PIN_RE = re.compile(r'^\d{4,8}$')

GAME_IDS = ('ai', 'cyber', 'iot', 'green', 'skills')
PLAYER_ID_RE = re.compile(r'^[a-z0-9]{6,32}$')
NOT_NAME = re.compile(r'[^A-Z0-9 ]')
MAX_NAME, MAX_SCORE, MAX_PLAYERS, MAX_PLAYER_PRIZES = 10, 1_000_000, 50_000, 4

PIN_MAX_FAILS, PIN_LOCK_SECONDS = 5, 60
LOGIN_MAX_FAILS, LOGIN_LOCK_SECONDS = 5, 300
SESSION_COOKIE, SESSION_SECONDS = 'purr_admin', 12 * 3600
sessions = {}  # admin sign-in token -> expiry time (kept in memory: a server restart signs everyone out)
login_fails = {}  # ip -> (fail count, locked until)
pin_fails = {}  # ip -> (fail count, locked until)

lock = threading.RLock()


def now_ms():
    return int(time.time() * 1000)


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), 200_000).hex()


def write_json(path, obj, indent):
    with lock:
        path.parent.mkdir(exist_ok=True)
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(obj, indent=indent, ensure_ascii=False), encoding='utf-8')
        os.replace(tmp, path)


def save(data):
    write_json(DATA_FILE, data, 2)


def load():
    with lock:
        if DATA_FILE.exists():
            return json.loads(DATA_FILE.read_text(encoding='utf-8'))
        salt = secrets.token_hex(16)
        data = {
            'prizes': DEFAULT_PRIZES,
            'staffPin': DEFAULT_PIN,
            'salt': salt,
            'passwordHash': hash_password(ENV_PASSWORD or DEFAULT_PASSWORD, salt),
        }
        save(data)
        return data


def load_players():
    with lock:
        if PLAYERS_FILE.exists():
            return json.loads(PLAYERS_FILE.read_text(encoding='utf-8'))
        return {}


def save_players(players):
    write_json(PLAYERS_FILE, players, 1)


def to_int(value):
    try:
        return int(value) if not isinstance(value, bool) else None
    except (TypeError, ValueError):
        return None


def merge_player(players, body, from_cloud=False):
    """Merges a player record. Records only ever grow: best scores keep the maximum,
    badges and prizes are added, nothing is removed. Returns (player id, error)."""
    pid = str(body.get('id', ''))
    if not PLAYER_ID_RE.match(pid):
        return None, 'Invalid player id.'
    name = re.sub(r' +', ' ', NOT_NAME.sub('', str(body.get('name', '')).upper())).strip()[:MAX_NAME]
    if not name:
        return None, 'Invalid name.'
    now = now_ms()
    player = players.get(pid)
    if player is None:
        if len(players) >= MAX_PLAYERS:
            return None, 'Player list is full.'
        created = to_int(body.get('created'))
        player = players[pid] = {'id': pid, 'name': name, 'created': created if created and created <= now else now,
                                 'best': {}, 'badges': [], 'bonus': False, 'prizes': []}
    player['name'] = name

    best = body.get('best') if isinstance(body.get('best'), dict) else {}
    badges = body.get('badges')
    if isinstance(badges, list):
        badges = {g: True for g in badges if isinstance(g, str)}
    badges = badges if isinstance(badges, dict) else {}
    for game in GAME_IDS:
        score = to_int(best.get(game))
        if score is not None and 0 <= score <= MAX_SCORE:
            player['best'][game] = max(player['best'].get(game, 0), score)
        if badges.get(game) is True and game not in player['badges']:
            player['badges'].append(game)
    if body.get('bonus') is True:
        player['bonus'] = True

    known = {p['at']: p for p in player['prizes']}
    prizes = body.get('prizes') if isinstance(body.get('prizes'), list) else []
    for item in prizes[:MAX_PLAYER_PRIZES]:
        if not isinstance(item, dict):
            continue
        at = to_int(item.get('at'))
        # Claim status: the newest change wins (claimedAt), whether it came from /admin or the Sheet.
        claimed_at = (to_int(item.get('claimedAt')) or 0) if from_cloud else 0
        if at in known:
            mine = known[at]
            if from_cloud and (claimed_at > mine.get('claimedAt', 0)
                               or (not claimed_at and not mine.get('claimedAt') and item.get('claimed') is True)):
                mine['claimed'] = item.get('claimed') is True
                if claimed_at:
                    mine['claimedAt'] = claimed_at
            continue
        label = NOT_DRAWABLE.sub('', str(item.get('prize', '')).upper()).strip()[:MAX_LABEL]
        if at and label and len(player['prizes']) < MAX_PLAYER_PRIZES:
            known[at] = {'prize': label, 'at': at, 'claimed': from_cloud and item.get('claimed') is True}
            if claimed_at:
                known[at]['claimedAt'] = claimed_at
            player['prizes'].append(known[at])
    updated = to_int(body.get('updated')) if from_cloud else None
    player['updated'] = max(player.get('updated', 0), updated or now)
    return pid, None


def leaderboard(players, limit=8):
    """Public high-score table: only names and best score per mini-game, ranked by total."""
    ranked = sorted((p for p in players.values() if any(p['best'].values())),
                    key=lambda p: (-sum(p['best'].values()), p.get('created', 0)))
    return [{'name': p['name'], 'scores': {g: p['best'].get(g, 0) for g in GAME_IDS}} for p in ranked[:limit]]


def clean_prizes(raw):
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_PRIZES:
        return None, f'Use 1 to {MAX_PRIZES} prizes.'
    prizes = []
    for item in raw:
        if not isinstance(item, dict):
            return None, 'Invalid prize.'
        label = NOT_DRAWABLE.sub('', str(item.get('label', '')).upper()).strip()[:MAX_LABEL]
        try:
            weight = int(item.get('weight'))
        except (TypeError, ValueError):
            return None, f'"{label or "?"}" needs a whole-number weight.'
        if not label:
            return None, 'Every prize needs a name.'
        if not 0 <= weight <= MAX_WEIGHT:
            return None, f'Weights must be 0 to {MAX_WEIGHT}.'
        prizes.append({'label': label, 'weight': weight})
    if not any(p['weight'] > 0 for p in prizes):
        return None, 'At least one prize must be in stock (weight above 0).'
    return prizes, None


class Cloud:
    """Backs up players and prize settings to a Google Sheet (tools/google-sheets-sync.gs).
    Changes are queued and pushed by a background thread until the Sheet confirms them."""
    enabled = bool(SHEETS_URL and SHEETS_KEY)
    dirty_players = set()
    dirty_settings = False
    last_ok = 0
    last_error = ''
    wake = threading.Event()

    @classmethod
    def call(cls, payload=None):
        if payload is None:
            req = urllib.request.Request(f'{SHEETS_URL}?key={quote(SHEETS_KEY)}')
        else:
            body = json.dumps({'key': SHEETS_KEY, **payload}, ensure_ascii=False).encode('utf-8')
            req = urllib.request.Request(SHEETS_URL, data=body, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.loads(res.read().decode('utf-8') or '{}')
        if data.get('error'):
            raise ValueError(data['error'])
        return data

    @classmethod
    def mark(cls, player_id=None, settings=False):
        if not cls.enabled:
            return
        with lock:
            if player_id:
                cls.dirty_players.add(player_id)
            cls.dirty_settings = cls.dirty_settings or settings
        cls.wake.set()

    @classmethod
    def push(cls):
        with lock:
            ids, settings = list(cls.dirty_players), cls.dirty_settings
            if not ids and not settings:
                return True
            players = load_players()
            payload = {'players': [players[i] for i in ids[:50] if i in players]}
            if settings:
                data = load()
                payload['settings'] = {'prizes': data['prizes'], 'staffPin': data['staffPin']}
        try:
            cls.call(payload)
        except (OSError, ValueError) as e:
            cls.last_error = f'{type(e).__name__}: {e}'[:200]
            return False
        with lock:
            cls.dirty_players.difference_update(ids[:50])
            if settings:
                cls.dirty_settings = False
        cls.last_ok, cls.last_error = now_ms(), ''
        return True

    @classmethod
    def pull(cls, startup=False):
        """Merges players and prize settings saved in the Sheet into the local data files, so another
        device (booth laptop, iPad on Render) sees the same records. Merging only ever adds."""
        try:
            data = cls.call()
        except (OSError, ValueError) as e:
            cls.last_error = f'{type(e).__name__}: {e}'[:200]
            if startup:
                print(f'  Google Sheet: could not load records ({cls.last_error}). Will keep retrying.')
            return False
        with lock:
            players = load_players()
            local_ids = set(players)
            for record in data.get('players') or []:
                if isinstance(record, dict):
                    merge_player(players, record, from_cloud=True)
            save_players(players)
            if startup:
                cls.dirty_players.update(local_ids)  # local-only changes go back up to the Sheet
            if not cls.dirty_settings:
                settings = data.get('settings') or {}
                prizes, error = clean_prizes(settings.get('prizes'))
                wheel = load()
                if not error:
                    wheel['prizes'] = prizes
                if PIN_RE.match(str(settings.get('staffPin', ''))):
                    wheel['staffPin'] = str(settings['staffPin'])
                save(wheel)
        cls.last_ok = now_ms()
        if startup:
            print(f'  Google Sheet: loaded {len(data.get("players") or [])} players.')
        return True

    @classmethod
    def run(cls):
        pulled = cls.pull(startup=True)
        last_pull = time.monotonic()
        delay = 5
        while True:
            cls.wake.wait(delay)
            cls.wake.clear()
            ok = cls.push()
            if ok and (time.monotonic() - last_pull >= PULL_EVERY or not pulled):
                pulled = cls.pull(startup=not pulled)
                last_pull = time.monotonic()
            delay = 5 if ok else min(delay * 2, 120)

    @classmethod
    def status(cls):
        return {'enabled': cls.enabled, 'pending': len(cls.dirty_players) + (1 if cls.dirty_settings else 0),
                'lastOk': cls.last_ok, 'lastError': cls.last_error}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json',
                      '.js': 'text/javascript', '.svg': 'image/svg+xml'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def route(self):
        path = posixpath.normpath(unquote(urlsplit(self.path).path))
        return '/' if path in ('.', '') else path

    def is_public_file(self, path):
        return (path in ('/', '/index.html', '/sw.js', '/favicon.svg', '/manifest.webmanifest')
                or path.startswith(('/css/', '/js/', '/audio/', '/icons/')))

    def client_ip(self):
        if BEHIND_PROXY and self.headers.get('X-Forwarded-For'):
            return self.headers['X-Forwarded-For'].split(',')[0].strip()
        return self.client_address[0]

    def send_json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get('Content-Length') or 0)
        if not 0 < length <= 16_384:
            return None
        try:
            body = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return None
        return body if isinstance(body, dict) else None

    def session_token(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
        except CookieError:
            return ''
        return cookie[SESSION_COOKIE].value if SESSION_COOKIE in cookie else ''

    def is_admin(self, page=False):
        token = self.session_token()
        with lock:
            if token and sessions.get(token, 0) > time.time():
                return True
            sessions.pop(token, None)
        if page:
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header('Location', '/admin/login')
            self.send_header('Content-Length', '0')
            self.end_headers()
        else:
            self.send_json({'error': 'Signed out. Sign in again.'}, HTTPStatus.UNAUTHORIZED)
        return False

    def session_cookie(self, token, max_age):
        secure = '; Secure' if BEHIND_PROXY else ''
        return f'{SESSION_COOKIE}={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Strict{secure}'

    def end_session(self):
        with lock:
            sessions.pop(self.session_token(), None)

    def login_page(self):
        """Always starts signed out, so the hidden code / taps always lead to a fresh sign-in."""
        self.end_session()
        body = LOGIN_PAGE.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header('Set-Cookie', self.session_cookie('', 0))
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def login(self):
        ip = self.client_ip()
        now = time.time()
        fails, locked_until = login_fails.get(ip, (0, 0))
        if locked_until > now:
            return self.send_json({'error': 'Too many wrong tries. Wait 5 minutes.'}, HTTPStatus.TOO_MANY_REQUESTS)
        body = self.read_json() or {}
        data = load()
        user_ok = hmac.compare_digest(str(body.get('username', '')).strip().encode(), ADMIN_USER.encode())
        pass_ok = hmac.compare_digest(hash_password(str(body.get('password', '')), data['salt']), data['passwordHash'])
        if not (user_ok and pass_ok):
            fails += 1
            login_fails[ip] = (0, now + LOGIN_LOCK_SECONDS) if fails >= LOGIN_MAX_FAILS else (fails, 0)
            return self.send_json({'error': 'Wrong username or password.'}, HTTPStatus.UNAUTHORIZED)
        login_fails.pop(ip, None)
        token = secrets.token_urlsafe(32)
        with lock:
            for old in [k for k, exp in sessions.items() if exp <= now]:
                del sessions[old]
            sessions[token] = now + SESSION_SECONDS
        payload = json.dumps({'ok': True}).encode('utf-8')
        self.send_response(HTTPStatus.OK)
        self.send_header('Set-Cookie', self.session_cookie(token, SESSION_SECONDS))
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def logout(self):
        self.end_session()
        payload = json.dumps({'ok': True}).encode('utf-8')
        self.send_response(HTTPStatus.OK)
        self.send_header('Set-Cookie', self.session_cookie('', 0))
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_HEAD(self):
        if self.is_public_file(self.route()):
            return super().do_HEAD()
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_GET(self):
        path = self.route()
        if path == '/api/prizes':
            return self.send_json({'prizes': load()['prizes']})
        if path == '/api/leaderboard':
            return self.send_json({'players': leaderboard(load_players())})
        if path == '/admin/api/players':
            if self.is_admin():
                players = sorted(load_players().values(), key=lambda p: p.get('updated', 0), reverse=True)
                self.send_json({'players': players, 'games': GAME_IDS, 'cloud': Cloud.status()})
            return
        if path == '/admin/login':
            return self.login_page()
        if path == '/admin':
            if not self.is_admin(page=True):
                return
            body = ADMIN_PAGE.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == '/admin/api/state':
            if self.is_admin():
                data = load()
                self.send_json({'prizes': data['prizes'], 'staffPin': data['staffPin'],
                                'passwordFromEnv': bool(ENV_PASSWORD), 'cloud': Cloud.status()})
            return
        if self.is_public_file(path):
            self.path = path
            return super().do_GET()
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self):
        path = self.route()
        if path == '/api/verify-pin':
            return self.verify_pin()
        if path == '/api/record':
            return self.record_player()
        if path == '/admin/login':
            return self.login()
        if path == '/admin/logout':
            return self.logout()
        if path not in ('/admin/api/prizes', '/admin/api/settings', '/admin/api/claim', '/admin/api/import'):
            return self.send_error(HTTPStatus.NOT_FOUND)
        if not self.is_admin():
            return
        body = self.read_json() if path != '/admin/api/import' else self.read_json_large()
        if body is None:
            return self.send_json({'error': 'Invalid request.'}, HTTPStatus.BAD_REQUEST)
        if path == '/admin/api/claim':
            return self.claim_prize(body)
        if path == '/admin/api/import':
            return self.import_players(body)
        with lock:
            data = load()
            if path == '/admin/api/prizes':
                prizes, error = clean_prizes(body.get('prizes'))
                if error:
                    return self.send_json({'error': error}, HTTPStatus.BAD_REQUEST)
                data['prizes'] = prizes
                save(data)
                Cloud.mark(settings=True)
                return self.send_json({'prizes': prizes})

            pin = str(body.get('staffPin', data['staffPin'])).strip()
            if not PIN_RE.match(pin):
                return self.send_json({'error': 'Staff PIN must be 4 to 8 digits.'}, HTTPStatus.BAD_REQUEST)
            new_password = body.get('newPassword') or ''
            if new_password and ENV_PASSWORD:
                return self.send_json({'error': 'The password is set by ADMIN_PASSWORD on the host (Render). Change it there.'},
                                      HTTPStatus.BAD_REQUEST)
            if new_password and len(new_password) < 8:
                return self.send_json({'error': 'New password must be at least 8 characters.'}, HTTPStatus.BAD_REQUEST)
            data['staffPin'] = pin
            if new_password:
                data['salt'] = secrets.token_hex(16)
                data['passwordHash'] = hash_password(new_password, data['salt'])
            save(data)
            Cloud.mark(settings=True)
            return self.send_json({'staffPin': pin, 'passwordChanged': bool(new_password)})

    def read_json_large(self):
        length = int(self.headers.get('Content-Length') or 0)
        if not 0 < length <= 20_000_000:
            return None
        try:
            body = json.loads(self.rfile.read(length).decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return None
        return body if isinstance(body, dict) else None

    def record_player(self):
        body = self.read_json()
        if body is None:
            return self.send_json({'error': 'Invalid request.'}, HTTPStatus.BAD_REQUEST)
        with lock:
            players = load_players()
            pid, error = merge_player(players, body)
            if error:
                return self.send_json({'error': error}, HTTPStatus.BAD_REQUEST)
            save_players(players)
        Cloud.mark(pid)
        self.send_json({'ok': True})

    def import_players(self, body):
        """Merges a JSON backup exported from a device (or from /admin) into the server records."""
        records = body.get('players')
        if isinstance(records, dict):
            records = list(records.values())
        if not isinstance(records, list):
            return self.send_json({'error': 'No players found in that file.'}, HTTPStatus.BAD_REQUEST)
        added = 0
        with lock:
            players = load_players()
            for record in records:
                if isinstance(record, dict):
                    pid, error = merge_player(players, record, from_cloud=True)
                    if not error:
                        added += 1
                        Cloud.mark(pid)
            save_players(players)
        self.send_json({'ok': True, 'merged': added})

    def claim_prize(self, body):
        with lock:
            players = load_players()
            player = players.get(str(body.get('id', '')))
            prize = next((p for p in player['prizes'] if p['at'] == to_int(body.get('at'))), None) if player else None
            if prize is None:
                return self.send_json({'error': 'Prize not found.'}, HTTPStatus.NOT_FOUND)
            prize['claimed'] = body.get('claimed') is True
            prize['claimedAt'] = player['updated'] = now_ms()
            save_players(players)
        Cloud.mark(player['id'])
        self.send_json({'ok': True, 'claimed': prize['claimed']})

    def verify_pin(self):
        ip = self.client_ip()
        now = time.time()
        fails, locked_until = pin_fails.get(ip, (0, 0))
        if locked_until > now:
            return self.send_json({'ok': False, 'error': 'Too many tries. Wait a minute.'}, HTTPStatus.TOO_MANY_REQUESTS)
        body = self.read_json() or {}
        ok = hmac.compare_digest(str(body.get('pin', '')).encode(), load()['staffPin'].encode())
        if ok:
            pin_fails.pop(ip, None)
        else:
            fails += 1
            pin_fails[ip] = (0, now + PIN_LOCK_SECONDS) if fails >= PIN_MAX_FAILS else (fails, 0)
        self.send_json({'ok': ok})


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('10.255.255.255', 1))
            return s.getsockname()[0]
    except OSError:
        return None


def check_sheets():
    if not Cloud.enabled:
        print('SHEETS_URL and SHEETS_KEY are not set. Set both, then run this again.')
        return 1
    try:
        data = Cloud.call()
        print(f'Read OK: the Sheet has {len(data.get("players") or [])} players.')
        Cloud.call({'players': []})
        print('Write OK: the server can save to the Sheet. Google Sheet backup is working.')
        return 0
    except (OSError, ValueError) as e:
        print(f'FAILED: {type(e).__name__}: {e}')
        print('Check the Web app URL (must end in /exec, access "Anyone") and that SHEETS_KEY matches SECRET_KEY.')
        return 1


def main():
    parser = argparse.ArgumentParser(description="PURR-OGRAM booth server")
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 8000)))
    parser.add_argument('--lan', action='store_true', help='allow phones/tablets on the same network to connect')
    parser.add_argument('--check-sheets', action='store_true', help='test the Google Sheet connection and exit')
    args = parser.parse_args()

    if args.check_sheets:
        return check_sheets()

    data = load()
    if ENV_PASSWORD and not hmac.compare_digest(hash_password(ENV_PASSWORD, data['salt']), data['passwordHash']):
        data['salt'] = secrets.token_hex(16)
        data['passwordHash'] = hash_password(ENV_PASSWORD, data['salt'])
        save(data)
    hosted = 'PORT' in os.environ
    host = '0.0.0.0' if args.lan or hosted else '127.0.0.1'
    server = ThreadingHTTPServer((host, args.port), Handler)

    print('\n  PURR-OGRAM: The ConvergeIT Quest is running!')
    print(f'  Game:   http://localhost:{args.port}')
    print(f'  Admin:  http://localhost:{args.port}/admin   (username: {ADMIN_USER})')
    if args.lan and (ip := lan_ip()):
        print(f'  Other devices on this Wi-Fi: http://{ip}:{args.port}')
    if hmac.compare_digest(hash_password(DEFAULT_PASSWORD, data['salt']), data['passwordHash']):
        print(f'\n  WARNING: admin password is still the default "{DEFAULT_PASSWORD}". Change it at /admin.')
    if Cloud.enabled:
        print('  Google Sheet backup: ON')
        threading.Thread(target=Cloud.run, daemon=True).start()
    else:
        print('  Google Sheet backup: off (set SHEETS_URL and SHEETS_KEY to turn it on)')
    print('\n  Press Ctrl+C to stop.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Stopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    raise SystemExit(main())
