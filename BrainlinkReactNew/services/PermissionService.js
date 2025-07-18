import { Platform, PermissionsAndroid, Alert } from 'react-native';

class PermissionService {
  static async requestBluetoothPermissions() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const androidVersion = Platform.Version;
    console.log('📱 Android version:', androidVersion);

    try {
      if (androidVersion >= 31) {
        // Android 12+ permissions
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permissions Required',
            'Bluetooth and location permissions are required to scan for BrainLink devices.',
            [{ text: 'OK' }]
          );
          return false;
        }
      } else {
        // Android 11 and below
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Location Permission Required',
            'Location permission is required for Bluetooth scanning on this Android version.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }

      console.log('✅ Bluetooth permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Permission request error:', error);
      Alert.alert(
        'Permission Error',
        'Failed to request permissions: ' + error.message,
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  static async checkBluetoothPermissions() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const androidVersion = Platform.Version;

    try {
      if (androidVersion >= 31) {
        const scanPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const connectPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const locationPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        return scanPermission && connectPermission && locationPermission;
      } else {
        const locationPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return locationPermission;
      }
    } catch (error) {
      console.error('❌ Permission check error:', error);
      return false;
    }
  }
}

export default PermissionService;
