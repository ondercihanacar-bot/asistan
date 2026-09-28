import hashlib
import secrets
import re
import time
import io
import base64
from datetime import datetime
from dateutil.relativedelta import relativedelta
from typing import Optional
from fastapi import Request, HTTPException, status
import pyotp
import qrcode
from database import get_db

# 2FA in-memory pending storage
pending_2fa_setups: dict[int, str] = {}
pending_2fa_logins: dict[str, dict] = {}

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return key.hex(), salt

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return secrets.compare_digest(key.hex(), password_hash)

def has_any_users() -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM users")
    cnt = cursor.fetchone()["cnt"]
    conn.close()
    return cnt > 0

def get_user_by_email(email: str) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    clean = email.strip().lower()
    cursor.execute("""
        SELECT id, email, full_name, password_hash, salt, is_active, two_factor_secret, two_factor_enabled 
        FROM users 
        WHERE LOWER(email) = ? OR LOWER(email) = ? OR LOWER(email) LIKE ? OR LOWER(email) LIKE ?
    """, (clean, clean + "@gmail.com", f"{clean}@%", f"{clean}%@%"))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, full_name, is_active, two_factor_secret, two_factor_enabled FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def register_user(email: str, full_name: str, password: str) -> tuple[bool, str, Optional[dict]]:
    email = email.strip().lower()
    full_name = full_name.strip()
    
    if not email or "@" not in email or "." not in email:
        return False, "Geçerli bir e-posta adresi giriniz.", None
        
    if len(password) < 4:
        return False, "Parola en az 4 karakter olmalıdır.", None

    if get_user_by_email(email):
        return False, "Bu e-posta adresi ile zaten kayıtlı bir hesap var.", None

    pwd_hash, salt = hash_password(password)
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as cnt FROM users")
    user_count = cursor.fetchone()["cnt"]

    if user_count == 0:
        # İlk kullanıcı: Mevcut tüm verilerin (user_id=1) sahibi olması için ID=1 olarak eklenir
        cursor.execute("""
            INSERT INTO users (id, email, full_name, password_hash, salt, created_at, is_active)
            VALUES (1, ?, ?, ?, ?, datetime('now'), 1)
        """, (email, full_name or email.split("@")[0].capitalize(), pwd_hash, salt))
        user_id = 1
    else:
        cursor.execute("""
            INSERT INTO users (email, full_name, password_hash, salt, created_at, is_active)
            VALUES (?, ?, ?, ?, datetime('now'), 1)
        """, (email, full_name or email.split("@")[0].capitalize(), pwd_hash, salt))
        user_id = cursor.lastrowid

    conn.commit()
    conn.close()

    user = get_user_by_id(user_id)
    return True, "Kayıt başarılı.", user

def authenticate_user(email: str, password: str) -> tuple[bool, str, Optional[dict]]:
    user = get_user_by_email(email)
    if not user:
        return False, "E-posta veya parola hatalı.", None
    if not user.get("is_active"):
        return False, "Bu hesap devre dışı bırakılmış.", None
    if not verify_password(password, user["password_hash"], user["salt"]):
        return False, "E-posta veya parola hatalı.", None

    return True, "Giriş başarılı.", {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "two_factor_enabled": bool(user.get("two_factor_enabled", 0)),
        "two_factor_secret": user.get("two_factor_secret")
    }

def create_session(user_id: int, remember_me: bool = True) -> str:
    token = secrets.token_urlsafe(32)
    # Beni hatırla: 30 gün, aksi halde 1 gün
    days = 30 if remember_me else 1
    expires_at = (datetime.now() + relativedelta(days=days)).isoformat()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires_at))
    conn.commit()
    conn.close()
    return token

def delete_session(token: str):
    if not token:
        return
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

def get_current_user_from_token(token: str) -> Optional[dict]:
    if not token:
        return None
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.email, u.full_name, u.is_active, u.two_factor_enabled, s.expires_at
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND u.is_active = 1
    """, (token,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
        
    try:
        exp = datetime.fromisoformat(row["expires_at"])
        if datetime.now() > exp:
            delete_session(token)
            return None
    except Exception:
        pass

    return {
        "id": row["id"],
        "email": row["email"],
        "full_name": row["full_name"],
        "two_factor_enabled": bool(row["two_factor_enabled"])
    }

def generate_2fa_secret() -> str:
    return pyotp.random_base32()

def get_2fa_qr_base64(secret: str, email: str) -> tuple[str, str]:
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name="Akıllı Asistan")
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return qr_b64, totp_uri

def verify_2fa_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    clean_code = str(code).strip().replace(" ", "").replace("-", "")
    return bool(pyotp.TOTP(secret).verify(clean_code, valid_window=1))

def enable_2fa_for_user(user_id: int, secret: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1 WHERE id = ?", (secret, user_id))
    conn.commit()
    conn.close()

def disable_2fa_for_user(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0 WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

def get_token_from_request(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization") or request.headers.get("X-Auth-Token")
    token = None
    if auth_header:
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        else:
            token = auth_header.strip()
    if not token:
        token = request.query_params.get("token")
    return token

def get_current_user_optional(request: Request) -> Optional[dict]:
    token = get_token_from_request(request)
    return get_current_user_from_token(token)

def get_current_user(request: Request) -> dict:
    user = get_current_user_optional(request)
    if not user:
        # Eğer henüz hiç kullanıcı kayıtlı değilse, ilk kurulum modunda varsayılan geçici kullanıcı izin verilebilir
        # ancak kullanıcı var ise kesinlikle 401 Unauthorized döner
        if not has_any_users():
            return {"id": 1, "email": "setup@local", "full_name": "Kurulum Kullanıcısı"}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum açmanız gerekiyor."
        )
    return user
