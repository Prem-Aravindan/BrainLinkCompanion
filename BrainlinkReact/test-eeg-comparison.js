/**
 * Comprehensive EEG Processing Test Script - JavaScript
 * Tests the JavaScript implementation against known test signals
 */

const { createEEGProcessor } = require('./utils/eegProcessing.js');

// Test configuration
const TEST_CONFIG = {
  fs: 512,
  duration: 1.0, // 1 second
  numSamples: 512,
  testCases: [
    {
      name: "Pure 10Hz Alpha Wave",
      frequencies: [{ freq: 10, amplitude: 20, phase: 0 }],
      noise: 0
    },
    {
      name: "Pure 6Hz Theta Wave", 
      frequencies: [{ freq: 6, amplitude: 15, phase: 0 }],
      noise: 0
    },
    {
      name: "Mixed Alpha + Theta",
      frequencies: [
        { freq: 10, amplitude: 20, phase: 0 },
        { freq: 6, amplitude: 15, phase: Math.PI/4 }
      ],
      noise: 2
    },
    {
      name: "Realistic EEG Mix",
      frequencies: [
        { freq: 2, amplitude: 8, phase: 0 },      // Delta
        { freq: 6, amplitude: 15, phase: 0 },     // Theta  
        { freq: 10, amplitude: 25, phase: 0 },    // Alpha (dominant)
        { freq: 20, amplitude: 10, phase: 0 },    // Beta
        { freq: 35, amplitude: 5, phase: 0 }      // Gamma
      ],
      noise: 3
    },
    {
      name: "Constant Signal (should produce zero power)",
      constant: 10.0,
      noise: 0
    },
    {
      name: "High SNR Theta Wave (clean 7Hz)",
      frequencies: [{ freq: 7, amplitude: 30, phase: 0 }],
      noise: 1
    },
    {
      name: "Low SNR Theta in Noise",
      frequencies: [{ freq: 6.5, amplitude: 5, phase: 0 }],
      noise: 10
    },
    {
      name: "Theta with Strong Alpha Competition",
      frequencies: [
        { freq: 6, amplitude: 10, phase: 0 },     // Theta
        { freq: 10, amplitude: 40, phase: 0 }     // Dominant Alpha
      ],
      noise: 2
    }
  ]
};

/**
 * Generate synthetic EEG test signal
 */
function generateTestSignal(testCase, config) {
  const data = [];
  const dt = 1.0 / config.fs;
  
  for (let i = 0; i < config.numSamples; i++) {
    const t = i * dt;
    let value = 0;
    
    if (testCase.constant !== undefined) {
      // Constant signal
      value = testCase.constant;
    } else {
      // Sum of sinusoids
      for (const component of testCase.frequencies) {
        value += component.amplitude * Math.sin(2 * Math.PI * component.freq * t + component.phase);
      }
    }
    
    // Add noise
    if (testCase.noise > 0) {
      value += (Math.random() - 0.5) * 2 * testCase.noise;
    }
    
    data.push(value);
  }
  
  return data;
}

/**
 * Format number for consistent output
 */
function formatNumber(num, decimals = 4) {
  if (num === null || num === undefined) return "null";
  if (!isFinite(num)) {
    if (num === Number.POSITIVE_INFINITY) return "inf";
    if (num === Number.NEGATIVE_INFINITY) return "-inf";
    return "nan";
  }
  return num.toFixed(decimals);
}

/**
 * Run comprehensive test suite
 */
function runTests() {
  console.log("=" * 80);
  console.log("JavaScript EEG Processing Test Suite");
  console.log("=" * 80);
  
  const processor = createEEGProcessor(TEST_CONFIG.fs);
  const results = [];
  
  for (const testCase of TEST_CONFIG.testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log("-" * 60);
    
    try {
      // Generate test signal
      const testData = generateTestSignal(testCase, TEST_CONFIG);
      
      // Log test signal statistics
      const mean = testData.reduce((sum, val) => sum + val, 0) / testData.length;
      const variance = testData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / testData.length;
      const std = Math.sqrt(variance);
      const min = Math.min(...testData);
      const max = Math.max(...testData);
      
      console.log(`📊 Test Signal Stats:`);
      console.log(`   Samples: ${testData.length}`);
      console.log(`   Mean: ${formatNumber(mean)}`);
      console.log(`   Std: ${formatNumber(std)}`);
      console.log(`   Range: [${formatNumber(min)}, ${formatNumber(max)}]`);
      console.log(`   First 5: [${testData.slice(0, 5).map(v => formatNumber(v, 2)).join(', ')}]`);
      
      // Process with EEG pipeline
      const result = processor.process(testData);
      
      // Extract key metrics
      const metrics = {
        testName: testCase.name,
        totalPower: result.payload['Total variance (power)'],
        deltaPower: result.payload['Delta power'],
        thetaPower: result.payload['Theta power'],
        alphaPower: result.payload['Alpha power'],
        betaPower: result.payload['Beta power'],
        gammaPower: result.payload['Gamma power'],
        thetaContribution: result.payload['Theta contribution'],
        thetaRelative: result.payload['Theta relative'],
        thetaSNRBroad: result.payload['Theta SNR broad'],
        thetaSNRPeak: result.payload['Theta SNR peak'],
        adaptedTheta: result.thetaMetrics.adaptedTheta,
        smoothedTheta: result.thetaMetrics.smoothedTheta,
        psdLength: result.psd.length,
        freqsLength: result.freqs.length,
        maxFreq: Math.max(...result.freqs),
        psdSum: result.psd.reduce((sum, val) => sum + val, 0)
      };
      
      results.push(metrics);
      
      // Display results
      console.log(`\n📈 Processing Results:`);
      console.log(`   Total Power (Variance): ${formatNumber(metrics.totalPower)}`);
      console.log(`   Delta Power (0.5-4 Hz): ${formatNumber(metrics.deltaPower)}`);
      console.log(`   Theta Power (4-8 Hz):   ${formatNumber(metrics.thetaPower)}`);
      console.log(`   Alpha Power (8-12 Hz):  ${formatNumber(metrics.alphaPower)}`);
      console.log(`   Beta Power (12-30 Hz):  ${formatNumber(metrics.betaPower)}`);
      console.log(`   Gamma Power (30-45 Hz): ${formatNumber(metrics.gammaPower)}`);
      console.log(`   Theta Contribution:     ${formatNumber(metrics.thetaContribution)}%`);
      console.log(`   Theta Relative:         ${formatNumber(metrics.thetaRelative)}`);
      console.log(`   Theta SNR Broad:        ${formatNumber(metrics.thetaSNRBroad)}`);
      console.log(`   Theta SNR Peak:         ${formatNumber(metrics.thetaSNRPeak)}`);
      console.log(`   PSD Length:             ${metrics.psdLength}`);
      console.log(`   Freq Range:             0 - ${formatNumber(metrics.maxFreq)} Hz`);
      console.log(`   PSD Total Power:        ${formatNumber(metrics.psdSum)}`);
      
      // Validate results
      console.log(`\n✅ Validation:`);
      
      // Check for NaN values
      const hasNaN = Object.values(metrics).some(val => 
        typeof val === 'number' && (isNaN(val) && isFinite(val) === false && val !== Number.POSITIVE_INFINITY)
      );
      console.log(`   No NaN values: ${!hasNaN ? '✅' : '❌'}`);
      
      // Check power conservation
      const bandSum = metrics.deltaPower + metrics.thetaPower + metrics.alphaPower + 
                     metrics.betaPower + metrics.gammaPower;
      const powerRatio = bandSum / metrics.totalPower;
      console.log(`   Band power sum/total: ${formatNumber(powerRatio)}`);
      
      // Check expected dominant frequency
      if (testCase.name.includes("Alpha")) {
        const isAlphaDominant = metrics.alphaPower > Math.max(metrics.deltaPower, metrics.thetaPower, metrics.betaPower, metrics.gammaPower);
        console.log(`   Alpha is dominant: ${isAlphaDominant ? '✅' : '❌'}`);
      }
      
      if (testCase.name.includes("Theta")) {
        const isThetaDominant = metrics.thetaPower > Math.max(metrics.deltaPower, metrics.alphaPower, metrics.betaPower, metrics.gammaPower);
        console.log(`   Theta is dominant: ${isThetaDominant ? '✅' : '❌'}`);
      }
      
      if (testCase.name.includes("Constant")) {
        const isZeroPower = metrics.totalPower < 1e-10;
        console.log(`   Zero power for constant: ${isZeroPower ? '✅' : '❌'}`);
      }
      
      // Advanced theta metrics validation
      console.log(`\n🧠 Advanced Theta Metrics:`);
      
      // Test theta peak SNR calculation
      if (metrics.thetaSNRPeak !== null && isFinite(metrics.thetaSNRPeak)) {
        const snrQuality = metrics.thetaSNRPeak > 2.0 ? "High" : 
                          metrics.thetaSNRPeak > 0.5 ? "Medium" : "Low";
        console.log(`   Theta Peak SNR: ${formatNumber(metrics.thetaSNRPeak, 2)} (${snrQuality} quality)`);
      } else {
        console.log(`   Theta Peak SNR: Invalid/NaN`);
      }
      
      // Test broadband theta SNR
      if (metrics.thetaSNRBroad !== null && isFinite(metrics.thetaSNRBroad)) {
        const broadQuality = metrics.thetaSNRBroad > 1.0 ? "High" : 
                            metrics.thetaSNRBroad > 0.1 ? "Medium" : "Low";
        console.log(`   Theta Broad SNR: ${formatNumber(metrics.thetaSNRBroad, 2)} (${broadQuality} quality)`);
      } else {
        console.log(`   Theta Broad SNR: Invalid/NaN`);
      }
      
      // Test theta contribution percentage
      const thetaContributionValid = metrics.thetaContribution >= 0 && metrics.thetaContribution <= 100;
      console.log(`   Theta Contribution: ${formatNumber(metrics.thetaContribution, 1)}% ${thetaContributionValid ? '✅' : '❌'}`);
      
      // Test theta relative (should be contribution/100)
      const expectedRelative = metrics.thetaContribution / 100;
      const relativeMatches = Math.abs(metrics.thetaRelative - expectedRelative) < 0.001;
      console.log(`   Theta Relative: ${formatNumber(metrics.thetaRelative, 3)} ${relativeMatches ? '✅' : '❌'}`);
      
      // Calculate adapted theta (SNR-based adjustment) - matches Python logic
      if (metrics.thetaSNRPeak !== null && isFinite(metrics.thetaSNRPeak) && 
          metrics.thetaSNRPeak >= 0.2) {
        const expectedAdapted = metrics.thetaSNRPeak / (metrics.thetaSNRPeak + 1);
        console.log(`   Adapted Theta (expected): ${formatNumber(expectedAdapted, 3)} (SNR-normalized)`);
        console.log(`   Adapted Theta (actual): ${formatNumber(metrics.adaptedTheta, 3)}`);
        
        const adaptedMatches = Math.abs(metrics.adaptedTheta - expectedAdapted) < 0.001;
        console.log(`   Adapted Theta calculation: ${adaptedMatches ? '✅' : '❌'}`);
      } else {
        console.log(`   Adapted Theta (expected): 0.000 (SNR too low)`);
        console.log(`   Adapted Theta (actual): ${formatNumber(metrics.adaptedTheta, 3)}`);
        
        const adaptedIsZero = Math.abs(metrics.adaptedTheta) < 0.001;
        console.log(`   Adapted Theta calculation: ${adaptedIsZero ? '✅' : '❌'}`);
      }
      
      // Test exponential smoothing of theta
      console.log(`   Smoothed Theta: ${formatNumber(metrics.smoothedTheta, 3)}`);
      const smoothedValid = metrics.smoothedTheta >= 0 && metrics.smoothedTheta <= 100;
      console.log(`   Smoothed Theta valid range: ${smoothedValid ? '✅' : '❌'}`);
      
      // For first test, smoothed should equal current contribution
      // For subsequent tests, smoothed should be exponentially weighted average
      if (testCase.name.includes("Pure 10Hz Alpha")) {
        // First test case - smoothed should equal current contribution
        const smoothedMatchesContrib = Math.abs(metrics.smoothedTheta - metrics.thetaContribution) < 0.1;
        console.log(`   Smoothed equals contribution (first test): ${smoothedMatchesContrib ? '✅' : '❌'}`);
      }
      
      // Validate theta metrics for specific test cases
      if (testCase.name.includes("Pure 6Hz Theta")) {
        // For pure theta, contribution should be high
        const highThetaContrib = metrics.thetaContribution > 70;
        console.log(`   High theta contribution for pure theta: ${highThetaContrib ? '✅' : '❌'}`);
        
        // SNR should be very high for pure signal
        const highSNR = isFinite(metrics.thetaSNRPeak) && metrics.thetaSNRPeak > 10;
        console.log(`   High SNR for pure theta: ${highSNR ? '✅' : '❌'}`);
      }
      
      else if (testCase.name.includes("Pure 10Hz Alpha")) {
        // For pure alpha, theta contribution should be low
        const lowThetaContrib = metrics.thetaContribution < 5;
        console.log(`   Low theta contribution for pure alpha: ${lowThetaContrib ? '✅' : '❌'}`);
      }
      
      else if (testCase.name.includes("Mixed")) {
        // For mixed signals, theta should be present but not dominant
        const moderateTheta = metrics.thetaContribution > 10 && metrics.thetaContribution < 60;
        console.log(`   Moderate theta contribution for mixed: ${moderateTheta ? '✅' : '❌'}`);
      }
      
      else if (testCase.name.includes("Constant")) {
        // For constant signal, theta contribution should be near zero
        const nearZeroTheta = metrics.thetaContribution < 1;
        console.log(`   Near-zero theta for constant: ${nearZeroTheta ? '✅' : '❌'}`);
      }
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      results.push({
        testName: testCase.name,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log(`\n${"=" * 80}`);
  console.log("TEST SUMMARY");
  console.log(`${"=" * 80}`);
  
  const successfulTests = results.filter(r => !r.error);
  console.log(`Successful tests: ${successfulTests.length}/${results.length}`);
  
  // Export results for comparison
  const exportData = {
    platform: "JavaScript",
    timestamp: new Date().toISOString(),
    config: TEST_CONFIG,
    results: results
  };
  
  // Write results to file
  const fs = require('fs');
  fs.writeFileSync('test-results-javascript.json', JSON.stringify(exportData, null, 2));
  console.log(`\n📄 Results exported to: test-results-javascript.json`);
  
  // Generate comparison table
  console.log(`\n📊 RESULTS TABLE:`);
  console.log(`${"=" * 120}`);
  console.log(`${"Test Name".padEnd(25)} | ${"Total".padEnd(10)} | ${"Delta".padEnd(10)} | ${"Theta".padEnd(10)} | ${"Alpha".padEnd(10)} | ${"Beta".padEnd(10)} | ${"Gamma".padEnd(10)}`);
  console.log(`${"-" * 120}`);
  
  for (const result of successfulTests) {
    const name = result.testName.substring(0, 24).padEnd(25);
    const total = formatNumber(result.totalPower, 2).padEnd(10);
    const delta = formatNumber(result.deltaPower, 2).padEnd(10);
    const theta = formatNumber(result.thetaPower, 2).padEnd(10);
    const alpha = formatNumber(result.alphaPower, 2).padEnd(10);
    const beta = formatNumber(result.betaPower, 2).padEnd(10);
    const gamma = formatNumber(result.gammaPower, 2).padEnd(10);
    
    console.log(`${name} | ${total} | ${delta} | ${theta} | ${alpha} | ${beta} | ${gamma}`);
  }
  
  return results;
}

// Run the tests
if (require.main === module) {
  runTests();
}

module.exports = { runTests, generateTestSignal, TEST_CONFIG };
