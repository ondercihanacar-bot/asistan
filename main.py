import os
import io
import base64
import socket
import asyncio
import sqlite3
import shutil
from datetime import datetime, date, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, UploadFile, File, Depends, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from auth import (
    register_user,
    authenticate_user,
    create_session,
    delete_session,
    get_current_user,
    get_current_user_optional,
    get_token_from_request,
    has_any_users
)
from database import get_db, init_db, next_cycle_date, DB_PATH

# Günde 2 Kez (09:00 ve 22:00) Otomatik Gmail Tarama Görevi
async def scheduled_gmail_sync_worker():
    """Her gün 09:00 ve 22:00'da arka planda sessizce Gmail'i tarar ve yeni ekstreleri kaydeder"""
    last_triggered_hour = None
    while True:
        try:
            now = datetime.now()
            # 09:00 veya 22:00 saat dilimi kontrolü (dakika 0-2 aralığında tetikle)
            if now.hour in [9, 22] and last_triggered_hour != now.hour:
                last_triggered_hour = now.hour
                print(f"⏰ [Otomatik Görev] Saat {now.strftime('%H:%M')} - Gmail ekstre taraması başlatılıyor...")
                try:
                    res = execute_gmail_sync_internal()
                    if res and res.get("count", 0) > 0:
                        print(f"✅ [Otomatik Görev] {res['count']} yeni fatura/ekstre sisteme işlendi!")
                except Exception as sync_err:
                    print(f"⚠️ [Otomatik Görev Hatası] {sync_err}")
            elif now.hour not in [9, 22]:
                last_triggered_hour = None
        except Exception as e:
            print(f"Zamanlayıcı döngü hatası: {e}")
        
        # 45 saniyede bir saati kontrol et
        await asyncio.sleep(45)

# Belirlenen Gün ve Saatte Otomatik Bilgisayara Yedek Alma Görevi
async def scheduled_backup_worker():
    """Belirlenen gün ve saatte bilgisayara otomatik yedek alan arka plan servisi"""
    last_backup_trigger_key = None
    while True:
        try:
            now = datetime.now()
            conn = get_db()
            cursor = conn.cursor()
            rows = cursor.execute("SELECT key, value FROM admin_settings WHERE key LIKE 'backup_%'").fetchall()
            settings = {r["key"]: r["value"] for r in rows}
            conn.close()

            auto_enabled = settings.get("backup_auto_enabled", "false") == "true"
            schedule_day = settings.get("backup_schedule_day", "everyday") # everyday, mon, tue, wed, thu, fri, sat, sun
            schedule_time = settings.get("backup_schedule_time", "03:00") # HH:MM
            folder = settings.get("backup_folder") or os.path.join(os.path.dirname(__file__), "backups")

            if auto_enabled and schedule_time:
                try:
                    parts = schedule_time.split(":")
                    target_hour = int(parts[0])
                    target_min = int(parts[1]) if len(parts) > 1 else 0
                except:
                    target_hour, target_min = 3, 0

                weekday_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
                current_weekday = weekday_map.get(now.weekday())

                is_day_match = (schedule_day == "everyday") or (schedule_day == current_weekday)
                is_time_match = (now.hour == target_hour and now.minute == target_min)
                trigger_key = f"{now.strftime('%Y-%m-%d')}_{target_hour}_{target_min}"

                if is_day_match and is_time_match and last_backup_trigger_key != trigger_key:
                    last_backup_trigger_key = trigger_key
                    print(f"📦 [Otomatik Yedekleme] Zamanı geldi ({schedule_day} {schedule_time}), yedek alınıyor: {folder}")
                    success, filename, msg = perform_database_backup(folder)
                    if success:
                        print(f"✅ [Otomatik Yedekleme Tamamlandı] {filename}")
                    else:
                        print(f"⚠️ [Otomatik Yedekleme Başarısız] {msg}")
        except Exception as e:
            print(f"⚠️ [Yedekleme Zamanlayıcı Hatası] {e}")

        await asyncio.sleep(30)

def perform_database_backup(target_folder: Optional[str] = None) -> tuple:
    try:
        if not target_folder:
            target_folder = os.path.join(os.path.dirname(__file__), "backups")
        target_folder = os.path.abspath(target_folder)
        os.makedirs(target_folder, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"asistan_yedek_{timestamp}.db"
        dest_path = os.path.join(target_folder, filename)

        # Checkpoint WAL
        try:
            conn = get_db()
            conn.execute("PRAGMA wal_checkpoint(FULL);")
            conn.close()
        except:
            pass

        shutil.copy2(DB_PATH, dest_path)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn = get_db()
        conn.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('backup_last_run', ?)", (now_str,))
        conn.commit()
        conn.close()

        file_size_kb = round(os.path.getsize(dest_path) / 1024, 1)
        return True, filename, f"{file_size_kb} KB"
    except Exception as e:
        return False, "", str(e)

def perform_database_restore(source_path: str) -> tuple:
    if not os.path.exists(source_path):
        return False, "Yedek dosyası diskte bulunamadı."

    # 1. Mevcut veritabanının acil kurtarma kopyası (safety restore point)
    safety_backup = DB_PATH + f".safety_before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    try:
        if os.path.exists(DB_PATH):
            shutil.copy2(DB_PATH, safety_backup)
    except Exception as e:
        print(f"Emniyet kopyası uyarısı: {e}")

    try:
        # 2. SQLite veritabanı bütünlüğünü doğrula
        test_conn = sqlite3.connect(source_path)
        tables = [r[0] for r in test_conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        test_conn.close()

        if "payments" not in tables:
            return False, "Seçilen dosya geçerli bir asistan veritabanı değil ('payments' tablosu eksik)."

        # 3. Dosyayı ana veritabanı üzerine yaz
        shutil.copy2(source_path, DB_PATH)

        # 4. Doğrula
        verify_conn = get_db()
        cur = verify_conn.cursor()
        p_count = cur.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
        verify_conn.close()

        return True, f"Yedek başarıyla geri yüklendi! ({p_count} ödeme kaydı doğrulandı)"
    except Exception as e:
        # Hata durumunda emniyet kopyasını geri koy
        if os.path.exists(safety_backup):
            shutil.copy2(safety_backup, DB_PATH)
        return False, f"Geri yükleme sırasında hata oluştu: {str(e)}"

# Lifespan for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Otomatik arka plan görevlerini başlat
    sync_task = asyncio.create_task(scheduled_gmail_sync_worker())
    backup_task = asyncio.create_task(scheduled_backup_worker())
    yield
    sync_task.cancel()
    backup_task.cancel()

app = FastAPI(title="Akıllı Ödeme ve Hatırlatıcı Asistanı", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Connection Manager for Real-time Two-Way Sync
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# Pydantic Schemas
class PaymentCreate(BaseModel):
    title: str
    category: str
    sub_type: Optional[str] = None
    amount: float
    currency: Optional[str] = "TL"
    due_date: str
    repeat_type: Optional[str] = "none"
    vehicle_plate: Optional[str] = None
    vehicle_km: Optional[int] = None
    notes: Optional[str] = None

class PaymentUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    sub_type: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    due_date: Optional[str] = None
    repeat_type: Optional[str] = None
    status: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_km: Optional[int] = None
    notes: Optional[str] = None


class VehicleProfile(BaseModel):
    id: Optional[int] = None
    brand_model: Optional[str] = None
    plate: Optional[str] = None
    year: Optional[int] = None
    tuvturk_date: Optional[str] = None
    insurance_date: Optional[str] = None
    kasko_date: Optional[str] = None
    maintenance_date: Optional[str] = None
    maintenance_km: Optional[int] = None
    current_km: Optional[int] = None
    last_maintenance_date: Optional[str] = None
    last_maintenance_km: Optional[int] = None
    interval_year: Optional[int] = 2
    interval_km: Optional[int] = 30000
    is_primary: Optional[int] = 0

class PayAction(BaseModel):
    paid_amount: Optional[float] = None
    receipt_note: Optional[str] = None

def get_local_ip():
    """Detects local LAN IP to connect from Android phone."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# --- API Endpoints ---


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = ""
    remember_me: Optional[bool] = True

class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: Optional[bool] = True

@app.get("/api/auth/status")
def auth_status(request: Request):
    user = get_current_user_optional(request)
    return {
        "has_users": has_any_users(),
        "is_authenticated": user is not None,
        "user": user
    }

@app.post("/api/auth/register")
def auth_register(payload: RegisterRequest):
    success, msg, user = register_user(payload.email, payload.full_name or "", payload.password)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    token = create_session(user["id"], remember_me=bool(payload.remember_me))
    return {"success": True, "token": token, "user": user, "message": msg}

@app.post("/api/auth/login")
def auth_login(payload: LoginRequest):
    success, msg, user = authenticate_user(payload.email, payload.password)
    if not success:
        raise HTTPException(status_code=401, detail=msg)
    token = create_session(user["id"], remember_me=bool(payload.remember_me))
    return {"success": True, "token": token, "user": user, "message": msg}

@app.post("/api/auth/logout")
def auth_logout(request: Request):
    token = get_token_from_request(request)
    if token:
        delete_session(token)
    return {"success": True}

@app.get("/api/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    return {"user": user}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive & handle incoming ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/payments")
def list_payments(
    status: Optional[str] = Query("all"),
    category: Optional[str] = Query("all"),
    user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM payments WHERE user_id = ?"
    params = [user["id"]]
    
    if status != "all":
        query += " AND status = ?"
        params.append(status)
        
    if category != "all":
        query += " AND category = ?"
        params.append(category)
        
    query += " ORDER BY due_date ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    today = date.today()
    results = []
    
    for r in rows:
        d = dict(r)
        try:
            due = datetime.strptime(d["due_date"], "%Y-%m-%d").date()
            diff_days = (due - today).days
        except Exception:
            diff_days = 999
            
        d["days_remaining"] = diff_days
        if d["status"] == "paid":
            d["urgency"] = "paid"
        elif diff_days < 0:
            d["urgency"] = "overdue"
        elif diff_days <= 3:
            d["urgency"] = "critical"
        elif diff_days <= 7:
            d["urgency"] = "soon"
        else:
            d["urgency"] = "normal"
            
        results.append(d)
        
    conn.close()
    return results

@app.post("/api/payments")
async def create_payment(payload: PaymentCreate):
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    
    cursor.execute("""
    INSERT INTO payments (title, category, sub_type, amount, currency, due_date, repeat_type, status, vehicle_plate, vehicle_km, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    """, (
        payload.title,
        payload.category,
        payload.sub_type,
        payload.amount,
        payload.currency or "TL",
        payload.due_date,
        payload.repeat_type or "none",
        payload.vehicle_plate,
        payload.vehicle_km,
        payload.notes,
        now_str,
        now_str
    ))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    await manager.broadcast({"type": "PAYMENT_CREATED", "id": new_id})
    return {"success": True, "id": new_id, "message": "Ödeme kalemi başarıyla eklendi."}

@app.put("/api/payments/{item_id}")
async def update_payment(item_id: int, payload: PaymentUpdate, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM payments WHERE id = ? AND user_id = ?", (item_id, user["id"]))
    item = cursor.fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Ödeme bulunamadı.")
        
    fields = []
    params = []
    for k, v in payload.dict(exclude_unset=True).items():
        fields.append(f"{k} = ?")
        params.append(v)
        
    if not fields:
        conn.close()
        return {"success": True}
        
    fields.append("updated_at = ?")
    params.append(datetime.now().isoformat())
    params.append(item_id)
    
    cursor.execute(f"UPDATE payments SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    
    await manager.broadcast({"type": "PAYMENT_UPDATED", "id": item_id})
    return {"success": True, "message": "Güncellendi."}

@app.delete("/api/payments/{item_id}")
async def delete_payment(item_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM payments WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    
    await manager.broadcast({"type": "PAYMENT_DELETED", "id": item_id})
    return {"success": True, "message": "Silindi."}

@app.post("/api/payments/{item_id}/pay")
async def mark_payment_paid(item_id: int, payload: PayAction = None):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM payments WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
        
    item = dict(row)
    paid_amt = payload.paid_amount if (payload and payload.paid_amount) else item["amount"]
    note = payload.receipt_note if (payload and payload.receipt_note) else "Ödendi olarak işaretlendi"
    
    today_str = date.today().strftime("%Y-%m-%d")
    now_str = datetime.now().isoformat()
    
    # 1. Log to History
    cursor.execute("""
    INSERT INTO payment_history (payment_id, title, category, paid_amount, paid_date, cycle_date, receipt_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (item["id"], item["title"], item["category"], paid_amt, today_str, item["due_date"], note, now_str))
    
    # 2. Handle Recurrence
    repeat = item.get("repeat_type", "none")
    msg = f"'{item['title']}' ödendi olarak kaydedildi."
    
    if repeat in ["monthly", "yearly", "2_yearly", "6_monthly"]:
        next_date = next_cycle_date(item["due_date"], repeat)
        cursor.execute("""
        UPDATE payments SET due_date = ?, status = 'pending', updated_at = ? WHERE id = ?
        """, (next_date, now_str, item_id))
        msg += f" Tekrarlayan ödeme olduğu için bir sonraki döngü tarihi {next_date} olarak güncellendi."
    else:
        cursor.execute("""
        UPDATE payments SET status = 'paid', updated_at = ? WHERE id = ?
        """, (now_str, item_id))
        
    conn.commit()
    conn.close()
    
    await manager.broadcast({
        "type": "PAYMENT_PAID",
        "id": item_id,
        "title": item["title"],
        "amount": paid_amt
    })
    
    return {"success": True, "message": msg}


@app.get("/api/vehicles")
def get_all_vehicles(user: dict = Depends(get_current_user)):
    """Tüm kayıtlı araçları listeler"""
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM vehicle_profile WHERE user_id = ? ORDER BY id ASC", (user["id"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/vehicle")
def get_vehicle(vehicle_id: Optional[int] = None, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    if vehicle_id:
        row = cursor.execute("SELECT * FROM vehicle_profile WHERE id = ? AND user_id = ?", (vehicle_id, user["id"])).fetchone()
    else:
        row = cursor.execute("SELECT * FROM vehicle_profile WHERE user_id = ? ORDER BY id ASC LIMIT 1", (user["id"],)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return {}

@app.post("/api/vehicle")
async def save_vehicle(v: VehicleProfile, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    if v.id:
        cursor.execute('''
            UPDATE vehicle_profile 
            SET brand_model=?, plate=?, year=?, tuvturk_date=?, insurance_date=?, kasko_date=?, 
                maintenance_date=?, maintenance_km=?, current_km=?,
                last_maintenance_date=?, last_maintenance_km=?, interval_year=?, interval_km=?
            WHERE id=? AND user_id=?
        ''', (v.brand_model, v.plate, v.year, v.tuvturk_date, v.insurance_date, v.kasko_date, 
              v.maintenance_date, v.maintenance_km, v.current_km,
              v.last_maintenance_date, v.last_maintenance_km, v.interval_year or 2, v.interval_km or 30000, v.id, user["id"]))
    else:
        cursor.execute('''
            INSERT INTO vehicle_profile (brand_model, plate, year, tuvturk_date, insurance_date, kasko_date, 
                                        maintenance_date, maintenance_km, current_km,
                                        last_maintenance_date, last_maintenance_km, interval_year, interval_km, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (v.brand_model, v.plate, v.year, v.tuvturk_date, v.insurance_date, v.kasko_date, 
              v.maintenance_date, v.maintenance_km, v.current_km,
              v.last_maintenance_date, v.last_maintenance_km, v.interval_year or 2, v.interval_km or 30000, user["id"]))
    
    conn.commit()
    conn.close()
    await manager.broadcast({"type": "VEHICLE_UPDATED"})
    return {"status": "ok"}

@app.delete("/api/vehicle/{v_id}")
async def delete_vehicle(v_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM vehicle_profile WHERE id = ? AND user_id = ?", (v_id, user["id"]))
    conn.commit()
    conn.close()
    await manager.broadcast({"type": "VEHICLE_DELETED"})
    return {"status": "ok", "message": "Araç garajdan kaldırıldı."}


class AdminAuth(BaseModel):
    password: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

def check_admin_password(password: str) -> bool:
    conn = get_db()
    row = conn.cursor().execute("SELECT value FROM admin_settings WHERE key = 'admin_password'").fetchone()
    conn.close()
    current_pass = row["value"] if row else "admin123"
    return password == current_pass

@app.post("/api/admin/verify")
def verify_admin(payload: AdminAuth):
    if not check_admin_password(payload.password):
        raise HTTPException(status_code=403, detail="Hatalı yönetici parolası!")
    return {"success": True}

@app.post("/api/admin/change-password")
async def change_admin_password(payload: PasswordChange):
    if not check_admin_password(payload.old_password):
        raise HTTPException(status_code=403, detail="Mevcut parola hatalı!")
    if not payload.new_password or len(payload.new_password.strip()) < 3:
        raise HTTPException(status_code=400, detail="Yeni parola en az 3 karakter olmalıdır!")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE admin_settings SET value = ? WHERE key = 'admin_password'", (payload.new_password.strip(),))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Yönetici parolası başarıyla değiştirildi."}

@app.post("/api/admin/clear-history")
async def clear_history(payload: AdminAuth):
    if not check_admin_password(payload.password):
        raise HTTPException(status_code=403, detail="Hatalı yönetici parolası!")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM payment_history")
    conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True, "message": "Geçmiş ödeme kayıtları başarıyla temizlendi."}

@app.post("/api/admin/reset-factory")
async def reset_factory(payload: AdminAuth):
    if not check_admin_password(payload.password):
        raise HTTPException(status_code=403, detail="Hatalı yönetici parolası!")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM payments")
    cursor.execute("DELETE FROM payment_history")
    cursor.execute("DELETE FROM vehicle_profile")
    conn.commit()
    conn.close()
    
    init_db()
    await manager.broadcast("update")
    return {"success": True, "message": "Tüm sistem sıfırlandı ve fabrika ayarlarına döndürüldü."}



# Gemini Global Client Cache
_gemini_client = None
_cached_gemini_key = None

def get_gemini_client(api_key: str):
    global _gemini_client, _cached_gemini_key
    if _gemini_client is None or _cached_gemini_key != api_key:
        from google import genai
        _gemini_client = genai.Client(api_key=api_key)
        _cached_gemini_key = api_key
    return _gemini_client

class GeminiChatPayload(BaseModel):
    message: str

class GeminiApiKeyPayload(BaseModel):
    api_key: str

@app.get("/api/gemini/status")
def get_gemini_status():
    conn = get_db()
    row = conn.cursor().execute("SELECT value FROM admin_settings WHERE key = 'gemini_api_key'").fetchone()
    conn.close()
    key = row["value"] if row else ""
    return {"has_key": bool(key and len(key.strip()) > 10)}

@app.post("/api/gemini/set-key")
def set_gemini_key(payload: GeminiApiKeyPayload):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('gemini_api_key', ?)", (payload.api_key.strip(),))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Gemini API Anahtarı başarıyla kaydedildi!"}

def get_live_weather(query: str = "kocaeli") -> str:
    """Open-Meteo API üzerinden tamamen ücretsiz, hızlı ve anlık hava durumu verisi çeker"""
    try:
        import urllib.request
        import json

        # Koordinat haritası (Kocaeli / İzmit varsayılan)
        city_coords = {
            "kocaeli": (40.76, 29.92, "Kocaeli"),
            "izmit": (40.76, 29.92, "İzmit"),
            "istanbul": (41.01, 28.97, "İstanbul"),
            "ankara": (39.93, 32.85, "Ankara"),
            "izmir": (38.42, 27.14, "İzmir"),
            "bursa": (40.18, 29.06, "Bursa"),
            "sakarya": (40.77, 30.40, "Sakarya"),
            "antalya": (36.89, 30.70, "Antalya")
        }

        lat, lon, city_name = 40.76, 29.92, "Kocaeli"
        q_lower = query.lower()
        for k, v in city_coords.items():
            if k in q_lower:
                lat, lon, city_name = v
                break

        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto"
        req = urllib.request.Request(url, headers={"User-Agent": "AsistanAI/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            curr = data.get("current", {})
            daily = data.get("daily", {})

            w_codes = {
                0: "Açık ve güneşli", 1: "Çoğunlukla açık", 2: "Parçalı bulutlu", 3: "Bulutlu",
                45: "Sisli", 51: "Hafif çisenti", 61: "Hafif yağmurlu", 63: "Orta kuvvette yağmurlu",
                65: "Kuvvetli sağanak yağmurlu", 71: "Kar yağışlı", 80: "Sağanak yağışlı", 95: "Gök gürültülü fırtına"
            }
            desc = w_codes.get(curr.get("weather_code", 0), "Değişken")
            t_max_list = daily.get("temperature_2m_max", [])
            t_min_list = daily.get("temperature_2m_min", [])
            t_max = t_max_list[0] if t_max_list else curr.get("temperature_2m", "--")
            t_min = t_min_list[0] if t_min_list else curr.get("temperature_2m", "--")

            return (
                f"CANLI METEOROLOJİ VERİSİ ({city_name}): "
                f"Şu anki sıcaklık: {curr.get('temperature_2m')}°C, Gökyüzü: {desc}, "
                f"Havadaki nem oranı: %{curr.get('relative_humidity_2m')}, Rüzgar: {curr.get('wind_speed_10m')} km/s. "
                f"Bugün beklenen en yüksek sıcaklık: {t_max}°C, en düşük sıcaklık: {t_min}°C."
            )
    except Exception as e:
        return f"Hava durumu servisi geçici olarak yanıt vermedi: {str(e)}"

@app.post("/api/gemini/chat")
async def gemini_chat(payload: GeminiChatPayload, user: dict = Depends(get_current_user)):
    msg = payload.message.lower().strip()
    
    conn = get_db()
    cursor = conn.cursor()
    v_row = cursor.execute("SELECT * FROM vehicle_profile WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user["id"],)).fetchone()
    v_info = dict(v_row) if v_row else {}
    conn.close()

    tr_months = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    
    # Bilgi alma, özetleme veya genel soru olup olmadığını anla
    is_general_query = any(w in msg for w in [
        "nasıl", "neden", "ne zaman", "özet", "özetle", "bilgi", "nedir", "kimdir", 
        "tarih", "açıkla", "tavsiye", "öneri", "tarif", "öğrenmek", "hava", "yağmur", 
        "sıcaklık", "fırtına", "kar", "derece"
    ])

    # Sadece doğrudan kısa sistem durumu soruluyorsa hızlı yanıt ver, aksi halde zeki yapay zekaya devret
    if not is_general_query:
        if any(w in msg for w in ["muayene", "tüvtürk", "tuvturk"]):
            tuv_date = v_info.get("tuvturk_date")
            if tuv_date:
                from datetime import datetime
                dt = datetime.strptime(tuv_date, "%Y-%m-%d").date()
                diff = (dt - datetime.now().date()).days
                month_tr = tr_months[dt.month] if dt.month <= 12 else ""
                date_spoken = f"{dt.day} {month_tr} {dt.year}"
                text = f"KIA EV6 aracınızın TÜVTÜRK muayene tarihi {date_spoken}. Muayenenize yaklaşık {diff} gün var."
                return {"reply": text, "configured": True}
            else:
                return {"reply": "Araç profilinizde henüz muayene tarihi tanımlanmamış. Araç menüsünden ekleyebilirsiniz.", "configured": True}

        if any(w in msg for w in ["sigorta", "trafik sigortası"]):
            ins_date = v_info.get("insurance_date")
            if ins_date:
                try:
                    from datetime import datetime
                    dt = datetime.strptime(ins_date, "%Y-%m-%d").date()
                    date_spoken = f"{dt.day} {tr_months[dt.month]} {dt.year}"
                except Exception:
                    date_spoken = ins_date
                return {"reply": f"Aracınızın Trafik Sigortası bitiş tarihi {date_spoken}.", "configured": True}

        if "kasko" in msg:
            kasko_date = v_info.get("kasko_date")
            if kasko_date:
                try:
                    from datetime import datetime
                    dt = datetime.strptime(kasko_date, "%Y-%m-%d").date()
                    date_spoken = f"{dt.day} {tr_months[dt.month]} {dt.year}"
                except Exception:
                    date_spoken = kasko_date
                return {"reply": f"Aracınızın Kasko poliçesi bitiş tarihi {date_spoken}.", "configured": True}

        if any(w in msg for w in ["brifing", "günün özeti", "durum raporu", "rapor ver"]):
            briefing_data = get_daily_briefing(user=user)
            return {"reply": briefing_data["briefing"], "configured": True}

        if any(w in msg for w in ["optimus prime", "optimus", "otobot"]):
            return {"reply": "Ben Optimus Prime. Tüm otobotlara ve yol arkadaşıma sesleniyorum: Sistemler aktif, görev için hazırım.", "configured": True}

        if any(w in msg for w in ["araba", "aracım", "araç", "model"]):
            return {"reply": f"Aracınız {v_info.get('brand_model', 'KIA EV6')}, plakanız {v_info.get('plate', '41 ACR 610')} ve güncel kilometreniz {v_info.get('current_km', 30800)} km'dir.", "configured": True}

    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM admin_settings WHERE key = 'gemini_api_key'").fetchone()
    api_key = row["value"] if row else os.environ.get("GEMINI_API_KEY", "")

    # Araç Bilgilerini Net Çek
    v_row = cursor.execute("SELECT * FROM vehicle_profile WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user["id"],)).fetchone()
    v_info = dict(v_row) if v_row else {}
    
    # Bekleyen & Ödenen Özetleri
    payments = [f"{r['title']}: {r['amount']} TL (Son Ödeme: {r['due_date']}, Durum: {r['status']})" for r in cursor.execute("SELECT title, amount, due_date, status FROM payments WHERE user_id = ?", (user["id"],)).fetchall()]
    conn.close()

    # Canlı Hava Durumu Enjeksiyonu
    is_weather_question = any(w in msg for w in ["hava", "yağmur", "sıcaklık", "kar", "derece", "rüzgar", "fırtına", "güneş"])
    weather_section = ""
    if is_weather_question:
        weather_section = "\n" + get_live_weather(msg) + "\n"
    elif "kocaeli" in msg:
        weather_section = "\n" + get_live_weather("kocaeli") + "\n"

    # API anahtarı girilmemişse bile hava durumu sorulmuşsa canlı yanıt verelim
    if not api_key:
        if is_weather_question:
            live_w = get_live_weather(msg)
            return {"reply": f"☀️ {live_w}\n\nDaha kapsamlı sohbet ve genel sorular için Ayarlar menüsünden Gemini API anahtarınızı tanımlayabilirsiniz.", "configured": False}
        return {
            "reply": "Lütfen önce Ayarlar menüsünden ücretsiz Gemini API anahtarınızı girin.",
            "configured": False
        }

    # Model için net, şeffaf ve kesin araç bilgileri
    vehicle_summary = f"""
    KULLANICININ ARAÇ BİLGİLERİ:
    - Marka ve Model: {v_info.get('brand_model', 'KIA EV6')}
    - Plaka: {v_info.get('plate', 'Belirtilmedi')}
    - Model Yılı: {v_info.get('year', '2024')}
    - Güncel Kilometre: {v_info.get('current_km', '30.800')} km
    - TÜVTÜRK Araç Muayene Bitiş Tarihi: {v_info.get('tuvturk_date', '2027-04-29')}
    - Trafik Sigortası Bitiş Tarihi: {v_info.get('insurance_date', '2027-04-29')}
    - Kasko Bitiş Tarihi: {v_info.get('kasko_date', '2027-04-29')}
    - Bakım Periyodu: {v_info.get('interval_year', 2)} Yıl veya {v_info.get('interval_km', 30000)} KM
    """

    system_instruction = f"""
    Sen kullanıcının kişisel, çok zeki, yardımsever ve samimi yapay zeka asistanı 'ASİSTAN'sın.
    Bugünün Tarihi ve Saati: {datetime.now().strftime('%d %B %Y, %H:%M')}
    Kullanıcının Şehri/Konumu: Kocaeli / Türkiye

    {vehicle_summary}

    ÖDEMELER & FATURALAR:
    {', '.join(payments[:15]) if payments else 'Kayıtlı ödeme bulunmuyor.'}

    {weather_section}

    ÖNEMLİ YANIT KURALLARI (HIZLI, KOTA DOSTU VE ÖZ CEVAPLAR):
    1. GÜNLÜK VE BASİT SORULAR (Hava durumu, fatura, araç durumu, selam vb.):
       - ASLA lafı uzatma! Giriş veya kapanış kalıpları ("Merhaba ben asistan", "Başka sorunuz var mı" vb.) kullanma.
       - Doğrudan, net, 1 veya en fazla 2-3 cümlelik öz ve kısa bir cevap ver.
       - Örnek hava yanıtı: "Kocaeli'de şu an hava hafif yağmurlu ve 19°C. Gün içinde en yüksek 21°C olacak; dışarı çıkarken şemsiyenizi almayı unutmayın."
    2. BİLGİ VE ÖZET SORULARI:
       - Kullanıcı bir konu hakkında bilgi veya özet istediğinde dolandırmadan, en can alıcı noktaları 1-2 kısa paragraf veya birkaç madde halinde hızlıca özetle.
    3. HIZ VE KOTA TASARRUFU:
       - Cevaplar kısa, net ve doğrudan hedefe yönelik olsun. Sesli okuma için akıcı ve pürüzsüz Türkçe kur.
    4. KİŞİSEL VERİ VE FİNANS: Araç muayenesi, kasko, sigorta veya faturaları yukarıdaki sistem verilerini temel alarak kesin ve net belirt.
    """

    MODELS_TO_TRY = [
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-3.8-flash'
    ]

    try:
        client = get_gemini_client(api_key)
        last_err = None

        for model_name in MODELS_TO_TRY:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=payload.message,
                    config={
                        'system_instruction': system_instruction,
                        'max_output_tokens': 250,
                        'temperature': 0.3
                    }
                )
                if response and response.text:
                    return {"reply": response.text.strip(), "configured": True}
            except Exception as m_err:
                last_err = m_err
                continue

        return {"reply": f"Yapay zeka yanıt oluşturamadı: {str(last_err)}", "configured": True}
    except Exception as e:
        return {"reply": f"Hata oluştu: {str(e)}", "configured": True}


@app.get("/api/briefing/today")
def get_daily_briefing(user: dict = Depends(get_current_user)):
    """Optimus Prime tarzı Günün Brifingi: Vadesi gelen faturalar, araç durumu ve EV tasarrufu"""
    conn = get_db()
    cursor = conn.cursor()
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # 1. Bekleyen / vadesi yaklaşan faturalar
    pending_bills = cursor.execute("""
        SELECT title, amount, due_date FROM payments 
        WHERE status != 'paid' AND user_id = ?
        ORDER BY due_date ASC LIMIT 3
    """, (user["id"],)).fetchall()
    
    # 2. Araç bilgisi
    v_row = cursor.execute("SELECT * FROM vehicle_profile WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user["id"],)).fetchone()
    v_info = dict(v_row) if v_row else {}
    
    # 3. EV Tasarruf hesabı
    charges = cursor.execute("SELECT kwh_amount, cost FROM ev_charges WHERE user_id = ?", (user["id"],)).fetchall()
    total_cost = sum(c["cost"] for c in charges)
    total_kwh = sum(c["kwh_amount"] for c in charges)
    gas_equiv = (total_kwh * 5.5) * 3.65
    ev_savings = max(0, gas_equiv - total_cost)
    conn.close()

    # Brifing metnini doğal, tok ve akıcı şekilde oluştur
    parts = ["Günaydın komutanım. Sistemler aktif, durum raporunu arz ediyorum."]
    
    if pending_bills:
        earliest = dict(pending_bills[0])
        due_d = datetime.strptime(earliest["due_date"], "%Y-%m-%d")
        diff = (due_d - datetime.now()).days
        if diff < 0:
            parts.append(f"Gecikmede olan {earliest['title']} için {int(earliest['amount'])} liralık ödemeniz bulunuyor.")
        elif diff == 0:
            parts.append(f"Bugün son ödeme günü olan {earliest['title']} için {int(earliest['amount'])} lira ödemeniz var.")
        else:
            parts.append(f"En yakın ödemeniz {diff} gün sonraki {earliest['title']}, tutarı {int(earliest['amount'])} lira.")
    else:
        parts.append("Ödemeleriniz tamamen güncel, bekleyen acil bir faturanız bulunmuyor.")

    # Araç özeti
    plate = v_info.get('plate', '')
    brand = v_info.get('brand_model', 'KIA EV6')
    if plate and plate != 'Belirtilmedi':
        parts.append(f"{brand} aracınız hazır durumda.")
    
    # Tasarruf
    if ev_savings > 100:
        parts.append(f"Elektrikli aracınızla bugüne kadar yaklaşık {int(ev_savings):,} lira yakıt tasarrufu sağladınız.")
        
    parts.append("Gününüz verimli ve başarılı geçsin.")
    briefing_text = " ".join(parts)
    return {"briefing": briefing_text}


# ==========================================
# 🧾 FİŞ / FATURA / EKSTRE OCR (GEMINI VISION)
# ==========================================
import json

@app.post("/api/ocr/parse-bill")
async def parse_bill_document(file: UploadFile = File(...)):
    """Görsel (JPG, PNG) veya PDF fatura / hesap ekstresini Gemini 3.8 ile analiz edip form verisine dönüştürür"""
    conn = get_db()
    row = conn.cursor().execute("SELECT value FROM admin_settings WHERE key = 'gemini_api_key'").fetchone()
    conn.close()
    api_key = row["value"] if row else os.environ.get("GEMINI_API_KEY", "")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Lütfen önce Ayarlar menüsünden Gemini API anahtarınızı girin.")

    file_bytes = await file.read()
    filename = (file.filename or "").lower()
    
    client = get_gemini_client(api_key)
    
    prompt = """
    Aşağıdaki fatura, fiş veya kredi kartı hesap özeti / ekstresi belgesini incele ve istenen bilgileri SADECE geçerli bir JSON nesnesi olarak döndür:
    {
        "title": "Kurum veya Kart Adı (Örn: Enerjisa, İSKİ, Garanti Bonus, Maximum Kart, ZES Şarj)",
        "category": "fatura veya kredi_karti veya abonelik veya diger",
        "amount": 0.0,
        "due_date": "YYYY-AA-GG (Örn: 2026-10-15)",
        "notes": "Varsa asgari ödeme tutarı veya ek kısa açıklama"
    }
    Not:
    1. Yalnızca JSON formatında yanıt ver. Markdown tırnakları (```json) kullanma.
    2. Eğer kesin bir son ödeme tarihi yoksa veya fiş ise bugünün tarihini ver.
    3. Tutarı sayısal (float) olarak yaz.
    """

    try:
        from google.genai import types
        # PDF ise pypdf ile metne çevir veya doküman olarak gönder
        if filename.endswith(".pdf"):
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            extracted_text = ""
            for page in reader.pages[:4]: # İlk 4 sayfayı oku
                extracted_text += page.extract_text() or ""
            
            response = client.models.generate_content(
                model='gemini-3.8-flash',
                contents=[prompt, f"DOKÜMAN METNİ:\n{extracted_text[:12000]}"]
            )
        else:
            # Resim (PNG, JPG, WEBP vb.)
            mime = "image/jpeg"
            if filename.endswith(".png"): mime = "image/png"
            elif filename.endswith(".webp"): mime = "image/webp"

            response = client.models.generate_content(
                model='gemini-3.8-flash',
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime),
                    prompt
                ]
            )

        resp_text = response.text.strip()
        # Temizle
        if resp_text.startswith("```"):
            resp_text = resp_text.split("```")[1]
            if resp_text.startswith("json"):
                resp_text = resp_text[4:]
        resp_text = resp_text.strip()
        
        parsed_data = json.loads(resp_text)
        return {"success": True, "data": parsed_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Belge analiz edilemedi: {str(e)}")


# ==========================================
# 📬 GMAIL OTOMATİK EKSTRE & FATURA TARAMA
# ==========================================
class GmailScanRequest(BaseModel):
    email_address: str
    app_password: str # Google Uygulama Şifresi (16 haneli)

@app.post("/api/gmail/save-credentials")
def save_gmail_credentials(payload: GmailScanRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('gmail_address', ?)", (payload.email_address.strip(),))
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('gmail_app_password', ?)", (payload.app_password.strip().replace(" ", ""),))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Gmail bilgileri başarıyla kaydedildi!"}

@app.get("/api/gmail/status")
def get_gmail_status():
    conn = get_db()
    c = conn.cursor()
    row_mail = c.execute("SELECT value FROM admin_settings WHERE key = 'gmail_address'").fetchone()
    row_pass = c.execute("SELECT value FROM admin_settings WHERE key = 'gmail_app_password'").fetchone()
    conn.close()
    email_val = row_mail["value"] if row_mail else ""
    has_pass = bool(row_pass and len(row_pass["value"]) >= 10)
    return {"configured": has_pass, "email": email_val}

@app.post("/api/gmail/sync")
def sync_gmail_statements():
    """Gmail gelen kutusunu IMAP üzerinden tarayıp son banka ve fatura e-postalarını Gemini ile ayıklar"""
    conn = get_db()
    c = conn.cursor()
    row_mail = c.execute("SELECT value FROM admin_settings WHERE key = 'gmail_address'").fetchone()
    row_pass = c.execute("SELECT value FROM admin_settings WHERE key = 'gmail_app_password'").fetchone()
    row_gemini = c.execute("SELECT value FROM admin_settings WHERE key = 'gemini_api_key'").fetchone()
    conn.close()

    email_user = row_mail["value"] if row_mail else ""
    app_pw = row_pass["value"] if row_pass else ""
    gemini_key = row_gemini["value"] if row_gemini else os.environ.get("GEMINI_API_KEY", "")

    if not email_user or not app_pw:
        raise HTTPException(status_code=400, detail="Lütfen önce Ayarlar menüsünden Gmail adresinizi ve 16 haneli Uygulama Şifrenizi kaydedin.")

    if not gemini_key:
        raise HTTPException(status_code=400, detail="Faturaları ayıklamak için Gemini API anahtarınız gereklidir.")

    import imaplib
    import email
    from email.header import decode_header

    found_bills = []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(email_user, app_pw)
        mail.select("INBOX")

        # 1. Yalnızca son 30 günün e-postalarını tara (Eski mailler asla taranmaz)
        from datetime import datetime, timedelta
        since_date = (datetime.now() - timedelta(days=30)).strftime("%d-%b-%Y")
        
        # IMAP sorgusu: Sadece son 30 günün ve ekstre/hesap/fatura konulu olanları
        search_query = f'(SINCE "{since_date}" OR OR (SUBJECT "ekstre") (SUBJECT "hesap") (SUBJECT "fatura"))'
        try:
            status, messages = mail.search('UTF-8', search_query)
        except Exception:
            status, messages = mail.search(None, f'(SINCE "{since_date}")')

        if status != "OK" or not messages or not messages[0]:
            mail.logout()
            return {"success": True, "count": 0, "message": "Son 30 güne ait yeni bir ekstre veya fatura bulunamadı.", "bills": []}

        msg_ids = messages[0].split()
        # En fazla son 5 güncel e-postayı incele
        latest_ids = msg_ids[-5:]
        
        client = get_gemini_client(gemini_key)

        for mid in reversed(latest_ids):
            res, data = mail.fetch(mid, "(RFC822)")
            for response_part in data:
                if isinstance(response_part, tuple):
                    raw_email = response_part[1]
                    msg = email.message_from_bytes(raw_email)
                    
                    # Konu çöz
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding or "utf-8", errors="ignore")
                    
                    sender = msg.get("From", "")

                    # Gövde metnini ve ekli PDF'leri al
                    body_text = ""
                    pdf_texts = []
                    if msg.is_multipart():
                        for part in msg.walk():
                            ctype = part.get_content_type()
                            cdispo = str(part.get('Content-Disposition') or '')
                            if ctype == "text/plain":
                                body_text += part.get_payload(decode=True).decode(errors="ignore") + "\n"
                            elif ctype == "text/html" and not body_text:
                                html_cnt = part.get_payload(decode=True).decode(errors="ignore")
                                # Basit html etiket temizleme
                                import re
                                body_text += re.sub('<[^<]+?>', ' ', html_cnt) + "\n"
                            elif ctype == "application/pdf" or "pdf" in cdispo.lower():
                                try:
                                    import pypdf
                                    pdf_data = part.get_payload(decode=True)
                                    p_reader = pypdf.PdfReader(io.BytesIO(pdf_data))
                                    for page in p_reader.pages[:3]:
                                        pdf_texts.append(page.extract_text() or "")
                                except Exception:
                                    pass
                    else:
                        body_text = msg.get_payload(decode=True).decode(errors="ignore")

                    combined_content = (body_text + "\n" + "\n".join(pdf_texts))[:4000]

                    # Gemini'ye analiz ettir
                    prompt = f"""
                    Aşağıdaki e-posta bir kredi kartı ekstresi, hesap özeti veya fatura bildirimi olabilir:
                    Kimden: {sender}
                    Konu: {subject}
                    İçerik:
                    {combined_content}

                    ÖNEMLİ KART İSİMLENDİRME KURALI:
                    - Eğer e-posta sonu 4584 ile biten karta aitse, title alanına KESİNLİKLE "Hepsiburada World Card" yaz.
                    - Eğer e-posta sonu 1129 ile biten karta aitse (World Gold), title alanına KESİNLİKLE "World Gold Card" yaz.
                    - Eğer e-posta sonu 3326 ile biten karta aitse (Opet Worldcard), title alanına KESİNLİKLE "Opet Worldcard" yaz.
                    - Diğer faturalar için kurum adını yaz (Örn: Enerjisa, İSKİ vb.).

                    Eğer bu bir fatura veya kredi kartı borç bildirimi ise şu JSON'ı döndür:
                    {{
                        "is_bill": true,
                        "title": "Hepsiburada World Card veya World Gold Card veya Opet Worldcard veya Kurum Adı",
                        "category": "kredi_karti veya fatura",
                        "amount": 0.0,
                        "due_date": "YYYY-AA-GG (Örn: 2026-10-05)",
                        "notes": "Kart Sonu: XXXX | Asgari Ödeme Tutarı: ... TL"
                    }}
                    Eğer fatura/ekstre değilse sadece {{"is_bill": false}} döndür.
                    Yanıtı SADECE JSON ver.
                    """
                    try:
                        g_res = client.models.generate_content(
                            model='gemini-3.8-flash',
                            contents=prompt
                        )
                        clean_json = g_res.text.strip().replace("```json", "").replace("```", "").strip()
                        p = json.loads(clean_json)
                        if p.get("is_bill") and p.get("amount", 0) > 0:
                            # 2. Mükerrer Kayıt Kontrolü: Aynı başlık ve vade tarihi veritabanında zaten varsa tekrar ekleme
                            conn_check = get_db()
                            exists = conn_check.cursor().execute(
                                "SELECT id FROM payments WHERE title = ? AND due_date = ?", 
                                (p["title"], p["due_date"])
                            ).fetchone()
                            conn_check.close()
                            if not exists:
                                found_bills.append(p)
                    except Exception:
                        pass
        
        mail.logout()

        # Bulunan faturaları doğrudan veritabanına ekle
        added_count = 0
        if found_bills:
            conn_ins = get_db()
            cursor_ins = conn_ins.cursor()
            for b in found_bills:
                try:
                    exists = cursor_ins.execute("SELECT id FROM payments WHERE title = ? AND due_date = ?", (b["title"], b["due_date"])).fetchone()
                    if not exists:
                        cursor_ins.execute("""
                            INSERT INTO payments (title, category, sub_type, amount, currency, due_date, repeat_type, status, notes)
                            VALUES (?, ?, ?, ?, 'TL', ?, 'monthly', 'pending', ?)
                        """, (b["title"], b.get("category", "kredi_karti"), b.get("category", "kredi_karti"), b["amount"], b["due_date"], b.get("notes", "Gmail üzerinden otomatik çekildi")))
                        added_count += 1
                except Exception:
                    pass
            conn_ins.commit()
            conn_ins.close()

        return {"success": True, "count": added_count, "bills": found_bills}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail bağlantı hatası: {str(e)}")

def execute_gmail_sync_internal():
    """Arka plan zamanlayıcısı (09:00 ve 22:00) için doğrudan çağırma"""
    try:
        return sync_gmail_statements()
    except Exception as e:
        return {"success": False, "count": 0, "error": str(e)}

# 📱 ANDROID BANKA BİLDİRİMİ DİNLEYİCİ (WEBHOOK)
# ==========================================
class BankNotificationPayload(BaseModel):
    title: Optional[str] = "" # Bildirim başlığı (Örn: Yapı Kredi, Garanti BBVA)
    text: str                # Bildirim metni (Örn: "...3326 nolu kartınız ile 450 TL harcama...")
    package_name: Optional[str] = "" # Örn: com.ykb.android

@app.post("/api/bank/notification")
async def receive_bank_notification(payload: BankNotificationPayload):
    """Android'den MacroDroid/Tasker ile gelen anlık banka bildirimini okur ve işler"""
    text = payload.text.strip()
    title = payload.title.strip()
    
    if not text:
        raise HTTPException(status_code=400, detail="Bildirim içeriği boş olamaz.")

    conn = get_db()
    row = conn.cursor().execute("SELECT value FROM admin_settings WHERE key = 'gemini_api_key'").fetchone()
    conn.close()
    api_key = row["value"] if row else os.environ.get("GEMINI_API_KEY", "")

    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API anahtarı ayarlanmamış.")

    client = get_gemini_client(api_key)
    prompt = f"""
    Aşağıda kullanıcının Android telefonuna banka uygulamasından gelen anlık bir bildirim var:
    Başlık: {title}
    İçerik: {text}

    GÖREVİN:
    1. Bu bildirimin bir harcama, para transferi veya kredi kartı ekstre/borç bildirimi olup olmadığını tespit et.
    2. Kart ismi kuralları:
       - 4584 ile bitiyorsa veya Hepsiburada geçiyorsa: "Hepsiburada World Card"
       - 1129 ile bitiyorsa veya World Gold geçiyorsa: "World Gold Card"
       - 3326 ile bitiyorsa veya Opet geçiyorsa: "Opet Worldcard"
       - Diğer banka/kartlar için uygun bir isim belirle (Örn: Garanti Bonus, İş Bankası vb.).
    3. Tutar ve harcama yerini / detayını bul.
    
    Aşağıdaki JSON formatında döndür:
    {{
        "is_financial": true,
        "type": "statement (eğer ekstre/borç ise) veya expense (eğer anlık harcama ise)",
        "card_title": "Kart veya Kurum Adı",
        "amount": 0.0,
        "due_date": "YYYY-AA-GG (ekstre ise son ödeme tarihi, harcama ise bugünün tarihi: {datetime.now().strftime('%Y-%m-%d')})",
        "notes": "Harcama yeri veya kısa detay"
    }}
    Finansal/bankacılık bildirimi değilse: {{"is_financial": false}} döndür.
    SADECE geçerli bir JSON ver.
    """

    try:
        response = client.models.generate_content(
            model='gemini-3.8-flash',
            contents=prompt
        )
        clean_json = response.text.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)

        if not data.get("is_financial") or data.get("amount", 0) <= 0:
            return {"success": False, "message": "Finansal bir bildirim olarak değerlendirilmedi."}

        # Veritabanına kaydet
        conn = get_db()
        cursor = conn.cursor()
        
        # Mükerrer kontrolü
        exists = cursor.execute(
            "SELECT id FROM payments WHERE title = ? AND amount = ? AND due_date = ?",
            (data["card_title"], data["amount"], data["due_date"])
        ).fetchone()

        if not exists:
            category = "kredi_karti" if "card" in data.get("card_title", "").lower() or data.get("type") == "statement" else "fatura"
            cursor.execute("""
                INSERT INTO payments (title, category, sub_type, amount, currency, due_date, repeat_type, status, notes)
                VALUES (?, ?, ?, ?, 'TL', ?, 'monthly', 'pending', ?)
            """, (data["card_title"], category, data.get("type", "expense"), data["amount"], data["due_date"], data.get("notes", "Android bildiriminden anında yakalandı")))
            conn.commit()

            # WebSocket ile bağlı tüm cihazlara (ekrana) anında canlı yansıt
            await manager.broadcast({
                "type": "PAYMENT_ADDED",
                "message": f"📱 Android Bildirimi: {data['card_title']} ({data['amount']} TL)"
            })
            conn.close()
            return {"success": True, "action": "added", "data": data}
        else:
            conn.close()
            return {"success": True, "action": "duplicate_skipped", "data": data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bildirim işleme hatası: {str(e)}")




class TtsRequest(BaseModel):

    text: str

class ElevenLabsConfigPayload(BaseModel):
    api_key: str
    voice_id: str

@app.get("/api/elevenlabs/status")
def get_elevenlabs_status():
    conn = get_db()
    cursor = conn.cursor()
    row_key = cursor.execute("SELECT value FROM admin_settings WHERE key = 'elevenlabs_api_key'").fetchone()
    row_voice = cursor.execute("SELECT value FROM admin_settings WHERE key = 'elevenlabs_voice_id'").fetchone()
    conn.close()
    has_key = bool(row_key and row_key["value"] and len(row_key["value"].strip()) > 5)
    has_voice = bool(row_voice and row_voice["value"] and len(row_voice["value"].strip()) > 3)
    return {"configured": has_key and has_voice, "voice_id": row_voice["value"] if row_voice else ""}

@app.post("/api/elevenlabs/set-config")
def set_elevenlabs_config(payload: ElevenLabsConfigPayload):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('elevenlabs_api_key', ?)", (payload.api_key.strip(),))
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('elevenlabs_voice_id', ?)", (payload.voice_id.strip(),))
    conn.commit()
    conn.close()
    return {"success": True, "message": "ElevenLabs Mazlum Kiper ses klonlama ayarları başarıyla kaydedildi!"}

@app.post("/api/tts/mazlum-kiper")
async def generate_mazlum_kiper_tts(payload: TtsRequest):
    """
    Mazlum Kiper tınısında derin, tok, tane tane ve vakur Türkçe ses üretir.
    1. Eğer kullanıcı ElevenLabs API Key ve Voice ID girdiyse doğrudan stüdyo klonundan üretir.
    2. Değilse edge-tts Nöral Stüdyo modelini (-14Hz Mazlum Kiper bariton akustiğinde) kullanır.
    """
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Metin boş olamaz")

    # 1. ElevenLabs Klon Kontrolü
    conn = get_db()
    cursor = conn.cursor()
    row_key = cursor.execute("SELECT value FROM admin_settings WHERE key = 'elevenlabs_api_key'").fetchone()
    row_voice = cursor.execute("SELECT value FROM admin_settings WHERE key = 'elevenlabs_voice_id'").fetchone()
    conn.close()

    el_key = row_key["value"].strip() if (row_key and row_key["value"]) else ""
    el_voice = row_voice["value"].strip() if (row_voice and row_voice["value"]) else ""

    if el_key and el_voice:
        try:
            import urllib.request
            import json
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{el_voice}?output_format=mp3_44100_128"
            headers = {
                "xi-api-key": el_key,
                "Content-Type": "application/json"
            }
            body = json.dumps({
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.55,
                    "similarity_boost": 0.90,
                    "style": 0.20,
                    "use_speaker_boost": True
                }
            }).encode("utf-8")
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=12) as res:
                audio_bytes = res.read()
                return Response(content=audio_bytes, media_type="audio/mpeg")
        except Exception as e:
            print(f"ElevenLabs çağrısı başarısız, nöral fallback devreye giriyor: {e}")

    # 2. edge-tts Nöral Model (Optimus Prime Akustiği: Derin Sub-Bass, Tok Bariton, Vakur ve Güçlü Tempo)
    try:
        import edge_tts
        # Optimus Prime: Çok derin frekans (-22Hz), tane tane ve heybetli tempo (-11%)
        communicate = edge_tts.Communicate(
            text=text,
            voice="tr-TR-AhmetNeural",
            pitch="-22Hz",
            rate="-11%"
        )
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
                
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Hatası: {str(e)}")


class EVChargeCreate(BaseModel):
    charge_date: str
    charge_type: str # 'ac_home', 'dc_fast', 'work'
    station_name: Optional[str] = "Ev (AC)"
    kwh_amount: float
    cost: float
    odometer_km: Optional[int] = None
    note: Optional[str] = None

@app.get("/api/ev/charges")
def get_ev_charges():
    conn = get_db()
    cursor = conn.cursor()
    charges = [dict(r) for r in cursor.execute("SELECT * FROM ev_charges ORDER BY charge_date DESC, id DESC").fetchall()]
    
    # Calculate stats
    total_cost = sum(c["cost"] for c in charges)
    total_kwh = sum(c["kwh_amount"] for c in charges)
    
    # Gas benchmark comparison: Benzinli eşdeğer SUV (Örn: 8.5 L/100km, benzin 43 TL/L => ~3.65 TL/km)
    # EV6 ortalama tüketim: ~18 kWh/100km
    avg_kwh_cost = (total_cost / total_kwh) if total_kwh > 0 else 0
    
    # Benzinli muadili maliyeti tahmini (EV6 kWh başına ~5.5 km gider => total_km = total_kwh * 5.5)
    estimated_km = total_kwh * 5.5
    gas_equivalent_cost = estimated_km * 3.65 # Benzinli araç olsaydı harcayacağı
    savings_vs_gas = max(0, gas_equivalent_cost - total_cost)

    conn.close()
    return {
        "charges": charges,
        "total_cost": round(total_cost, 2),
        "total_kwh": round(total_kwh, 2),
        "avg_kwh_cost": round(avg_kwh_cost, 2),
        "estimated_km": round(estimated_km, 0),
        "savings_vs_gas": round(savings_vs_gas, 2)
    }

@app.post("/api/ev/charges")
async def add_ev_charge(payload: EVChargeCreate):
    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    cursor.execute('''
    INSERT INTO ev_charges (charge_date, charge_type, station_name, kwh_amount, cost, odometer_km, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (payload.charge_date, payload.charge_type, payload.station_name, payload.kwh_amount, payload.cost, payload.odometer_km, payload.note, now_str))
    
    # Also update vehicle current_km if odometer provided
    if payload.odometer_km:
        cursor.execute("UPDATE vehicle_profile SET current_km = ? WHERE id = (SELECT id FROM vehicle_profile ORDER BY id DESC LIMIT 1)", (payload.odometer_km,))

    conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True, "message": "Şarj kaydı başarıyla eklendi!"}

@app.delete("/api/ev/charges/{cid}")
async def delete_ev_charge(cid: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ev_charges WHERE id = ? AND user_id = ?", (cid, user["id"]))
    conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True}

@app.get("/api/history")
def get_payment_history(limit: int = 50):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM payment_history ORDER BY paid_date DESC, id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/analytics")
def get_analytics(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    # All active payments
    cursor.execute("SELECT * FROM payments WHERE user_id = ?", (user["id"],))
    payments = [dict(r) for r in cursor.fetchall()]
    
    today = date.today()
    cur_year = today.year
    cur_month = today.month
    
    # Calculate this month's stats
    this_month_total = 0.0
    this_month_pending = 0.0
    
    for p in payments:
        try:
            p_date = datetime.strptime(p["due_date"], "%Y-%m-%d").date()
            if p_date.year == cur_year and p_date.month == cur_month:
                this_month_total += p["amount"]
                if p["status"] == "pending":
                    this_month_pending += p["amount"]
        except Exception:
            pass
            
    # Calculate this month's paid from history
    cursor.execute("""
    SELECT SUM(paid_amount) as total_paid FROM payment_history
    WHERE strftime('%Y', paid_date) = ? AND strftime('%m', paid_date) = ? AND user_id = ?
    """, (str(cur_year), f"{cur_month:02d}", user["id"]))
    paid_row = cursor.fetchone()
    this_month_paid = paid_row["total_paid"] if (paid_row and paid_row["total_paid"]) else 0.0
    
    # Category Breakdowns (Annual & Monthly projections)
    monthly_subs_total = 0.0
    annual_vehicle_total = 0.0
    category_totals = {"fatura": 0.0, "abonelik": 0.0, "kredi_karti": 0.0, "arac": 0.0, "vergi": 0.0, "diger": 0.0}
    
    for p in payments:
        cat = p.get("category", "diger")
        amt = p.get("amount", 0.0)
        rep = p.get("repeat_type", "none")
        
        # Monthly subscriptions
        if cat == "abonelik":
            if rep == "monthly":
                monthly_subs_total += amt
            elif rep == "yearly":
                monthly_subs_total += amt / 12.0
                
        # Vehicle Annual Costs
        if cat == "arac":
            if rep == "yearly":
                annual_vehicle_total += amt
            elif rep == "2_yearly":
                annual_vehicle_total += amt / 2.0
            elif rep == "monthly":
                annual_vehicle_total += amt * 12.0
            else:
                annual_vehicle_total += amt
                
        # Categorized normalized monthly impact
        if rep == "monthly":
            category_totals[cat] = category_totals.get(cat, 0.0) + amt
        elif rep == "yearly":
            category_totals[cat] = category_totals.get(cat, 0.0) + (amt / 12.0)
        elif rep == "2_yearly":
            category_totals[cat] = category_totals.get(cat, 0.0) + (amt / 24.0)
        else:
            category_totals[cat] = category_totals.get(cat, 0.0) + amt
            
    # Annual Projected Total
    monthly_impact_sum = sum(category_totals.values())
    annual_projected_total = monthly_impact_sum * 12.0
    
    # 12-Month Projection Forecast
    month_names = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
    months_forecast = []
    
    for i in range(12):
        # future month index
        target_month_num = (cur_month - 1 + i) % 12 + 1
        target_year = cur_year + ((cur_month - 1 + i) // 12)
        month_label = f"{month_names[target_month_num - 1]} {str(target_year)[2:]}"
        
        # calculate sum of items expected in this month
        month_sum = 0.0
        for p in payments:
            rep = p.get("repeat_type", "none")
            amt = p.get("amount", 0.0)
            if rep == "monthly":
                month_sum += amt
            elif rep == "yearly" or rep == "2_yearly":
                try:
                    due = datetime.strptime(p["due_date"], "%Y-%m-%d").date()
                    if due.month == target_month_num:
                        month_sum += amt
                except Exception:
                    pass
            else:
                try:
                    due = datetime.strptime(p["due_date"], "%Y-%m-%d").date()
                    if due.year == target_year and due.month == target_month_num:
                        month_sum += amt
                except Exception:
                    pass
                    
        months_forecast.append({
            "month": month_label,
            "amount": round(month_sum, 2)
        })
        
    # --- 1. HAFTALIK NAKİT AKIŞI HESAPLAMA (Önümüzdeki 7 gün) ---
    today_date = date.today()
    next_7_days = [today_date + timedelta(days=i) for i in range(7)]
    weekly_breakdown = []
    weekly_total = 0.0
    day_names_tr = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

    for d in next_7_days:
        d_str = d.strftime("%Y-%m-%d")
        day_bills = []
        day_sum = 0.0
        for p in payments:
            if p["status"] != "paid" and p["due_date"] == d_str:
                day_bills.append({"title": p["title"], "amount": p["amount"], "category": p["category"]})
                day_sum += p["amount"]
        weekly_total += day_sum
        weekly_breakdown.append({
            "date": d_str,
            "day_name": day_names_tr[d.weekday()],
            "display": f"{d.day} {d.strftime('%b')}",
            "amount": round(day_sum, 2),
            "bills": day_bills
        })

    conn.close()
    
    return {
        "this_month": {
            "total_due": round(this_month_total, 2),
            "paid": round(this_month_paid, 2),
            "pending": round(this_month_pending, 2),
        },
        "weekly_cashflow": {
            "total_7_days": round(weekly_total, 2),
            "days": weekly_breakdown
        },
        "monthly_subscriptions_total": round(monthly_subs_total, 2),
        "annual_subscriptions_total": round(monthly_subs_total * 12, 2),
        "annual_vehicle_total": round(annual_vehicle_total, 2),
        "monthly_average_budget": round(monthly_impact_sum, 2),
        "annual_projected_total": round(annual_projected_total, 2),
        "category_totals": {k: round(v, 2) for k, v in category_totals.items()},
        "forecast_12_months": months_forecast
    }

# ==========================================
# 🛡️ TAAHHÜT, SÖZLEŞME & GARANTİ TAKİP API
# ==========================================
class ContractCreate(BaseModel):
    title: str
    category: Optional[str] = "garanti" # 'garanti', 'taahhut', 'sozlesme'
    provider: Optional[str] = None
    purchase_date: Optional[str] = None
    warranty_duration: Optional[str] = None
    end_date: str
    notes: Optional[str] = None

@app.get("/api/contracts")
def get_contracts(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM contracts_warranties WHERE user_id = ? ORDER BY end_date ASC", (user["id"],)).fetchall()
    today = date.today()
    results = []
    for r in rows:
        d = dict(r)
        try:
            end_d = datetime.strptime(d["end_date"], "%Y-%m-%d").date()
            diff = (end_d - today).days
            d["days_remaining"] = diff
            d["is_expiring_soon"] = (0 <= diff <= 30)
            d["is_expired"] = (diff < 0)
        except Exception:
            d["days_remaining"] = 999
            d["is_expiring_soon"] = False
            d["is_expired"] = False
        results.append(d)
    conn.close()
    return results

@app.post("/api/contracts")
async def add_contract(payload: ContractCreate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO contracts_warranties (title, category, provider, purchase_date, warranty_duration, end_date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (payload.title, payload.category or "garanti", payload.provider, payload.purchase_date, payload.warranty_duration, payload.end_date, payload.notes))
    conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True, "message": "Ürün garanti kaydı başarıyla eklendi!"}

@app.delete("/api/contracts/{cid}")
async def delete_contract(cid: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM contracts_warranties WHERE id = ?", (cid,))
    conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True}

# ==========================================
# 🎙️ OPTIMUS'A GÖREV & HATIRLATICI NOTLARI
# ==========================================
class ReminderCreate(BaseModel):
    title: Optional[str] = None
    task_text: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = "normal"

@app.get("/api/reminders")
def get_reminders():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM reminders_tasks")
    if cursor.fetchone()["cnt"] == 0:
        cursor.execute("""
        INSERT INTO reminders_tasks (title, due_date, is_completed, priority, created_at)
        VALUES ('Kasko poliçesi için acenteyi ara ve teklif al', ?, 0, 'high', datetime('now'))
        """, ((date.today() + timedelta(days=5)).strftime("%Y-%m-%d"),))
        cursor.execute("""
        INSERT INTO reminders_tasks (title, due_date, is_completed, priority, created_at)
        VALUES ('Optimus ile haftalık finansal değerlendirme yap', ?, 0, 'normal', datetime('now'))
        """, ((date.today() + timedelta(days=2)).strftime("%Y-%m-%d"),))
        conn.commit()

    rows = cursor.execute("SELECT * FROM reminders_tasks ORDER BY is_completed ASC, id DESC").fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        d["task_text"] = d.get("title", "")
        res.append(d)
    return res

@app.post("/api/reminders")
async def add_reminder(payload: ReminderCreate):
    conn = get_db()
    cursor = conn.cursor()
    task_text = payload.task_text or payload.title or "Görev"
    cursor.execute("""
    INSERT INTO reminders_tasks (title, due_date, is_completed, priority, created_at)
    VALUES (?, ?, 0, ?, datetime('now'))
    """, (task_text, payload.due_date, payload.priority or "normal"))
    conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True, "message": "Görev / not eklendi!"}

@app.post("/api/reminders/{rid}/toggle")
async def toggle_reminder(rid: int):
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT is_completed FROM reminders_tasks WHERE id = ?", (rid,)).fetchone()
    if row:
        new_val = 0 if row["is_completed"] else 1
        cursor.execute("UPDATE reminders_tasks SET is_completed = ? WHERE id = ?", (new_val, rid))
        conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True}

@app.delete("/api/reminders/{rid}")
async def delete_reminder(rid: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reminders_tasks WHERE id = ?", (rid,))
    conn.commit()
    conn.close()
    await manager.broadcast("update")
    return {"success": True}

# ==========================================
# 📄 TEK TIKLA EXCEL / CSV RAPOR ÇIKTISI
# ==========================================
import io
import csv
from fastapi.responses import StreamingResponse

@app.get("/api/export/csv")
def export_financial_report():
    conn = get_db()
    cursor = conn.cursor()
    payments = cursor.execute("SELECT title, category, amount, currency, due_date, status, notes FROM payments ORDER BY due_date ASC").fetchall()
    history = cursor.execute("SELECT title, category, paid_amount, paid_date, receipt_note FROM payment_history ORDER BY paid_date DESC").fetchall()
    conn.close()

    output = io.StringIO()
    # Excel Turkish compatible with UTF-8 BOM
    output.write('\ufeff')
    writer = csv.writer(output, delimiter=';')
    
    writer.writerow(["=== GÜNCEL ÖDEMELER & FATURALAR ==="])
    writer.writerow(["Başlık", "Kategori", "Tutar (TL)", "Vade Tarihi", "Durum", "Notlar"])
    for p in payments:
        writer.writerow([p["title"], p["category"], str(p["amount"]).replace('.', ','), p["due_date"], p["status"], p["notes"] or ""])
    
    writer.writerow([])
    writer.writerow(["=== GEÇMİŞ ÖDEME KAYITLARI ==="])
    writer.writerow(["Başlık", "Kategori", "Ödenen Tutar (TL)", "Ödeme Tarihi", "Dekont/Not"])
    for h in history:
        writer.writerow([h["title"], h["category"], str(h["paid_amount"]).replace('.', ','), h["paid_date"], h["receipt_note"] or ""])

    output.seek(0)
    filename = f"Finans_Raporu_{date.today().strftime('%Y_%m_%d')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==========================================
# YEDEKLEME & GERİ YÜKLEME (BACKUP & RESTORE) ENDPOINTLERİ
# ==========================================
class BackupSettingsPayload(BaseModel):
    backup_folder: Optional[str] = None
    backup_auto_enabled: Optional[bool] = False
    backup_schedule_day: Optional[str] = "everyday"
    backup_schedule_time: Optional[str] = "03:00"

class BackupRestorePayload(BaseModel):
    filename: str

@app.get("/api/backup/settings")
def get_backup_settings():
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT key, value FROM admin_settings WHERE key LIKE 'backup_%'").fetchall()
    settings = {r["key"]: r["value"] for r in rows}
    conn.close()

    default_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    return {
        "backup_folder": settings.get("backup_folder") or default_folder,
        "backup_auto_enabled": settings.get("backup_auto_enabled", "false") == "true",
        "backup_schedule_day": settings.get("backup_schedule_day", "everyday"),
        "backup_schedule_time": settings.get("backup_schedule_time", "03:00"),
        "last_backup_time": settings.get("backup_last_run", "Henüz yedek alınmadı")
    }

@app.post("/api/backup/settings")
def save_backup_settings(payload: BackupSettingsPayload):
    conn = get_db()
    cursor = conn.cursor()

    folder = payload.backup_folder.strip() if payload.backup_folder else ""
    if not folder:
        folder = os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    os.makedirs(folder, exist_ok=True)

    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('backup_folder', ?)", (folder,))
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('backup_auto_enabled', ?)", ("true" if payload.backup_auto_enabled else "false",))
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('backup_schedule_day', ?)", (payload.backup_schedule_day or "everyday",))
    cursor.execute("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('backup_schedule_time', ?)", (payload.backup_schedule_time or "03:00",))
    conn.commit()
    conn.close()

    return {"success": True, "message": "Yedekleme ayarları başarıyla kaydedildi!"}

@app.post("/api/backup/create")
def create_manual_backup():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM admin_settings WHERE key = 'backup_folder'").fetchone()
    conn.close()
    folder = (row["value"] if row and row["value"] else None) or os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    
    success, filename, size_or_err = perform_database_backup(folder)
    if not success:
        raise HTTPException(status_code=500, detail=f"Yedek alınamadı: {size_or_err}")
    return {
        "success": True, 
        "filename": filename, 
        "size": size_or_err,
        "folder": folder,
        "message": f"Yedek başarıyla alındı: {filename} ({size_or_err})"
    }

@app.get("/api/backup/list")
def list_backups():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM admin_settings WHERE key = 'backup_folder'").fetchone()
    conn.close()
    folder = (row["value"] if row and row["value"] else None) or os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    os.makedirs(folder, exist_ok=True)

    backups = []
    if os.path.exists(folder):
        for entry in os.scandir(folder):
            if entry.is_file() and entry.name.endswith(".db"):
                try:
                    stat = entry.stat()
                    created_dt = datetime.fromtimestamp(stat.st_mtime).strftime("%d.%m.%Y %H:%M:%S")
                    size_kb = round(stat.st_size / 1024, 1)
                    backups.append({
                        "filename": entry.name,
                        "filepath": entry.path,
                        "size_kb": f"{size_kb} KB",
                        "created_at": created_dt,
                        "timestamp": stat.st_mtime
                    })
                except Exception as e:
                    print(f"Dosya okuma atlandı {entry.name}: {e}")
    backups.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"folder": folder, "backups": backups}

@app.post("/api/backup/restore")
def restore_backup(payload: BackupRestorePayload):
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM admin_settings WHERE key = 'backup_folder'").fetchone()
    conn.close()
    folder = (row["value"] if row and row["value"] else None) or os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    
    backup_file = os.path.join(folder, os.path.basename(payload.filename))
    success, msg = perform_database_restore(backup_file)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "message": msg}

@app.post("/api/backup/upload-restore")
async def upload_and_restore_backup(file: UploadFile = File(...)):
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Lütfen sadece .db uzantılı SQLite veritabanı yedeği yükleyin.")
    
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM admin_settings WHERE key = 'backup_folder'").fetchone()
    conn.close()
    folder = (row["value"] if row and row["value"] else None) or os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    os.makedirs(folder, exist_ok=True)

    save_path = os.path.join(folder, f"yuklenen_yedek_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.path.basename(file.filename)}")
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    success, msg = perform_database_restore(save_path)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "message": msg}

@app.delete("/api/backup/{filename}")
def delete_backup(filename: str):
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM admin_settings WHERE key = 'backup_folder'").fetchone()
    conn.close()
    folder = (row["value"] if row and row["value"] else None) or os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    
    safe_filename = os.path.basename(filename)
    target = os.path.join(folder, safe_filename)
    if os.path.exists(target):
        os.remove(target)
        return {"success": True, "message": "Yedek dosyası silindi."}
    raise HTTPException(status_code=404, detail="Yedek dosyası bulunamadı.")

@app.post("/api/backup/open-folder")
def open_backup_folder():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT value FROM admin_settings WHERE key = 'backup_folder'").fetchone()
    conn.close()
    folder = (row["value"] if row and row["value"] else None) or os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    os.makedirs(folder, exist_ok=True)
    try:
        os.startfile(folder)
        return {"success": True, "message": f"Yedek klasörü açıldı: {folder}"}
    except Exception as e:
        return {"success": False, "message": f"Klasör açılamadı: {str(e)}"}

# Mount static files folder
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static_assets")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 so phone on same Wi-Fi can connect
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
