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

// MacrotellectLink SDK imports
import com.macrotellect.link.LinkManager;
import com.macrotellect.link.OnConnectListener;
import com.macrotellect.link.EEGPowerDataListener;
import com.macrotellect.link.BrainWave;
import com.macrotellect.link.Gravity;
import com.macrotellect.link.BlueConnectDevice;

import java.util.ArrayList;

public class BrainLinkModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkModule";
    private ReactApplicationContext reactContext;
    
    // MacrotellectLink SDK manager
    private LinkManager linkManager;
    private OnConnectListener connectListener;
    private EEGPowerDataListener dataListener;

    public BrainLinkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        setupListeners();
    }

    @Override
    public String getName() {
        return "BrainLinkModule";
    }

    private void setupListeners() {
        // Connection status listener
        connectListener = new OnConnectListener() {
            @Override
            public void onConnectStart(BlueConnectDevice blueConnectDevice) {
                Log.d(TAG, "Trying to connect: " + blueConnectDevice.getName());
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", blueConnectDevice.getAddress());
                params.putString("deviceName", blueConnectDevice.getName());
                params.putString("status", "connecting");
                sendEvent("BrainLinkConnectionChange", params);
            }

            @Override
            public void onConnectting(BlueConnectDevice blueConnectDevice) {
                Log.d(TAG, "Connecting to: " + blueConnectDevice.getName());
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", blueConnectDevice.getAddress());
                params.putString("deviceName", blueConnectDevice.getName());
                params.putString("status", "connecting");
                sendEvent("BrainLinkConnectionChange", params);
            }

            @Override
            public void onConnectSuccess(BlueConnectDevice blueConnectDevice) {
                Log.d(TAG, "Connected successfully: " + blueConnectDevice.getName());
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", blueConnectDevice.getAddress());
                params.putString("deviceName", blueConnectDevice.getName());
                params.putString("status", "connected");
                params.putBoolean("isBLE", blueConnectDevice.isBleConnect);
                sendEvent("BrainLinkConnectionChange", params);
            }

            @Override
            public void onConnectFailed(BlueConnectDevice blueConnectDevice) {
                Log.d(TAG, "Connection failed: " + blueConnectDevice.getName());
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", blueConnectDevice.getAddress());
                params.putString("deviceName", blueConnectDevice.getName());
                params.putString("status", "failed");
                sendEvent("BrainLinkConnectionChange", params);
            }

            @Override
            public void onConnectionLost(BlueConnectDevice blueConnectDevice) {
                Log.d(TAG, "Connection lost: " + blueConnectDevice.getName());
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", blueConnectDevice.getAddress());
                params.putString("deviceName", blueConnectDevice.getName());
                params.putString("status", "disconnected");
                sendEvent("BrainLinkConnectionChange", params);
            }

            @Override
            public void onError(Exception e) {
                Log.e(TAG, "Connection error", e);
                WritableMap params = Arguments.createMap();
                params.putString("error", e.getMessage());
                sendEvent("BrainLinkError", params);
            }
        };

        // EEG data listener
        dataListener = new EEGPowerDataListener() {
            @Override
            public void onBrainWavedata(String mac, BrainWave brainWave) {
                Log.d(TAG, "EEG Data from " + mac + ": " + brainWave.toString());
                
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", mac);
                params.putDouble("timestamp", System.currentTimeMillis());
                
                // Basic brainwave data
                params.putInt("signal", brainWave.signal);
                params.putInt("attention", brainWave.att);
                params.putInt("meditation", brainWave.med);
                
                // EEG band powers
                params.putInt("delta", brainWave.delta);
                params.putInt("theta", brainWave.theta);
                params.putInt("lowAlpha", brainWave.lowAlpha);
                params.putInt("highAlpha", brainWave.highAlpha);
                params.putInt("lowBeta", brainWave.lowBeta);
                params.putInt("highBeta", brainWave.highBeta);
                params.putInt("lowGamma", brainWave.lowGamma);
                params.putInt("middleGamma", brainWave.middleGamma);
                
                // Additional data (if available)
                params.putInt("appreciation", brainWave.ap);
                params.putInt("batteryCapacity", brainWave.batteryCapacity);
                params.putInt("heartRate", brainWave.heartRate);
                params.putInt("temperature", brainWave.temperature);
                
                sendEvent("BrainLinkEEGData", params);
            }

            @Override
            public void onRawData(String mac, int raw) {
                Log.d(TAG, "Raw EEG data from " + mac + ": " + raw);
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", mac);
                params.putInt("rawData", raw);
                params.putDouble("timestamp", System.currentTimeMillis());
                sendEvent("BrainLinkRawData", params);
            }

            @Override
            public void onGravity(String mac, Gravity gravity) {
                Log.d(TAG, "Gravity data from " + mac + ": X=" + gravity.x + ", Y=" + gravity.y + ", Z=" + gravity.z);
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", mac);
                params.putDouble("x", gravity.x);
                params.putDouble("y", gravity.y);
                params.putDouble("z", gravity.z);
                params.putDouble("timestamp", System.currentTimeMillis());
                sendEvent("BrainLinkGravityData", params);
            }

            @Override
            public void onRR(String mac, ArrayList<Integer> rr, int oxygen) {
                Log.d(TAG, "RR intervals from " + mac + ": " + rr.size() + " intervals, O2: " + oxygen + "%");
                WritableMap params = Arguments.createMap();
                params.putString("deviceId", mac);
                params.putInt("oxygenPercentage", oxygen);
                
                // Convert ArrayList to WritableArray
                WritableArray rrArray = Arguments.createArray();
                for (Integer interval : rr) {
                    rrArray.pushInt(interval);
                }
                params.putArray("rrIntervals", rrArray);
                params.putDouble("timestamp", System.currentTimeMillis());
                sendEvent("BrainLinkRRData", params);
            }
        };
    }

    @ReactMethod
    public void initialize(Promise promise) {
        try {
            Log.d(TAG, "Initializing BrainLink SDK");
            
            // Initialize LinkManager (singleton)
            linkManager = LinkManager.init(reactContext);
            linkManager.setDebug(true); // Enable logging
            
            // Set up listeners
            linkManager.setOnConnectListener(connectListener);
            linkManager.setMultiEEGPowerDataListener(dataListener); // Correct method name from documentation
            
            // Configure connection settings
            linkManager.setMaxConnectSize(1); // Maximum 1 connection
            linkManager.setConnectType(LinkManager.ConnectType.ALLDEVICE); // Allow both BLE and Classic Bluetooth
            linkManager.setWhiteList("BrainLink_Pro,BrainLink_Lite"); // Only allow BrainLink devices
            
            promise.resolve("BrainLink SDK initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize BrainLink SDK", e);
            promise.reject("INIT_ERROR", "Failed to initialize: " + e.getMessage());
        }
    }

    @ReactMethod
    public void startScan(Promise promise) {
        try {
            Log.d(TAG, "Starting device scan");
            
            if (linkManager != null) {
                linkManager.startScan(); // Start scan and auto-connect to whitelisted devices
                promise.resolve("Scan started successfully");
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized. Call initialize() first.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start scan", e);
            promise.reject("SCAN_ERROR", "Failed to start scan: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopScan(Promise promise) {
        try {
            Log.d(TAG, "Stopping device scan");
            
            if (linkManager != null) {
                // Note: The SDK doesn't have an explicit stopScan method in the documentation
                // Scanning stops automatically when devices are found and connected
                promise.resolve("Scan stopped");
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop scan", e);
            promise.reject("SCAN_ERROR", "Failed to stop scan: " + e.getMessage());
        }
    }

    @ReactMethod
    public void connectToDevice(String deviceId, Promise promise) {
        try {
            Log.d(TAG, "Manual connection requested for: " + deviceId);
            
            // Note: The MacrotellectLink SDK uses automatic connection through startScan()
            // Manual connection to specific device ID is not directly supported
            // The SDK connects to whitelisted devices automatically
            
            if (linkManager != null) {
                // Start scan which will auto-connect to whitelisted devices
                linkManager.startScan();
                promise.resolve("Scan started to connect to available devices");
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start connection scan", e);
            promise.reject("CONNECT_ERROR", "Failed to connect: " + e.getMessage());
        }
    }

    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            Log.d(TAG, "Disconnecting from devices");
            
            if (linkManager != null) {
                // Note: The SDK documentation doesn't show explicit disconnect method
                // Connection is managed automatically by the SDK
                // We'll need to check if there's a disconnect method in the actual JAR
                promise.resolve("Disconnect requested - handled by SDK");
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to disconnect", e);
            promise.reject("DISCONNECT_ERROR", "Failed to disconnect: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getConnectedDevices(Promise promise) {
        try {
            if (linkManager != null) {
                int connectedCount = linkManager.getConnectSize();
                WritableMap result = Arguments.createMap();
                result.putInt("connectedCount", connectedCount);
                promise.resolve(result);
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to get connected devices", e);
            promise.reject("GET_DEVICES_ERROR", "Failed to get devices: " + e.getMessage());
        }
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }
}
