/**
 * @format
 */

import {AppRegistry, NativeModules, Platform} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Early initialization of MacrotellectLink SDK
if (Platform.OS === 'android' && NativeModules.BrainLinkModule) {
  console.log('🔥 Early MacrotellectLink SDK initialization...');
  NativeModules.BrainLinkModule.initialize()
    .then(result => {
      console.log('🔥 Early SDK initialization success:', result);
    })
    .catch(error => {
      console.warn('⚠️ Early SDK initialization failed:', error);
    });
}

AppRegistry.registerComponent(appName, () => App);
