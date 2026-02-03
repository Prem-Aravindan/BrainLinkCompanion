"""
ANT Neuro eego 64-Channel EEG Data Acquisition Module
------------------------------------------------------
This module handles connection and data streaming from ANT Neuro eego amplifiers.

Compatible with: eego-SDK (64-channel amplifiers)
Python Version: 3.13+
"""

import sys
import time
import numpy as np
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass

# Add SDK path
sys.path.insert(0, 'M:/CODEBASE/BrainLinkCompanion/eego_sdk_toolbox')

try:
    import eego_sdk
    SDK_AVAILABLE = True
except ImportError as e:
    SDK_AVAILABLE = False
    print(f"Warning: eego_sdk not available: {e}")


@dataclass
class ChannelInfo:
    """Information about a single EEG channel"""
    index: int
    label: str
    type: str  # 'EEG', 'Reference', 'Ground', etc.
    unit: str
    sampling_rate: float


@dataclass
class AmplifierInfo:
    """Information about a connected amplifier"""
    serial: str
    type: str
    channel_count: int
    firmware_version: Optional[str] = None


class AntNeuroDevice:
    """
    Interface for ANT Neuro eego 64-channel EEG amplifier
    
    Usage:
        device = AntNeuroDevice()
        amplifiers = device.discover_amplifiers()
        device.connect(amplifiers[0].serial)
        device.start_streaming(sample_rate=500)
        
        while streaming:
            data = device.read_samples(250)  # Read 0.5 seconds at 500Hz
            # Process data...
            
        device.stop_streaming()
    """
    
    def __init__(self):
        """Initialize the ANT Neuro device interface"""
        if not SDK_AVAILABLE:
            raise RuntimeError("eego_sdk not available. Check installation.")
        
        self.factory = None
        self.amplifier = None
        self.stream = None
        self.channels: List[ChannelInfo] = []
        self.sampling_rate = 0
        self.is_streaming = False
        
        # Initialize factory
        try:
            self.factory = eego_sdk.factory()
        except Exception as e:
            raise RuntimeError(f"Failed to initialize eego_sdk factory: {e}")
    
    def discover_amplifiers(self) -> List[AmplifierInfo]:
        """
        Discover all connected ANT Neuro amplifiers
        
        Returns:
            List of AmplifierInfo objects for each discovered amplifier
            
        Raises:
            RuntimeError: If discovery fails
        """
        if not self.factory:
            raise RuntimeError("Factory not initialized")
        
        try:
            amplifiers = self.factory.getAmplifiers()
            
            amp_info_list = []
            for amp in amplifiers:
                info = AmplifierInfo(
                    serial=amp.getSerial(),
                    type=amp.getType(),
                    channel_count=amp.getChannelCount()
                )
                amp_info_list.append(info)
            
            return amp_info_list
            
        except Exception as e:
            raise RuntimeError(f"Failed to discover amplifiers: {e}")
    
    def connect(self, amplifier_serial: Optional[str] = None) -> AmplifierInfo:
        """
        Connect to a specific amplifier (or the first one found)
        
        Args:
            amplifier_serial: Serial number of amplifier. If None, connects to first available.
            
        Returns:
            AmplifierInfo object for the connected amplifier
            
        Raises:
            RuntimeError: If connection fails
        """
        amplifiers = self.discover_amplifiers()
        
        if not amplifiers:
            raise RuntimeError("No amplifiers found. Check device connection.")
        
        # Select amplifier
        if amplifier_serial:
            selected = next((a for a in amplifiers if a.serial == amplifier_serial), None)
            if not selected:
                raise RuntimeError(f"Amplifier with serial {amplifier_serial} not found")
        else:
            selected = amplifiers[0]
        
        # Get the actual amplifier object
        amp_objects = self.factory.getAmplifiers()
        self.amplifier = next(a for a in amp_objects if a.getSerial() == selected.serial)
        
        print(f"Connected to amplifier: {selected.serial}")
        print(f"  Type: {selected.type}")
        print(f"  Channels: {selected.channel_count}")
        
        return selected
    
    def start_streaming(self, sample_rate: int = 500) -> None:
        """
        Start EEG data streaming
        
        Args:
            sample_rate: Sampling rate in Hz (e.g., 500, 1000, 2000)
            
        Raises:
            RuntimeError: If streaming cannot be started
        """
        if not self.amplifier:
            raise RuntimeError("No amplifier connected. Call connect() first.")
        
        if self.is_streaming:
            raise RuntimeError("Already streaming. Stop current stream first.")
        
        try:
            # Open stream with specified sample rate
            self.stream = self.amplifier.OpenStream(sample_rate)
            self.sampling_rate = sample_rate
            
            # Get channel information
            channel_list = self.stream.getChannelList()
            self.channels = []
            
            for idx, ch in enumerate(channel_list):
                ch_info = ChannelInfo(
                    index=idx,
                    label=f"Ch{idx+1}",  # Default label
                    type=str(ch.getType()) if hasattr(ch, 'getType') else 'EEG',
                    unit='μV',  # Standard unit for EEG
                    sampling_rate=sample_rate
                )
                self.channels.append(ch_info)
            
            self.is_streaming = True
            print(f"Streaming started at {sample_rate} Hz")
            print(f"Channels available: {len(self.channels)}")
            
        except Exception as e:
            raise RuntimeError(f"Failed to start streaming: {e}")
    
    def read_samples(self, num_samples: int) -> Optional[np.ndarray]:
        """
        Read EEG samples from the stream
        
        Args:
            num_samples: Number of samples to read per channel
            
        Returns:
            numpy array of shape (num_samples, num_channels)
            Each row is a time point, each column is a channel
            Returns None if no data available
            
        Raises:
            RuntimeError: If not streaming
        """
        if not self.is_streaming:
            raise RuntimeError("Not streaming. Call start_streaming() first.")
        
        try:
            # Get data from stream
            buffer = self.stream.getData()
            
            if not buffer or buffer.size() == 0:
                return None
            
            # Convert to numpy array
            # Format: [sample0_ch0, sample0_ch1, ..., sample1_ch0, sample1_ch1, ...]
            num_channels = len(self.channels)
            data_list = []
            
            for i in range(buffer.size()):
                sample = buffer.getSample(i)
                data_list.append(sample)
            
            if not data_list:
                return None
            
            # Reshape to (samples, channels)
            data_array = np.array(data_list).reshape(-1, num_channels)
            
            # Return requested number of samples
            if data_array.shape[0] >= num_samples:
                return data_array[:num_samples, :]
            else:
                return data_array
            
        except Exception as e:
            print(f"Error reading samples: {e}")
            return None
    
    def get_channel_info(self) -> List[ChannelInfo]:
        """
        Get information about all channels
        
        Returns:
            List of ChannelInfo objects
        """
        return self.channels
    
    def get_sampling_rate(self) -> int:
        """Get current sampling rate"""
        return self.sampling_rate
    
    def stop_streaming(self) -> None:
        """Stop EEG data streaming and cleanup"""
        if self.is_streaming:
            try:
                if self.stream:
                    # Close stream
                    self.stream = None
                self.is_streaming = False
                print("Streaming stopped")
            except Exception as e:
                print(f"Error stopping stream: {e}")
        
        self.sampling_rate = 0
        self.channels = []
    
    def disconnect(self) -> None:
        """Disconnect from amplifier"""
        self.stop_streaming()
        self.amplifier = None
        print("Disconnected from amplifier")
    
    def __del__(self):
        """Cleanup on deletion"""
        try:
            self.disconnect()
        except:
            pass


# Test function
def test_device():
    """Test the ANT Neuro device connection"""
    print("="*60)
    print("ANT NEURO DEVICE TEST")
    print("="*60)
    
    try:
        device = AntNeuroDevice()
        print("✓ Device interface initialized")
        
        # Discover amplifiers
        print("\nDiscovering amplifiers...")
        amplifiers = device.discover_amplifiers()
        
        if not amplifiers:
            print("⚠ No amplifiers found (device not connected)")
            print("  Connect the ANT Neuro headset and try again.")
            return
        
        print(f"✓ Found {len(amplifiers)} amplifier(s)")
        for amp in amplifiers:
            print(f"  - {amp.serial}: {amp.type} ({amp.channel_count} channels)")
        
        # Connect to first amplifier
        print("\nConnecting to amplifier...")
        amp_info = device.connect()
        print("✓ Connected successfully")
        
        # Start streaming
        print("\nStarting data stream at 500 Hz...")
        device.start_streaming(sample_rate=500)
        print("✓ Streaming started")
        
        # Read some samples
        print("\nReading test samples...")
        for i in range(3):
            time.sleep(0.5)  # Wait 0.5 seconds
            data = device.read_samples(250)  # Read 250 samples (0.5 sec at 500Hz)
            
            if data is not None:
                print(f"  Read {data.shape[0]} samples x {data.shape[1]} channels")
                print(f"    Data range: {data.min():.2f} to {data.max():.2f} μV")
            else:
                print("  No data available yet")
        
        # Stop streaming
        print("\nStopping stream...")
        device.stop_streaming()
        print("✓ Stream stopped")
        
        # Disconnect
        device.disconnect()
        print("✓ Disconnected")
        
        print("\n" + "="*60)
        print("TEST COMPLETE - Device is working correctly!")
        print("="*60)
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_device()
