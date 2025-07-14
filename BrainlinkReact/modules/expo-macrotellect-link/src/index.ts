import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

// Get our BrainLinkModule that we registered in MainApplication
const { BrainLinkModule } = NativeModules;
const brainLinkEmitter = BrainLinkModule ? new NativeEventEmitter(BrainLinkModule) : null;

// TypeScript definitions for the MacrotellectLink integration
export interface EEGData {
  rawData: number[];
  signal: number;
  attention: number;
  meditation: number;
  blink: number;
  timestamp: number;
}

export interface EEGPowerData {
  delta: number;
  theta: number;
  lowAlpha: number;
  highAlpha: number;
  lowBeta: number;
  highBeta: number;
  lowGamma: number;
  highGamma: number;
  timestamp: number;
}

export interface DeviceInfo {
  id: string;
  name: string;
  address: string;
}

// Main API functions - these call our native BrainLinkModule
export async function startDeviceScan(): Promise<string> {
  if (!BrainLinkModule) {
    throw new Error('BrainLinkModule not available');
  }
  return BrainLinkModule.startDeviceScan();
}

export async function stopDeviceScan(): Promise<string> {
  if (!BrainLinkModule) {
    throw new Error('BrainLinkModule not available');
  }
  return BrainLinkModule.stopDeviceScan();
}

export async function connectToDevice(deviceId: string): Promise<string> {
  if (!BrainLinkModule) {
    throw new Error('BrainLinkModule not available');
  }
  return BrainLinkModule.connectToDevice(deviceId);
}

export async function disconnectDevice(): Promise<string> {
  if (!BrainLinkModule) {
    throw new Error('BrainLinkModule not available');
  }
  return BrainLinkModule.disconnectDevice();
}

export async function startEEGDataCollection(): Promise<string> {
  if (!BrainLinkModule) {
    throw new Error('BrainLinkModule not available');
  }
  return BrainLinkModule.startEEGDataCollection();
}

export async function stopEEGDataCollection(): Promise<string> {
  if (!BrainLinkModule) {
    throw new Error('BrainLinkModule not available');
  }
  return BrainLinkModule.stopEEGDataCollection();
}

// Event subscription helpers
export function addDeviceFoundListener(listener: (device: DeviceInfo) => void): EmitterSubscription | null {
  if (!brainLinkEmitter) return null;
  return brainLinkEmitter.addListener('onDeviceFound', listener);
}

export function addScanFinishedListener(listener: () => void): EmitterSubscription | null {
  if (!brainLinkEmitter) return null;
  return brainLinkEmitter.addListener('onScanFinished', listener);
}

export function addScanErrorListener(listener: (error: { error: string }) => void): EmitterSubscription | null {
  if (!brainLinkEmitter) return null;
  return brainLinkEmitter.addListener('onScanError', listener);
}

export function addEEGDataListener(listener: (data: EEGData) => void): EmitterSubscription | null {
  if (!brainLinkEmitter) return null;
  return brainLinkEmitter.addListener('onEEGDataReceived', listener);
}

export function addEEGPowerDataListener(listener: (data: EEGPowerData) => void): EmitterSubscription | null {
  if (!brainLinkEmitter) return null;
  return brainLinkEmitter.addListener('onEEGPowerDataReceived', listener);
}

// Remove all listeners
export function removeAllListeners() {
  if (!brainLinkEmitter) return;
  brainLinkEmitter.removeAllListeners('onDeviceFound');
  brainLinkEmitter.removeAllListeners('onScanFinished');
  brainLinkEmitter.removeAllListeners('onScanError');
  brainLinkEmitter.removeAllListeners('onEEGDataReceived');
  brainLinkEmitter.removeAllListeners('onEEGPowerDataReceived');
}

// Check if module is available
export function isBrainLinkModuleAvailable(): boolean {
  return !!BrainLinkModule;
}

export { BrainLinkModule };
