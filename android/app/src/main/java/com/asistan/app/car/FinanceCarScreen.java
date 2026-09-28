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

public class FinanceCarScreen extends Screen {

    private final CarAudioPlayer audioPlayer;
    private String summaryText = "";
    private boolean isLoading = true;

    public FinanceCarScreen(@NonNull CarContext carContext, @NonNull CarAudioPlayer audioPlayer) {
        super(carContext);
        this.audioPlayer = audioPlayer;
        loadData();
    }

    private void loadData() {
        isLoading = true;
        CarDataHelper.getFinanceSummary(getCarContext(), text -> {
            summaryText = text;
            isLoading = false;
            invalidate();
        });
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        if (isLoading) {
            return new ListTemplate.Builder()
                    .setTitle("Kasa & Finans Durumu")
                    .setHeaderAction(Action.BACK)
                    .setLoading(true)
                    .build();
        }

        ItemList.Builder listBuilder = new ItemList.Builder();

        // 1. Sesli Dinle Butonu
        listBuilder.addItem(new Row.Builder()
                .setTitle("🎙️ Finans Raporunu Sesli Dinle")
                .addText("Özet durumu araç hoparlöründen dinleyin")
                .setOnClickListener(() -> {
                    CarToast.makeText(getCarContext(), "Finans raporu okunuyor...", CarToast.LENGTH_SHORT).show();
                    audioPlayer.playText(summaryText, null);
                })
                .build());

        // 2. Özet Bilgi Kartı
        listBuilder.addItem(new Row.Builder()
                .setTitle("📊 Genel Finans Özeti")
                .addText(summaryText.length() > 100 ? summaryText.substring(0, 97) + "..." : summaryText)
                .build());

        ActionStrip actionStrip = new ActionStrip.Builder()
                .addAction(new Action.Builder()
                        .setTitle("Yenile")
                        .setOnClickListener(this::loadData)
                        .build())
                .build();

        return new ListTemplate.Builder()
                .setTitle("Kasa & Finans Durumu")
                .setHeaderAction(Action.BACK)
                .setActionStrip(actionStrip)
                .setSingleList(listBuilder.build())
                .build();
    }
}
