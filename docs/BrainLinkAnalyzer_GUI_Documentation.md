# BrainLink Feature Analyzer GUI - Technical Documentation

## Overview

The BrainLinkAnalyzer_GUI.py is a comprehensive PyQt6-based desktop application for real-time EEG signal analysis using BrainLink devices. This application is derived from the original BrainCompanion "mother code" but focuses on feature extraction and cognitive state analysis rather than data transmission.

## System Architecture

### 1. Core Components

#### 1.1 Main Application Framework
- **Framework**: PySide6 (PyQt6) for cross-platform GUI
- **Real-time Plotting**: PyQtGraph for high-performance EEG visualization
- **Signal Processing**: SciPy for digital signal processing
- **Data Analysis**: NumPy and Pandas for numerical computation
- **Authentication**: JWT-based authentication with multiple backend environments

#### 1.2 Key Classes

##### BrainLinkAnalyzerWindow (Main Window)
- **Purpose**: Primary application window managing all UI components
- **Responsibilities**:
  - Device connection and authentication
  - Real-time EEG visualization
  - Calibration phase management
  - Analysis result display
- **Architecture**: Tab-based interface with Connection, Analysis, and Results tabs

##### FeatureAnalysisEngine
- **Purpose**: Core signal processing and feature extraction engine
- **Responsibilities**:
  - Real-time EEG feature computation
  - Baseline calibration data collection
  - Statistical analysis and comparison
  - Cognitive state classification
- **Key Features**:
  - 23 comprehensive EEG features per analysis window
  - Multi-band power spectral analysis (Delta, Theta, Alpha, Beta, Gamma)
  - Real-time z-score normalization
  - Outlier detection and significance testing

##### OSSelectionDialog & LoginDialog
- **Purpose**: Authentication and configuration dialogs
- **Features**:
  - Cross-platform OS detection
  - Secure credential management with remember me functionality
  - Environment selection (EN/NL/Local)

### 2. Signal Processing Pipeline

#### 2.1 Data Flow Architecture
```
BrainLink Device → Serial Communication → BrainLinkParser → Raw Data Buffer → 
Signal Processing → Feature Extraction → Real-time Analysis → GUI Display
```

#### 2.2 Signal Processing Chain
1. **Data Acquisition**: 512Hz raw EEG from BrainLink device
2. **Downsampling**: Decimation to 256Hz for processing efficiency
3. **Filtering Pipeline**:
   - DC component removal
   - 50Hz notch filter for line noise elimination
   - 1-45Hz bandpass filter for EEG frequency range
4. **Feature Extraction**: 23 features per 1-second window with 50% overlap

#### 2.3 Feature Set (23 Features)
- **Band Powers**: Delta, Theta, Alpha, Beta, Gamma absolute power
- **Relative Powers**: Normalized band powers (% of total power)
- **Peak Analysis**: Peak frequency and amplitude for each band
- **Spectral Ratios**: Alpha/Theta ratio, Beta/Alpha ratio
- **Total Power**: Complete spectrum power

### 3. Authentication System

#### 3.1 Multi-Environment Support
- **EN Environment**: Production (https://en.mindspeller.com)
- **NL Environment**: Production (https://nl.mindspeller.com)
- **Local Environment**: Development (http://127.0.0.1:5000)

#### 3.2 Authentication Flow
1. **User Login**: Username/password authentication
2. **JWT Token Acquisition**: Bearer token for API authorization
3. **HWID Fetching**: Authorized device IDs from `/users/hwids` endpoint
4. **Device Matching**: Match authorized HWIDs with available serial ports
5. **Secure Connection**: Establish authenticated device connection

### 4. Device Detection & Connection

#### 4.1 Cross-Platform Device Detection
- **Windows**: Hardware ID matching using known BrainLink serial numbers
- **macOS**: Device description and path-based detection
- **Authorization**: HWID-based device validation from backend

#### 4.2 Serial Communication
- **Library**: cushy-serial for robust serial port management
- **Protocol**: BrainLinkParser for proprietary data format parsing
- **Threading**: Separate thread for non-blocking data acquisition

### 5. Calibration & Analysis Workflow

#### 5.1 Three-Phase Calibration
1. **Eyes Closed Baseline**: Resting state with eyes closed
2. **Eyes Open Baseline**: Resting state with eyes open
3. **Task Recording**: Cognitive task performance

#### 5.2 Cognitive Tasks Available
- **Mental Math**: Interactive arithmetic problems with auto-generated challenges
- **Visual Imagery**: Guided spatial visualization with detailed instructions
- **Working Memory**: Dynamic sequences (numbers/letters) with memory manipulation tasks
- **Focused Attention**: Breathing focus with counting guidance
- **Language Processing**: Letter-based word generation with changing prompts
- **Motor Imagery**: Alternating hand movement visualization with specific actions
- **Cognitive Load**: Multi-task cognitive challenges with visual components

#### 5.3 Interactive Task Interface
- **Real-time Task Window**: Separate window with task-specific content during recording
- **Dynamic Content**: Auto-updating problems, sequences, and instructions
- **Visual Feedback**: Progress bar, timer, and task-specific controls
- **User Controls**: Task-specific buttons for generating new content
- **Auto-progression**: Automatic content updates at optimal intervals
- **Professional Styling**: Dark theme with clear visual hierarchy

#### 5.3 Analysis Pipeline
1. **Baseline Statistics**: Mean, std, percentiles for calibration data
2. **Task Analysis**: Z-score normalization against baseline
3. **Significance Testing**: 2-sigma threshold for significant changes
4. **Outlier Detection**: Statistical outlier identification
5. **Report Generation**: Comprehensive JSON analysis report

### 6. Real-time Visualization

#### 6.1 Live EEG Display
- **Update Rate**: 500ms refresh for real-time visualization
- **Processing**: Same filtering pipeline as analysis
- **Visualization**: Green trace on black background for clarity

#### 6.2 Feature Monitoring
- **Real-time Table**: Live updating feature values
- **Update Rate**: 1-second intervals
- **Features**: All 23 computed features with 4-decimal precision

### 7. Data Storage & Export

#### 7.1 Analysis Results
- **Format**: JSON with comprehensive metadata
- **Content**: 
  - Configuration parameters
  - Data collection statistics
  - Baseline statistics
  - Analysis results with significance flags
  - Device and authentication information

#### 7.2 Report Structure
```json
{
  "timestamp": "ISO format timestamp",
  "configuration": "Analysis parameters",
  "data_collection": "Data collection statistics",
  "baseline_statistics": "Baseline feature statistics",
  "analysis_results": "Task vs baseline comparison",
  "device_info": "Connection and authentication details"
}
```

### 8. Technical Specifications

#### 8.1 Performance Characteristics
- **Sampling Rate**: 256Hz effective (downsampled from 512Hz)
- **Window Size**: 1-second analysis windows
- **Overlap**: 50% window overlap for smooth analysis
- **Latency**: <1 second for real-time feature computation
- **Memory Usage**: Circular buffers with 10-second capacity

#### 8.2 Signal Processing Parameters
- **Frequency Bands**:
  - Delta: 0.5-4 Hz
  - Theta: 4-8 Hz
  - Alpha: 8-12 Hz
  - Beta: 12-30 Hz
  - Gamma: 30-45 Hz
- **Filters**: 2nd-order Butterworth filters
- **PSD**: Welch's method with 256-sample segments

### 9. Error Handling & Robustness

#### 9.1 Connection Resilience
- **SSL Fallback**: Automatic retry without certificate verification
- **Proxy Handling**: Automatic proxy bypass for connection issues
- **Timeout Management**: Configurable timeouts for all network operations

#### 9.2 Data Validation
- **Signal Quality**: Real-time data validation
- **Feature Bounds**: Sanity checking for computed features
- **Statistical Validation**: Outlier detection and significance testing

### 10. Development & Debugging

#### 10.1 Logging System
- **Timestamped Logs**: All operations logged with precise timestamps
- **Multi-level Logging**: Info, warning, and error categorization
- **User Interface**: Real-time log display in GUI

#### 10.2 Debug Information
- **Device Detection**: Detailed port scanning and HWID matching
- **Authentication**: Step-by-step login process logging
- **Signal Processing**: Real-time feature computation status

### 11. Integration Points

#### 11.1 Backend API Integration
- **Login Endpoint**: `/api/cas/token/login`
- **HWID Endpoint**: `/api/cas/users/hwids`
- **Authentication**: Bearer token authorization

#### 11.2 Hardware Integration
- **BrainLink Device**: Direct serial communication
- **Cross-platform**: Windows, macOS, Linux support
- **Real-time**: Sub-second latency for all operations

### 12. Future Extensibility

#### 12.1 Modular Architecture
- **Plugin System**: Easy addition of new cognitive tasks
- **Feature Extension**: Simple addition of new EEG features
- **Backend Flexibility**: Support for additional authentication methods

#### 12.2 Scalability Considerations
- **Multi-device**: Architecture supports multiple concurrent devices
- **Cloud Integration**: Ready for cloud-based analysis services
- **Machine Learning**: Feature set optimized for ML model training

## Usage Flow

1. **Startup**: OS detection and environment selection
2. **Authentication**: Login with backend service
3. **Device Connection**: Automatic BrainLink device detection and connection
4. **Calibration**: Three-phase baseline and task recording
5. **Analysis**: Real-time statistical analysis and significance testing
6. **Results**: Comprehensive analysis report generation

## Key Differences from Mother Code

1. **Purpose**: Analysis-focused vs. data transmission
2. **Features**: Comprehensive 23-feature extraction vs. simple data forwarding
3. **Calibration**: Structured three-phase calibration protocol
4. **Analysis**: Real-time statistical analysis with significance testing
5. **Reporting**: Detailed JSON analysis reports
6. **UI**: Tab-based interface optimized for analysis workflow

This application represents a complete transformation from a simple data forwarding tool to a sophisticated EEG analysis platform while maintaining compatibility with the original BrainCompanion authentication and device management systems.
