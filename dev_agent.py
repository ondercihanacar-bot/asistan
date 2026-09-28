import os
import subprocess
import py_compile
import json
import sqlite3
from typing import Dict, Any, List, Optional
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_git_status() -> Dict[str, Any]:
    """Git durumu ve son commitleri döndürür"""
    try:
        status_proc = subprocess.run(["git", "status", "--short"], cwd=BASE_DIR, capture_output=True, text=True, timeout=5)
        branch_proc = subprocess.run(["git", "branch", "--show-current"], cwd=BASE_DIR, capture_output=True, text=True, timeout=5)
        log_proc = subprocess.run(["git", "log", "-n", "5", "--oneline"], cwd=BASE_DIR, capture_output=True, text=True, timeout=5)
        
        status_lines = [line.strip() for line in status_proc.stdout.splitlines() if line.strip()]
        commits = [line.strip() for line in log_proc.stdout.splitlines() if line.strip()]
        branch = branch_proc.stdout.strip() or "main"
        
        return {
            "success": True,
            "branch": branch,
            "changed_files": status_lines,
            "has_changes": len(status_lines) > 0,
            "recent_commits": commits
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def git_rollback() -> Dict[str, Any]:
    """Son yapılan değişikliği veya kaydedilmemiş değişiklikleri güvenle geri alır"""
    try:
        # Önce kaydedilmemiş çalışma dizini değişikliklerini temizle
        subprocess.run(["git", "checkout", "--", "."], cwd=BASE_DIR, capture_output=True, text=True, timeout=5)
        subprocess.run(["git", "clean", "-fd"], cwd=BASE_DIR, capture_output=True, text=True, timeout=5)
        
        # Son commit Optimus Dev Agent'a aitse o commiti de geri alabiliriz
        last_log = subprocess.run(["git", "log", "-n", "1", "--pretty=%B"], cwd=BASE_DIR, capture_output=True, text=True, timeout=5).stdout
        rolled_back_commit = False
        if "[Optimus Dev Agent]" in last_log:
            subprocess.run(["git", "reset", "--hard", "HEAD~1"], cwd=BASE_DIR, capture_output=True, text=True, timeout=5)
            rolled_back_commit = True
            
        status = get_git_status()
        return {
            "success": True,
            "message": "Son yapılan değişiklikler başarıyla geri alındı (Rollback tamamlandı)." if rolled_back_commit else "Kaydedilmemiş tüm değişiklikler temizlendi.",
            "status": status
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def run_system_health_check() -> Dict[str, Any]:
    """Proje kodlarının sözdizimi, veritabanı ve temel sağlık durumunu test eder"""
    results = []
    has_error = False
    
    # 1. Python Sözdizimi Kontrolü
    py_files = ["main.py", "database.py", "auth.py", "dev_agent.py"]
    for pf in py_files:
        full_path = os.path.join(BASE_DIR, pf)
        if os.path.exists(full_path):
            try:
                py_compile.compile(full_path, doraise=True)
                results.append({"target": pf, "status": "ok", "message": "Sözdizimi hatasız (Syntax OK)"})
            except py_compile.PyCompileError as pe:
                has_error = True
                results.append({"target": pf, "status": "error", "message": f"Sözdizimi hatası: {pe}"})
                
    # 2. SQLite Veritabanı Bütünlük Kontrolü
    db_path = os.path.join(BASE_DIR, "finans_takip.db")
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("PRAGMA integrity_check;")
            row = cur.fetchone()
            conn.close()
            if row and row[0] == "ok":
                results.append({"target": "finans_takip.db", "status": "ok", "message": "Veritabanı bütünlüğü sağlam (Integrity OK)"})
            else:
                results.append({"target": "finans_takip.db", "status": "warning", "message": f"DB uyarısı: {row}"})
        except Exception as dbe:
            has_error = True
            results.append({"target": "finans_takip.db", "status": "error", "message": str(dbe)})

    # 3. Statik Varlıklar
    for s_file in ["static/index.html", "static/app.js", "static/style.css"]:
        full_s = os.path.join(BASE_DIR, s_file)
        if os.path.exists(full_s):
            size_kb = round(os.path.getsize(full_s) / 1024, 1)
            results.append({"target": s_file, "status": "ok", "message": f"Erişilebilir ({size_kb} KB)"})
        else:
            results.append({"target": s_file, "status": "error", "message": "Dosya bulunamadı"})

    return {
        "success": not has_error,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "checks": results
    }

def read_project_file(rel_path: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> Dict[str, Any]:
    """Proje içindeki izinli bir dosyayı okur"""
    rel_path = rel_path.replace("\\", "/").strip().lstrip("/")
    full_path = os.path.normpath(os.path.join(BASE_DIR, rel_path))
    
    # Sandboxing: Base dir dışına çıkmayı engelle
    if not full_path.startswith(BASE_DIR):
        return {"success": False, "error": "Güvenlik kuralı: Proje dizini dışına erişilemez."}
        
    if not os.path.exists(full_path):
        return {"success": False, "error": f"Dosya bulunamadı: {rel_path}"}
        
    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            
        total_lines = len(lines)
        if start_line is not None and end_line is not None:
            s_idx = max(0, start_line - 1)
            e_idx = min(total_lines, end_line)
            selected_lines = lines[s_idx:e_idx]
            content = "".join(selected_lines)
        else:
            content = "".join(lines)
            
        return {
            "success": True,
            "path": rel_path,
            "total_lines": total_lines,
            "content": content
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def edit_project_file(rel_path: str, search_text: str, replace_text: str) -> Dict[str, Any]:
    """Proje içindeki bir dosyada tam eşleşen bloğu değiştirir ve sözdizimi kontrolü yapar"""
    rel_path = rel_path.replace("\\", "/").strip().lstrip("/")
    full_path = os.path.normpath(os.path.join(BASE_DIR, rel_path))
    
    if not full_path.startswith(BASE_DIR):
        return {"success": False, "error": "Güvenlik kuralı: Proje dizini dışına yazılamaz."}
        
    if not os.path.exists(full_path):
        return {"success": False, "error": f"Dosya bulunamadı: {rel_path}"}
        
    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            original_content = f.read()
            
        if search_text not in original_content:
            return {
                "success": False, 
                "error": f"Aranan kod bloğu '{rel_path}' dosyasında bulunamadı. Lütfen tam eşleşmeyi kontrol edin."
            }
            
        new_content = original_content.replace(search_text, replace_text, 1)
        
        # Geçici yazım & sözdizimi testi
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(new_content)
            
        if rel_path.endswith(".py"):
            try:
                py_compile.compile(full_path, doraise=True)
            except py_compile.PyCompileError as pe:
                # Hata durumunda derhal eski içeriği geri yükle
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(original_content)
                return {
                    "success": False,
                    "error": f"Python sözdizimi hatası oluştu, dosya orijinal haline geri alındı: {pe}"
                }
                
        return {
            "success": True,
            "path": rel_path,
            "message": f"'{rel_path}' başarıyla güncellendi."
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def commit_agent_changes(instruction: str) -> Dict[str, Any]:
    """Ajanın yaptığı değişiklikleri Git'e commit eder"""
    try:
        clean_msg = instruction.replace('"', '').replace("'", "").strip()[:80]
        commit_msg = f"[Optimus Dev Agent] {clean_msg}"
        subprocess.run(["git", "add", "."], cwd=BASE_DIR, check=True, timeout=10)
        proc = subprocess.run(["git", "commit", "-m", commit_msg], cwd=BASE_DIR, capture_output=True, text=True, timeout=10)
        return {
            "success": proc.returncode == 0,
            "commit_message": commit_msg,
            "output": proc.stdout.strip()
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

async def process_dev_instruction(instruction: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Kullanıcının Türkçe doğal dil talimatını işleyen ana Optimus Dev Agent fonksiyonu"""
    ins_lower = instruction.lower().strip()
    
    # --- 1. HIZLI KOMUTLAR (SIFIR TOKEN / ANINDA CEVAP) ---
    if any(k in ins_lower for k in ["git durumu", "git status", "değişiklikler", "commitler", "son commit"]):
        st = get_git_status()
        changed = "\n".join([f"- `{c}`" for c in st.get("changed_files", [])]) if st.get("changed_files") else "✅ Değiştirilmiş bekleyen dosya yok (Tertemiz)."
        commits = "\n".join([f"- `{c}`" for c in st.get("recent_commits", [])])
        reply = f"### 📊 Git ve Depo Durumu (Dal: `{st.get('branch')}`)\n\n**Değişen Dosyalar:**\n{changed}\n\n**Son 5 Commit:**\n{commits}"
        return {
            "success": True,
            "action_type": "git_status",
            "reply": reply,
            "data": st
        }
        
    if any(k in ins_lower for k in ["geri al", "rollback", "iptal et", "önceki sürüme dön", "değişikliği geri al"]):
        rb = git_rollback()
        return {
            "success": rb.get("success", False),
            "action_type": "rollback",
            "reply": f"⏪ **Rollback İşlemi:** {rb.get('message', rb.get('error'))}",
            "data": rb
        }
        
    if any(k in ins_lower for k in ["sağlık testi", "sistem kontrolü", "test et", "syntax kontrol"]):
        hc = run_system_health_check()
        checks_md = "\n".join([f"- **{c['target']}**: `{'✅ ' + c['message'] if c['status'] == 'ok' else '❌ ' + c['message']}`" for c in hc.get("checks", [])])
        return {
            "success": hc.get("success", False),
            "action_type": "health_check",
            "reply": f"### 🩺 Optimus Sistem Sağlık Testi Raporu\n{checks_md}",
            "data": hc
        }
        
    # --- 2. DOĞAL DİL KOD DÜZENLEME (GEMINI 1.5/2.0/3.x FLASH ENTEGRASYONU) ---
    if not api_key:
        # DB'den anahtarı çek
        try:
            conn = sqlite3.connect(os.path.join(BASE_DIR, "finans_takip.db"))
            row = conn.cursor().execute("SELECT value FROM admin_settings WHERE key = 'gemini_api_key'").fetchone()
            conn.close()
            if row and row[0]:
                api_key = row[0]
        except:
            pass

    if not api_key:
        return {
            "success": False,
            "action_type": "error",
            "reply": "⚠️ Optimus Dev Agent'ın kodu inceleyip düzenleyebilmesi için Ayarlar menüsünden Google Gemini API anahtarının tanımlanmış olması gerekmektedir."
        }

    # Dosya haritası & hedef belirleme
    target_rel = "static/style.css"
    if any(w in ins_lower for w in ["html", "buton", "başlık", "yazı", "ikon", "kart", "modal", "menü"]):
        target_rel = "static/index.html"
    elif any(w in ins_lower for w in ["js", "fonksiyon", "grafik", "hesaplama", "tıklama", "event"]):
        target_rel = "static/app.js"
    elif any(w in ins_lower for w in ["css", "renk", "arka plan", "görünüm", "boyut", "font", "stil", "tasarım"]):
        target_rel = "static/style.css"
    elif any(w in ins_lower for w in ["api", "python", "backend", "sunucu", "veritabanı", "endpoint"]):
        target_rel = "main.py"

    # Dosyayı oku
    file_info = read_project_file(target_rel)
    if not file_info.get("success"):
        return {
            "success": False,
            "action_type": "error",
            "reply": f"Hedef dosya okunamadı: {file_info.get('error')}"
        }

    content_snippet = file_info.get("content", "")
    # Çok büyükse veya token tasarrufu için hedef içeriği kırp
    if len(content_snippet) > 40000:
        content_snippet = content_snippet[:40000]

    system_prompt = f"""
    Sen 'Akıllı Asistan' projesinin bizzat içine entegre edilmiş Antigravity / Optimus Geliştirici Kod Ajanısın (In-App Dev Agent).
    Kullanıcı senden uygulamanın kodlarında bir değişiklik yapmanı istiyor.

    HEDEF DOSYA: '{target_rel}'
    DOSYA İÇERİĞİ (veya ilgili kısmı):
    ---
    {content_snippet}
    ---

    GÖREVİN:
    Kullanıcının talimatını dikkatle analiz et. Hedef dosya üzerinde yapılacak değişikliği belirle.
    YANITINI SADECE AŞAĞIDAKİ GEÇERLİ JSON FORMATINDA DÖNDÜR (JSON dışında hiçbir şey yazma):
    {{
      "explanation": "Kullanıcıya yapılacak değişikliğin kısa, samimi ve teknik açıklaması (Türkçe)",
      "target_file": "{target_rel}",
      "search_block": "Değiştirilecek mevcut kod bloğu (dosyadakiyle BİREBİR AYNI karakter dizilimi)",
      "replace_block": "Yeni güncellenmiş kod bloğu"
    }}

    Eğer talimat bir kod değişikliği gerektirmiyorsa veya sadece bilgi soruyorsa:
    {{
      "explanation": "Cevabınız...",
      "target_file": null,
      "search_block": null,
      "replace_block": null
    }}
    """

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        models_to_try = [
            'gemini-flash-lite-latest',
            'gemini-2.5-flash-lite',
            'gemini-flash-latest',
            'gemini-3.8-flash'
        ]
        
        response_text = None
        last_err = None
        for m in models_to_try:
            try:
                resp = client.models.generate_content(
                    model=m,
                    contents=instruction,
                    config={
                        'system_instruction': system_prompt,
                        'temperature': 0.2
                    }
                )
                if resp and resp.text:
                    response_text = resp.text.strip()
                    break
            except Exception as e:
                last_err = e
                continue
                
        if not response_text:
            return {
                "success": False,
                "action_type": "error",
                "reply": f"Yapay zeka modeli yanıt oluşturamadı: {last_err}"
            }
            
        # JSON ayrıştırma
        clean_json_str = response_text
        if "```json" in clean_json_str:
            clean_json_str = clean_json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in clean_json_str:
            clean_json_str = clean_json_str.split("```")[1].split("```")[0].strip()
            
        action_data = json.loads(clean_json_str)
        explanation = action_data.get("explanation", "İşlem tamamlandı.")
        target_f = action_data.get("target_file")
        search_b = action_data.get("search_block")
        replace_b = action_data.get("replace_block")
        
        if target_f and search_b and replace_b:
            edit_res = edit_project_file(target_f, search_b, replace_b)
            if not edit_res.get("success"):
                return {
                    "success": False,
                    "action_type": "edit_error",
                    "reply": f"⚠️ Kod düzenlenirken bir sorun oluştu: {edit_res.get('error')}\n\nAçıklama: {explanation}",
                    "data": edit_res
                }
                
            # Git Commit
            commit_res = commit_agent_changes(instruction)
            
            return {
                "success": True,
                "action_type": "code_edited",
                "modified_file": target_f,
                "explanation": explanation,
                "commit": commit_res,
                "reply": f"✅ **Optimus Dev Agent Değişikliği Uyguladı!**\n\n**Düzenlenen Dosya:** `{target_f}`\n**Açıklama:** {explanation}\n\n*Git commit oluşturuldu ve değişiklikler anında devreye alındı.* 🚀"
            }
        else:
            return {
                "success": True,
                "action_type": "info",
                "reply": explanation
            }
            
    except Exception as exc:
        return {
            "success": False,
            "action_type": "exception",
            "reply": f"Dev Agent işlem hatası: {str(exc)}"
        }
