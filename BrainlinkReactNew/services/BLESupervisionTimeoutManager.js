/**
 * BLE Supervision Timeout Prevention Manager
 * Implements the comprehensive solution for 15-second BLE disconnections
 * Based on BLE protocol analysis and Android BLE best practices
 */

import { NativeModules } from 'react-native';

class BLESupervisionTimeoutManager {
  constructor() {
    this.keepAliveInterval = null;
    this.connectionPriorityRequested = false;
    this.gattOperationCount = 0;
    this.lastGattOperation = null;
  }

  /**
   * Start comprehensive BLE supervision timeout prevention
   * Implements all strategies to prevent 15-second peripheral timeout
   */
  async startSupervisionTimeoutPrevention(device) {
    console.log('🔄 Starting BLE supervision timeout prevention for:', device.id);
    
    try {
      // Strategy 1: Request high connection priority immediately
      await this.requestHighConnectionPriority(device);
      
      // Strategy 2: Start periodic GATT operations to reset supervision timeout
      this.startPeriodicGattOperations(device);
      
      // Strategy 3: Monitor connection health
      this.startConnectionHealthMonitor(device);
      
      console.log('✅ BLE supervision timeout prevention active');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to start supervision timeout prevention:', error);
      return false;
    }
  }

  /**
   * Stop all supervision timeout prevention activities
   */
  stopSupervisionTimeoutPrevention() {
    console.log('⏹️ Stopping BLE supervision timeout prevention');
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    this.connectionPriorityRequested = false;
    this.gattOperationCount = 0;
    this.lastGattOperation = null;
  }

  /**
   * Request high connection priority to improve BLE link stability
   * This helps renegotiate connection intervals and reduce supervision timeout
   */
  async requestHighConnectionPriority(device) {
    try {
      const { BrainLinkModule } = NativeModules;
      
      if (BrainLinkModule && BrainLinkModule.requestConnectionPriority) {
        await BrainLinkModule.requestConnectionPriority(1); // HIGH_PRIORITY
        this.connectionPriorityRequested = true;
        console.log('📡 High BLE connection priority requested');
      } else {
        // Fallback: Try direct device method if available
        if (device && device.requestConnectionPriority) {
          await device.requestConnectionPriority(1);
          this.connectionPriorityRequested = true;
          console.log('📡 High BLE connection priority requested (direct)');
        } else {
          console.log('⚠️ Connection priority request not available');
        }
      }
    } catch (error) {
      console.error('❌ Failed to request connection priority:', error);
    }
  }

  /**
   * Start periodic GATT operations to prevent supervision timeout
   * The key insight: ANY GATT operation resets the peripheral's supervision timer
   */
  startPeriodicGattOperations(device) {
    // Clear any existing interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = setInterval(async () => {
      await this.performGattKeepAlive(device);
    }, 8000); // Every 8 seconds - well before 15s supervision timeout

    console.log('🔄 Periodic GATT operations started (8s interval)');
  }

  /**
   * Perform a GATT operation to reset the supervision timeout
   * Try multiple GATT operations in order of preference
   */
  async performGattKeepAlive(device) {
    if (!device) return;

    try {
      // Check if device is still connected first
      const isConnected = await device.isConnected();
      if (!isConnected) {
        console.log('💔 Device disconnected - stopping keep-alive');
        this.stopSupervisionTimeoutPrevention();
        return;
      }

      // Method 1: RSSI read (preferred - lightweight GATT operation)
      try {
        const rssi = await device.readRSSI();
        this.recordGattOperation('RSSI', rssi);
        console.log(`🔄 BLE supervision timeout reset - RSSI: ${rssi}dBm`);
        return;
      } catch (rssiError) {
        console.log('⚠️ RSSI read failed, trying fallback...');
      }

      // Method 2: Service discovery (fallback GATT operation)
      try {
        const services = await device.services();
        this.recordGattOperation('SERVICE_DISCOVERY', services.length);
        console.log(`🔄 BLE supervision timeout reset - Services: ${services.length}`);
        return;
      } catch (serviceError) {
        console.log('⚠️ Service discovery failed, trying next fallback...');
      }

      // Method 3: MTU read (last resort GATT operation)
      try {
        const mtu = await device.mtu();
        this.recordGattOperation('MTU', mtu);
        console.log(`🔄 BLE supervision timeout reset - MTU: ${mtu}`);
        return;
      } catch (mtuError) {
        console.log('❌ All GATT keep-alive operations failed');
      }

    } catch (error) {
      console.error('❌ GATT keep-alive operation failed:', error);
    }
  }

  /**
   * Record GATT operation statistics for monitoring
   */
  recordGattOperation(operation, result) {
    this.gattOperationCount++;
    this.lastGattOperation = {
      operation,
      result,
      timestamp: Date.now()
    };
  }

  /**
   * Monitor connection health and detect potential issues
   */
  startConnectionHealthMonitor(device) {
    // This runs less frequently than keep-alive to avoid interference
    const healthCheckInterval = setInterval(async () => {
      try {
        const timeSinceLastGatt = this.lastGattOperation ? 
          Date.now() - this.lastGattOperation.timestamp : 0;

        if (timeSinceLastGatt > 12000) { // More than 12 seconds
          console.log('⚠️ No recent GATT operations - supervision timeout risk!');
          await this.performGattKeepAlive(device);
        }

        // Log statistics every 30 seconds
        if (this.gattOperationCount % 4 === 0) {
          console.log(`📊 BLE Health: ${this.gattOperationCount} GATT ops, Priority: ${this.connectionPriorityRequested}`);
        }

      } catch (error) {
        console.error('❌ Connection health check failed:', error);
      }
    }, 15000); // Every 15 seconds

    // Store reference to clear later
    this.healthCheckInterval = healthCheckInterval;
  }

  /**
   * Get current supervision timeout prevention status
   */
  getStatus() {
    return {
      active: this.keepAliveInterval !== null,
      gattOperationCount: this.gattOperationCount,
      lastGattOperation: this.lastGattOperation,
      connectionPriorityRequested: this.connectionPriorityRequested
    };
  }
}

export default BLESupervisionTimeoutManager;
