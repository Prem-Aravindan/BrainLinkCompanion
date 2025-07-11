#!/usr/bin/env python3
"""
Debug Python Welch implementation with the same signal
"""

import numpy as np
from scipy.signal import welch

# Same test signal as JavaScript
fs = 512
duration = 1.0
freq = 10
amplitude = 20

# Generate test signal
t = np.arange(0, duration, 1/fs)
data = amplitude * np.sin(2 * np.pi * freq * t)

print("Test Signal:")
print(f"Samples: {len(data)}")
print(f"Mean: {np.mean(data):.16e}")
print(f"Max: {np.max(data)}")
print(f"Min: {np.min(data)}")
print(f"First 5: [{', '.join([f'{v:.2f}' for v in data[:5]])}]")

# Compute PSD using scipy.signal.welch with same parameters
nperseg = 512
noverlap = 128
freqs, psd = welch(data, fs=fs, nperseg=nperseg, noverlap=noverlap, window='hann')

print(f"\nScipy Welch Results:")
print(f"PSD length: {len(psd)}")
print(f"Max PSD: {np.max(psd)}")
print(f"Total power: {np.sum(psd) * (freqs[1] - freqs[0])}")
print(f"Peak frequency: {freqs[np.argmax(psd)]:.1f} Hz")
print(f"Peak power: {np.max(psd)}")

# Band power for alpha (8-12 Hz)
alpha_mask = (freqs >= 8) & (freqs <= 12)
alpha_power = np.trapz(psd[alpha_mask], freqs[alpha_mask])
print(f"Alpha band power (8-12 Hz): {alpha_power}")

# Manual calculation to understand scaling
print(f"\nManual Calculation:")
window = np.hanning(nperseg)
print(f"Window sum: {np.sum(window)}")
print(f"Window sum of squares: {np.sum(window**2)}")
print(f"Window norm factor: {np.sum(window**2) / nperseg}")

# Apply window manually
windowed = data[:nperseg] * window
print(f"Windowed RMS: {np.sqrt(np.mean(windowed**2))}")

# Manual FFT
fft_result = np.fft.fft(windowed)
power_spectrum = np.abs(fft_result)**2
freqbins = len(power_spectrum) // 2 + 1
power_spectrum = power_spectrum[:freqbins]

print(f"Raw FFT power at peak: {np.max(power_spectrum)}")
print(f"Peak bin: {np.argmax(power_spectrum)}")

# Manual scaling (scipy formula)
window_norm = np.sum(window**2) / nperseg
scaled_power = power_spectrum / (fs * window_norm * nperseg)  # Added nperseg factor!
# One-sided spectrum scaling
scaled_power[1:-1] *= 2

print(f"Manually scaled peak power (with nperseg): {np.max(scaled_power)}")
print(f"Scipy peak power: {np.max(psd)}")
print(f"Scaling matches: {np.allclose(np.max(scaled_power), np.max(psd))}")

# The correct scipy.signal.welch scaling formula is:
# power = |FFT|^2 / (fs * sum(window^2))
# NOT: power = |FFT|^2 / (fs * sum(window^2) / nperseg)
