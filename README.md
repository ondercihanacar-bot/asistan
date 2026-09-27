# 💳 Akıllı Ödeme, Fatura & Araç Takip Asistanı (Web & Android)

Bu uygulama; bilgisayarınızda ve Android cep telefonunuzda yaklaşan ödemeleri renk kodlu sayaçlarla hatırlatan, tek tıkla *"Ödendi"* durumuna geçiren ve **aylık / yıllık maliyet analizlerinizi** çıkaran modern kişisel finans ve ödeme asistanınızdır.

---

## 🚀 Başlıca Özellikler

### 1. Akıllı Ödeme ve Takip Kategorileri
* ⚡ **Faturalar:** Elektrik (EnerjiSA), Su (İSKİ), Doğalgaz (İGDAŞ), Fiber İnternet, GSM operatörleri vb.
* 📺 **Dijital Abonelikler:** Netflix, Xbox Game Pass, Amazon Prime, Spotify, iCloud vb.
* 💳 **Kredi Kartları & Krediler:** Ekstre kesim, son ödeme günleri ve asgari/toplam tutarlar.
* 🚗 **Araç & Garaj Takibi:**
  * **TÜVTÜRK Araç Muayene Tarihi** (2 yıllık döngü kuralı ile ödenince otomatik 2 yıl sonraya ötelenir).
  * **Zorunlu Trafik Sigortası** ve **Kasko Poliçesi** bitiş uyarıları.
  * **Yıllık Periyodik Bakım** ve **Kilometre Takibi** (Motor yağı, filtreler, servis ücreti).
  * Plaka ve Kilometre notları.
* 🏛️ **Vergiler & Harçlar:** Motorlu Taşıtlar Vergisi (MTV), Emlak Vergisi vb.

### 2. Akıllı "Ödendi" Döngüsü
* **Abonelikler:** Ödendiğinde geçmişe arşivlenir ve vade tarihi **otomatik olarak 1 ay sonraya** güncellenir.
* **TÜVTÜRK Muayenesi:** Ödendiğinde bir sonraki muayene tarihi **2 yıl sonraya** ötelenir.
* **Yıllık Sigorta / Kasko / Bakım:** Bir sonraki poliçe tarihi **1 yıl sonraya** ötelenir.
* **Tek Seferlik Ödemeler:** Tamamlandı rozetiyle arşive kaldırılır.

### 3. Maliyet & Bütçe Analitiği
* **Aylık Sabit Dijital Abonelik Yükü:** Ayda ne kadar abonelik ödüyorsunuz?
* **Aboneliklerin 1 Yıllık Maliyeti:** Dijital platformlara yılda giden toplam para.
* **Yıllık Araç & Garaj Masrafı:** Muayene + Sigorta + Kasko + Servis bakım toplamı.
* **12 Aylık Tahmini Harcama Çizelgesi (Bar Chart):** Önümüzdeki 12 ayın hangi ayında ne kadar harcamanız olacağını gösteren grafik.
* **Kategori Dağılımı (Doughnut Chart):** Harcamalarınızın yüzde kaçı araç, fatura veya abonelik?

---

## 📱 Cep Telefonu & Mobil Uygulama (Android APK)

Uygulamanın tam işlevsel bir **Android Yerel Uygulaması (`android/`)** bulunmaktadır.

### 🔗 GitHub ile Otomatik Bağlantı (CI/CD)
* Proje kaynak kodu GitHub ile tam entegredir.
* Her kod güncellemesinde **GitHub Actions** devreye girer ve otomatik olarak en güncel Android APK'sını (`Asistan-Pro.apk`) derler.
* Derlenen APK, projenin **GitHub Releases** sayfasında `mobile-latest` etiketiyle her zaman indirilebilir durumdadır:
  👉 [En Güncel Android APK'sını İndir](https://github.com/ondercihanacar-bot/asistan/releases)

### 📲 Telefona Yükleme ve Kullanma Seçenekleri

1. **⚡ USB Kablo ile Doğrudan Yükleme:**
   * Telefonunuzu bilgisayara USB kablosuyla takın (USB Hata Ayıklama açık olsun).
   * Klasördeki **`telefona_yukle.bat`** dosyasına çift tıklayın.
   * Uygulama otomatik olarak telefonunuza kurulur ve ekranda açılır!
   * İstediğiniz zaman **`usb_bagla.bat`** dosyasını çalıştırarak port yönlendirmesini aktif edebilirsiniz (`http://localhost:8000`).

2. **📶 Ev / Ofis Wi-Fi ile Kablosuz Kullanım:**
   * Telefonunuz ve bilgisayarınız aynı Wi-Fi ağına bağlıyken:
   * Telefonunuzun tarayıcısından veya Asistan uygulamasından `http://10.22.250.66:8000` adresine girin.
   * Tüm verileriniz bilgisayarınızdaki veri tabanıyla anlık olarak eşitlenir.

3. **🌐 Bulut / Render Sunucusu ile Her Yerden Erişim:**
   * Projede yer alan `render.yaml` konfigürasyonu ile Render üzerinde ücretsiz cloud sunucusu açabilirsiniz.
   * Bu sayede dışarıdayken 4G/5G mobil veri ile telefonunuzdan tüm ödemelerinizi takip edebilirsiniz.

---

## 💻 Bilgisayarda Nasıl Başlatılır?

Klasör içindeki **`baslat.bat`** dosyasına çift tıklamanız yeterlidir.
Otomatik olarak servisi ayağa kaldırır ve tarayıcınızı açar.
