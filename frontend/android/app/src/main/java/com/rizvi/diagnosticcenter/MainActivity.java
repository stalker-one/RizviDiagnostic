package com.rizvi.diagnosticcenter;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(PrintPlugin.class);
        registerPlugin(UpdatePlugin.class);
        registerPlugin(ExportPlugin.class);
    }
}
