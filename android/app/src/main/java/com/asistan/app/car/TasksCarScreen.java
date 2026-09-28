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

public class TasksCarScreen extends Screen {

    private final CarAudioPlayer audioPlayer;
    private String tasksText = "";
    private boolean isLoading = true;

    public TasksCarScreen(@NonNull CarContext carContext, @NonNull CarAudioPlayer audioPlayer) {
        super(carContext);
        this.audioPlayer = audioPlayer;
        loadData();
    }

    private void loadData() {
        isLoading = true;
        CarDataHelper.getTasksSummary(getCarContext(), text -> {
            tasksText = text;
            isLoading = false;
            invalidate();
        });
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        if (isLoading) {
            return new ListTemplate.Builder()
                    .setTitle("Bugünkü Görevler")
                    .setHeaderAction(Action.BACK)
                    .setLoading(true)
                    .build();
        }

        ItemList.Builder listBuilder = new ItemList.Builder();

        // 1. Sesli Dinle Butonu
        listBuilder.addItem(new Row.Builder()
                .setTitle("🎙️ Görevleri Sesli Dinle")
                .addText("Listenizdeki işleri araç hoparlöründen dinleyin")
                .setOnClickListener(() -> {
                    CarToast.makeText(getCarContext(), "Görevler seslendiriliyor...", CarToast.LENGTH_SHORT).show();
                    audioPlayer.playText(tasksText, null);
                })
                .build());

        // 2. Özet Bilgi Kartı
        listBuilder.addItem(new Row.Builder()
                .setTitle("📋 Görev Listesi")
                .addText(tasksText.length() > 100 ? tasksText.substring(0, 97) + "..." : tasksText)
                .build());

        ActionStrip actionStrip = new ActionStrip.Builder()
                .addAction(new Action.Builder()
                        .setTitle("Yenile")
                        .setOnClickListener(this::loadData)
                        .build())
                .build();

        return new ListTemplate.Builder()
                .setTitle("Bugünkü Görevler")
                .setHeaderAction(Action.BACK)
                .setActionStrip(actionStrip)
                .setSingleList(listBuilder.build())
                .build();
    }
}
