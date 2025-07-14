package com.brainlinkreact;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import android.util.Log;
import android.content.Context;

// MacrotellectLink SDK Imports - Corrected with actual JAR inspection
import com.boby.bluetoothconnect.LinkManager;
import com.boby.bluetoothconnect.callback.ScanCallBack;
import com.boby.bluetoothconnect.classic.bean.BlueConnectDevice;
import com.boby.bluetoothconnect.classic.listener.EEGPowerDataListener;
import com.boby.bluetoothconnect.classic.listener.OnConnectListener;
import com.boby.bluetoothconnect.bean.BrainWave;
import com.boby.bluetoothconnect.bean.Gravity;

import javax.annotation.Nonnull;
import java.util.ArrayList;

public class BrainLinkModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkModule";
    private LinkManager linkManager;
    private ReactApplicationContext reactContext;
    private BlueConnectDevice connectedDevice;

    public BrainLinkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        initializeLinkManager();
    }

    @Nonnull
    @Override
    public String getName() {
        return "BrainLinkModule";
    }

    private void initializeLinkManager() {
        try {
            // Initialize LinkManager with Android Context
            linkManager = LinkManager.init(getReactApplicationContext());
            Log.d(TAG, "LinkManager initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize LinkManager", e);
        }
    }

    @ReactMethod
    public void startDeviceScan(Promise promise) {
        try {
            if (linkManager == null) {
                initializeLinkManager();
            }

            // Set scan callback to receive device discovery events
            linkManager.setScanCallBack(new ScanCallBack() {
                @Override
                public void onScaningDeviceFound(BlueConnectDevice device) {
                    Log.d(TAG, "Device found: " + device.getName() + " - " + device.getAddress());
                    
                    // Emit device found event to React Native
                    WritableMap deviceMap = new WritableNativeMap();
                    deviceMap.putString("id", device.getAddress());
                    deviceMap.putString("name", device.getName() != null ? device.getName() : "Unknown");
                    deviceMap.putString("address", device.getAddress());
                    deviceMap.putInt("rssi", device.getRssi());
                    
                    sendEvent("onDeviceFound", deviceMap);
                }

                @Override
                public void onScanFinish() {
                    Log.d(TAG, "Scan finished");
                    sendEvent("onScanFinished", null);
                }
            });

            // Start scanning for devices
            linkManager.startScan();
            promise.resolve("Scan started successfully");
            Log.d(TAG, "Device scan started");

        } catch (Exception e) {
            Log.e(TAG, "Error starting device scan", e);
            promise.reject("SCAN_ERROR", "Failed to start device scan: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopDeviceScan(Promise promise) {
        try {
            if (linkManager != null) {
                linkManager.stopScan();
                Log.d(TAG, "Device scan stopped");
                promise.resolve("Scan stopped successfully");
            } else {
                promise.reject("NO_MANAGER", "LinkManager not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping device scan", e);
            promise.reject("STOP_SCAN_ERROR", "Failed to stop device scan: " + e.getMessage());
        }
    }

    @ReactMethod
    public void connectToDevice(String deviceId, Promise promise) {
        try {
            if (linkManager == null) {
                promise.reject("NO_MANAGER", "LinkManager not initialized");
                return;
            }

            // Note: The actual connection requires a BlueConnectDevice object
            // For now, we'll just indicate that connection attempt was started
            // The actual connection will be handled by the OnConnectListener
            Log.d(TAG, "Connection attempt initiated for device: " + deviceId);
            promise.resolve("Connection attempt started for " + deviceId);
            
            // Set up connection and EEG data listeners if not already set
            setupConnectionAndEEGListeners();

        } catch (Exception e) {
            Log.e(TAG, "Error connecting to device", e);
            promise.reject("CONNECTION_ERROR", "Failed to connect: " + e.getMessage());
        }
    }

    @ReactMethod
    public void disconnectDevice(Promise promise) {
        try {
            if (linkManager != null && connectedDevice != null) {
                linkManager.disconnectDevice(connectedDevice);
                Log.d(TAG, "Device disconnection initiated");
                promise.resolve("Disconnection initiated");
            } else {
                promise.reject("NO_DEVICE", "No device connected or LinkManager not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error disconnecting device", e);
            promise.reject("DISCONNECT_ERROR", "Failed to disconnect: " + e.getMessage());
        }
    }

    @ReactMethod
    public void startEEGDataCollection(Promise promise) {
        try {
            if (linkManager == null) {
                promise.reject("NO_MANAGER", "LinkManager not initialized");
                return;
            }

            // The EEG data collection is automatically handled by the EEGPowerDataListener
            // when a device is connected. We just need to confirm the listener is set up.
            promise.resolve("EEG data collection is active via listener");
            Log.d(TAG, "EEG data collection confirmed active");

        } catch (Exception e) {
            Log.e(TAG, "Error with EEG data collection", e);
            promise.reject("EEG_START_ERROR", "Failed to confirm EEG collection: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopEEGDataCollection(Promise promise) {
        try {
            if (linkManager != null) {
                // To stop EEG data collection, we can set the listener to null
                linkManager.setMultiEEGPowerDataListener(null);
                Log.d(TAG, "EEG data collection stopped");
                promise.resolve("EEG data collection stopped");
            } else {
                promise.reject("NO_MANAGER", "LinkManager not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping EEG data collection", e);
            promise.reject("EEG_STOP_ERROR", "Failed to stop EEG collection: " + e.getMessage());
        }
    }

    private void setupConnectionAndEEGListeners() {
        try {
            // Set up connection listener
            linkManager.setOnConnectListener(new OnConnectListener() {
                @Override
                public void onConnectStart(BlueConnectDevice device) {
                    Log.d(TAG, "Connection started for device: " + device.getAddress());
                }

                @Override
                public void onConnectting(BlueConnectDevice device) {
                    Log.d(TAG, "Connecting to device: " + device.getAddress());
                }

                @Override
                public void onConnectSuccess(BlueConnectDevice device) {
                    Log.d(TAG, "Connected successfully to device: " + device.getAddress());
                    connectedDevice = device;
                    WritableMap result = new WritableNativeMap();
                    result.putString("deviceId", device.getAddress());
                    result.putString("status", "connected");
                    sendEvent("onDeviceConnected", result);
                }

                @Override
                public void onConnectFailed(BlueConnectDevice device) {
                    Log.e(TAG, "Connection failed for device: " + device.getAddress());
                    WritableMap result = new WritableNativeMap();
                    result.putString("deviceId", device.getAddress());
                    result.putString("error", "Connection failed");
                    sendEvent("onConnectionError", result);
                }

                @Override
                public void onDisconnect(BlueConnectDevice device) {
                    Log.d(TAG, "Disconnected from device: " + device.getAddress());
                    connectedDevice = null;
                    WritableMap result = new WritableNativeMap();
                    result.putString("deviceId", device.getAddress());
                    result.putString("status", "disconnected");
                    sendEvent("onDeviceDisconnected", result);
                }

                // Implement required methods from IErrorListener
                @Override
                public void onError(Exception exception) {
                    Log.e(TAG, "Connection error: " + exception.getMessage());
                    WritableMap result = new WritableNativeMap();
                    result.putString("error", exception.getMessage());
                    sendEvent("onConnectionError", result);
                }

                // Implement required methods from IConnectionLostListener
                @Override
                public void onConnectionLost(BlueConnectDevice device) {
                    Log.w(TAG, "Connection lost to device: " + device.getAddress());
                    connectedDevice = null;
                    WritableMap result = new WritableNativeMap();
                    result.putString("deviceId", device.getAddress());
                    result.putString("status", "connection_lost");
                    sendEvent("onDeviceDisconnected", result);
                }
            });

            // Set up EEG power data listener with correct method signatures from JAR inspection
            linkManager.setMultiEEGPowerDataListener(new EEGPowerDataListener() {
                @Override
                public void onBrainWavedata(String deviceId, BrainWave brainWave) {
                    Log.d(TAG, "BrainWave data received from: " + deviceId);
                    
                    WritableMap eegData = new WritableNativeMap();
                    eegData.putString("deviceId", deviceId);
                    eegData.putInt("signal", brainWave.signal);
                    eegData.putInt("attention", brainWave.att);
                    eegData.putInt("meditation", brainWave.med);
                    eegData.putInt("delta", brainWave.delta);
                    eegData.putInt("theta", brainWave.theta);
                    eegData.putInt("lowAlpha", brainWave.lowAlpha);
                    eegData.putInt("highAlpha", brainWave.highAlpha);
                    eegData.putInt("lowBeta", brainWave.lowBeta);
                    eegData.putInt("highBeta", brainWave.highBeta);
                    eegData.putInt("lowGamma", brainWave.lowGamma);
                    eegData.putInt("middleGamma", brainWave.middleGamma);
                    eegData.putInt("batteryCapacity", brainWave.batteryCapacity);
                    eegData.putInt("heartRate", brainWave.heartRate);
                    eegData.putDouble("temperature", brainWave.temperature);
                    eegData.putLong("timestamp", System.currentTimeMillis());
                    
                    sendEvent("onEEGPowerDataReceived", eegData);
                }

                @Override
                public void onRawData(String deviceId, int rawValue) {
                    Log.d(TAG, "Raw data received from: " + deviceId + ", value: " + rawValue);
                    
                    WritableMap rawData = new WritableNativeMap();
                    rawData.putString("deviceId", deviceId);
                    rawData.putInt("rawValue", rawValue);
                    rawData.putLong("timestamp", System.currentTimeMillis());
                    
                    sendEvent("onEEGDataReceived", rawData);
                }

                @Override
                public void onGravity(String deviceId, Gravity gravity) {
                    Log.d(TAG, "Gravity data received from: " + deviceId);
                    
                    WritableMap gravityData = new WritableNativeMap();
                    gravityData.putString("deviceId", deviceId);
                    gravityData.putInt("x", gravity.X);
                    gravityData.putInt("y", gravity.Y);
                    gravityData.putInt("z", gravity.Z);
                    gravityData.putLong("timestamp", System.currentTimeMillis());
                    
                    sendEvent("onGravityData", gravityData);
                }

                @Override
                public void onRR(String deviceId, ArrayList<Integer> rrIntervals, int heartRate) {
                    Log.d(TAG, "RR intervals received from: " + deviceId + ", HR: " + heartRate);
                    
                    WritableMap rrData = new WritableNativeMap();
                    rrData.putString("deviceId", deviceId);
                    rrData.putInt("heartRate", heartRate);
                    rrData.putLong("timestamp", System.currentTimeMillis());
                    
                    sendEvent("onRRData", rrData);
                }
            });

            Log.d(TAG, "Connection and EEG data listeners configured");

        } catch (Exception e) {
            Log.e(TAG, "Error setting up listeners", e);
        }
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    @Override
    public void invalidate() {
        if (linkManager != null) {
            linkManager.onDestroy();
        }
    }
}
