import unittest
import math
from device.simulator import SimulatorDriver, SIMULATION_SCENARIOS


class TestPhysicsSimulator(unittest.TestCase):
    def setUp(self):
        self.driver = SimulatorDriver()
        self.driver.connect()

    def test_baseline_physical_consistency(self):
        self.driver.apply_scenario('baseline')
        m = self.driver.get_measurement()
        self.assertIsNotNone(m)
        self.assertEqual(m.data_source, 'SIMULATED')
        
        # Power around -40 dBm ± 4 dB
        self.assertGreaterEqual(m.signal_dbm, -48.0)
        self.assertLessEqual(m.signal_dbm, -34.0)

        # Noise floor around -95 dBm ± 3 dB
        self.assertGreaterEqual(m.noise_dbm, -100.0)
        self.assertLessEqual(m.noise_dbm, -90.0)

        # SNR = Signal - Noise
        expected_snr = round(m.signal_dbm - m.noise_dbm, 2)
        self.assertAlmostEqual(m.snr_db, expected_snr, delta=0.1)

        # AD8317 transfer function: V_det = -0.025 * (signal_dbm - (-60.0)) + 0.5
        expected_vdet = -0.025 * (m.signal_dbm - (-60.0)) + 0.5
        expected_vdet = max(0.0, min(2.5, expected_vdet))
        self.assertAlmostEqual(m.detector_voltage, expected_vdet, delta=0.01)

        # 12-bit ADC quantization
        expected_adc = int(expected_vdet / 3.3 * 4095)
        self.assertAlmostEqual(m.adc_value, expected_adc, delta=2)

    def test_distance_path_loss_effect(self):
        # 1m distance vs 10m distance with n=2.0 -> ~20 dB loss
        self.driver.update_config({
            'distance_m': 1.0,
            'path_loss_exponent': 2.0,
            'wall_attenuation_db': 0.0,
            'num_walls': 0,
            'signal_variation_std_db': 0.0,
            'fading_depth_db': 0.0
        })
        m_near = self.driver.get_measurement()

        self.driver.update_config({
            'distance_m': 10.0,
            'path_loss_exponent': 2.0,
            'wall_attenuation_db': 0.0,
            'num_walls': 0,
            'signal_variation_std_db': 0.0,
            'fading_depth_db': 0.0
        })
        m_far = self.driver.get_measurement()

        # Path loss should be approximately 20 dB lower at 10m than 1m
        diff = m_near.signal_dbm - m_far.signal_dbm
        self.assertAlmostEqual(diff, 20.0, delta=1.0)
        # Detector voltage should INCREASE when power drops (negative slope)
        self.assertGreater(m_far.detector_voltage, m_near.detector_voltage)

    def test_obstacle_attenuation_effect(self):
        self.driver.update_config({
            'distance_m': 2.0,
            'wall_attenuation_db': 0.0,
            'num_walls': 0,
            'signal_variation_std_db': 0.0,
            'fading_depth_db': 0.0
        })
        m_clear = self.driver.get_measurement()

        self.driver.update_config({
            'distance_m': 2.0,
            'wall_attenuation_db': 15.0,
            'num_walls': 2,
            'signal_variation_std_db': 0.0,
            'fading_depth_db': 0.0
        })
        m_blocked = self.driver.get_measurement()

        # 2 walls * 15 dB = 30 dB drop
        diff = m_clear.signal_dbm - m_blocked.signal_dbm
        self.assertAlmostEqual(diff, 30.0, delta=1.0)

    def test_interference_raising_noise_floor(self):
        self.driver.update_config({
            'noise_floor_dbm': -95.0,
            'interference_level_dbm': -120.0,
            'signal_variation_std_db': 0.0,
            'fading_depth_db': 0.0
        })
        m_clean = self.driver.get_measurement()

        self.driver.update_config({
            'noise_floor_dbm': -95.0,
            'interference_level_dbm': -65.0,  # strong interferer
            'signal_variation_std_db': 0.0,
            'fading_depth_db': 0.0
        })
        m_interfered = self.driver.get_measurement()

        # Effective noise floor should rise near -65 dBm
        self.assertAlmostEqual(m_interfered.noise_dbm, -65.0, delta=1.0)
        # SNR should drop noticeably
        self.assertLess(m_interfered.snr_db, m_clean.snr_db - 20.0)

    def test_device_outage_scenario(self):
        self.driver.apply_scenario('device_outage')
        m = self.driver.get_measurement()
        self.assertIsNone(m)
        status = self.driver.get_status()
        self.assertEqual(status['status'], 'offline')
        self.assertFalse(status['connected'])

        # Recovery scenario restores measurements
        self.driver.apply_scenario('recovery')
        m_rec = self.driver.get_measurement()
        self.assertIsNotNone(m_rec)
        self.assertTrue(self.driver.get_status()['connected'])


if __name__ == '__main__':
    unittest.main()
