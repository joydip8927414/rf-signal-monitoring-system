import unittest
from unittest.mock import patch, MagicMock
import os
import time

from config import device_cfg
from device.interface import DeviceInterface, RFMeasurement, get_device_interface
from device.esp32 import ESP32Driver
from device.simulator import SimulatorDriver

class TestDeviceAdapter(unittest.TestCase):
    def test_source_selection_simulator(self):
        with patch.object(device_cfg, 'SOURCE', 'simulator'):
            iface = get_device_interface()
            self.assertIsInstance(iface._driver, SimulatorDriver)

    def test_source_selection_esp32(self):
        with patch.object(device_cfg, 'SOURCE', 'esp32'):
            iface = get_device_interface()
            self.assertIsInstance(iface._driver, ESP32Driver)

    def test_measurement_normalization(self):
        m = RFMeasurement(
            device_id='TEST-001',
            signal_dbm=-45.5,
            noise_dbm=-90.0,
            snr_db=44.5,
            data_source='real',
            metadata={'latitude': 12.34}
        )
        d = m.to_dict()
        self.assertEqual(d['device_id'], 'TEST-001')
        self.assertEqual(d['signal_dbm'], -45.5)
        self.assertEqual(d['data_source'], 'real')
        self.assertEqual(d['metadata']['latitude'], 12.34)
        
        m2 = RFMeasurement.from_dict(d)
        self.assertEqual(m2.signal_dbm, -45.5)

    @patch('requests.Session.get')
    def test_invalid_device_data(self, mock_get):
        # Mocking an invalid response (missing signal_dbm)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"adc_value": 2048}
        mock_get.return_value = mock_resp
        
        driver = ESP32Driver()
        driver._connected = True
        
        m = driver.get_measurement()
        self.assertIsNone(m)

    @patch('requests.Session.get')
    def test_reconnection(self, mock_get):
        # Mocking a connection failure followed by success
        import requests
        mock_get.side_effect = [
            requests.exceptions.ConnectionError("Failed"), # connect() fails
            MagicMock(status_code=200, json=lambda: {"signal_dbm": -50.0}), # get_measurement() succeeds
        ]
        # removed duplicate import
        driver = ESP32Driver()
        self.assertFalse(driver.is_connected)
        
        m = driver.get_measurement()
        # First call fails in connect
        self.assertIsNone(m)
        self.assertFalse(driver.is_connected)
        
        mock_get.side_effect = [
            MagicMock(status_code=200), # connect() succeeds
            MagicMock(status_code=200, json=lambda: {"signal_dbm": -50.0}) # get_measurement() succeeds
        ]
        
        m2 = driver.get_measurement()
        self.assertIsNotNone(m2)
        self.assertTrue(driver.is_connected)

    def test_simulator_behavior(self):
        driver = SimulatorDriver()
        self.assertTrue(driver.connect())
        m = driver.get_measurement()
        self.assertIsNotNone(m)
        self.assertEqual(m.data_source.upper(), 'SIMULATED')
        self.assertIsNotNone(m.signal_dbm)
        self.assertIsNotNone(m.noise_dbm)
        # Verify it doesn't fabricate frequency
        self.assertIsNone(m.frequency_hz)
        
if __name__ == '__main__':
    unittest.main()
