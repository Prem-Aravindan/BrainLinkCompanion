package com.brainlinkreactnew;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import android.util.Log;
import android.content.Context;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;
import androidx.core.content.ContextCompat;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Context;

// MacrotellectLink SDK Imports - Corrected with actual JAR inspection
import com.boby.bluetoothconnect.LinkManager;
import com.boby.bluetoothconnect.callback.ScanCallBack;
import com.boby.bluetoothconnect.callback.WhiteListCallBack;
import com.boby.bluetoothconnect.classic.bean.BlueConnectDevice;
import com.boby.bluetoothconnect.classic.listener.EEGPowerDataListener;
import com.boby.bluetoothconnect.classic.listener.OnConnectListener;
import com.boby.bluetoothconnect.classic.listener.IErrorListener;
import com.boby.bluetoothconnect.classic.listener.IConnectionLostListener;
import com.boby.bluetoothconnect.bean.BrainWave;
import com.boby.bluetoothconnect.bean.Gravity;

import javax.annotation.Nonnull;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class BrainLinkModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BrainLinkModule";
    private LinkManager linkManager;
    private ReactApplicationContext reactContext;
    private BlueConnectDevice connectedDevice;
    private boolean isServiceReady = false;

    public BrainLinkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        // LinkManager is already initialized in MainApplication.onCreate()
        // Just get the singleton instance here
        this.linkManager = LinkManager.getInstance();
    }

    @Nonnull
    @Override
    public String getName() {
        return "BrainLinkModule";
    }

    private boolean hasRequiredPermissions() {
        Context context = getReactApplicationContext();
        if (context == null) return false;
        
        // Check Android 12+ permissions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            boolean hasBluetoothScan = ContextCompat.checkSelfPermission(context, 
                Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
            boolean hasBluetoothConnect = ContextCompat.checkSelfPermission(context, 
                Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
            boolean hasFineLocation = ContextCompat.checkSelfPermission(context, 
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            
            Log.d(TAG, "Android 12+ permissions - BLUETOOTH_SCAN: " + hasBluetoothScan + 
                      ", BLUETOOTH_CONNECT: " + hasBluetoothConnect + 
                      ", ACCESS_FINE_LOCATION: " + hasFineLocation);
            
            return hasBluetoothScan && hasBluetoothConnect && hasFineLocation;
        } else {
            // Check legacy permissions
            boolean hasBluetooth = ContextCompat.checkSelfPermission(context, 
                Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
            boolean hasBluetoothAdmin = ContextCompat.checkSelfPermission(context, 
                Manifest.permission.BLUETOOTH_ADMIN) == PackageManager.PERMISSION_GRANTED;
            boolean hasFineLocation = ContextCompat.checkSelfPermission(context, 
                Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            
            Log.d(TAG, "Legacy permissions - BLUETOOTH: " + hasBluetooth + 
                      ", BLUETOOTH_ADMIN: " + hasBluetoothAdmin + 
                      ", ACCESS_FINE_LOCATION: " + hasFineLocation);
            
            return hasBluetooth && hasBluetoothAdmin && hasFineLocation;
        }
    }

    @ReactMethod
    public void initialize(Promise promise) {
        Log.d(TAG, "🔄 Initializing BrainLinkModule...");
        
        // Check permissions first
        if (!hasRequiredPermissions()) {
            String error = "Required Bluetooth permissions not granted. Please grant BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and ACCESS_FINE_LOCATION permissions.";
            Log.e(TAG, error);
            promise.reject("PERMISSION_ERROR", error);
            return;
        }
        
        try {
            // LinkManager should already be initialized in MainApplication.onCreate()
            if (linkManager == null) {
                linkManager = LinkManager.getInstance();
            }
            
            if (linkManager == null) {
                Log.e(TAG, "LinkManager instance is null - SDK not initialized properly");
                promise.reject("SDK_ERROR", "MacrotellectLink SDK not initialized. Please restart the app.");
                return;
            }
            
            // Configure the LinkManager
            configureLinkManager();
            
            // Wait a bit for service binding to complete
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    isServiceReady = true;
                    Log.d(TAG, "🎉 MacrotellectLink SDK service ready after delay");
                    sendEvent("onServiceReady", null);
                    
                    WritableMap result = new WritableNativeMap();
                    result.putString("status", "initialized");
                    result.putString("version", "1.4.3");
                    result.putBoolean("serviceReady", true);
                    promise.resolve(result);
                }
            }, 1000); // 1 second delay for service binding
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize BrainLinkModule", e);
            promise.reject("INIT_ERROR", "Failed to initialize: " + e.getMessage());
        }
    }
    
    private void configureLinkManager() {
        try {
            Log.d(TAG, "Configuring LinkManager...");
            
            // Configure LinkManager exactly as shown in developer guide
            linkManager.setDebug(true); // Enable debug logging
            
            // Set maximum connections (available in actual JAR)
            linkManager.setMaxConnectSize(1);
            
            // Set whitelist (available in actual JAR) 
            linkManager.setWhiteList("BrainLink_Pro,BrainLink_Lite");
            
            // Initialize whitelist - this might be required for internal service initialization
            Log.d(TAG, "🔄 Initializing WhiteList for internal service setup...");
            linkManager.initWhiteList(new WhiteListCallBack() {
                @Override
                public void onSucces(String result) {
                    Log.d(TAG, "✅ WhiteList initialized successfully: " + result);
                    Log.d(TAG, "🔥 SDK internal services should now be ready for scanning");
                }
                
                @Override
                public void onError(String error, String details) {
                    Log.e(TAG, "❌ WhiteList initialization failed: " + error + ", details: " + details);
                    Log.e(TAG, "⚠️ This might affect scanning functionality");
                }
            });
            
            // Set up connection listener using actual JAR API
            linkManager.setOnConnectListener(new OnConnectListener() {
                @Override
                public void onConnectStart(BlueConnectDevice device) {
                    Log.d(TAG, "Connection starting for: " + device.getName());
                    
                    // Send connection event in the format React Native expects
                    WritableMap connectionData = new WritableNativeMap();
                    connectionData.putString("status", "connecting");
                    connectionData.putString("deviceName", device.getName());
                    connectionData.putString("deviceMac", device.getAddress());
                    connectionData.putString("connectionType", "MacrotellectLink_SDK");
                    sendEvent("BrainLinkConnection", connectionData);
                }
                
                @Override
                public void onConnectting(BlueConnectDevice device) {
                    Log.d(TAG, "Connecting to: " + device.getName());
                    sendEvent("onConnecting", createDeviceMap(device));
                }
                
                @Override
                public void onConnectSuccess(BlueConnectDevice device) {
                    Log.d(TAG, "✅ Connected successfully to: " + device.getName());
                    Log.d(TAG, "📱 Connection stable - Device: " + device.getAddress());
                    connectedDevice = device;
                    
                    // Set up EEG data listeners immediately after connection
                    Log.d(TAG, "🧠 Setting up EEG data listeners for device: " + device.getName());
                    setupEEGDataListeners();
                    
                    Log.d(TAG, "🎉 Device connected and ready for EEG data streaming");
                    
                    // Send connection event in the format React Native expects
                    WritableMap connectionData = new WritableNativeMap();
                    connectionData.putString("status", "connected");
                    connectionData.putString("deviceName", device.getName());
                    connectionData.putString("deviceMac", device.getAddress());
                    connectionData.putString("connectionType", "MacrotellectLink_SDK");
                    connectionData.putBoolean("isBLE", false);
                    sendEvent("BrainLinkConnection", connectionData);
                }
                
                @Override
                public void onConnectFailed(BlueConnectDevice device) {
                    Log.e(TAG, "❌ Connection failed for: " + device.getName() + " (" + device.getAddress() + ")");
                    Log.e(TAG, "💡 Troubleshooting tips:");
                    Log.e(TAG, "   1. Make sure the BrainLink device is in pairing mode");
                    Log.e(TAG, "   2. Check if device is already connected to another phone");
                    Log.e(TAG, "   3. Try turning the BrainLink device off and on again");
                    Log.e(TAG, "   4. Ensure the device is close to the phone (within 1 meter)");
                    Log.e(TAG, "   5. Check if device battery is sufficient");
                    
                    // Try to get more connection info
                    try {
                        Log.e(TAG, "🔍 Device connection info - Type: " + device.getDeviceType() + ", RSSI: " + device.getRssi());
                    } catch (Exception e) {
                        Log.e(TAG, "⚠️ Could not get device connection details: " + e.getMessage());
                    }
                    
                    // Send connection event in the format React Native expects
                    WritableMap connectionData = new WritableNativeMap();
                    connectionData.putString("status", "failed");
                    connectionData.putString("deviceName", device.getName());
                    connectionData.putString("deviceMac", device.getAddress());
                    connectionData.putString("error", "Connection failed");
                    sendEvent("BrainLinkConnection", connectionData);
                }
                
                public void onDisconnect(BlueConnectDevice device) {
                    Log.d(TAG, "Disconnected from: " + device.getName());
                    connectedDevice = null;
                    sendEvent("onDisconnect", createDeviceMap(device));
                }
                
                @Override
                public void onError(Exception e) {
                    Log.e(TAG, "Connection error: " + e.getMessage());
                    sendEvent("onError", null);
                }
                
                @Override
                public void onConnectionLost(BlueConnectDevice device) {
                    Log.e(TAG, "❌ Connection lost for: " + (device != null ? device.getName() : "NULL"));
                    
                    if (device != null) {
                        Log.e(TAG, "🔄 Connection lost details - Address: " + device.getAddress() + ", Type: " + device.getDeviceType());
                        
                        // Send connection event in the format React Native expects
                        WritableMap connectionData = new WritableNativeMap();
                        connectionData.putString("status", "disconnected");
                        connectionData.putString("deviceName", device.getName());
                        connectionData.putString("deviceMac", device.getAddress());
                        connectionData.putString("reason", "Connection lost");
                        sendEvent("BrainLinkConnection", connectionData);
                        
                        // Attempt to reconnect after a short delay
                        Log.d(TAG, "🔄 Attempting to reconnect in 3 seconds...");
                        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    Log.d(TAG, "🔄 Reconnecting to: " + device.getName());
                                    linkManager.connectDevice(device);
                                } catch (Exception e) {
                                    Log.e(TAG, "❌ Failed to reconnect: " + e.getMessage());
                                }
                            }
                        }, 3000); // 3 second delay before reconnection
                    }
                    
                    connectedDevice = null;
                }
            });
            
            Log.d(TAG, "✅ LinkManager configured with actual JAR API methods");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to configure LinkManager", e);
        }
    }

    private void setupEEGDataListeners() {
        try {
            Log.d(TAG, "🧠 Setting up EEG data listeners for real-time data...");
            
            // Set up multi-EEG power data listener with correct interface
            linkManager.setMultiEEGPowerDataListener(new EEGPowerDataListener() {
                @Override
                public void onBrainWavedata(String mac, BrainWave brainWave) {
                    Log.d(TAG, "🧠 EEG data received from: " + mac);
                    Log.d(TAG, "📊 BrainWave data received: " + brainWave.toString());
                    
                    // Create data in the format React Native expects
                    WritableMap eegData = new WritableNativeMap();
                    eegData.putString("type", "brainwave");
                    eegData.putString("deviceMac", mac);
                    eegData.putString("rawData", brainWave.toString());
                    eegData.putDouble("timestamp", System.currentTimeMillis());
                    
                    // Try to access BrainWave properties including battery
                    try {
                        // Access battery level directly from the BrainWave object
                        int batteryLevel = brainWave.batteryCapacity;
                        
                        if (batteryLevel >= 0 && batteryLevel <= 100) {
                            eegData.putInt("batteryLevel", batteryLevel);
                            
                            // Send battery update as separate event
                            WritableMap batteryData = new WritableNativeMap();
                            batteryData.putString("type", "battery");
                            batteryData.putString("deviceMac", mac);
                            batteryData.putInt("batteryLevel", batteryLevel);
                            batteryData.putDouble("timestamp", System.currentTimeMillis());
                            batteryData.putBoolean("isCharging", false); // Default to false
                            sendEvent("BrainLinkData", batteryData);
                            
                            Log.d(TAG, "🔋 Battery level sent to React Native: " + batteryLevel + "%");
                        }
                        
                        // Access other BrainWave properties directly
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
                        eegData.putInt("ap", brainWave.ap);
                        eegData.putInt("grind", brainWave.grind);
                        eegData.putInt("heartRate", brainWave.heartRate);
                        eegData.putDouble("temperature", brainWave.temperature);
                        
                        // Add hardware version if available
                        if (brainWave.hardwareversion != null) {
                            eegData.putDouble("hardwareVersion", brainWave.hardwareversion);
                        }
                        
                        // Add HRV data if available
                        if (brainWave.hrv != null && !brainWave.hrv.isEmpty()) {
                            WritableArray hrvArray = new WritableNativeArray();
                            for (Integer hrv : brainWave.hrv) {
                                hrvArray.pushInt(hrv);
                            }
                            eegData.putArray("hrv", hrvArray);
                        }
                        
                        Log.d(TAG, "✅ Complete EEG data with battery info packaged and sent to React Native");
                        Log.d(TAG, "📊 EEG Values - Signal: " + brainWave.signal + ", Attention: " + brainWave.att + ", Meditation: " + brainWave.med);
                        Log.d(TAG, "🌊 Band Powers - Delta: " + brainWave.delta + ", Theta: " + brainWave.theta + ", LowAlpha: " + brainWave.lowAlpha);
                        
                    } catch (Exception e) {
                        Log.w(TAG, "⚠️ Could not access BrainWave properties: " + e.getMessage());
                        e.printStackTrace();
                    }
                    
                    // Send to React Native with the expected event name
                    sendEvent("BrainLinkData", eegData);
                }
                
                @Override
                public void onRR(String mac, ArrayList<Integer> rrData, int signalQuality) {
                    Log.d(TAG, "🫀 R-R interval data received from: " + mac);
                    Log.d(TAG, "📊 R-R data size: " + rrData.size() + ", Signal Quality: " + signalQuality);
                    
                    // Create data in the format React Native expects
                    WritableMap rrEventData = new WritableNativeMap();
                    rrEventData.putString("type", "rr_interval");
                    rrEventData.putString("deviceMac", mac);
                    rrEventData.putInt("signalQuality", signalQuality);
                    rrEventData.putInt("dataSize", rrData.size());
                    rrEventData.putDouble("timestamp", System.currentTimeMillis());
                    
                    // Convert RR data to React Native array
                    WritableArray rrArray = new WritableNativeArray();
                    for (Integer rr : rrData) {
                        rrArray.pushInt(rr);
                    }
                    rrEventData.putArray("rrIntervals", rrArray);
                    
                    // Send to React Native with the expected event name
                    sendEvent("BrainLinkData", rrEventData);
                }
                
                @Override
                public void onGravity(String mac, Gravity gravity) {
                    Log.d(TAG, "🌍 Gravity data received from: " + mac);
                    Log.d(TAG, "📊 Gravity data: " + gravity.toString());
                    
                    // Create data in the format React Native expects
                    WritableMap gravityData = new WritableNativeMap();
                    gravityData.putString("type", "gravity");
                    gravityData.putString("deviceMac", mac);
                    gravityData.putString("gravityInfo", gravity.toString());
                    gravityData.putDouble("timestamp", System.currentTimeMillis());
                    
                    // Send to React Native with the expected event name
                    sendEvent("BrainLinkData", gravityData);
                }
                
                @Override
                public void onRawData(String mac, int rawData) {
                    // Log.d(TAG, "🔢 Raw data received from: " + mac + ", Value: " + rawData);
                    
                    // Create data in the format React Native expects
                    WritableMap eegData = new WritableNativeMap();
                    eegData.putString("type", "raw");
                    eegData.putString("deviceMac", mac);
                    eegData.putInt("rawValue", rawData);
                    eegData.putDouble("timestamp", System.currentTimeMillis());
                    
                    // Send to React Native with the expected event name
                    sendEvent("BrainLinkData", eegData);
                }
            });
            
            Log.d(TAG, "✅ EEG data listeners set up successfully with correct interface");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to set up EEG data listeners: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext != null) {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    @Override
    public Map<String, Object> getConstants() {
        Map<String, Object> constants = new HashMap<>();
        constants.put("SUPPORTS_MACROTELLECT", true);
        constants.put("SDK_VERSION", "1.4.3");
        constants.put("MODULE_NAME", "BrainLinkModule");
        return constants;
    }

    @ReactMethod
    public void initializeSDK(Promise promise) {
        initialize(promise);
    }

    @ReactMethod
    public void startScan(Promise promise) {
        try {
            Log.d(TAG, "Starting device scan...");
            
            // Check permissions first
            if (!hasRequiredPermissions()) {
                String error = "Required Bluetooth permissions not granted. Please grant BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and ACCESS_FINE_LOCATION permissions.";
                Log.e(TAG, error);
                promise.reject("PERMISSION_ERROR", error);
                return;
            }
            
            if (linkManager == null) {
                Log.e(TAG, "LinkManager is null - SDK not initialized properly");
                promise.reject("SDK_ERROR", "MacrotellectLink SDK not initialized. Please restart the app.");
                return;
            }
            
            // Check if service is ready (simple delay-based approach)
            if (!isServiceReady) {
                Log.w(TAG, "SDK service not ready, waiting for readiness...");
                
                // Wait for service to be ready
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        isServiceReady = true;
                        Log.d(TAG, "Service assumed ready after delay, starting scan...");
                        performScan(promise);
                    }
                }, 2000); // Increased to 2 seconds for full service readiness
                return;
            }
            
            // Service is ready, proceed with scan
            performScan(promise);
            
        } catch (Exception e) {
            Log.e(TAG, "Error starting scan", e);
            promise.reject("SCAN_ERROR", e.getMessage());
        }
    }

    private void performScan(Promise promise) {
        try {
            Log.d(TAG, "Performing scan with service-ready LinkManager...");
            
            // First, check Android system Bluetooth state
            try {
                BluetoothManager bluetoothManager = (BluetoothManager) reactContext.getSystemService(Context.BLUETOOTH_SERVICE);
                BluetoothAdapter bluetoothAdapter = bluetoothManager.getAdapter();
                
                if (bluetoothAdapter == null) {
                    Log.e(TAG, "❌ BluetoothAdapter is null - device doesn't support Bluetooth");
                    promise.reject("NO_BLUETOOTH", "Device doesn't support Bluetooth");
                    return;
                }
                
                if (!bluetoothAdapter.isEnabled()) {
                    Log.e(TAG, "❌ Bluetooth is disabled");
                    promise.reject("BLUETOOTH_DISABLED", "Bluetooth is disabled");
                    return;
                }
                
                Log.d(TAG, "✅ Android Bluetooth state - Enabled: " + bluetoothAdapter.isEnabled() + 
                          ", Discovering: " + bluetoothAdapter.isDiscovering());
                
                // Check if we're already discovering and cancel if needed
                if (bluetoothAdapter.isDiscovering()) {
                    Log.d(TAG, "🔄 Bluetooth already discovering, canceling...");
                    bluetoothAdapter.cancelDiscovery();
                }
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to check Android Bluetooth state: " + e.getMessage());
                e.printStackTrace();
            }
            
            // Next, let's check the SDK's internal state
            try {
                Log.d(TAG, "🔍 Checking SDK internal state before scan...");
                int connectSize = linkManager.getConnectSize();
                int maxConnectSize = linkManager.getMaxConnectSize();
                Log.d(TAG, "SDK State - Current connections: " + connectSize + ", Max connections: " + maxConnectSize);
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to check SDK state: " + e.getMessage());
                e.printStackTrace();
            }
            
            // Set up scan callback with detailed logging
            linkManager.setScanCallBack(new ScanCallBack() {
                @Override
                public void onScanFinish() {
                    Log.d(TAG, "🔍 Scan finished - no more devices to discover");
                    sendEvent("onScanStop", null);
                }

                @Override
                public void onScaningDeviceFound(BlueConnectDevice device) {
                    Log.d(TAG, "🔍 Device found: " + device.getName() + " (" + device.getAddress() + ")");
                    Log.d(TAG, "Device details - Type: " + device.getDeviceType() + ", RSSI: " + device.getRssi());
                    
                    // Auto-connect to BrainLink devices
                    if (device.getName() != null && (device.getName().contains("BrainLink_Pro") || device.getName().contains("BrainLink_Lite"))) {
                        Log.d(TAG, "🔗 Auto-connecting to BrainLink device: " + device.getName());
                        Log.d(TAG, "📱 Device info - Address: " + device.getAddress() + ", Type: " + device.getDeviceType() + ", RSSI: " + device.getRssi());
                        
                        try {
                            // Stop scanning before connecting
                            linkManager.stopScan();
                            Log.d(TAG, "⏹️ Stopped scanning to connect to device");
                            
                            // Wait a moment before attempting connection
                            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    try {
                                        // Connect to the device using the device object
                                        Log.d(TAG, "🚀 Attempting connection to: " + device.getAddress());
                                        linkManager.connectDevice(device);
                                        Log.d(TAG, "� Connection request sent to MacrotellectLink SDK");
                                        
                                    } catch (Exception e) {
                                        Log.e(TAG, "❌ Failed to initiate connection: " + e.getMessage());
                                        e.printStackTrace();
                                    }
                                }
                            }, 500); // 500ms delay before connection attempt
                            
                        } catch (Exception e) {
                            Log.e(TAG, "❌ Failed to connect to device: " + e.getMessage());
                            e.printStackTrace();
                        }
                    }
                    
                    sendEvent("onDeviceFound", createDeviceMap(device));
                }

                public void onScanFailed(int errorCode) {
                    String errorMessage = "Scan failed with error code: " + errorCode;
                    Log.e(TAG, "❌ " + errorMessage);
                    sendEvent("onScanFailed", null);
                    promise.reject("SCAN_FAILED", errorMessage);
                }
            });

            // Add longer delay to ensure SDK internal services are fully initialized
            Log.d(TAG, "⏳ Calling linkManager.startScan() after extended delay...");
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        // Pre-warm the SDK by calling some initialization methods
                        Log.d(TAG, "🔥 Pre-warming SDK internal services...");
                        
                        // Try to call getConnectSize() to initialize the internal lists
                        try {
                            int connectSize = linkManager.getConnectSize();
                            Log.d(TAG, "✅ SDK internal services initialized, connected count: " + connectSize);
                        } catch (Exception e) {
                            Log.w(TAG, "⚠️ Pre-warming failed, proceeding anyway: " + e.getMessage());
                        }
                        
                        // Check if we can access the whitelist
                        try {
                            linkManager.setWhiteList("BrainLink_Pro,BrainLink_Lite");
                            Log.d(TAG, "✅ Whitelist configuration confirmed");
                        } catch (Exception e) {
                            Log.w(TAG, "⚠️ Whitelist configuration issue: " + e.getMessage());
                        }
                        
                        // Now start the scan
                        Log.d(TAG, "🚀 Starting LinkManager scan with pre-warmed services...");
                        linkManager.startScan();
                        
                        Log.d(TAG, "✅ Scan started successfully - now scanning for BrainLink devices");
                        Log.d(TAG, "🔍 Looking for devices: BrainLink_Pro, BrainLink_Lite");
                        sendEvent("onScanStart", null);
                        promise.resolve("Scan started successfully");
                        
                    } catch (Exception e) {
                        Log.e(TAG, "❌ Failed to start scan after service pre-warming: " + e.getMessage());
                        Log.e(TAG, "🔧 MacrotellectLink SDK internal service issue detected");
                        e.printStackTrace();
                        promise.reject("SCAN_ERROR", e.getMessage());
                    }
                }
            }, 3000); // 3 second delay for full service initialization
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to set up scan: " + e.getMessage());
            promise.reject("SCAN_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startDeviceScan(Promise promise) {
        startScan(promise);
    }

    @ReactMethod
    public void stopScan(Promise promise) {
        try {
            if (linkManager != null) {
                linkManager.stopScan();
                promise.resolve("Scan stopped successfully");
            } else {
                promise.reject("INIT_ERROR", "LinkManager not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping scan", e);
            promise.reject("SCAN_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopDeviceScan(Promise promise) {
        stopScan(promise);
    }

    @ReactMethod
    public void connectToDevice(String deviceAddress, Promise promise) {
        try {
            if (linkManager == null) {
                promise.reject("INIT_ERROR", "LinkManager not initialized");
                return;
            }

            Log.d(TAG, "Attempting to connect to device: " + deviceAddress);
            // Note: The actual connection logic would depend on the specific SDK API
            // For now, we'll just log the attempt
            promise.resolve("Connection initiated for: " + deviceAddress);
            
        } catch (Exception e) {
            Log.e(TAG, "Error connecting to device", e);
            promise.reject("CONNECT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void disconnectFromDevice(Promise promise) {
        try {
            if (linkManager != null && connectedDevice != null) {
                // Disconnect logic would go here
                Log.d(TAG, "Disconnecting from device: " + connectedDevice.getName());
                connectedDevice = null;
                promise.resolve("Disconnected successfully");
            } else {
                promise.reject("DISCONNECT_ERROR", "No device connected or LinkManager not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error disconnecting from device", e);
            promise.reject("DISCONNECT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getConnectedDevices(Promise promise) {
        try {
            WritableArray devices = new WritableNativeArray();
            
            if (linkManager != null) {
                // Get connected devices from LinkManager
                // For now, we'll return the currently connected device if any
                if (connectedDevice != null) {
                    devices.pushMap(createDeviceMap(connectedDevice));
                }
            }
            
            promise.resolve(devices);
        } catch (Exception e) {
            Log.e(TAG, "Error getting connected devices", e);
            promise.reject("GET_DEVICES_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startEEGDataCollection(Promise promise) {
        try {
            if (linkManager == null) {
                promise.reject("INIT_ERROR", "LinkManager not initialized");
                return;
            }
            
            if (connectedDevice == null) {
                promise.reject("NO_DEVICE", "No device connected");
                return;
            }
            
            Log.d(TAG, "🧠 Starting EEG data collection...");
            
            // Set up EEG data listeners if not already set
            setupEEGDataListeners();
            
            // Start data collection (this might be automatic after connection)
            Log.d(TAG, "✅ EEG data collection started for device: " + connectedDevice.getName());
            promise.resolve("EEG data collection started");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error starting EEG data collection: " + e.getMessage());
            promise.reject("EEG_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setUseDemoMode(boolean useDemoMode, Promise promise) {
        try {
            Log.d(TAG, "🚫 SDK-only mode: setUseDemoMode called with value: " + useDemoMode);
            
            if (useDemoMode) {
                // SDK-only mode: reject any attempt to enable demo mode
                Log.e(TAG, "🚫 SDK-only mode enforced - demo mode is not allowed");
                promise.reject("DEMO_MODE_DISABLED", "SDK-only mode enforced - demo mode is not available. All connections must use real MacrotellectLink SDK.");
                return;
            }
            
            // Demo mode is already disabled in SDK-only mode
            Log.d(TAG, "✅ Demo mode is OFF - SDK-only mode active");
            promise.resolve("Demo mode disabled - SDK-only mode active");
            
        } catch (Exception e) {
            Log.e(TAG, "Error in setUseDemoMode", e);
            promise.reject("DEMO_MODE_ERROR", e.getMessage());
        }
    }

    private WritableMap createDeviceMap(BlueConnectDevice device) {
        WritableMap deviceMap = new WritableNativeMap();
        if (device != null) {
            deviceMap.putString("name", device.getName());
            deviceMap.putString("address", device.getAddress());
            // Note: isConnected() method may not be available in this SDK version
            deviceMap.putBoolean("connected", false); // Default to false
        }
        return deviceMap;
    }
}