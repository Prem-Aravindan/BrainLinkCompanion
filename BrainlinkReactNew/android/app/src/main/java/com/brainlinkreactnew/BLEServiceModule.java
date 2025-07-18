package com.brainlinkreactnew;

import android.content.Intent;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import android.util.Log;

/**
 * React Native module to control BLE Foreground Service
 * Prevents DirectBLE from disconnecting after 15 seconds
 */
public class BLEServiceModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BLEServiceModule";
    private ReactApplicationContext reactContext;
    
    public BLEServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }
    
    @Override
    public String getName() {
        return "BLEServiceModule";
    }
    
    @ReactMethod
    public void startForegroundService(Promise promise) {
        try {
            Log.d(TAG, "Starting BLE Foreground Service");
            Intent serviceIntent = new Intent(reactContext, BLEForegroundService.class);
            reactContext.startForegroundService(serviceIntent);
            promise.resolve("BLE Foreground Service started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start BLE Foreground Service", e);
            promise.reject("START_FAILED", "Failed to start BLE Foreground Service: " + e.getMessage());
        }
    }
    
    @ReactMethod
    public void stopForegroundService(Promise promise) {
        try {
            Log.d(TAG, "Stopping BLE Foreground Service");
            Intent serviceIntent = new Intent(reactContext, BLEForegroundService.class);
            reactContext.stopService(serviceIntent);
            promise.resolve("BLE Foreground Service stopped");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop BLE Foreground Service", e);
            promise.reject("STOP_FAILED", "Failed to stop BLE Foreground Service: " + e.getMessage());
        }
    }
}
