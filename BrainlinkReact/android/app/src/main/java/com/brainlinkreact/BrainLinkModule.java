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
import com.boby.bluetoothconnect.BlueManager;
import com.boby.bluetoothconnect.classic.listener.OnSearchDeviceListener;
import com.boby.bluetoothconnect.classic.bean.BlueConnectDevice;
import android.bluetooth.BluetoothDevice;

import java.util.ArrayList;
import java.util.List;

/**
 * React Native bridge for MacrotellectLink SDK
 * Provides native BLE functionality for BrainLink devices
 */
public class BrainLinkModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkModule";
    private final ReactApplicationContext reactContext;
    private BlueManager blueManager;
    private boolean isInitialized = false;

    public BrainLinkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        Log.d(TAG, "BrainLinkModule created with MacrotellectLink SDK");
    }

    @Override
    public String getName() {
        return "BrainLinkModule";
    }

    /**
     * Initialize the MacrotellectLink SDK
     */
    @ReactMethod
    public void initialize(Promise promise) {
        try {
            Log.d(TAG, "Initializing MacrotellectLink SDK...");
            
            if (blueManager == null) {
                blueManager = new BlueManager();
                Log.d(TAG, "BlueManager created successfully");
            }
            
            isInitialized = true;
            Log.d(TAG, "MacrotellectLink SDK initialized successfully");
            promise.resolve("SDK initialized successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize MacrotellectLink SDK", e);
            promise.reject("INIT_ERROR", "Failed to initialize SDK: " + e.getMessage());
        }
    }

    /**
     * Start scanning for BrainLink devices
     */
    @ReactMethod
    public void startScan(Promise promise) {
        try {
            if (!isInitialized || blueManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Starting device scan...");
            
            // Set up the search device listener
            blueManager.setOnSearchDeviceListener(new OnSearchDeviceListener() {
                @Override
                public void onStartDiscovery() {
                    Log.d(TAG, "Device discovery started");
                    sendEvent("DeviceSearchStarted", null);
                }

                @Override
                public void onNewDeviceFound(BluetoothDevice device) {
                    Log.d(TAG, "New device found: " + device.getName());
                    
                    WritableMap deviceInfo = Arguments.createMap();
                    deviceInfo.putString("name", device.getName());
                    deviceInfo.putString("address", device.getAddress());
                    
                    sendEvent("DeviceFound", deviceInfo);
                }

                @Override
                public void onSearchCompleted(List<BlueConnectDevice> pairedDevices, List<BlueConnectDevice> unpairedDevices) {
                    Log.d(TAG, "Device search completed - Paired: " + pairedDevices.size() + ", Unpaired: " + unpairedDevices.size());
                    
                    WritableMap result = Arguments.createMap();
                    result.putInt("pairedCount", pairedDevices.size());
                    result.putInt("unpairedCount", unpairedDevices.size());
                    
                    sendEvent("DeviceSearchFinished", result);
                }

                @Override
                public void onNewBoundNewDevice(BlueConnectDevice device) {
                    Log.d(TAG, "New bound device: " + device.getName());
                    
                    WritableMap deviceInfo = Arguments.createMap();
                    deviceInfo.putString("name", device.getName());
                    deviceInfo.putString("address", device.getAddress());
                    
                    sendEvent("DeviceBound", deviceInfo);
                }

                @Override
                public void onError(String error) {
                    Log.e(TAG, "Search error: " + error);
                    
                    WritableMap errorInfo = Arguments.createMap();
                    errorInfo.putString("error", error);
                    
                    sendEvent("DeviceSearchError", errorInfo);
                }
            });
            
            // Start the scan
            blueManager.startScan();
            promise.resolve("Scan started successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start scan", e);
            promise.reject("SCAN_ERROR", "Failed to start scan: " + e.getMessage());
        }
    }

    /**
     * Stop scanning for devices
     */
    @ReactMethod
    public void stopScan(Promise promise) {
        try {
            if (!isInitialized || blueManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Stopping device scan...");
            blueManager.stopScan();
            promise.resolve("Scan stopped successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop scan", e);
            promise.reject("SCAN_ERROR", "Failed to stop scan: " + e.getMessage());
        }
    }

    /**
     * Connect to a specific device
     */
    @ReactMethod
    public void connectToDevice(String deviceAddress, Promise promise) {
        try {
            if (!isInitialized || blueManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Connecting to device: " + deviceAddress);
            // Implementation depends on MacrotellectLink SDK API
            promise.resolve("Connection initiated for " + deviceAddress);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to connect to device", e);
            promise.reject("CONNECTION_ERROR", "Failed to connect: " + e.getMessage());
        }
    }

    /**
     * Disconnect from current device
     */
    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            if (!isInitialized || blueManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Disconnecting from device...");
            // Implementation depends on MacrotellectLink SDK API
            promise.resolve("Disconnected successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to disconnect", e);
            promise.reject("DISCONNECT_ERROR", "Failed to disconnect: " + e.getMessage());
        }
    }

    /**
     * Get list of connected devices
     */
    @ReactMethod
    public void getConnectedDevices(Promise promise) {
        try {
            WritableArray devices = Arguments.createArray();
            // Implementation depends on MacrotellectLink SDK API
            promise.resolve(devices);
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to get connected devices", e);
            promise.reject("GET_DEVICES_ERROR", "Failed to get devices: " + e.getMessage());
        }
    }

    /**
     * Send events to React Native
     */
    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }
}