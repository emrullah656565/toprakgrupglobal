import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

import psycopg
from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

BASE_DIR = os.path.dirname(__file__)
DATABASE_URL = os.environ.get("DATABASE_URL", "")
SESSION_SECRET = os.environ.get("SESSION_SECRET", secrets.token_urlsafe(48))
INITIAL_USER = os.environ.get("ADMIN_USERNAME", "admin")
INITIAL_PASSWORD = os.environ.get("ADMIN_INITIAL_PASSWORD", "")
PUBLIC_ORIGIN = os.environ.get("PUBLIC_ORIGIN", "https://toprakgrupglobal.com.tr")
MAX_UPLOAD = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"}

app = FastAPI(title="Toprak Grup Global Yönetim Paneli", docs_url=None, redoc_url=None)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, https_only=True, same_site="lax", max_age=60 * 60 * 8)
app.mount("/admin/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="admin-static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


class SQLiteConnection:
    def __init__(self, path):
        self.conn = sqlite3.connect(path)

    def execute(self, sql, params=()):
        sql = sql.replace("%s", "?").replace("NOW()", "CURRENT_TIMESTAMP").replace("'{}'::jsonb", "'{}'")
        sql = sql.replace("BIGSERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
        sql = sql.replace("TIMESTAMPTZ", "TIMESTAMP").replace("JSONB", "TEXT").replace("BYTEA", "BLOB")
        return self.conn.execute(sql, params)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type: self.conn.rollback()
        else: self.conn.commit()
        self.conn.close()


def db():
    if DATABASE_URL:
        return psycopg.connect(DATABASE_URL)
    return SQLiteConnection(os.environ.get("SQLITE_PATH", "/tmp/toprak-admin.db"))


def password_hash(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def password_ok(password: str, stored: str) -> bool:
    try:
        _, salt, expected = stored.split("$", 2)
        actual = password_hash(password, base64.b64decode(salt)).split("$", 2)[2]
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def now():
    return datetime.now(timezone.utc)


def current_user(request: Request):
    return request.session.get("user")


def require_user(request: Request):
    user = current_user(request)
    if not user:
        raise HTTPException(401, "Oturum gerekli")
    return user


def csrf(request: Request):
    token = request.session.get("csrf")
    if not token:
        token = secrets.token_urlsafe(32)
        request.session["csrf"] = token
    return token


def verify_csrf(request: Request, token: str):
    expected = request.session.get("csrf", "")
    if not expected or not hmac.compare_digest(token, expected):
        raise HTTPException(403, "Geçersiz güvenlik anahtarı")


def audit(actor: str, action: str, target: str):
    with db() as conn:
        conn.execute("INSERT INTO audit_log(actor, action, target) VALUES (%s,%s,%s)", (actor, action, target))


def init_db():
    with db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("""CREATE TABLE IF NOT EXISTS entries (
            id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', image_id BIGINT,
            country TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'published', sort_order INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(kind,slug))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS media (
            id BIGSERIAL PRIMARY KEY, filename TEXT NOT NULL, mime_type TEXT NOT NULL, alt_text TEXT NOT NULL DEFAULT '',
            data BYTEA NOT NULL, size INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("""CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("""CREATE TABLE IF NOT EXISTS audit_log (
            id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        if INITIAL_PASSWORD:
            conn.execute("INSERT INTO users(username,password_hash) VALUES (%s,%s) ON CONFLICT(username) DO NOTHING", (INITIAL_USER, password_hash(INITIAL_PASSWORD)))
        defaults = {
            "company_name": "TOPRAK GRUP GLOBAL GIDA İNŞAAT İTHALAT İHRACAT TİCARET VE SANAYİ LİMİTED ŞİRKETİ",
            "phone": "+90 505 472 89 85", "email": "info@toprakgrupglobal.com.tr",
            "address": "Kışla Mahallesi, 65400 Van", "site_title": "Toprak Grup Global",
        }
        for key, value in defaults.items():
            conn.execute("INSERT INTO settings(key,value) VALUES (%s,%s) ON CONFLICT(key) DO NOTHING", (key, value))
        seed_entries = [
            ("product","muz-ticareti","Muz Ticareti","Ekvador ve Hindistan kaynaklı muz tedariki.","Ekvador · Hindistan",10),
            ("product","karpuz-ticareti","Karpuz Ticareti","Seçkin üretim bölgelerinden taze karpuz ticareti.","Uluslararası",20),
            ("product","hurma-ticareti","Hurma Ticareti","Kalite ve süreklilik odaklı hurma tedariki.","Uluslararası",30),
            ("product","iran-domatesi","Domates Ticareti","İran kaynaklı taze domates tedariki.","İran",40),
            ("product","seker-ticareti","Şeker Ticareti","Brezilya'dan tedarik edilen şekerin Afganistan pazarına sevki.","Brezilya → Afganistan",50),
            ("product","lastik-granulu","Lastik Granülü","Geri dönüşüm ve sanayi uygulamalarına yönelik lastik granülü.","Uluslararası",60),
            ("product","gpps-1540","GPPS 1540","Endüstriyel üretim için GPPS 1540 plastik hammaddesi.","Uluslararası",70),
            ("product","plastik-hammaddeler","Plastik Hammaddeler","Üretim ihtiyaçlarına uygun polimer ve plastik hammaddeler.","Uluslararası",80),
            ("product","celik-yapi-urunleri","Çelik Yapı Ürünleri","İnşaat ve sanayi projeleri için çelik ürünler.","Uluslararası",90),
            ("product","oto-lastikleri","Otomotiv Lastikleri","Farklı araç segmentleri için lastik tedariki.","Uluslararası",100),
            ("activity","uluslararasi-gida-ticareti","Uluslararası Gıda Ticareti","Muz, karpuz, hurma, domates ve şeker ürünlerinde uçtan uca ticaret.","Küresel",10),
            ("activity","endustriyel-hammaddeler","Endüstriyel Hammaddeler","GPPS 1540, plastik hammaddeler ve lastik granülü tedariki.","Küresel",20),
            ("activity","celik-ve-yapi","Çelik ve Yapı Ürünleri","Proje ihtiyaçlarına uygun çelik ve yapı ürünlerinin tedariği.","Küresel",30),
            ("activity","lojistik-ve-tedarik","Lojistik ve Tedarik Zinciri","Kaynak ülkeden hedef pazara planlı sevkiyat ve operasyon takibi.","Küresel",40),
            ("page","kurumsal","Kurumsal","Şirket profili, değerler, vizyon ve iş yaklaşımı.","",10),
            ("page","ticaret-agi","Ticaret Ağı","Kaynak ülkeler, hedef pazarlar ve lojistik kabiliyetler.","",20),
            ("page","iletisim","İletişim","Telefon, e-posta, adres ve iletişim formu bilgileri.","",30),
            ("legal","kvkk-aydinlatma","KVKK Aydınlatma Metni","Kişisel verilerin işlenmesine ilişkin aydınlatma metni.","",10),
            ("legal","gizlilik-politikasi","Gizlilik Politikası","Web sitesi ve iletişim süreçleri gizlilik politikası.","",20),
            ("legal","cerez-politikasi","Çerez Politikası","Çerezlerin kullanımına ilişkin bilgilendirme.","",30),
            ("legal","kullanim-kosullari","Kullanım Koşulları","Web sitesi kullanım şartları.","",40),
            ("legal","ilgili-kisi-basvurusu","İlgili Kişi Başvurusu","KVKK kapsamındaki başvuru prosedürü.","",50),
        ]
        for item in seed_entries:
            conn.execute("""INSERT INTO entries(kind,slug,title,summary,country,sort_order)
                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(kind,slug) DO NOTHING""", item)


@app.on_event("startup")
def startup():
    init_db()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path.startswith("/api/public") or request.url.path.startswith("/media/"):
        response.headers["Access-Control-Allow-Origin"] = PUBLIC_ORIGIN
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/admin", response_class=HTMLResponse)
def admin(request: Request):
    if not current_user(request):
        return RedirectResponse("/admin/login", 303)
    with db() as conn:
        counts = dict(conn.execute("SELECT kind, COUNT(*) FROM entries GROUP BY kind").fetchall())
        media_count = conn.execute("SELECT COUNT(*) FROM media").fetchone()[0]
        recent = conn.execute("SELECT actor,action,target,created_at FROM audit_log ORDER BY id DESC LIMIT 8").fetchall()
    return templates.TemplateResponse(request, "dashboard.html", {"section": "dashboard", "counts": counts, "media_count": media_count, "recent": recent, "csrf": csrf(request)})


@app.get("/admin/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html", {"error": None, "csrf": csrf(request)})


@app.post("/admin/login", response_class=HTMLResponse)
def login(request: Request, username: str = Form(...), password: str = Form(...), csrf_token: str = Form(...)):
    verify_csrf(request, csrf_token)
    with db() as conn:
        row = conn.execute("SELECT username,password_hash,role FROM users WHERE username=%s AND active=TRUE", (username,)).fetchone()
    if not row or not password_ok(password, row[1]):
        return templates.TemplateResponse(request, "login.html", {"error": "Kullanıcı adı veya şifre hatalı.", "csrf": csrf(request)}, status_code=401)
    request.session.clear(); request.session["user"] = {"username": row[0], "role": row[2]}; csrf(request)
    audit(row[0], "Giriş", "Yönetim paneli")
    return RedirectResponse("/admin", 303)


@app.post("/admin/logout")
def logout(request: Request, csrf_token: str = Form(...)):
    verify_csrf(request, csrf_token); request.session.clear()
    return RedirectResponse("/admin/login", 303)


@app.get("/admin/entries", response_class=HTMLResponse)
def entries(request: Request, kind: str = "product"):
    require_user(request)
    with db() as conn:
        rows = conn.execute("SELECT id,slug,title,summary,country,status,sort_order,updated_at,image_id FROM entries WHERE kind=%s ORDER BY sort_order,title", (kind,)).fetchall()
        media = conn.execute("SELECT id,filename,alt_text FROM media ORDER BY id DESC").fetchall()
    labels = {"product":"Ürün Grupları", "activity":"Faaliyetler", "page":"Sayfalar", "legal":"Kurumsal Metinler"}
    return templates.TemplateResponse(request, "entries.html", {"section": kind, "kind": kind, "label": labels.get(kind, kind), "rows": rows, "media": media, "csrf": csrf(request)})


@app.post("/admin/entries/save")
def save_entry(request: Request, csrf_token: str = Form(...), kind: str = Form(...), entry_id: str = Form(""), slug: str = Form(...), title: str = Form(...), summary: str = Form(""), body: str = Form(""), country: str = Form(""), status: str = Form("published"), sort_order: int = Form(0), image_id: str = Form("")):
    user = require_user(request); verify_csrf(request, csrf_token)
    clean_slug = "-".join(slug.lower().strip().replace("ı","i").replace("ş","s").replace("ğ","g").replace("ü","u").replace("ö","o").replace("ç","c").split())
    image_value = int(image_id) if image_id else None
    with db() as conn:
        if entry_id:
            conn.execute("UPDATE entries SET slug=%s,title=%s,summary=%s,body=%s,country=%s,status=%s,sort_order=%s,image_id=%s,updated_at=NOW() WHERE id=%s AND kind=%s", (clean_slug,title,summary,body,country,status,sort_order,image_value,int(entry_id),kind))
        else:
            conn.execute("INSERT INTO entries(kind,slug,title,summary,body,country,status,sort_order,image_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", (kind,clean_slug,title,summary,body,country,status,sort_order,image_value))
    audit(user["username"], "Kaydet", f"{kind}: {title}")
    return RedirectResponse(f"/admin/entries?kind={kind}", 303)


@app.post("/admin/entries/delete")
def delete_entry(request: Request, csrf_token: str = Form(...), entry_id: int = Form(...), kind: str = Form(...)):
    user = require_user(request); verify_csrf(request, csrf_token)
    with db() as conn:
        row = conn.execute("DELETE FROM entries WHERE id=%s AND kind=%s RETURNING title", (entry_id,kind)).fetchone()
    if row: audit(user["username"], "Sil", f"{kind}: {row[0]}")
    return RedirectResponse(f"/admin/entries?kind={kind}", 303)


@app.get("/admin/media", response_class=HTMLResponse)
def media_page(request: Request):
    require_user(request)
    with db() as conn: rows = conn.execute("SELECT id,filename,mime_type,alt_text,size,created_at FROM media ORDER BY id DESC").fetchall()
    return templates.TemplateResponse(request, "media.html", {"section":"media", "rows":rows, "csrf":csrf(request)})


@app.post("/admin/media/upload")
async def upload_media(request: Request, file: UploadFile, alt_text: str = Form(""), csrf_token: str = Form(...)):
    user = require_user(request); verify_csrf(request, csrf_token)
    data = await file.read(MAX_UPLOAD + 1)
    if file.content_type not in ALLOWED_TYPES or len(data) > MAX_UPLOAD or not data:
        raise HTTPException(400, "Yalnızca JPG, PNG, WebP, GIF veya SVG; en fazla 10 MB.")
    filename = f"{uuid.uuid4().hex}-{os.path.basename(file.filename or 'gorsel')}"
    with db() as conn:
        row = conn.execute("INSERT INTO media(filename,mime_type,alt_text,data,size) VALUES (%s,%s,%s,%s,%s) RETURNING id", (filename,file.content_type,alt_text,data,len(data))).fetchone()
    audit(user["username"], "Görsel yükle", filename)
    return RedirectResponse("/admin/media", 303)


@app.post("/admin/media/delete")
def delete_media(request: Request, csrf_token: str = Form(...), media_id: int = Form(...)):
    user = require_user(request); verify_csrf(request, csrf_token)
    with db() as conn:
        used = conn.execute("SELECT COUNT(*) FROM entries WHERE image_id=%s", (media_id,)).fetchone()[0]
        if used: raise HTTPException(409, "Bu görsel içerikte kullanılıyor.")
        row = conn.execute("DELETE FROM media WHERE id=%s RETURNING filename", (media_id,)).fetchone()
    if row: audit(user["username"], "Görsel sil", row[0])
    return RedirectResponse("/admin/media", 303)


@app.get("/media/{media_id}")
def get_media(media_id: int):
    with db() as conn: row = conn.execute("SELECT data,mime_type,filename FROM media WHERE id=%s", (media_id,)).fetchone()
    if not row: raise HTTPException(404)
    return Response(bytes(row[0]), media_type=row[1], headers={"Cache-Control":"public, max-age=86400", "Content-Disposition":f'inline; filename="{row[2]}"'})


@app.get("/admin/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    require_user(request)
    with db() as conn: rows = conn.execute("SELECT key,value FROM settings ORDER BY key").fetchall()
    return templates.TemplateResponse(request, "settings.html", {"section":"settings", "rows":rows, "csrf":csrf(request)})


@app.post("/admin/settings")
async def save_settings(request: Request):
    user = require_user(request); form = await request.form(); verify_csrf(request, str(form.get("csrf_token", "")))
    with db() as conn:
        for key, value in form.multi_items():
            if key.startswith("setting_"):
                conn.execute("INSERT INTO settings(key,value) VALUES (%s,%s) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", (key[8:], str(value)))
    audit(user["username"], "Güncelle", "Genel ayarlar")
    return RedirectResponse("/admin/settings", 303)


@app.get("/admin/security", response_class=HTMLResponse)
def security_page(request: Request):
    require_user(request)
    with db() as conn: logs = conn.execute("SELECT actor,action,target,created_at FROM audit_log ORDER BY id DESC LIMIT 100").fetchall()
    return templates.TemplateResponse(request, "security.html", {"section":"security", "logs":logs, "csrf":csrf(request), "message":None})


@app.post("/admin/security/password", response_class=HTMLResponse)
def change_password(request: Request, current_password: str = Form(...), new_password: str = Form(...), csrf_token: str = Form(...)):
    user = require_user(request); verify_csrf(request, csrf_token)
    if len(new_password) < 12: raise HTTPException(400, "Yeni şifre en az 12 karakter olmalı.")
    with db() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE username=%s", (user["username"],)).fetchone()
        if not row or not password_ok(current_password, row[0]): raise HTTPException(403, "Mevcut şifre hatalı.")
        conn.execute("UPDATE users SET password_hash=%s WHERE username=%s", (password_hash(new_password),user["username"]))
    audit(user["username"], "Şifre değiştir", user["username"])
    request.session.clear()
    return RedirectResponse("/admin/login", 303)


@app.get("/api/public/content")
def public_content(kind: Optional[str] = None):
    query = "SELECT id,kind,slug,title,summary,body,country,status,sort_order,image_id,metadata FROM entries WHERE status='published'"
    params = []
    if kind: query += " AND kind=%s"; params.append(kind)
    query += " ORDER BY kind,sort_order,title"
    with db() as conn:
        rows = conn.execute(query, params).fetchall()
        settings = dict(conn.execute("SELECT key,value FROM settings").fetchall())
    keys = ["id","kind","slug","title","summary","body","country","status","sort_order","image_id","metadata"]
    data = [dict(zip(keys,row)) for row in rows]
    for item in data: item["image_url"] = f"/media/{item['image_id']}" if item["image_id"] else None
    return {"company":settings,"content":data}
