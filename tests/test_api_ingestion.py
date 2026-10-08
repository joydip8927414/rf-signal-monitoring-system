import unittest
import os
import json
from unittest.mock import patch, MagicMock

from app import create_app
from config import device_cfg

class TestAPIIngestion(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        os.environ['DEVICE_TOKEN'] = 'secret-token'
        self.app = create_app()
        self.client = self.app.test_client()

    def tearDown(self):
        if 'DEVICE_TOKEN' in os.environ:
            del os.environ['DEVICE_TOKEN']

    def test_valid_authenticated_ingestion(self):
        payload = {
            "signal_dbm": -45.0,
            "noise_dbm": -90.0,
            "snr_db": 45.0,
            "detector_voltage": 1.25,
            "adc_value": 2048,
            "latitude": 26.3452,
            "longitude": 89.4628
        }
        resp = self.client.post(
            "/api/device/measurements",
            json=payload,
            headers={"Authorization": "Bearer secret-token"}
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertTrue(data['success'])
        
        # Verify it updated the latest measurement correctly
        with self.app.app_context():
            iface = self.app.config["DEVICE_INTERFACE"]
            latest = iface.get_latest()
            self.assertEqual(latest.data_source, "real")
            self.assertEqual(latest.signal_dbm, -45.0)

    def test_invalid_device_token(self):
        payload = {"signal_dbm": -50.0}
        resp = self.client.post(
            "/api/device/measurements",
            json=payload,
            headers={"Authorization": "Bearer wrong-token"}
        )
        self.assertEqual(resp.status_code, 401)

    def test_invalid_or_incomplete_measurements(self):
        payload = {"noise_dbm": -90.0} # Missing signal_dbm
        resp = self.client.post(
            "/api/device/measurements",
            json=payload,
            headers={"Authorization": "Bearer secret-token"}
        )
        self.assertEqual(resp.status_code, 400)

    def test_missing_gps_coordinates(self):
        payload = {
            "signal_dbm": -45.0
            # No lat/lng provided
        }
        resp = self.client.post(
            "/api/device/measurements",
            json=payload,
            headers={"Authorization": "Bearer secret-token"}
        )
        self.assertEqual(resp.status_code, 201)
        
        with self.app.app_context():
            iface = self.app.config["DEVICE_INTERFACE"]
            latest = iface.get_latest()
            self.assertIsNone(latest.metadata.get('latitude'))
            self.assertIsNone(latest.metadata.get('longitude'))

    def test_simulator_operation_remaining_unchanged(self):
        # We know simulator works without POST endpoints.
        # This just verifies the driver is unaffected.
        with self.app.app_context():
            iface = self.app.config["DEVICE_INTERFACE"]
            self.assertTrue(iface.is_connected)
            
if __name__ == '__main__':
    unittest.main()
