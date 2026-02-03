#!/usr/bin/python

import itertools
import time

import eego_sdk
###############################################################################
def amplifier_to_id(amplifier):
  return '{}-{:06d}-{}'.format(amplifier.getType(), amplifier.getFirmwareVersion(), amplifier.getSerialNumber())
###############################################################################
def test_impedance(amplifier):
  stream = amplifier.OpenImpedanceStream()

  print('stream:')
  print('  channels.... {}'.format(stream.getChannelList()))
  print('  impedances.. {}'.format(list(stream.getData())))
###############################################################################
def test_eeg(amplifier):
  rates = amplifier.getSamplingRatesAvailable()
  ref_ranges = amplifier.getReferenceRangesAvailable()
  bip_ranges = amplifier.getBipolarRangesAvailable()
  rate = rates[0]
  stream = amplifier.OpenEegStream(rate, ref_ranges[0], bip_ranges[0])

  print('stream:')
  print('  rate:       {}'.format(rate))
  print('  channels:   {}'.format(stream.getChannelList()))

  stream_channel_count = len(stream.getChannelList())

  with open('%s-eeg.txt' % (amplifier_to_id(amplifier)), 'w') as eeg_file:
    # get data for 10 seconds, 0.25 seconds in between
    t0 = time.time()
    t1 = t0 + 10
    interval = 0.25
    tnext = t0
    while time.time() < t1:
      tnext = tnext + interval
      delay = tnext - time.time()
      if delay > 0:
        time.sleep(delay)

      try:
        data = stream.getData()
        print('  [{:04.4f}] delay={:03} buffer, channels: {:03} samples: {:03}'.format(time.time() - t0, delay, data.getChannelCount(), data.getSampleCount()))
        for s in range(data.getSampleCount()):
          for c in range(data.getChannelCount()):
            eeg_file.write(' %f' % (data.getSample(c, s)))
          eeg_file.write('\n')
      except Exception as e:
        print('error: {}'.format(e))
###############################################################################
def test_amplifier(amplifier):
  rates = amplifier.getSamplingRatesAvailable()
  ref_ranges = amplifier.getReferenceRangesAvailable()
  bip_ranges = amplifier.getBipolarRangesAvailable()
  print('amplifier: {}'.format(amplifier_to_id(amplifier)))
  print('  rates....... {}'.format(rates))
  print('  ref ranges.. {}'.format(ref_ranges))
  print('  bip ranges.. {}'.format(bip_ranges))
  print('  channels.... {}'.format(amplifier.getChannelList()))

  ps = amplifier.getPowerState()
  print('  power:')
  print('    is powered...... {}'.format(ps.is_powered))
  print('    is charging..... {}'.format(ps.is_charging))
  print('    charging level.. {}'.format(ps.charging_level))

  #
  # test impedance stream
  #
  try:
    test_impedance(amplifier)
  except Exception as e:
    print('stream error: {}'.format(e))

  #
  # test eeg stream
  #
  try:
    test_eeg(amplifier)
  except Exception as e:
    print('stream error: {}'.format(e))
###############################################################################
def test_cascaded(amplifiers):
  n = 2
  while n <= len(amplifiers):
    for l in itertools.permutations(amplifiers):
      selected_amplifiers=[]
      print('cascading permutation:')
      for amplifier in l[:n]:
        selected_amplifiers.append(amplifier)
        print('  amplifier: {}'.format(amplifier_to_id(amplifier)))
      test_amplifier(factory.createCascadedAmplifier(selected_amplifiers))
    n += 1
###############################################################################
if __name__ == '__main__':
  factory = eego_sdk.factory()

  v = factory.getVersion()
  print('version: {}.{}.{}.{}'.format(v.major, v.minor, v.micro, v.build))

  print('delaying to allow slow devices to attach...')
  time.sleep(1)

  amplifiers=factory.getAmplifiers()
  cascaded={}
  for amplifier in amplifiers:
    try:
      test_amplifier(amplifier)

      # add to cascaded dictionary
      if amplifier.getType() not in cascaded:
        cascaded[amplifier.getType()]=[]
      cascaded[amplifier.getType()].append(amplifier)
    except Exception as e:
      print('amplifier({}) error: {}'.format(amplifier_to_id(amplifier), e))

  for key in cascaded:
    n=len(cascaded[key])
    print('cascaded({}) has {} amplifiers: {}'.format(key, n, ', '.join(amplifier_to_id(a) for a in cascaded[key])))
    try:
      if n>1 and hasattr(factory, "createCascadedAmplifier"):
        test_cascaded(cascaded[key])
    except Exception as e:
      print('cascading({}) error: {}'.format(key, e))
