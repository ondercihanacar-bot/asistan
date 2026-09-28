package com.asistan.app.car;

import android.content.Intent;
import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;

public class AssistantCarSession extends Session {

    private CarAudioPlayer audioPlayer;

    @NonNull
    @Override
    public Screen onCreateScreen(@NonNull Intent intent) {
        audioPlayer = new CarAudioPlayer(getCarContext());
        return new MainCarScreen(getCarContext(), audioPlayer);
    }
}
