# BrainLink Companion React Native App - Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

This is a React Native (Expo) application for BrainLink EEG device companion functionality. The app provides:

- Bluetooth connectivity to BrainLink devices
- Real-time EEG data visualization 
- User authentication and device authorization
- Cross-platform support (iOS/Android)

## Key Technologies

- **React Native + Expo**: Cross-platform mobile development
- **Bluetooth Serial**: Device communication via react-native-bluetooth-serial
- **Chart Visualization**: Real-time data plotting with react-native-chart-kit
- **Authentication**: JWT-based user login with backend API
- **Data Processing**: EEG signal filtering and band power analysis

## Code Standards

- Use functional components with React Hooks
- Implement proper error handling for Bluetooth operations
- Follow React Native best practices for performance
- Use TypeScript when possible for better type safety
- Maintain clean separation between UI and business logic

## Architecture

- **components/**: Reusable UI components
- **screens/**: Main app screens (Login, Dashboard, Settings)
- **services/**: API calls and Bluetooth communication
- **utils/**: Helper functions for EEG processing
- **constants/**: App configuration and constants

## BrainLink Integration

- Port the Python EEG processing logic to JavaScript
- Implement device detection and HWID validation
- Handle real-time data streaming and visualization
- Maintain compatibility with existing backend APIs
