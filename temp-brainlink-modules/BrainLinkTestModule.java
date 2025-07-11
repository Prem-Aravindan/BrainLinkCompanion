package com.brainlinkreact;

import android.util.Log;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

// Test if basic module works without MacrotellectLink imports
public class BrainLinkTestModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkTestModule";
    private ReactApplicationContext reactContext;

    public BrainLinkTestModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "BrainLinkTestModule";
    }

    @ReactMethod
    public void testConnection(Promise promise) {
        try {
            Log.d(TAG, "Test module is working");
            promise.resolve("Test module working - JAR integration next step");
        } catch (Exception e) {
            Log.e(TAG, "Test failed", e);
            promise.reject("TEST_ERROR", e.getMessage(), e);
        }
    }
}
