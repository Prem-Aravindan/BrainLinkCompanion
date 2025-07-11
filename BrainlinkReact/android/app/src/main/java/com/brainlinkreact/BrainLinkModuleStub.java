package com.brainlinkreact;

import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * Stub implementation of BrainLinkModule that compiles without MacrotellectLink SDK
 * This allows the app to build and run, with real functionality loaded when SDK is available
 */
public class BrainLinkModuleStub extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkModuleStub";
    private ReactApplicationContext reactContext;

    public BrainLinkModuleStub(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        Log.d(TAG, "BrainLinkModuleStub initialized - SDK not available");
    }

    @Override
    public String getName() {
        return "BrainLinkModule";
    }

    @ReactMethod
    public void initialize(Promise promise) {
        Log.w(TAG, "MacrotellectLink SDK not available - using stub implementation");
        WritableMap result = Arguments.createMap();
        result.putBoolean("success", false);
        result.putString("error", "MacrotellectLink SDK not available on this platform");
        promise.resolve(result);
    }

    @ReactMethod
    public void startScan(Promise promise) {
        Log.w(TAG, "startScan called but SDK not available");
        WritableMap result = Arguments.createMap();
        result.putBoolean("success", false);
        result.putString("error", "MacrotellectLink SDK not available");
        promise.resolve(result);
    }

    @ReactMethod
    public void stopScan(Promise promise) {
        Log.w(TAG, "stopScan called but SDK not available");
        WritableMap result = Arguments.createMap();
        result.putBoolean("success", true);
        promise.resolve(result);
    }

    @ReactMethod
    public void connectToDevice(String deviceId, Promise promise) {
        Log.w(TAG, "connectToDevice called but SDK not available");
        WritableMap result = Arguments.createMap();
        result.putBoolean("success", false);
        result.putString("error", "MacrotellectLink SDK not available");
        promise.resolve(result);
    }

    @ReactMethod
    public void disconnectDevice(Promise promise) {
        Log.w(TAG, "disconnectDevice called but SDK not available");
        WritableMap result = Arguments.createMap();
        result.putBoolean("success", true);
        promise.resolve(result);
    }

    @ReactMethod
    public void getConnectedDevices(Promise promise) {
        Log.w(TAG, "getConnectedDevices called but SDK not available");
        WritableArray devices = Arguments.createArray();
        promise.resolve(devices);
    }

    @ReactMethod
    public void isSDKAvailable(Promise promise) {
        Log.d(TAG, "SDK availability check - returning false");
        promise.resolve(false);
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }
}
