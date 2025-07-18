/**
 * Enhanced DirectBLE Scanner with Foreground Service Support
 * Prevents 15-second disconnection by running as foreground service
 */

import { NativeModules } from 'react-native';
const { BLEServiceModule } = NativeModules;

class DirectBLEServiceManager {
  constructor() {
    this.isServiceRunning = false;
  }

  async startForegroundService() {
    try {
      if (this.isServiceRunning) {
        console.log('🔄 BLE Foreground Service already running');
        return true;
      }

      console.log('🚀 Starting BLE Foreground Service...');
      const result = await BLEServiceModule.startForegroundService();
      this.isServiceRunning = true;
      console.log('✅ BLE Foreground Service started:', result);
      return true;
    } catch (error) {
      console.error('❌ Failed to start BLE Foreground Service:', error);
      return false;
    }
  }

  async stopForegroundService() {
    try {
      if (!this.isServiceRunning) {
        console.log('⏹️ BLE Foreground Service not running');
        return true;
      }

      console.log('⏹️ Stopping BLE Foreground Service...');
      const result = await BLEServiceModule.stopForegroundService();
      this.isServiceRunning = false;
      console.log('✅ BLE Foreground Service stopped:', result);
      return true;
    } catch (error) {
      console.error('❌ Failed to stop BLE Foreground Service:', error);
      return false;
    }
  }
}

export default DirectBLEServiceManager;
