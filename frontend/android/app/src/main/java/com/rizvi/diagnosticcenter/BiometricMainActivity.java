package com.rizvi.diagnosticcenter;

import android.os.Bundle;

public class BiometricMainActivity extends MainActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BiometricAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
