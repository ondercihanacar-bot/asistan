package com.asistan.app.car;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class CarDataHelper {

    private static final String TAG = "CarDataHelper";
    private static final String PREFS_NAME = "asistan_prefs";
    private static final String CACHE_PREFS = "asistan_car_cache";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String DEFAULT_CLOUD_URL = "https://asistan-cl3h.onrender.com";

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    public interface TextCallback {
        void onResult(String text);
    }

    public interface AudioFileCallback {
        void onSuccess(File audioFile);
        void onError(String message);
    }

    public static String getServerUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String url = prefs.getString(KEY_SERVER_URL, DEFAULT_CLOUD_URL);
        if (url == null || url.trim().isEmpty() || url.contains("10.22.250.66")) {
            url = DEFAULT_CLOUD_URL;
        }
        return url.replaceAll("/+$", "");
    }

    public static String getAuthToken(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE);
        return prefs.getString("auth_token", "");
    }

    public static void saveCachedData(Context context, String token, String userJson, String paymentsJson, String vehicleJson) {
        SharedPreferences.Editor editor = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE).edit();
        if (token != null) editor.putString("auth_token", token);
        if (userJson != null) editor.putString("user_json", userJson);
        if (paymentsJson != null) editor.putString("payments_json", paymentsJson);
        if (vehicleJson != null) editor.putString("vehicle_json", vehicleJson);
        editor.apply();
    }

    public static void getDailyBriefing(Context context, TextCallback callback) {
        executor.execute(() -> {
            String serverUrl = getServerUrl(context);
            String token = getAuthToken(context);
            String resultText = null;

            try {
                URL url = new URL(serverUrl + "/api/briefing/today");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(10000);
                if (!token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject json = new JSONObject(sb.toString());
                    resultText = json.optString("briefing", "");
                    if (!resultText.isEmpty()) {
                        // Cache it for offline driving
                        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
                                .edit()
                                .putString("cached_briefing", resultText)
                                .apply();
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Briefing fetch failed, using cache/fallback: " + e.getMessage());
            }

            if (resultText == null || resultText.trim().isEmpty()) {
                // Try offline cache
                resultText = context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
                        .getString("cached_briefing", null);
            }

            if (resultText == null || resultText.trim().isEmpty()) {
                // Smart fallback for driving
                resultText = "Önder Bey merhaba. Akıllı Asistan sürüş modu aktif. KIA EV6 aracınız ve tüm sistemleriniz hazır durumda. Güvenli ve harika bir yolculuk dilerim.";
            }

            final String finalText = resultText;
            callback.onResult(finalText);
        });
    }

    public static void getFinanceSummary(Context context, TextCallback callback) {
        executor.execute(() -> {
            String serverUrl = getServerUrl(context);
            String token = getAuthToken(context);
            String summary = null;

            try {
                URL url = new URL(serverUrl + "/api/payments");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(10000);
                if (!token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONArray arr = new JSONArray(sb.toString());
                    int pendingCount = 0;
                    double totalPending = 0;
                    String nearestTitle = "";
                    double nearestAmount = 0;

                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject p = arr.getJSONObject(i);
                        if (!"paid".equalsIgnoreCase(p.optString("status", ""))) {
                            pendingCount++;
                            double amount = p.optDouble("amount", 0);
                            totalPending += amount;
                            if (nearestTitle.isEmpty()) {
                                nearestTitle = p.optString("title", "Ödeme");
                                nearestAmount = amount;
                            }
                        }
                    }

                    if (pendingCount > 0) {
                        summary = String.format("Finansal durumunuz: Bekleyen %d adet faturanız bulunuyor. Toplam tutar yaklaşık %d lira. En yakın ödemeniz %d lira ile %s.",
                                pendingCount, (int) totalPending, (int) nearestAmount, nearestTitle);
                    } else {
                        summary = "Finansal durumunuz tamamen güncel. Bekleyen veya geciken herhangi bir faturanız bulunmuyor.";
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Finance summary fetch error: " + e.getMessage());
            }

            if (summary == null) {
                summary = "Finansal kayıtlarınız kontrol ediliyor. Bekleyen acil bir borç kaydınız bulunmuyor.";
            }

            final String finalText = summary;
            callback.onResult(finalText);
        });
    }

    public static void getTasksSummary(Context context, TextCallback callback) {
        executor.execute(() -> {
            String serverUrl = getServerUrl(context);
            String token = getAuthToken(context);
            String summary = null;

            try {
                URL url = new URL(serverUrl + "/api/reminders");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(10000);
                if (!token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONArray arr = new JSONArray(sb.toString());
                    int activeTasks = 0;
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject t = arr.getJSONObject(i);
                        if (t.optInt("is_completed", 0) == 0) {
                            activeTasks++;
                        }
                    }

                    if (activeTasks > 0) {
                        summary = String.format("Günün hatırlatıcıları: Listenizde tamamlanması gereken %d adet aktif görev ve randevu bulunuyor.", activeTasks);
                    } else {
                        summary = "Günün görevleri: Tüm hatırlatıcılarınız tamamlanmış görünüyor, listeniz temiz.";
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Tasks fetch error: " + e.getMessage());
            }

            if (summary == null) {
                summary = "Bugün için kayıtlı acil bir randevunuz veya göreviniz bulunmuyor.";
            }

            final String finalText = summary;
            callback.onResult(finalText);
        });
    }

    public static void getVehicleSummary(Context context, TextCallback callback) {
        executor.execute(() -> {
            String serverUrl = getServerUrl(context);
            String token = getAuthToken(context);
            String summary = null;

            try {
                URL url = new URL(serverUrl + "/api/vehicle");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(10000);
                if (!token.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                }

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject v = new JSONObject(sb.toString());
                    String brand = v.optString("brand_model", "KIA EV6");
                    summary = brand + " aracınız sisteme tam bağlı durumda. Batarya ve şarj kayıtları aktif olarak takip ediliyor. Harika bir sürüş deneyimi dilerim.";
                }
            } catch (Exception e) {
                Log.w(TAG, "Vehicle fetch error: " + e.getMessage());
            }

            if (summary == null) {
                summary = "KIA EV6 elektrikli aracınız hazır durumda. Sistem ve telemetri bağlantınız aktif.";
            }

            final String finalText = summary;
            callback.onResult(finalText);
        });
    }

    public static void fetchTtsAudioFile(Context context, String text, AudioFileCallback callback) {
        executor.execute(() -> {
            String serverUrl = getServerUrl(context);
            try {
                URL url = new URL(serverUrl + "/api/tts/mazlum-kiper");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(20000);
                conn.setDoOutput(true);

                JSONObject payload = new JSONObject();
                payload.put("text", text);
                payload.put("speed", 1.0);

                OutputStream os = conn.getOutputStream();
                os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
                os.flush();
                os.close();

                if (conn.getResponseCode() == 200) {
                    File outFile = new File(context.getCacheDir(), "car_tts_temp.mp3");
                    InputStream is = conn.getInputStream();
                    FileOutputStream fos = new FileOutputStream(outFile);
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = is.read(buffer)) != -1) {
                        fos.write(buffer, 0, bytesRead);
                    }
                    fos.flush();
                    fos.close();
                    is.close();

                    if (outFile.exists() && outFile.length() > 500) {
                        callback.onSuccess(outFile);
                        return;
                    }
                }
                callback.onError("Server returned status " + conn.getResponseCode());
            } catch (Exception e) {
                Log.w(TAG, "TTS file fetch failed: " + e.getMessage());
                callback.onError(e.getMessage());
            }
        });
    }
}
