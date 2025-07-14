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

// MacrotellectLink SDK imports - CORRECT API
import com.boby.bluetoothconnect.LinkManager;
import com.boby.bluetoothconnect.callback.ScanCallBack;
import com.boby.bluetoothconnect.classic.bean.BlueConnectDevice;
import com.boby.bluetoothconnect.classic.listener.OnConnectListener;

import java.util.ArrayList;
import java.util.List;

/**
 * React Native bridge for MacrotellectLink SDK
 * Provides native BLE functionality for BrainLink devices
 */
public class BrainLinkModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkModule";
    private final ReactApplicationContext reactContext;
    private LinkManager linkManager;
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
            
            if (linkManager == null) {
                linkManager = LinkManager.init(reactContext);
                Log.d(TAG, "LinkManager initialized successfully");
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
            if (!isInitialized || linkManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Starting device scan...");
            
            // Set up the scan callback
            linkManager.setScanCallBack(new ScanCallBack() {
                @Override
                public void onScaningDeviceFound(BlueConnectDevice device) {
                    Log.d(TAG, "Device found: " + device.getName());
                    
                    WritableMap deviceInfo = Arguments.createMap();
                    deviceInfo.putString("name", device.getName());
                    deviceInfo.putString("address", device.getAddress());
                    
                    sendEvent("DeviceFound", deviceInfo);
                }

                @Override
                public void onScanFinish() {
                    Log.d(TAG, "Device scan finished");
                    sendEvent("DeviceSearchFinished", null);
                }
            });
            
            // Start the scan
            linkManager.startScan();
            sendEvent("DeviceSearchStarted", null);
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
            if (!isInitialized || linkManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Stopping device scan...");
            linkManager.stopScan();
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
            if (!isInitialized || linkManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Connecting to device: " + deviceAddress);
            
            // Create a BlueConnectDevice from the address
            BlueConnectDevice device = new BlueConnectDevice();
            device.setAddress(deviceAddress);
            
            linkManager.connectDevice(device);
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
            if (!isInitialized || linkManager == null) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }

            Log.d(TAG, "Disconnecting from device...");
            linkManager.close();
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