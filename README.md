# 💳 Akıllı Ödeme, Fatura & Araç Takip Asistanı (PC & Android Eşzamanlı)

Bu uygulama; bilgisayarınızda ve Android telefonunuzda internet/ağ üzerinden **eşzamanlı (real-time)** olarak çalışan, yaklaşan ödemeleri renk kodlu sayaçlarla hatırlatan, tek tıkla *"Ödendi"* durumuna geçiren ve **aylık / yıllık maliyet analizlerinizi** çıkaran kişisel finans asistanınızdır.

---

## 🚀 Başlıca Özellikler

### 1. Çift Cihaz Eşzamanlı (Real-Time) Senkronizasyon
* Bilgisayardan bir faturayı *"Ödendi"* olarak işaretlediğinizde veya yeni bir abonelik eklediğinizde, telefonunuzdaki ekran sayfayı bile yenilemenize gerek kalmadan **saliseler içinde güncellenir**.
* Masaüstünde ve Android telefonda tam ekran mobil uygulama (PWA) olarak çalışır.

### 2. Akıllı Ödeme ve Takip Kategorileri
* ⚡ **Faturalar:** Elektrik (EnerjiSA), Su (İSKİ), Doğalgaz (İGDAŞ), Fiber İnternet, GSM operatörleri vb.
* 📺 **Dijital Abonelikler:** Netflix, Xbox Game Pass, Amazon Prime, Spotify, iCloud vb.
* 💳 **Kredi Kartları & Krediler:** Ekstre kesim, son ödeme günleri ve asgari/toplam tutarlar.
* 🚗 **Araç & Garaj Takibi:**
  * **TÜVTÜRK Araç Muayene Tarihi** (2 yıllık döngü kuralı ile ödenince otomatik 2 yıl sonraya ötelenir).
  * **Zorunlu Trafik Sigortası** ve **Kasko Poliçesi** bitiş uyarıları.
  * **Yıllık Periyodik Bakım** ve **Kilometre Takibi** (Motor yağı, filtreler, servis ücreti).
  * Plaka ve Kilometre notları.
* 🏛️ **Vergiler & Harçlar:** Motorlu Taşıtlar Vergisi (MTV), Emlak Vergisi vb.

### 3. Akıllı "Ödendi" Döngüsü
* **Abonelikler:** Ödendiğinde geçmişe arşivlenir ve vade tarihi **otomatik olarak 1 ay sonraya** güncellenir.
* **TÜVTÜRK Muayenesi:** Ödendiğinde bir sonraki muayene tarihi **2 yıl sonraya** ötelenir.
* **Yıllık Sigorta / Kasko / Bakım:** Bir sonraki poliçe tarihi **1 yıl sonraya** ötelenir.
* **Tek Seferlik Ödemeler:** Tamamlandı rozetiyle arşive kaldırılır.

### 4. Maliyet & Bütçe Analitiği
* **Aylık Sabit Dijital Abonelik Yükü:** Ayda ne kadar abonelik ödüyorsunuz?
* **Aboneliklerin 1 Yıllık Maliyeti:** Dijital platformlara yılda giden toplam para.
* **Yıllık Araç & Garaj Masrafı:** Muayene + Sigorta + Kasko + Servis bakım toplamı.
* **12 Aylık Tahmini Harcama Çizelgesi (Bar Chart):** Önümüzdeki 12 ayın hangi ayında ne kadar harcamanız olacağını gösteren grafik.
* **Kategori Dağılımı (Doughnut Chart):** Harcamalarınızın yüzde kaçı araç, fatura veya abonelik?

---

## 📱 Android Telefondan Nasıl Bağlanılır?

1. Bilgisayarınızdaki paneli açın (`http://localhost:8000`).
2. Sağ üstteki **"📱 Telefona Bağla"** butonuna tıklayın.
3. Ekrana gelen **QR Kodu** Android telefonunuzun kamerasıyla okutun veya telefon tarayıcınızdan şu adrese girin:
   ```
   http://192.168.0.53:8000
   ```
4. **Telefona Uygulama Olarak Yükleme (İpucu):**
   * Android Chrome'da sağ üstteki **3 noktaya** dokunun.
   * **"Ana Ekrana Ekle"** veya **"Uygulamayı Yükle"** seçeneğini seçin.
   * Uygulama telefonunuzda tıpkı Play Store'dan indirilmiş yerel bir uygulama gibi tam ekran açılacaktır.

---

## 💻 Bilgisayarda Nasıl Başlatılır?

Klasör içindeki **`baslat.bat`** dosyasına çift tıklamanız yeterlidir.
Otomatik olarak servisi ayağa kaldırır ve tarayıcınızı açar.
