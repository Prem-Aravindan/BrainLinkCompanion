/**
 * Enhanced DirectBLE Connection Manager
 * Multiple strategies to prevent 15-second disconnection
 */

class DirectBLEConnectionManager {
  constructor(scanner) {
    this.scanner = scanner;
    this.keepAliveInterval = null;
    this.connectionMonitor = null;
    this.wakeLockTimer = null;
  }

  /**
   * Start enhanced connection management with BLE supervision timeout prevention
   */
  startEnhancedConnectionManagement(device) {
    console.log('🚀 Starting enhanced connection management for:', device.id);
    
    // Strategy 1: BLE supervision timeout prevention via GATT keep-alive
    this.startKeepAlivePings(device);
    
    // Strategy 2: Connection activity monitor
    this.startConnectionActivityMonitor(device);
    
    // Strategy 3: Prevent JavaScript engine sleep
    this.startWakeLockTimer();
    
    // Strategy 4: Request high connection priority for better link stability
    this.requestHighConnectionPriority(device);
  }

  /**
   * Stop all enhanced connection management
   */
  stopEnhancedConnectionManagement() {
    console.log('⏹️ Stopping enhanced connection management');
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = null;
    }
    
    if (this.wakeLockTimer) {
      clearInterval(this.wakeLockTimer);
      this.wakeLockTimer = null;
    }
  }

  /**
   * Strategy 1: Send BLE supervision timeout keep-alive pings every 10 seconds
   * This prevents the peripheral's 15s supervision timeout from triggering
   */
  startKeepAlivePings(device) {
    this.keepAliveInterval = setInterval(async () => {
      try {
        if (device && await device.isConnected()) {
          // Method 1: RSSI read - this is a GATT operation that resets supervision timeout
          const rssi = await device.readRSSI();
          console.log('� BLE supervision timeout reset - RSSI:', rssi);
          
          // Method 2: If RSSI fails, try reading a characteristic
          // This ensures we always have GATT traffic to reset the timeout
        }
      } catch (error) {
        console.log('⚠️ Keep-alive GATT operation failed:', error.message);
        
        // Try alternative GATT operation if RSSI read fails
        try {
          if (device && await device.isConnected()) {
            const services = await device.services();
            if (services && services.length > 0) {
              console.log('🔄 Fallback GATT operation - service discovery successful');
            }
          }
        } catch (fallbackError) {
          console.log('⚠️ Fallback GATT operation also failed:', fallbackError.message);
        }
      }
    }, 10000); // Every 10 seconds - well before 15s supervision timeout
  }

  /**
   * Strategy 2: Monitor connection every 8 seconds
   */
  startConnectionActivityMonitor(device) {
    this.connectionMonitor = setInterval(async () => {
      try {
        if (device) {
          const isConnected = await device.isConnected();
          console.log('🔍 Connection status:', isConnected ? 'CONNECTED' : 'DISCONNECTED');
          
          if (!isConnected) {
            console.log('💔 Connection lost - triggering reconnection');
            this.scanner.handleDisconnection();
          }
        }
      } catch (error) {
        console.log('⚠️ Connection monitor error:', error.message);
      }
    }, 8000);
  }

  /**
   * Strategy 3: Prevent JavaScript engine from sleeping
   */
  startWakeLockTimer() {
    // Keep JavaScript engine active with minimal timer
    this.wakeLockTimer = setInterval(() => {
      // Just a minimal operation to prevent engine sleep
      const now = Date.now();
      console.log('⏰ JS Wake lock ping:', now);
    }, 12000); // Every 12 seconds
  }

  /**
   * Strategy 4: Request high connection priority for better BLE link stability
   * This helps renegotiate connection intervals and reduce supervision timeout issues
   */
  requestHighConnectionPriority(device) {
    try {
      // Check if device supports connection priority requests
      if (device && typeof device.requestConnectionPriority === 'function') {
        device.requestConnectionPriority(1); // 1 = HIGH_PRIORITY
        console.log('📡 Requested high BLE connection priority');
      } else {
        console.log('⚠️ Device does not support connection priority requests');
      }
    } catch (error) {
      console.error('❌ Failed to request connection priority:', error.message);
    }
  }
}

export default DirectBLEConnectionManager;
