package com.macrotellectlink;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

// MacrotellectLink SDK imports
import com.macrotellect.BrainLinkManager;
import com.macrotellect.BrainWave;
import com.macrotellect.ConnectCallback;
import com.macrotellect.Device;
import com.macrotellect.EEGRawCallback;
import com.macrotellect.DeviceCallback;
import com.macrotellect.OnBrainWaveListener;

import java.util.HashMap;
import java.util.Map;

/**
 * React Native Bridge for MacrotellectLink SDK V1.4.3
 * 
 * This module bridges the MacrotellectLink Android SDK with React Native,
 * providing access to real BrainLink device functionality and EEG data.
 */
public class BrainLinkModule extends ReactContextBaseJavaModule {
    
    private static final String TAG = "BrainLinkModule";
    private static final String MODULE_NAME = "BrainLinkModule";
    
    private ReactApplicationContext reactContext;
    private BrainLinkManager brainLinkManager;
    private boolean isInitialized = false;
    private boolean isScanning = false;
    
    public BrainLinkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        Log.d(TAG, "BrainLinkModule initialized");
    }
    
    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("MODULE_NAME", MODULE_NAME);
        constants.put("SDK_VERSION", "1.4.3");
        return constants;
    }
    
    /**
     * Initialize the MacrotellectLink SDK
     */
    @ReactMethod
    public void initialize(Promise promise) {
        try {
            Log.d(TAG, "Initializing MacrotellectLink SDK...");
            
            Context context = reactContext.getApplicationContext();
            brainLinkManager = BrainLinkManager.getInstance(context);
            
            if (brainLinkManager != null) {
                isInitialized = true;
                Log.d(TAG, "MacrotellectLink SDK initialized successfully");
                
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("message", "MacrotellectLink SDK initialized");
                promise.resolve(result);
            } else {
                throw new Exception("Failed to get BrainLinkManager instance");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize MacrotellectLink SDK", e);
            promise.reject("INIT_ERROR", "Failed to initialize MacrotellectLink SDK: " + e.getMessage());
        }
    }
    
    /**
     * Start scanning for BrainLink devices
     */
    @ReactMethod
    public void startScan(Promise promise) {
        try {
            if (!isInitialized) {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
                return;
            }
            
            Log.d(TAG, "Starting device scan...");
            
            // Set up device discovery callback
            brainLinkManager.setDeviceCallback(new DeviceCallback() {
                @Override
                public void onDeviceFound(Device device) {
                    Log.d(TAG, "Device found: " + device.getName() + " - " + device.getAddress());
                    
                    WritableMap deviceMap = Arguments.createMap();
                    deviceMap.putString("name", device.getName());
                    deviceMap.putString("address", device.getAddress());
                    deviceMap.putString("type", device.getDeviceType());
                    
                    sendEvent("DeviceFound", deviceMap);
                    
                    // Auto-connect to BrainLink devices
                    if (device.getName().contains("BrainLink")) {
                        connectToDevice(device);
                    }
                }
            });
            
            // Start scanning
            boolean started = brainLinkManager.startScan();
            
            if (started) {
                isScanning = true;
                Log.d(TAG, "Device scan started successfully");
                promise.resolve(true);
            } else {
                promise.reject("SCAN_ERROR", "Failed to start device scan");
            }
            
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
            if (brainLinkManager != null) {
                brainLinkManager.stopScan();
                isScanning = false;
                Log.d(TAG, "Device scan stopped");
                promise.resolve(true);
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop scan", e);
            promise.reject("STOP_SCAN_ERROR", "Failed to stop scan: " + e.getMessage());
        }
    }
    
    /**
     * Connect to a specific device
     */
    private void connectToDevice(Device device) {
        Log.d(TAG, "Attempting to connect to device: " + device.getName());
        
        brainLinkManager.connectDevice(device, new ConnectCallback() {
            @Override
            public void onConnectSuccess(Device connectedDevice) {
                Log.d(TAG, "Successfully connected to: " + connectedDevice.getName());
                
                WritableMap deviceMap = Arguments.createMap();
                deviceMap.putString("name", connectedDevice.getName());
                deviceMap.putString("address", connectedDevice.getAddress());
                deviceMap.putString("type", connectedDevice.getDeviceType());
                
                WritableMap connectionData = Arguments.createMap();
                connectionData.putString("status", "connected");
                connectionData.putMap("device", deviceMap);
                
                sendEvent("ConnectionChanged", connectionData);
                
                // Set up EEG data callbacks
                setupEEGCallbacks(connectedDevice);
            }
            
            @Override
            public void onConnectFailed(Device device, String error) {
                Log.e(TAG, "Failed to connect to device: " + error);
                
                WritableMap connectionData = Arguments.createMap();
                connectionData.putString("status", "failed");
                connectionData.putString("error", error);
                
                sendEvent("ConnectionChanged", connectionData);
            }
            
            @Override
            public void onDisconnected(Device device) {
                Log.d(TAG, "Device disconnected: " + device.getName());
                
                WritableMap connectionData = Arguments.createMap();
                connectionData.putString("status", "disconnected");
                
                sendEvent("ConnectionChanged", connectionData);
            }
        });
    }
    
    /**
     * Set up EEG data callbacks for real-time data streaming
     */
    private void setupEEGCallbacks(Device device) {
        Log.d(TAG, "Setting up EEG callbacks for device: " + device.getName());
        
        // BrainWave data callback (processed EEG data)
        brainLinkManager.setOnBrainWaveListener(device, new OnBrainWaveListener() {
            @Override
            public void onBrainWave(BrainWave brainWave) {
                WritableMap brainWaveMap = Arguments.createMap();
                brainWaveMap.putInt("signal", brainWave.getSignal());
                brainWaveMap.putInt("attention", brainWave.getAtt());
                brainWaveMap.putInt("meditation", brainWave.getMed());
                brainWaveMap.putInt("delta", brainWave.getDelta());
                brainWaveMap.putInt("theta", brainWave.getTheta());
                brainWaveMap.putInt("lowAlpha", brainWave.getLowAlpha());
                brainWaveMap.putInt("highAlpha", brainWave.getHighAlpha());
                brainWaveMap.putInt("lowBeta", brainWave.getLowBeta());
                brainWaveMap.putInt("highBeta", brainWave.getHighBeta());
                brainWaveMap.putInt("lowGamma", brainWave.getLowGamma());
                brainWaveMap.putInt("middleGamma", brainWave.getMiddleGamma());
                
                WritableMap eegData = Arguments.createMap();
                eegData.putMap("brainWave", brainWaveMap);
                eegData.putString("mac", device.getAddress());
                
                sendEvent("EEGData", eegData);
            }
        });
        
        // Raw EEG data callback
        brainLinkManager.setEEGRawCallback(device, new EEGRawCallback() {
            @Override
            public void onRawDataReceived(int rawValue) {
                WritableMap rawData = Arguments.createMap();
                rawData.putInt("raw", rawValue);
                rawData.putString("mac", device.getAddress());
                
                sendEvent("RawData", rawData);
            }
        });
    }
    
    /**
     * Disconnect from all devices
     */
    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            if (brainLinkManager != null) {
                brainLinkManager.disconnectAll();
                Log.d(TAG, "Disconnected from all devices");
                promise.resolve(true);
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to disconnect", e);
            promise.reject("DISCONNECT_ERROR", "Failed to disconnect: " + e.getMessage());
        }
    }
    
    /**
     * Get connected devices
     */
    @ReactMethod
    public void getConnectedDevices(Promise promise) {
        try {
            if (brainLinkManager != null) {
                // This would return the list of connected devices
                // Implementation depends on the actual SDK API
                promise.resolve(Arguments.createArray());
            } else {
                promise.reject("NOT_INITIALIZED", "SDK not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to get connected devices", e);
            promise.reject("GET_DEVICES_ERROR", "Failed to get connected devices: " + e.getMessage());
        }
    }
    
    /**
     * Send event to React Native
     */
    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }
}
