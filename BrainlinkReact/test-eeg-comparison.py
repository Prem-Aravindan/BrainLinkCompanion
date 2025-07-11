#!/usr/bin/env python3
"""
Comprehensive EEG Processing Test Script - Python
Tests the Python implementation against known test signals
"""

import numpy as np
import json
from datetime import datetime
from scipy.signal import butter, filtfilt, iirnotch, welch
from scipy.integrate import simpson as simps

# Test configuration
TEST_CONFIG = {
    'fs': 512,
    'duration': 1.0,  # 1 second
    'numSamples': 512,
    'testCases': [
        {
            'name': "Pure 10Hz Alpha Wave",
            'frequencies': [{'freq': 10, 'amplitude': 20, 'phase': 0}],
            'noise': 0
        },
        {
            'name': "Pure 6Hz Theta Wave", 
            'frequencies': [{'freq': 6, 'amplitude': 15, 'phase': 0}],
            'noise': 0
        },
        {
            'name': "Mixed Alpha + Theta",
            'frequencies': [
                {'freq': 10, 'amplitude': 20, 'phase': 0},
                {'freq': 6, 'amplitude': 15, 'phase': np.pi/4}
            ],
            'noise': 2
        },
        {
            'name': "Realistic EEG Mix",
            'frequencies': [
                {'freq': 2, 'amplitude': 8, 'phase': 0},      # Delta
                {'freq': 6, 'amplitude': 15, 'phase': 0},     # Theta  
                {'freq': 10, 'amplitude': 25, 'phase': 0},    # Alpha (dominant)
                {'freq': 20, 'amplitude': 10, 'phase': 0},    # Beta
                {'freq': 35, 'amplitude': 5, 'phase': 0}      # Gamma
            ],
            'noise': 3
        },
        {
            'name': "Constant Signal (should produce zero power)",
            'constant': 10.0,
            'noise': 0
        },
        {
            'name': "High SNR Theta Wave (clean 7Hz)",
            'frequencies': [{'freq': 7, 'amplitude': 30, 'phase': 0}],
            'noise': 1
        },
        {
            'name': "Low SNR Theta in Noise",
            'frequencies': [{'freq': 6.5, 'amplitude': 5, 'phase': 0}],
            'noise': 10
        },
        {
            'name': "Theta with Strong Alpha Competition",
            'frequencies': [
                {'freq': 6, 'amplitude': 10, 'phase': 0},     # Theta
                {'freq': 10, 'amplitude': 40, 'phase': 0}     # Dominant Alpha
            ],
            'noise': 2
        }
    ]
}

# EEG Processing Constants (matching the working Python code)
FS = 512
WINDOW_SIZE = 512
OVERLAP_SIZE = 128
EEG_BANDS = {'delta':(0.5,4), 'theta':(4,8), 'alpha':(8,12), 'beta':(12,30), 'gamma':(30,45)}

# Global state for exponential smoothing (matches JavaScript implementation)
smoothed_theta_contribution = None

def bandpass_filter(data, lowcut, highcut, fs, order=2):
    """Butterworth bandpass filter (matches working Python code)"""
    nyq = 0.5*fs
    b, a = butter(order, [lowcut/nyq, highcut/nyq], btype='band')
    return filtfilt(b, a, data)

def notch_filter(data, fs, notch_freq=50.0, quality_factor=30.0):
    """Notch filter (matches working Python code)"""
    freq = notch_freq/(fs/2)
    b, a = iirnotch(freq, quality_factor)
    return filtfilt(b, a, data)

def compute_psd(data, fs):
    """Compute PSD using Welch's method (matches working Python code)"""
    return welch(data, fs=fs, nperseg=WINDOW_SIZE, noverlap=OVERLAP_SIZE)

def bandpower(psd, freqs, band):
    """Calculate band power (matches working Python code)"""
    low, high = EEG_BANDS[band]
    idx = (freqs >= low) & (freqs <= high)
    return simps(psd[idx], dx=freqs[1]-freqs[0]) if np.any(idx) else 0

def compute_snr(psd, freqs, band):
    """Compute SNR (matches working Python code)"""
    bp = bandpower(psd, freqs, band)
    total = simps(psd, dx=freqs[1]-freqs[0])
    noise = total - bp
    return bp/noise if noise > 0 else np.inf

def theta_peak_snr(psd, freqs, sig_band=(3,9), noise_bands=((2,3),(9,10))):
    """Calculate theta peak SNR (matches working Python code)"""
    sig_idx = (freqs >= sig_band[0]) & (freqs <= sig_band[1])
    if not np.any(sig_idx): 
        return np.nan
    signal = np.max(psd[sig_idx])
    noise_vals = []
    for low, high in noise_bands:
        idx = (freqs >= low) & (freqs <= high)
        if np.any(idx): 
            noise_vals.append(psd[idx])
    if not noise_vals: 
        return np.nan
    noise_vals = np.hstack(noise_vals)
    return signal/np.mean(noise_vals) if np.mean(noise_vals) > 0 else np.inf

def remove_eye_blink_artifacts(data, window=10):
    """Remove eye blink artifacts (matches working Python code exactly)"""
    clean = data.copy()
    adaptive_threshold = np.mean(data) + 3 * np.std(data)
    idx = np.where(np.abs(data) > adaptive_threshold)[0]
    for i in idx:
        start = max(0, i - window)
        end = min(len(data), i + window)
        local_window = np.delete(data[start:end], np.where(np.abs(data[start:end]) > adaptive_threshold))
        if len(local_window) > 0:
            clean[i] = np.median(local_window)
        else:
            clean[i] = np.median(data)
    return clean

def generate_test_signal(test_case, config):
    """Generate synthetic EEG test signal"""
    dt = 1.0 / config['fs']
    t = np.arange(0, config['duration'], dt)[:config['numSamples']]
    
    if 'constant' in test_case:
        # Constant signal
        signal = np.full_like(t, test_case['constant'])
    else:
        # Sum of sinusoids
        signal = np.zeros_like(t)
        for component in test_case['frequencies']:
            signal += component['amplitude'] * np.sin(2 * np.pi * component['freq'] * t + component['phase'])
    
    # Add noise
    if test_case['noise'] > 0:
        noise = np.random.normal(0, test_case['noise'], len(signal))
        signal += noise
    
    return signal

def format_number(num, decimals=4):
    """Format number for consistent output"""
    if num is None:
        return "null"
    if not np.isfinite(num):
        if num == np.inf:
            return "inf"
        elif num == -np.inf:
            return "-inf"
        else:
            return "nan"
    return f"{num:.{decimals}f}"

def process_eeg_signal(data):
    """Process EEG signal using the exact Python pipeline"""
    # Step 1: Artifact removal
    cleaned_data = remove_eye_blink_artifacts(data)
    
    # Step 2: Notch filter (50 Hz)
    data_notched = notch_filter(cleaned_data, FS, notch_freq=50.0, quality_factor=30.0)
    
    # Step 3: Bandpass filter (1-45 Hz)
    filtered = bandpass_filter(data_notched, lowcut=1.0, highcut=45.0, fs=FS, order=2)
    
    # Step 4: Compute PSD
    freqs, psd = compute_psd(filtered, FS)
    
    # Step 5: Calculate metrics
    total_power = np.var(filtered)
    
    # Band powers
    delta_power = bandpower(psd, freqs, 'delta')
    theta_power = bandpower(psd, freqs, 'theta')
    alpha_power = bandpower(psd, freqs, 'alpha')
    beta_power = bandpower(psd, freqs, 'beta')
    gamma_power = bandpower(psd, freqs, 'gamma')
    
    # Theta metrics
    theta_contribution = (theta_power / total_power * 100) if total_power > 0 else 0
    theta_relative = theta_contribution / 100
    theta_snr_broad = compute_snr(psd, freqs, 'theta')
    theta_peak_snr_val = theta_peak_snr(psd, freqs)
    
    # Adapted theta based on SNR quality (matches JavaScript implementation)
    if np.isfinite(theta_peak_snr_val) and theta_peak_snr_val >= 0.2:
        adapted_theta = theta_peak_snr_val / (theta_peak_snr_val + 1)  # Normalize SNR contribution
    else:
        adapted_theta = 0.0
    
    # Exponential smoothing (α = 0.3, matches JavaScript implementation)
    global smoothed_theta_contribution
    alpha = 0.3
    if smoothed_theta_contribution is None:
        smoothed_theta_contribution = theta_contribution
    else:
        smoothed_theta_contribution = alpha * theta_contribution + (1 - alpha) * smoothed_theta_contribution
    
    # Build payload (matches Python exactly)
    payload = {
        'Total variance (power)': total_power,
        'Delta power': delta_power,
        'Theta power': theta_power,
        'Theta contribution': theta_contribution,
        'Theta relative': theta_relative,
        'Theta SNR broad': theta_snr_broad if np.isfinite(theta_snr_broad) else np.nan,
        'Theta SNR peak': theta_peak_snr_val if np.isfinite(theta_peak_snr_val) else np.nan,
        'Adapted theta': adapted_theta,
        'Smoothed theta': smoothed_theta_contribution,
        'Alpha power': alpha_power,
        'Beta power': beta_power,
        'Gamma power': gamma_power,
    }
    
    return {
        'payload': payload,
        'psd': psd,
        'freqs': freqs,
        'filtered': filtered
    }

def run_tests():
    """Run comprehensive test suite"""
    print("=" * 80)
    print("Python EEG Processing Test Suite")
    print("=" * 80)
    
    results = []
    
    for test_case in TEST_CONFIG['testCases']:
        print(f"\n🧪 Testing: {test_case['name']}")
        print("-" * 60)
        
        try:
            # Set random seed for reproducible noise
            np.random.seed(42)
            
            # Generate test signal
            test_data = generate_test_signal(test_case, TEST_CONFIG)
            
            # Log test signal statistics
            mean = np.mean(test_data)
            std = np.std(test_data)
            min_val = np.min(test_data)
            max_val = np.max(test_data)
            
            print(f"📊 Test Signal Stats:")
            print(f"   Samples: {len(test_data)}")
            print(f"   Mean: {format_number(mean)}")
            print(f"   Std: {format_number(std)}")
            print(f"   Range: [{format_number(min_val)}, {format_number(max_val)}]")
            print(f"   First 5: [{', '.join([format_number(v, 2) for v in test_data[:5]])}]")
            
            # Process with EEG pipeline
            result = process_eeg_signal(test_data)
            payload = result['payload']
            
            # Extract key metrics
            metrics = {
                'testName': test_case['name'],
                'totalPower': payload['Total variance (power)'],
                'deltaPower': payload['Delta power'],
                'thetaPower': payload['Theta power'],
                'alphaPower': payload['Alpha power'],
                'betaPower': payload['Beta power'],
                'gammaPower': payload['Gamma power'],
                'thetaContribution': payload['Theta contribution'],
                'thetaRelative': payload['Theta relative'],
                'thetaSNRBroad': payload['Theta SNR broad'],
                'thetaSNRPeak': payload['Theta SNR peak'],
                'adaptedTheta': payload['Adapted theta'],
                'smoothedTheta': payload['Smoothed theta'],
                'psdLength': len(result['psd']),
                'freqsLength': len(result['freqs']),
                'maxFreq': np.max(result['freqs']),
                'psdSum': np.sum(result['psd'])
            }
            
            results.append(metrics)
            
            # Display results
            print(f"\n📈 Processing Results:")
            print(f"   Total Power (Variance): {format_number(metrics['totalPower'])}")
            print(f"   Delta Power (0.5-4 Hz): {format_number(metrics['deltaPower'])}")
            print(f"   Theta Power (4-8 Hz):   {format_number(metrics['thetaPower'])}")
            print(f"   Alpha Power (8-12 Hz):  {format_number(metrics['alphaPower'])}")
            print(f"   Beta Power (12-30 Hz):  {format_number(metrics['betaPower'])}")
            print(f"   Gamma Power (30-45 Hz): {format_number(metrics['gammaPower'])}")
            print(f"   Theta Contribution:     {format_number(metrics['thetaContribution'])}%")
            print(f"   Theta Relative:         {format_number(metrics['thetaRelative'])}")
            print(f"   Theta SNR Broad:        {format_number(metrics['thetaSNRBroad'])}")
            print(f"   Theta SNR Peak:         {format_number(metrics['thetaSNRPeak'])}")
            print(f"   Adapted Theta:          {format_number(metrics['adaptedTheta'])}")
            print(f"   Smoothed Theta:         {format_number(metrics['smoothedTheta'])}")
            print(f"   PSD Length:             {metrics['psdLength']}")
            print(f"   Freq Range:             0 - {format_number(metrics['maxFreq'])} Hz")
            print(f"   PSD Total Power:        {format_number(metrics['psdSum'])}")
            
            # Validate results
            print(f"\n✅ Validation:")
            
            # Check for NaN values
            numeric_values = [v for v in metrics.values() if isinstance(v, (int, float))]
            has_nan = any(np.isnan(v) and np.isfinite(v) == False and v != np.inf for v in numeric_values)
            print(f"   No NaN values: {'✅' if not has_nan else '❌'}")
            
            # Check power conservation
            band_sum = (metrics['deltaPower'] + metrics['thetaPower'] + metrics['alphaPower'] + 
                       metrics['betaPower'] + metrics['gammaPower'])
            power_ratio = band_sum / metrics['totalPower'] if metrics['totalPower'] > 0 else 0
            print(f"   Band power sum/total: {format_number(power_ratio)}")
            
            # Advanced theta metrics validation
            print(f"\n🧠 Advanced Theta Metrics Validation:")
            
            # Check adapted theta range (0-1)
            adapted_valid = 0 <= metrics['adaptedTheta'] <= 1 if np.isfinite(metrics['adaptedTheta']) else True
            print(f"   Adapted Theta valid range (0-1): {'✅' if adapted_valid else '❌'}")
            
            # Check smoothed theta range (should be percentage 0-100)
            smoothed_valid = 0 <= metrics['smoothedTheta'] <= 100 if np.isfinite(metrics['smoothedTheta']) else True
            print(f"   Smoothed Theta valid range (0-100): {'✅' if smoothed_valid else '❌'}")
            
            # Check SNR-based adaptation logic
            if np.isfinite(metrics['thetaSNRPeak']) and metrics['thetaSNRPeak'] >= 0.2:
                expected_adapted = metrics['thetaSNRPeak'] / (metrics['thetaSNRPeak'] + 1)
                adapted_correct = abs(metrics['adaptedTheta'] - expected_adapted) < 0.001
                print(f"   SNR-based adaptation correct: {'✅' if adapted_correct else '❌'}")
            else:
                adapted_zero = metrics['adaptedTheta'] == 0.0
                print(f"   Low SNR adapted theta is zero: {'✅' if adapted_zero else '❌'}")
            
            # Check if theta peaks result in higher adapted values
            if "Theta" in test_case['name'] and metrics['thetaSNRPeak'] > 1.0:
                high_adapted = metrics['adaptedTheta'] > 0.3
                print(f"   High theta SNR → high adapted value: {'✅' if high_adapted else '❌'}")
            
            # For first test, smoothed should equal current contribution
            # For subsequent tests, smoothed should be exponentially weighted average
            if results.index(metrics) == 0:
                # First test case - smoothed should equal current contribution  
                smoothed_matches_contrib = abs(metrics['smoothedTheta'] - metrics['thetaContribution']) < 0.1
                print(f"   Smoothed equals contribution (first test): {'✅' if smoothed_matches_contrib else '❌'}")
            else:
                # Check exponential smoothing behavior
                prev_smoothed = results[-2]['smoothedTheta'] if len(results) > 1 else 0
                alpha = 0.3
                expected_smoothed = alpha * metrics['thetaContribution'] + (1 - alpha) * prev_smoothed
                smoothing_correct = abs(metrics['smoothedTheta'] - expected_smoothed) < 0.01
                print(f"   Exponential smoothing correct: {'✅' if smoothing_correct else '❌'}")
            
            # Check expected dominant frequency
            if "Alpha" in test_case['name']:
                is_alpha_dominant = metrics['alphaPower'] > max(metrics['deltaPower'], metrics['thetaPower'], 
                                                              metrics['betaPower'], metrics['gammaPower'])
                print(f"   Alpha is dominant: {'✅' if is_alpha_dominant else '❌'}")
            
            if "Theta" in test_case['name']:
                is_theta_dominant = metrics['thetaPower'] > max(metrics['deltaPower'], metrics['alphaPower'], 
                                                              metrics['betaPower'], metrics['gammaPower'])
                print(f"   Theta is dominant: {'✅' if is_theta_dominant else '❌'}")
            
            if "Constant" in test_case['name']:
                is_zero_power = metrics['totalPower'] < 1e-10
                print(f"   Zero power for constant: {'✅' if is_zero_power else '❌'}")
            
            # Advanced theta metrics validation
            print(f"\n🧠 Advanced Theta Metrics:")
            
            # Test theta peak SNR calculation
            if metrics['thetaSNRPeak'] is not None and np.isfinite(metrics['thetaSNRPeak']):
                snr_quality = "High" if metrics['thetaSNRPeak'] > 2.0 else "Medium" if metrics['thetaSNRPeak'] > 0.5 else "Low"
                print(f"   Theta Peak SNR: {format_number(metrics['thetaSNRPeak'], 2)} ({snr_quality} quality)")
            else:
                print(f"   Theta Peak SNR: Invalid/NaN")
            
            # Test broadband theta SNR
            if metrics['thetaSNRBroad'] is not None and np.isfinite(metrics['thetaSNRBroad']):
                broad_quality = "High" if metrics['thetaSNRBroad'] > 1.0 else "Medium" if metrics['thetaSNRBroad'] > 0.1 else "Low"
                print(f"   Theta Broad SNR: {format_number(metrics['thetaSNRBroad'], 2)} ({broad_quality} quality)")
            else:
                print(f"   Theta Broad SNR: Invalid/NaN")
            
            # Test theta contribution percentage
            theta_contribution_valid = 0 <= metrics['thetaContribution'] <= 100
            print(f"   Theta Contribution: {format_number(metrics['thetaContribution'], 1)}% {'✅' if theta_contribution_valid else '❌'}")
            
            # Test theta relative (should be contribution/100)
            expected_relative = metrics['thetaContribution'] / 100
            relative_matches = abs(metrics['thetaRelative'] - expected_relative) < 0.001
            print(f"   Theta Relative: {format_number(metrics['thetaRelative'], 3)} {'✅' if relative_matches else '❌'}")
            
            # Calculate adapted theta (SNR-based adjustment) - matches Python logic
            if (metrics['thetaSNRPeak'] is not None and np.isfinite(metrics['thetaSNRPeak']) and 
                metrics['thetaSNRPeak'] >= 0.2):
                expected_adapted = metrics['thetaSNRPeak'] / (metrics['thetaSNRPeak'] + 1)
                print(f"   Adapted Theta (expected): {format_number(expected_adapted, 3)} (SNR-normalized)")
                print(f"   Adapted Theta (actual): {format_number(metrics['adaptedTheta'], 3)}")
                
                adapted_matches = abs(metrics['adaptedTheta'] - expected_adapted) < 0.001
                print(f"   Adapted Theta calculation: {'✅' if adapted_matches else '❌'}")
            else:
                print(f"   Adapted Theta (expected): 0.000 (SNR too low)")
                print(f"   Adapted Theta (actual): {format_number(metrics['adaptedTheta'], 3)}")
                
                adapted_is_zero = abs(metrics['adaptedTheta']) < 0.001
                print(f"   Adapted Theta calculation: {'✅' if adapted_is_zero else '❌'}")
            
            # Test exponential smoothing of theta
            print(f"   Smoothed Theta: {format_number(metrics['smoothedTheta'], 3)}")
            smoothed_valid = 0 <= metrics['smoothedTheta'] <= 100
            print(f"   Smoothed Theta valid range: {'✅' if smoothed_valid else '❌'}")
            
            # For first test, smoothed should equal current contribution
            # For subsequent tests, smoothed should be exponentially weighted average
            if "Pure 10Hz Alpha" in test_case['name']:
                # First test case - smoothed should equal current contribution
                smoothed_matches_contrib = abs(metrics['smoothedTheta'] - metrics['thetaContribution']) < 0.1
                print(f"   Smoothed equals contribution (first test): {'✅' if smoothed_matches_contrib else '❌'}")
            
            # Validate theta metrics for specific test cases
            if "Pure 6Hz Theta" in test_case['name']:
                # For pure theta, contribution should be high
                high_theta_contrib = metrics['thetaContribution'] > 70
                print(f"   High theta contribution for pure theta: {'✅' if high_theta_contrib else '❌'}")
                
                # SNR should be very high for pure signal
                high_snr = metrics['thetaSNRPeak'] > 10 if np.isfinite(metrics['thetaSNRPeak']) else False
                print(f"   High SNR for pure theta: {'✅' if high_snr else '❌'}")
            
            elif "Pure 10Hz Alpha" in test_case['name']:
                # For pure alpha, theta contribution should be low
                low_theta_contrib = metrics['thetaContribution'] < 5
                print(f"   Low theta contribution for pure alpha: {'✅' if low_theta_contrib else '❌'}")
            
            elif "Mixed" in test_case['name']:
                # For mixed signals, theta should be present but not dominant
                moderate_theta = 10 < metrics['thetaContribution'] < 60
                print(f"   Moderate theta contribution for mixed: {'✅' if moderate_theta else '❌'}")
            
            elif "Constant" in test_case['name']:
                # For constant signal, theta contribution should be near zero
                near_zero_theta = metrics['thetaContribution'] < 1
                print(f"   Near-zero theta for constant: {'✅' if near_zero_theta else '❌'}")
            
        except Exception as error:
            print(f"❌ Test failed: {str(error)}")
            results.append({
                'testName': test_case['name'],
                'error': str(error)
            })
    
    # Summary
    print(f"\n{'=' * 80}")
    print("TEST SUMMARY")
    print(f"{'=' * 80}")
    
    successful_tests = [r for r in results if 'error' not in r]
    print(f"Successful tests: {len(successful_tests)}/{len(results)}")
    
    # Export results for comparison
    export_data = {
        'platform': "Python",
        'timestamp': datetime.now().isoformat(),
        'config': TEST_CONFIG,
        'results': results
    }
    
    # Convert numpy types for JSON serialization
    def convert_numpy(obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {k: convert_numpy(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_numpy(v) for v in obj]
        return obj
    
    export_data = convert_numpy(export_data)
    
    # Write results to file
    with open('test-results-python.json', 'w') as f:
        json.dump(export_data, f, indent=2)
    print(f"\n📄 Results exported to: test-results-python.json")
    
    # Generate comparison table
    print(f"\n📊 RESULTS TABLE:")
    print(f"{'=' * 120}")
    print(f"{'Test Name':<25} | {'Total':<10} | {'Delta':<10} | {'Theta':<10} | {'Alpha':<10} | {'Beta':<10} | {'Gamma':<10}")
    print(f"{'-' * 120}")
    
    for result in successful_tests:
        name = result['testName'][:24].ljust(25)
        total = format_number(result['totalPower'], 2).ljust(10)
        delta = format_number(result['deltaPower'], 2).ljust(10)
        theta = format_number(result['thetaPower'], 2).ljust(10)
        alpha = format_number(result['alphaPower'], 2).ljust(10)
        beta = format_number(result['betaPower'], 2).ljust(10)
        gamma = format_number(result['gammaPower'], 2).ljust(10)
        
        print(f"{name} | {total} | {delta} | {theta} | {alpha} | {beta} | {gamma}")
    
    return results

if __name__ == "__main__":
    run_tests()
