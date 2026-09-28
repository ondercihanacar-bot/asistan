package com.asistan.app.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

public class MainCarScreen extends Screen {

    private final CarAudioPlayer audioPlayer;
    private String lastStatus = "Optimus Sürüş Modu Aktif";

    public MainCarScreen(@NonNull CarContext carContext, @NonNull CarAudioPlayer audioPlayer) {
        super(carContext);
        this.audioPlayer = audioPlayer;
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        ItemList.Builder listBuilder = new ItemList.Builder();

        // 1. Günün Sesli Brifingi (Tek dokunuşla başlat)
        listBuilder.addItem(new Row.Builder()
                .setTitle("🎙️ Günün Brifingini Dinle")
                .addText("Hava durumu, acil faturalar ve araç durumu özeti")
                .setOnClickListener(this::playBriefing)
                .build());

        // 2. Finans ve Kasa Durumu
        listBuilder.addItem(new Row.Builder()
                .setTitle("💰 Kasa & Finans Durumu")
                .addText("Bekleyen faturalar ve yaklaşan ödemeleri gör")
                .setOnClickListener(this::openFinanceScreen)
                .build());

        // 3. Günün Görevleri
        listBuilder.addItem(new Row.Builder()
                .setTitle("📋 Bugünkü Görevler & Randevular")
                .addText("Listenizdeki aktif hatırlatıcılar")
                .setOnClickListener(this::openTasksScreen)
                .build());

        // 4. KIA EV6 & Tasarruf Raporu
        listBuilder.addItem(new Row.Builder()
                .setTitle("🚗 KIA EV6 Araç Durumu")
                .addText("Batarya, şarj ve akaryakıt tasarruf raporunu dinle")
                .setOnClickListener(this::playVehicleReport)
                .build());

        // 5. Oynatmayı Durdur (Eğer çalıyorsa)
        if (audioPlayer.isPlaying()) {
            listBuilder.addItem(new Row.Builder()
                    .setTitle("⏹️ Seslendirmeyi Durdur")
                    .addText("Araba hoparlörlerindeki konuşmayı sustur")
                    .setOnClickListener(() -> {
                        audioPlayer.stop();
                        CarToast.makeText(getCarContext(), "Ses durduruldu", CarToast.LENGTH_SHORT).show();
                        invalidate();
                    })
                    .build());
        }

        ActionStrip actionStrip = new ActionStrip.Builder()
                .addAction(new Action.Builder()
                        .setTitle("Yenile")
                        .setOnClickListener(this::invalidate)
                        .build())
                .build();

        return new ListTemplate.Builder()
                .setTitle("Akıllı Asistan - Optimus")
                .setHeaderAction(Action.APP_ICON)
                .setActionStrip(actionStrip)
                .setSingleList(listBuilder.build())
                .build();
    }

    private void playBriefing() {
        CarToast.makeText(getCarContext(), "🎙️ Brifing hazırlanıyor...", CarToast.LENGTH_SHORT).show();
        lastStatus = "Brifing çalınıyor...";
        invalidate();

        CarDataHelper.getDailyBriefing(getCarContext(), text -> {
            audioPlayer.playText(text, new CarAudioPlayer.PlaybackListener() {
                @Override
                public void onStarted() {
                    CarToast.makeText(getCarContext(), "Optimus Prime Brifingi Başladı", CarToast.LENGTH_SHORT).show();
                    invalidate();
                }

                @Override
                public void onFinished() {
                    lastStatus = "Brifing tamamlandı";
                    invalidate();
                }

                @Override
                public void onError(String message) {
                    CarToast.makeText(getCarContext(), "Ses hatası: " + message, CarToast.LENGTH_SHORT).show();
                    invalidate();
                }
            });
        });
    }

    private void openFinanceScreen() {
        getScreenManager().push(new FinanceCarScreen(getCarContext(), audioPlayer));
    }

    private void openTasksScreen() {
        getScreenManager().push(new TasksCarScreen(getCarContext(), audioPlayer));
    }

    private void playVehicleReport() {
        CarToast.makeText(getCarContext(), "🚗 Araç raporu yükleniyor...", CarToast.LENGTH_SHORT).show();
        CarDataHelper.getVehicleSummary(getCarContext(), text -> {
            audioPlayer.playText(text, new CarAudioPlayer.PlaybackListener() {
                @Override
                public void onStarted() {
                    invalidate();
                }

                @Override
                public void onFinished() {
                    invalidate();
                }

                @Override
                public void onError(String message) {
                    CarToast.makeText(getCarContext(), "Hata: " + message, CarToast.LENGTH_SHORT).show();
                    invalidate();
                }
            });
        });
    }
}
