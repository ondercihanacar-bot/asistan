// ============================================================
// ASİSTAN PRO - OFFLINE / STANDALONE & DUAL-SYNC ADAPTER
// ============================================================
(function() {
  console.log("⚡ [OfflineAdapter] Asistan Pro Yerel Depolama ve Çevrimdışı Motoru devrede.");

  // Pre-configured default seed data from user's live database:
  const SEED_PAYMENTS = [
    { id: 1, title: "Elektrik (BEDAŞ/EnerjiSA)", category: "fatura", sub_type: "elektrik", amount: 520.0, currency: "TL", due_date: "2026-10-01", repeat_type: "monthly", status: "pending", notes: "Sözleşme No: 1048291" },
    { id: 2, title: "Doğalgaz (İGDAŞ)", category: "fatura", sub_type: "dogalgaz", amount: 380.0, currency: "TL", due_date: "2027-08-03", repeat_type: "monthly", status: "pending", notes: "Tesisat No: 9812401" },
    { id: 3, title: "Su Faturası (İSKİ)", category: "fatura", sub_type: "su", amount: 195.0, currency: "TL", due_date: "2026-10-28", repeat_type: "monthly", status: "pending", notes: "Mukavele No: 765412" },
    { id: 4, title: "Ev İnterneti (Superonline)", category: "fatura", sub_type: "internet", amount: 320.0, currency: "TL", due_date: "2027-07-10", repeat_type: "monthly", status: "pending", notes: "100 Mbps Fiber Paketi" },
    { id: 5, title: "Turkcell Cep Telefonu", category: "fatura", sub_type: "gsm", amount: 290.0, currency: "TL", due_date: "2027-07-14", repeat_type: "monthly", status: "pending", notes: "Platinum Tarife" },
    { id: 6, title: "Netflix Standart", category: "abonelik", sub_type: "eglence", amount: 179.99, currency: "TL", due_date: "2027-06-01", repeat_type: "monthly", status: "pending", notes: "Otomatik kart çekimi" },
    { id: 7, title: "Xbox Game Pass Ultimate", category: "abonelik", sub_type: "oyun", amount: 209.0, currency: "TL", due_date: "2027-02-05", repeat_type: "monthly", status: "pending", notes: "Konsol + PC erişimi" },
    { id: 8, title: "Amazon Prime Video & Kargo", category: "abonelik", sub_type: "alisveris", amount: 39.0, currency: "TL", due_date: "2027-06-11", repeat_type: "monthly", status: "pending", notes: "Yıllık/Aylık avantaj" },
    { id: 9, title: "Spotify Aile Paketi", category: "abonelik", sub_type: "muzik", amount: 99.99, currency: "TL", due_date: "2027-05-17", repeat_type: "monthly", status: "pending", notes: "6 kullanıcı" },
    { id: 12, title: "TÜVTÜRK Araç Muayenesi", category: "arac", sub_type: "muayene", amount: 1821.60, currency: "TL", due_date: "2031-01-05", repeat_type: "2_yearly", status: "pending", vehicle_plate: "41 ACR 610", vehicle_km: 74500, notes: "Randevu son günü. Gecikme cezası almamak için 15 gün önce randevu al." },
    { id: 13, title: "Zorunlu Trafik Sigortası", category: "arac", sub_type: "sigorta", amount: 7400.0, currency: "TL", due_date: "2035-10-30", repeat_type: "yearly", status: "pending", vehicle_plate: "41 ACR 610", vehicle_km: 74500, notes: "Axa Sigorta Poliçe Yenileme" },
    { id: 14, title: "Kasko Sigortası (Genişletilmiş)", category: "arac", sub_type: "kasko", amount: 16800.0, currency: "TL", due_date: "2030-12-11", repeat_type: "yearly", status: "pending", vehicle_plate: "41 ACR 610", vehicle_km: 74500, notes: "Anadolu Sigorta / İkame araçlı" },
    { id: 15, title: "Yıllık Periyodik Araç Bakımı", category: "arac", sub_type: "bakim", amount: 5500.0, currency: "TL", due_date: "2034-11-15", repeat_type: "yearly", status: "pending", vehicle_plate: "41 ACR 610", vehicle_km: 75000, notes: "Motor Yağı, Yağ/Hava/Polen Filtresi Değişimi" },
    { id: 16, title: "Motorlu Taşıtlar Vergisi (MTV)", category: "vergi", sub_type: "mtv", amount: 1850.0, currency: "TL", due_date: "2028-01-26", repeat_type: "yearly", status: "pending", vehicle_plate: "41 ACR 610", notes: "İnteraktif Vergi Dairesi üzerinden ödeme" },
    { id: 17, title: "Emlak Vergisi 2. Taksit", category: "vergi", sub_type: "emlak", amount: 450.0, currency: "TL", due_date: "2034-11-26", repeat_type: "yearly", status: "pending", notes: "Belediye veznesi veya e-Devlet" },
    { id: 18, title: "Araç Servis Bakım", category: "arac", sub_type: "bakim", amount: 14500.0, currency: "TL", due_date: "2026-09-26", repeat_type: "yearly", status: "paid", vehicle_plate: "41 ACR 610", notes: "Kocaeli Kia Yetkili Servis Bakımı" },
    { id: 19, title: "Hepsiburada World Card", category: "kredi_karti", sub_type: "banka", amount: 6126.63, currency: "TL", due_date: "2026-09-28", repeat_type: "monthly", status: "pending", notes: "Ekstre Kesim: Her ayın 28'i" },
    { id: 20, title: "Opet Worldcard", category: "kredi_karti", sub_type: "banka", amount: 6537.71, currency: "TL", due_date: "2026-10-05", repeat_type: "monthly", status: "pending", notes: "Ekstre Kesim: Her ayın 5'i" },
    { id: 22, title: "World Gold Card", category: "kredi_karti", sub_type: "banka", amount: 6742.97, currency: "TL", due_date: "2026-10-05", repeat_type: "monthly", status: "pending", notes: "Ekstre Kesim: Her ayın 5'i" }
  ];

  const SEED_VEHICLES = [
    { id: 1, brand_model: "KIA EV6", plate: "41 ACR 610", year: 2024, tuvturk_date: "2027-04-29", insurance_date: "2027-04-29", kasko_date: "2027-04-29", current_km: 30800, interval_year: 2, interval_km: 30000 }
  ];

  const SEED_CONTRACTS = [
    { id: 1, title: "Superonline Fiber Taahhüt Sonu", category: "taahhut", provider: "Turkcell Superonline", end_date: "2026-11-20", notes: "Cayma bedeli ödememek için son 30 gün içinde yeni pakete geçilmeli." },
    { id: 2, title: "KIA EV6 Batarya & Araç Garantisi", category: "garanti", provider: "KIA Yetkili Servis", end_date: "2031-04-29", notes: "8 Yıl veya 160.000 KM batarya kapasite garantisi." }
  ];

  const SEED_HISTORY = [
    { id: 1, payment_id: 1, title: "Elektrik (BEDAŞ/EnerjiSA)", category: "fatura", paid_amount: 490.0, paid_date: "2026-09-07", receipt_note: "Banka otomatik talimattan ödendi" },
    { id: 2, payment_id: 6, title: "Netflix Standart", category: "abonelik", paid_amount: 179.99, paid_date: "2026-09-07", receipt_note: "Karttan çekildi" },
    { id: 3, payment_id: 18, title: "Araç Servis Bakım", category: "arac", paid_amount: 14500.0, paid_date: "2026-09-26", receipt_note: "Kocaeli Kia Yetkili Servis Bakımı" }
  ];

  // Initialize storage if not already initialized
  if (!localStorage.getItem('asistan_seed_v2')) {
    localStorage.setItem('asistan_payments', JSON.stringify(SEED_PAYMENTS));
    localStorage.setItem('asistan_vehicles', JSON.stringify(SEED_VEHICLES));
    localStorage.setItem('asistan_contracts', JSON.stringify(SEED_CONTRACTS));
    localStorage.setItem('asistan_history', JSON.stringify(SEED_HISTORY));
    localStorage.setItem('asistan_reminders', JSON.stringify([]));
    localStorage.setItem('asistan_auth_token', 'local-user-token');
    localStorage.setItem('asistan_seed_v2', 'true');
  }

  function getPayments() {
    try { return JSON.parse(localStorage.getItem('asistan_payments')) || []; } catch(e) { return []; }
  }
  function savePayments(items) {
    localStorage.setItem('asistan_payments', JSON.stringify(items));
  }
  function getVehicles() {
    try { return JSON.parse(localStorage.getItem('asistan_vehicles')) || []; } catch(e) { return []; }
  }
  function saveVehicles(items) {
    localStorage.setItem('asistan_vehicles', JSON.stringify(items));
  }
  function getContracts() {
    try { return JSON.parse(localStorage.getItem('asistan_contracts')) || []; } catch(e) { return []; }
  }
  function saveContracts(items) {
    localStorage.setItem('asistan_contracts', JSON.stringify(items));
  }
  function getHistory() {
    try { return JSON.parse(localStorage.getItem('asistan_history')) || []; } catch(e) { return []; }
  }
  function saveHistory(items) {
    localStorage.setItem('asistan_history', JSON.stringify(items));
  }
  function getReminders() {
    try { return JSON.parse(localStorage.getItem('asistan_reminders')) || []; } catch(e) { return []; }
  }
  function saveReminders(items) {
    localStorage.setItem('asistan_reminders', JSON.stringify(items));
  }

  function advanceDueDate(dateStr, repeatType) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (repeatType === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else if (repeatType === 'yearly') {
      d.setFullYear(d.getFullYear() + 1);
    } else if (repeatType === '2_yearly') {
      d.setFullYear(d.getFullYear() + 2);
    } else if (repeatType === '6_monthly') {
      d.setMonth(d.getMonth() + 6);
    }
    return d.toISOString().split('T')[0];
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status: status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Intercept window.fetch to provide fast offline data
  const realFetch = window.fetch;
  window.fetch = async function(resource, init = {}) {
    const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    const method = (init.method || 'GET').toUpperCase();

    // Check if it's an API route
    if (url.includes('/api/')) {
      const parsedUrl = new URL(url, window.location.origin || 'http://localhost');
      const path = parsedUrl.pathname;

      // 1. Auth Status & User
      if (path === '/api/auth/status') {
        return jsonResponse({
          logged_in: true,
          user: { id: 1, email: "onder@asistan.local", full_name: "Önder Cihan Acar" }
        });
      }
      if (path === '/api/auth/login') {
        return jsonResponse({
          success: true,
          token: "local-user-token",
          user: { id: 1, email: "onder@asistan.local", full_name: "Önder Cihan Acar" }
        });
      }
      if (path === '/api/auth/logout') {
        return jsonResponse({ success: true });
      }

      // 2. Payments API
      if (path === '/api/payments' && method === 'GET') {
        const today = new Date();
        today.setHours(0,0,0,0);
        let payments = getPayments();
        
        const statusFilter = parsedUrl.searchParams.get('status') || 'all';
        const categoryFilter = parsedUrl.searchParams.get('category') || 'all';
        
        if (statusFilter !== 'all') {
          payments = payments.filter(p => p.status === statusFilter);
        }
        if (categoryFilter !== 'all') {
          payments = payments.filter(p => p.category === categoryFilter);
        }

        // Compute urgency and days remaining
        const enriched = payments.map(p => {
          const item = { ...p };
          const due = new Date(item.due_date);
          due.setHours(0,0,0,0);
          const diffTime = due - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          item.days_remaining = diffDays;

          if (item.status === 'paid') {
            item.urgency = 'paid';
          } else if (diffDays < 0) {
            item.urgency = 'overdue';
          } else if (diffDays <= 3) {
            item.urgency = 'critical';
          } else if (diffDays <= 7) {
            item.urgency = 'soon';
          } else {
            item.urgency = 'normal';
          }
          return item;
        });

        enriched.sort((a,b) => (a.due_date > b.due_date ? 1 : -1));
        return jsonResponse(enriched);
      }

      if (path === '/api/payments' && method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        const payments = getPayments();
        const newId = payments.length > 0 ? Math.max(...payments.map(p => p.id || 0)) + 1 : 1;
        const newPayment = {
          id: newId,
          title: body.title,
          category: body.category,
          sub_type: body.sub_type,
          amount: parseFloat(body.amount) || 0,
          currency: body.currency || 'TL',
          due_date: body.due_date,
          repeat_type: body.repeat_type || 'none',
          status: 'pending',
          vehicle_plate: body.vehicle_plate || null,
          vehicle_km: body.vehicle_km || null,
          notes: body.notes || '',
          created_at: new Date().toISOString()
        };
        payments.push(newPayment);
        savePayments(payments);
        return jsonResponse({ success: true, id: newId, message: "Ödeme eklendi." });
      }

      // Mark payment as paid
      const payMatch = path.match(/^\/api\/payments\/(\d+)\/pay$/);
      if (payMatch && method === 'POST') {
        const payId = parseInt(payMatch[1]);
        const body = init.body ? JSON.parse(init.body) : {};
        const payments = getPayments();
        const pIndex = payments.findIndex(p => p.id === payId);
        if (pIndex !== -1) {
          const item = payments[pIndex];
          const paidAmount = body.paid_amount || item.amount;
          const note = body.receipt_note || 'Ödendi olarak işaretlendi';
          const todayStr = new Date().toISOString().split('T')[0];

          // Add to history
          const history = getHistory();
          history.unshift({
            id: Date.now(),
            payment_id: item.id,
            title: item.title,
            category: item.category,
            paid_amount: paidAmount,
            paid_date: todayStr,
            cycle_date: item.due_date,
            receipt_note: note,
            created_at: new Date().toISOString()
          });
          saveHistory(history);

          // Advance date if repeatable
          if (item.repeat_type && item.repeat_type !== 'none') {
            item.due_date = advanceDueDate(item.due_date, item.repeat_type);
            item.status = 'pending';
          } else {
            item.status = 'paid';
          }
          payments[pIndex] = item;
          savePayments(payments);
          return jsonResponse({ success: true, message: "Ödeme yapıldı ve arşivlendi." });
        }
      }

      // Update / Delete single payment
      const singlePayMatch = path.match(/^\/api\/payments\/(\d+)$/);
      if (singlePayMatch) {
        const payId = parseInt(singlePayMatch[1]);
        let payments = getPayments();
        if (method === 'PUT') {
          const body = JSON.parse(init.body || '{}');
          payments = payments.map(p => p.id === payId ? { ...p, ...body, updated_at: new Date().toISOString() } : p);
          savePayments(payments);
          return jsonResponse({ success: true, message: "Güncellendi." });
        }
        if (method === 'DELETE') {
          payments = payments.filter(p => p.id !== payId);
          savePayments(payments);
          return jsonResponse({ success: true, message: "Silindi." });
        }
      }

      // 3. Analytics
      if (path === '/api/analytics') {
        const payments = getPayments();
        const history = getHistory();
        
        let totalDebt = 0;
        let totalPaid = history.reduce((sum, h) => sum + (parseFloat(h.paid_amount) || 0), 0);
        let monthlySubscriptions = 0;
        let yearlyVehicleCost = 0;
        const categoryMap = {};

        payments.forEach(p => {
          const amt = parseFloat(p.amount) || 0;
          if (p.status === 'pending') {
            totalDebt += amt;
            categoryMap[p.category] = (categoryMap[p.category] || 0) + amt;
          }
          if (p.category === 'abonelik') {
            monthlySubscriptions += amt;
          }
          if (p.category === 'arac') {
            yearlyVehicleCost += amt;
          }
        });

        const categoryDistribution = Object.keys(categoryMap).map(k => ({
          category: k,
          total: categoryMap[k]
        }));

        // 12-month projections
        const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        const monthlyBreakdown = months.map(m => ({ month: m, total: Math.round(monthlySubscriptions + totalDebt / 12) }));

        return jsonResponse({
          total_debt: totalDebt,
          total_paid: totalPaid,
          monthly_subscriptions: monthlySubscriptions,
          yearly_subscriptions: monthlySubscriptions * 12,
          yearly_vehicle_cost: yearlyVehicleCost,
          category_distribution: categoryDistribution,
          monthly_breakdown: monthlyBreakdown
        });
      }

      // 4. Vehicles
      if (path === '/api/vehicles') {
        return jsonResponse(getVehicles());
      }
      if (path === '/api/vehicle') {
        const vehicles = getVehicles();
        if (method === 'GET') {
          return jsonResponse(vehicles[0] || {});
        }
        if (method === 'POST' || method === 'PUT') {
          const body = JSON.parse(init.body || '{}');
          if (vehicles.length > 0) {
            vehicles[0] = { ...vehicles[0], ...body };
          } else {
            vehicles.push({ id: 1, ...body });
          }
          saveVehicles(vehicles);
          return jsonResponse({ success: true, data: vehicles[0] });
        }
      }

      // 5. Contracts & Warranties
      if (path === '/api/contracts') {
        const contracts = getContracts();
        if (method === 'GET') return jsonResponse(contracts);
        if (method === 'POST') {
          const body = JSON.parse(init.body || '{}');
          const newId = Date.now();
          contracts.push({ id: newId, ...body, created_at: new Date().toISOString() });
          saveContracts(contracts);
          return jsonResponse({ success: true, id: newId });
        }
      }
      const singleContractMatch = path.match(/^\/api\/contracts\/(\d+)$/);
      if (singleContractMatch && method === 'DELETE') {
        const cId = parseInt(singleContractMatch[1]);
        saveContracts(getContracts().filter(c => c.id !== cId));
        return jsonResponse({ success: true });
      }

      // 6. Payment History
      if (path === '/api/history') {
        return jsonResponse(getHistory());
      }

      // 7. Reminders
      if (path === '/api/reminders') {
        const reminders = getReminders();
        if (method === 'GET') return jsonResponse(reminders);
        if (method === 'POST') {
          const body = JSON.parse(init.body || '{}');
          const newId = Date.now();
          reminders.push({ id: newId, ...body, is_completed: 0 });
          saveReminders(reminders);
          return jsonResponse({ success: true, id: newId });
        }
      }
      const toggleReminderMatch = path.match(/^\/api\/reminders\/(\d+)\/toggle$/);
      if (toggleReminderMatch && method === 'POST') {
        const rId = parseInt(toggleReminderMatch[1]);
        const reminders = getReminders();
        const r = reminders.find(item => item.id === rId);
        if (r) { r.is_completed = r.is_completed ? 0 : 1; saveReminders(reminders); }
        return jsonResponse({ success: true });
      }

      // 8. Backup / Settings
      if (path === '/api/backup/settings') {
        return jsonResponse({ backup_auto_enabled: "false" });
      }
      if (path === '/api/backup/list') {
        return jsonResponse([]);
      }
      if (path === '/api/ev/charges') {
        return jsonResponse([]);
      }

      // 9. Gemini AI Chat, Brifing, TTS ve Optimus Dev Agent (Bulut sunucusu köprüsü)
      if (path.startsWith('/api/gemini') || path.startsWith('/api/briefing') || path.startsWith('/api/tts') || path.startsWith('/api/dev-agent')) {
        const cloudBase = "https://asistan-cl3h.onrender.com";
        try {
          return await realFetch(cloudBase + path, init);
        } catch(err) {
          console.warn("Cloud bridge request failed:", err);
          if (path.startsWith('/api/briefing')) {
            return jsonResponse({
              briefing: "Günün kontrolü yapıldı. Önümüzdeki günlerde planlı ödemeleriniz bulunmaktadır. Harika bir gün dilerim!",
              first_name: "Önder"
            });
          }
          return jsonResponse({
            reply: "Bulut sunucusuna bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.",
            configured: false
          });
        }
      }
    }

    // Default fallback to native fetch for images, fonts etc.
    try {
      return await realFetch(resource, init);
    } catch(err) {
      console.warn("Fetch fallback err:", err);
      return jsonResponse({});
    }
  };
})();
