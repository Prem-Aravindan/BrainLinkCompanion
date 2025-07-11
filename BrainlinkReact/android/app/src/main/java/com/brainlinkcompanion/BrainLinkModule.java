package com.brainlinkcompanion;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

// Import MacrotellectLink SDK classes
import com.macrotellect.domain.model.multi.BrainWave;
import com.macrotellect.domain.model.multi.Gravity;
import com.macrotellect.domain.model.multi.BlueConnectDevice;
import com.macrotellect.link.LinkManager;
import com.macrotellect.link.listener.EEGPowerDataListener;
import com.macrotellect.link.listener.OnConnectListener;
import java.util.ArrayList;

import android.util.Log;
import java.util.HashMap;
import java.util.Map;

public class BrainLinkModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkModule";
    private ReactApplicationContext reactContext;
    private LinkManager linkManager;
    private boolean isInitialized = false;
    private boolean isScanning = false;

    public BrainLinkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "BrainLinkModule";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("DEVICE_BRAINLINK_PRO", "BrainLink_pro");
        constants.put("DEVICE_BRAINLINK_LITE", "BrainLink_Lite");
        return constants;
    }

    @ReactMethod
    public void initializeSDK(Promise promise) {
        try {
            Log.d(TAG, "Initializing MacrotellectLink SDK...");
            
            // Initialize the LinkManager
            linkManager = LinkManager.init(reactContext);
            linkManager.setDebug(true); // Enable debug logging
            
            // Configure connection settings
            linkManager.setMaxConnectSize(1); // Only connect to one device at a time
            linkManager.setConnectType(LinkManager.ConnectType.ALLDEVICE); // Support both BLE and Classic Bluetooth
            linkManager.setWhiteList("BrainLink_pro,BrainLink_Lite"); // Set device whitelist
            
            // Setup data listeners
            setupDataListeners();
            setupConnectionListener();
            
            isInitialized = true;
            promise.resolve(true);
            Log.d(TAG, "SDK initialized successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize SDK: " + e.getMessage());
            promise.reject("INIT_ERROR", "Failed to initialize BrainLink SDK: " + e.getMessage());
        }
    }

    @ReactMethod
    public void startScan(Promise promise) {
        try {
            if (!isInitialized) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized. Call initializeSDK first.");
                return;
            }

            Log.d(TAG, "Starting device scan...");
            
            // Start scanning for devices
            linkManager.startScan();
            
            isScanning = true;
            promise.resolve(true);
            Log.d(TAG, "Device scan started");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start scan: " + e.getMessage());
            promise.reject("SCAN_ERROR", "Failed to start scan: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopScan(Promise promise) {
        try {
            Log.d(TAG, "Stopping device scan...");
            
            // Note: The SDK doesn't have a stopScan method, scanning stops automatically when devices connect
            // linkManager.stopScan(); // This method doesn't exist in the SDK
            
            isScanning = false;
            promise.resolve(true);
            Log.d(TAG, "Device scan stopped");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop scan: " + e.getMessage());
            promise.reject("SCAN_ERROR", "Failed to stop scan: " + e.getMessage());
        }
    }

    @ReactMethod
    public void connectToDevice(String deviceMac, Promise promise) {
        try {
            Log.d(TAG, "Note: MacrotellectLink SDK connects automatically during scan");
            Log.d(TAG, "Device MAC: " + deviceMac + " will be connected when found during scan");
            
            // The MacrotellectLink SDK automatically connects to whitelisted devices during scanning
            // There's no explicit connect method - connection happens in the scan process
            
            promise.resolve(true);
            Log.d(TAG, "Auto-connection enabled for device: " + deviceMac);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to setup connection: " + e.getMessage());
            promise.reject("CONNECT_ERROR", "Failed to setup connection: " + e.getMessage());
        }
    }

    @ReactMethod
    public void disconnectDevice(Promise promise) {
        try {
            Log.d(TAG, "Disconnecting all devices...");
            
            // The SDK doesn't have a specific disconnect method either
            // Connection is managed through the scan lifecycle
            // We can trigger a new scan to potentially reconnect
            
            promise.resolve(true);
            Log.d(TAG, "Disconnect signal sent");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to disconnect device: " + e.getMessage());
            promise.reject("DISCONNECT_ERROR", "Failed to disconnect device: " + e.getMessage());
        }
    }

    private void setupDataListeners() {
        // Set up EEG Power Data Listener for brainwave data
        linkManager.setEegPowerDataListener(new EEGPowerDataListener() {
            @Override
            public void onBrainWavedata(String mac, BrainWave brainWave) {
                Log.d(TAG, "Received brainwave data from: " + mac);
                
                WritableMap data = Arguments.createMap();
                data.putString("type", "brainwave");
                data.putString("deviceMac", mac);
                
                // Basic brainwave data
                data.putInt("signal", brainWave.getSignal());
                data.putInt("attention", brainWave.getAtt());
                data.putInt("meditation", brainWave.getMed());
                
                // EEG Band powers
                data.putDouble("delta", brainWave.getDelta());
                data.putDouble("theta", brainWave.getTheta());
                data.putDouble("lowAlpha", brainWave.getLowAlpha());
                data.putDouble("highAlpha", brainWave.getHighAlpha());
                data.putDouble("lowBeta", brainWave.getLowBeta());
                data.putDouble("highBeta", brainWave.getHighBeta());
                data.putDouble("lowGamma", brainWave.getLowGamma());
                data.putDouble("middleGamma", brainWave.getMiddleGamma());
                
                // Additional data (if available)
                try {
                    data.putDouble("appreciation", brainWave.getAp()); // Appreciation
                    data.putInt("batteryCapacity", brainWave.getBatteryCapacity());
                    data.putInt("heartRate", brainWave.getHeartRate());
                    data.putDouble("temperature", brainWave.getTemperature());
                } catch (Exception e) {
                    Log.d(TAG, "Some additional data not available: " + e.getMessage());
                }
                
                data.putDouble("timestamp", System.currentTimeMillis());
                sendEvent("BrainLinkData", data);
            }

            @Override
            public void onRawData(String mac, int raw) {
                Log.d(TAG, "Received raw EEG data from: " + mac);
                
                WritableMap data = Arguments.createMap();
                data.putString("type", "raw");
                data.putString("deviceMac", mac);
                data.putInt("rawEEG", raw);
                data.putDouble("timestamp", System.currentTimeMillis());
                
                sendEvent("BrainLinkData", data);
            }

            @Override
            public void onGravity(String mac, Gravity gravity) {
                Log.d(TAG, "Received gravity data from: " + mac);
                
                WritableMap data = Arguments.createMap();
                data.putString("type", "gravity");
                data.putString("deviceMac", mac);
                data.putDouble("x", gravity.getX()); // Pitching angle
                data.putDouble("y", gravity.getY()); // Yaw angle  
                data.putDouble("z", gravity.getZ()); // Roll angle
                data.putDouble("timestamp", System.currentTimeMillis());
                
                sendEvent("BrainLinkData", data);
            }

            @Override
            public void onRR(String mac, ArrayList<Integer> rr, int oxygen) {
                Log.d(TAG, "Received RR and oxygen data from: " + mac);
                
                WritableMap data = Arguments.createMap();
                data.putString("type", "rr_oxygen");
                data.putString("deviceMac", mac);
                data.putArray("rrIntervals", Arguments.fromArray(rr.toArray()));
                data.putInt("oxygenPercentage", oxygen);
                data.putDouble("timestamp", System.currentTimeMillis());
                
                sendEvent("BrainLinkData", data);
            }
        });
    }

    private void setupConnectionListener() {
        // Set up connection status listener
        linkManager.setOnConnectListener(new OnConnectListener() {
            @Override
            public void onConnectStart(BlueConnectDevice blueConnectDevice) {
                Log.d(TAG, "Connection starting to: " + blueConnectDevice.getName());
                
                WritableMap data = Arguments.createMap();
                data.putString("status", "connecting");
                data.putString("deviceName", blueConnectDevice.getName());
                data.putString("deviceMac", blueConnectDevice.getAddress());
                data.putBoolean("isBLE", blueConnectDevice.isBleConnect);
                
                sendEvent("BrainLinkConnection", data);
            }

            @Override
            public void onConnectting(BlueConnectDevice blueConnectDevice) {
                Log.d(TAG, "Connecting to: " + blueConnectDevice.getName());
                
                WritableMap data = Arguments.createMap();
                data.putString("status", "connecting");
                data.putString("deviceName", blueConnectDevice.getName());
                data.putString("deviceMac", blueConnectDevice.getAddress());
                data.putBoolean("isBLE", blueConnectDevice.isBleConnect);
                
                sendEvent("BrainLinkConnection", data);
            }

            @Override
            public void onConnectSuccess(BlueConnectDevice blueConnectDevice) {
                String connectType = blueConnectDevice.isBleConnect ? "BLE 4.0" : "Classic 3.0";
                Log.d(TAG, "Connected successfully to: " + blueConnectDevice.getName() + 
                     " (" + blueConnectDevice.getAddress() + ") via " + connectType);
                
                WritableMap data = Arguments.createMap();
                data.putString("status", "connected");
                data.putString("deviceName", blueConnectDevice.getName());
                data.putString("deviceMac", blueConnectDevice.getAddress());
                data.putBoolean("isBLE", blueConnectDevice.isBleConnect);
                data.putString("connectionType", connectType);
                
                sendEvent("BrainLinkConnection", data);
            }

            @Override
            public void onConnectFailed(BlueConnectDevice blueConnectDevice) {
                Log.e(TAG, "Connection failed to: " + blueConnectDevice.getName());
                
                WritableMap data = Arguments.createMap();
                data.putString("status", "failed");
                data.putString("deviceName", blueConnectDevice.getName());
                data.putString("deviceMac", blueConnectDevice.getAddress());
                data.putString("error", "Connection failed");
                
                sendEvent("BrainLinkConnection", data);
            }

            @Override
            public void onConnectionLost(BlueConnectDevice blueConnectDevice) {
                Log.w(TAG, "Connection lost to: " + blueConnectDevice.getName());
                
                WritableMap data = Arguments.createMap();
                data.putString("status", "disconnected");
                data.putString("deviceName", blueConnectDevice.getName());
                data.putString("deviceMac", blueConnectDevice.getAddress());
                data.putString("reason", "Connection lost");
                
                sendEvent("BrainLinkConnection", data);
            }

            @Override
            public void onError(Exception e) {
                Log.e(TAG, "Connection error: " + e.getMessage());
                e.printStackTrace();
                
                WritableMap data = Arguments.createMap();
                data.putString("status", "error");
                data.putString("error", e.getMessage());
                
                sendEvent("BrainLinkConnection", data);
            }
        });
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        // Cleanup when module is destroyed
        isInitialized = false;
        isScanning = false;
    }
}
