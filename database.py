import sqlite3
import os
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "finans_takip.db"))

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')
    cursor.execute("INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('admin_password', 'admin123')")
    cursor.execute("INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('gemini_api_key', '')")

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # Add user_id column to existing tables if missing
    for t in ["payments", "payment_history", "vehicle_profile", "ev_charges", "reminders_tasks", "contracts_warranties"]:
        try:
            cursor.execute(f"ALTER TABLE {t} ADD COLUMN user_id INTEGER DEFAULT 1")
        except Exception:
            pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_type TEXT,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'TL',
        due_date TEXT NOT NULL,
        repeat_type TEXT DEFAULT 'none',
        status TEXT DEFAULT 'pending',
        vehicle_plate TEXT,
        vehicle_km INTEGER,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
    )
    """)


    cursor.execute('''
    CREATE TABLE IF NOT EXISTS vehicle_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_model TEXT,
        plate TEXT,
        year INTEGER,
        tuvturk_date TEXT,
        insurance_date TEXT,
        kasko_date TEXT,
        maintenance_date TEXT,
        maintenance_km INTEGER,
        current_km INTEGER
    )
    ''')

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        paid_amount REAL NOT NULL,
        paid_date TEXT NOT NULL,
        cycle_date TEXT,
        receipt_note TEXT,
        created_at TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reminders_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        due_date TEXT,
        is_completed INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        created_at TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contracts_warranties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL, -- 'taahhut', 'garanti', 'sozlesme'
        provider TEXT,
        purchase_date TEXT,
        warranty_duration TEXT,
        end_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS health_medications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        item_type TEXT DEFAULT 'hap', -- 'hap', 'surup', 'toz', 'damla', 'igne'
        category TEXT DEFAULT 'ilac', -- 'ilac', 'spor_takviyesi'
        dosage TEXT,                  -- '1 Tablet', '5 gr', '1 Ölçek'
        time_of_day TEXT,             -- 'Sabah 09:00', 'Akşam 20:00', 'Spordan Önce'
        meal_condition TEXT,          -- 'Tok Karnına', 'Aç Karnına', 'Antrenman Öncesi'
        notes TEXT,
        last_taken_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gym_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        day_of_week INTEGER NOT NULL, -- 1: Pazartesi ... 7: Pazar
        day_name TEXT NOT NULL,
        is_workout_day INTEGER DEFAULT 1,
        workout_title TEXT,
        workout_time TEXT DEFAULT '19:30',
        supplements TEXT,             -- 'Creatin, Protein Tozu'
        notes TEXT,
        last_completed_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicle_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        vehicle_id INTEGER DEFAULT 1,
        battery_percentage REAL DEFAULT 78.0, -- SoC %
        battery_soh REAL DEFAULT 100.0,       -- SoH %
        range_km INTEGER DEFAULT 395,
        charging_status TEXT DEFAULT 'disconnected', -- disconnected, charging_ac, charging_dc, completed
        charging_power_kw REAL DEFAULT 0.0,
        remaining_charging_minutes INTEGER DEFAULT 0,
        battery_kwh_remaining REAL DEFAULT 60.4,
        battery_kwh_total REAL DEFAULT 77.4,
        battery_temp_c REAL DEFAULT 24.0,
        aux_battery_voltage REAL DEFAULT 13.8,
        odometer_km INTEGER DEFAULT 30800,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()

    # Seed default telemetry record if empty
    cursor.execute("SELECT COUNT(*) as cnt FROM vehicle_telemetry")
    if cursor.fetchone()["cnt"] == 0:
        cursor.execute("""
        INSERT INTO vehicle_telemetry 
        (user_id, vehicle_id, battery_percentage, battery_soh, range_km, charging_status, charging_power_kw, remaining_charging_minutes, battery_kwh_remaining, battery_kwh_total, battery_temp_c, aux_battery_voltage, odometer_km)
        VALUES 
        (1, 1, 78.0, 100.0, 395, 'disconnected', 0.0, 0, 60.4, 77.4, 24.0, 13.8, 30800)
        """)
        conn.commit()

    # Seed default gym schedule if empty
    cursor.execute("SELECT COUNT(*) as cnt FROM gym_schedule")
    if cursor.fetchone()["cnt"] == 0:
        seed_gym = [
            (1, 1, 'Pazartesi', 1, 'Göğüs & Ön Kol (Biceps)', '19:30', 'Creatin (Spordan 30 dk önce 5g), Protein Tozu (Sonrası 1 ölçek)', 'Ağır pres ve serbest ağırlık hareketleri'),
            (1, 2, 'Salı', 0, 'Dinlenme & İyileşme (Off Day)', '', 'Bol su ve dengeli beslenme', 'Kas gelişimi ve dinlenme günü'),
            (1, 3, 'Çarşamba', 1, 'Sırt & Arka Kol (Triceps)', '19:30', 'Creatin (Antrenman öncesi), Protein Tozu (Antrenman sonrası)', 'Lat pulldown, row ve pushdown serileri'),
            (1, 4, 'Perşembe', 0, 'Dinlenme (Off Day)', '', 'Hafif esneme ve yürüyüş', 'Toparlanma ve kas dinlendirme'),
            (1, 5, 'Cuma', 1, 'Bacak & Omuz', '19:30', 'Creatin (Antrenman öncesi), Protein Tozu (Antrenman sonrası)', 'Squat, leg press ve omuz pres'),
            (1, 6, 'Cumartesi', 1, 'Kardiyo & Karın (Core)', '14:00', 'BCAA veya Protein Tozu', '30 dk tempolu kardiyo ve karın egzersizleri'),
            (1, 7, 'Pazar', 0, 'Dinlenme (Hafta Sonu Off)', '', 'Dinlenme', 'Haftalık tam yenilenme günü')
        ]
        cursor.executemany("""
            INSERT INTO gym_schedule (user_id, day_of_week, day_name, is_workout_day, workout_title, workout_time, supplements, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, seed_gym)
        conn.commit()

    # Seed default sample medications/supplements if empty
    cursor.execute("SELECT COUNT(*) as cnt FROM health_medications")
    if cursor.fetchone()["cnt"] == 0:
        seed_meds = [
            (1, 'D Vitamini', 'damla', 'ilac', '1 Kapsül / Damla', 'Sabah 09:00', 'Tok Karnına', 'Kahvaltı sonrası'),
            (1, 'Creatin Monohidrat', 'toz', 'spor_takviyesi', '5 gr (1 Ölçek)', 'Spordan 30 dk Önce', 'Bol Su ile', 'Antrenman öncesi güç ve patlayıcı enerji için'),
            (1, 'Whey Protein Tozu', 'toz', 'spor_takviyesi', '30 gr (1 Ölçek)', 'Spordan Sonra', 'Antrenman Sonrası', 'Antrenman sonrası hızlı kas onarımı için')
        ]
        cursor.executemany("""
            INSERT INTO health_medications (user_id, name, item_type, category, dosage, time_of_day, meal_condition, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, seed_meds)
        conn.commit()

    # Seed default sample contract / warranty if empty
    cursor.execute("SELECT COUNT(*) as cnt FROM contracts_warranties")
    if cursor.fetchone()["cnt"] == 0:
        cursor.execute("""
        INSERT INTO contracts_warranties (title, category, provider, end_date, notes, created_at)
        VALUES 
        ('Superonline Fiber Taahhüt Sonu', 'taahhut', 'Turkcell Superonline', '2026-11-20', 'Cayma bedeli ödememek için son 30 gün içinde yeni pakete geçilmeli.', datetime('now')),
        ('KIA EV6 Batarya & Araç Garantisi', 'garanti', 'KIA Yetkili Servis', '2031-04-29', '8 Yıl veya 160.000 KM batarya kapasite garantisi.', datetime('now'))
        """)
        conn.commit()

    # Check if empty, add realistic default seed items
    cursor.execute("SELECT COUNT(*) as cnt FROM payments")
    count = cursor.fetchone()["cnt"]

    if count == 0:
        seed_data = [
            # Faturalar
            ("Elektrik (BEDAŞ/EnerjiSA)", "fatura", "elektrik", 520.0, "TL", (date.today() + relativedelta(days=3)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Sözleşme No: 1048291"),
            ("Doğalgaz (İGDAŞ)", "fatura", "dogalgaz", 380.0, "TL", (date.today() + relativedelta(days=7)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Tesisat No: 9812401"),
            ("Su Faturası (İSKİ)", "fatura", "su", 195.0, "TL", (date.today() + relativedelta(days=12)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Mukavele No: 765412"),
            ("Ev İnterneti (Superonline)", "fatura", "internet", 320.0, "TL", (date.today() + relativedelta(days=14)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "100 Mbps Fiber Paketi"),
            ("Turkcell Cep Telefonu", "fatura", "gsm", 290.0, "TL", (date.today() + relativedelta(days=18)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Platinum Tarife"),
            
            # Abonelikler
            ("Netflix Standart", "abonelik", "eglence", 179.99, "TL", (date.today() + relativedelta(days=5)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Otomatik kart çekimi"),
            ("Xbox Game Pass Ultimate", "abonelik", "oyun", 209.0, "TL", (date.today() + relativedelta(days=9)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Konsol + PC erişimi"),
            ("Amazon Prime Video & Kargo", "abonelik", "alisveris", 39.0, "TL", (date.today() + relativedelta(days=15)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Yıllık/Aylık avantaj"),
            ("Spotify Aile Paketi", "abonelik", "muzik", 99.99, "TL", (date.today() + relativedelta(days=21)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "6 kullanıcı"),
            ("iCloud 200 GB Depolama", "abonelik", "bulut", 39.99, "TL", (date.today() + relativedelta(days=26)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Yedekleme alanı"),

            # Kredi Kartları
            ("Ana Kredi Kartı Ekstresi", "kredi_karti", "banka", 6450.0, "TL", (date.today() + relativedelta(days=8)).strftime("%Y-%m-%d"), "monthly", "pending", None, None, "Asgari: 2.100 TL / Ekstre Kesim: Her ayın 1'i"),

            # Araç Takibi (Muayene, Sigorta, Kasko, Bakım)
            ("TÜVTÜRK Araç Muayenesi", "arac", "muayene", 1821.60, "TL", (date.today() + relativedelta(months=3, days=10)).strftime("%Y-%m-%d"), "2_yearly", "pending", "34 ABC 789", 74500, "Randevu son günü. Gecikme cezası almamak için 15 gün önce randevu al."),
            ("Zorunlu Trafik Sigortası", "arac", "sigorta", 7400.0, "TL", (date.today() + relativedelta(months=1, days=4)).strftime("%Y-%m-%d"), "yearly", "pending", "34 ABC 789", 74500, "Axa Sigorta Poliçe Yenileme"),
            ("Kasko Sigortası (Genişletilmiş)", "arac", "kasko", 16800.0, "TL", (date.today() + relativedelta(months=2, days=15)).strftime("%Y-%m-%d"), "yearly", "pending", "34 ABC 789", 74500, "Anadolu Sigorta / İkame araçlı"),
            ("Yıllık Periyodik Araç Bakımı", "arac", "bakim", 5500.0, "TL", (date.today() + relativedelta(months=1, days=20)).strftime("%Y-%m-%d"), "yearly", "pending", "34 ABC 789", 75000, "Motor Yağı, Yağ/Hava/Polen Filtresi Değişimi"),

            # Vergiler & Harçlar
            ("Motorlu Taşıtlar Vergisi (MTV)", "vergi", "mtv", 1850.0, "TL", (date.today() + relativedelta(months=4)).strftime("%Y-%m-%d"), "yearly", "pending", "34 ABC 789", None, "İnteraktif Vergi Dairesi üzerinden ödeme"),
            ("Emlak Vergisi 2. Taksit", "vergi", "emlak", 450.0, "TL", (date.today() + relativedelta(months=2)).strftime("%Y-%m-%d"), "yearly", "pending", None, None, "Belediye veznesi veya e-Devlet")
        ]

        now_str = datetime.now().isoformat()
        cursor.executemany("""
        INSERT INTO payments (title, category, sub_type, amount, currency, due_date, repeat_type, status, vehicle_plate, vehicle_km, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], item[10], now_str, now_str) for item in seed_data])
        
        # Add sample past paid history
        past_date = (date.today() - relativedelta(days=20)).strftime("%Y-%m-%d")
        cursor.execute("""
        INSERT INTO payment_history (payment_id, title, category, paid_amount, paid_date, cycle_date, receipt_note, created_at)
        VALUES (1, 'Elektrik (BEDAŞ/EnerjiSA)', 'fatura', 490.0, ?, ?, 'Banka otomatik talimattan ödendi', ?)
        """, (past_date, past_date, now_str))

        cursor.execute("""
        INSERT INTO payment_history (payment_id, title, category, paid_amount, paid_date, cycle_date, receipt_note, created_at)
        VALUES (6, 'Netflix Standart', 'abonelik', 179.99, ?, ?, 'Karttan çekildi', ?)
        """, (past_date, past_date, now_str))

        conn.commit()

    conn.close()

def next_cycle_date(current_date_str: str, repeat_type: str) -> str:
    """Calculates next due date based on repetition rule."""
    try:
        cur_date = datetime.strptime(current_date_str, "%Y-%m-%d").date()
    except Exception:
        cur_date = date.today()

    if repeat_type == "monthly":
        new_date = cur_date + relativedelta(months=1)
    elif repeat_type == "yearly":
        new_date = cur_date + relativedelta(years=1)
    elif repeat_type == "2_yearly":
        new_date = cur_date + relativedelta(years=2)
    elif repeat_type == "6_monthly":
        new_date = cur_date + relativedelta(months=6)
    else:
        new_date = cur_date

    return new_date.strftime("%Y-%m-%d")
