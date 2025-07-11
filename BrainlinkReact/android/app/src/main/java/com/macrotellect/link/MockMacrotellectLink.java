package com.macrotellect.link;

/**
 * Mock version of MacrotellectLink SDK for testing purposes
 * This allows us to test the integration without the actual JAR file
 */
public class MockMacrotellectLink {
    
    public static class Manager {
        public static Manager getInstance() {
            return new Manager();
        }
        
        public void init() {
            // Mock implementation
        }
        
        public void startScan() {
            // Mock implementation
        }
        
        public void stopScan() {
            // Mock implementation
        }
        
        public void connect(String deviceId) {
            // Mock implementation
        }
        
        public void disconnect() {
            // Mock implementation
        }
        
        public void setOnConnectListener(Object listener) {
            // Mock implementation
        }
        
        public void setEEGPowerDataListener(Object listener) {
            // Mock implementation
        }
    }
    
    public interface OnConnectListener {
        void onConnect(String deviceId);
        void onDisconnect(String deviceId);
    }
    
    public interface EEGPowerDataListener {
        void onEEGPowerData(int delta, int theta, int alpha, int beta, int gamma);
    }
}
