package com.brainlinkreact;

import android.util.Log;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

/**
 * Factory for creating the appropriate BrainLink module implementation
 * Attempts to load the full MacrotellectLink implementation, falls back to stub
 */
public class BrainLinkModuleFactory {
    private static final String TAG = "BrainLinkModuleFactory";

    public static ReactContextBaseJavaModule createModule(ReactApplicationContext reactContext) {
        try {
            Log.d(TAG, "Creating BrainLink module with SDK auto-detection");
            return new BrainLinkModuleSafe(reactContext);
                
        } catch (Exception e) {
            Log.e(TAG, "Error creating BrainLink module, falling back to stub", e);
            return new BrainLinkModuleStub(reactContext);
        }
    }
}
