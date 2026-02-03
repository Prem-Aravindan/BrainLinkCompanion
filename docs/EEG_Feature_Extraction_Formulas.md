# BrainLink EEG Feature Extraction Formulas

## Frequency Bands
- **Delta (δ)**: 0.5 - 4 Hz
- **Theta (θ)**: 4 - 8 Hz  
- **Alpha (α)**: 8 - 13 Hz
- **Beta (β)**: 13 - 30 Hz
- **Gamma (γ)**: 30 - 45 Hz
- **Theta1**: 4 - 6 Hz
- **Theta2**: 6 - 8 Hz
- **Beta1**: 13 - 20 Hz
- **Beta2**: 20 - 30 Hz

## Power Features

### 1. Band Power (Absolute)
```
P_band = ∫(f_low to f_high) PSD(f) df
```

### 2. Band Power (Raw)
```
P_band_raw = ∫(f_low to f_high) PSD_original(f) df
```

### 3. Band Power (Relative)
```
P_relative = P_band / P_total
```

### 4. Total Power
```
P_total = variance(signal)
```

## Peak Features

### 1. Peak Frequency
```
f_peak = argmax(PSD(f)) for f ∈ [f_low, f_high]
```

### 2. Peak Amplitude
```
A_peak = PSD(f_peak)
```

### 3. Peak Relative Amplitude
```
A_peak_rel = A_peak / mean(PSD_band)
```

### 4. Spectral Entropy
```
p(f) = PSD_normalized(f) / sum(PSD_normalized)
H = -∑ p(f) × log₂(p(f))
```

## Ratio Features

### 1. Alpha/Theta Ratio
```
alpha_theta_ratio = P_alpha / P_theta
```

### 2. Beta/Alpha Ratio
```
beta_alpha_ratio = P_beta / P_alpha
```

### 3. Beta2/Beta1 Ratio
```
beta2_beta1_ratio = P_beta2 / P_beta1
```

### 4. Theta2/Theta1 Ratio
```
theta2_theta1_ratio = P_theta2 / P_theta1
```

## Complete Feature List

### Power Features (per band)
- `{band}_power` - SNR-adapted band power
- `{band}_power_raw` - Raw band power  
- `{band}_relative` - Relative band power

### Peak Features (per band)
- `{band}_peak_freq` - Peak frequency in band
- `{band}_peak_amp` - Peak amplitude
- `{band}_peak_rel_amp` - Relative peak amplitude
- `{band}_entropy` - Spectral entropy

### Ratio Features
- `alpha_theta_ratio`
- `beta_alpha_ratio` 
- `beta2_beta1_ratio`
- `theta2_theta1_ratio`

### Global Features
- `total_power` - Signal variance
