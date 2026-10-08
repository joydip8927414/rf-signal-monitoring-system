"""
Basic smoke tests for the RF Monitor application.
Run with: venv313/Scripts/python.exe -m unittest discover tests
"""

import json
import os
import sys
import time
import unittest
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class TestRFMonitorApp(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        os.environ['RF_SOURCE'] = 'simulator'
        os.environ['DB_ECHO'] = 'false'
        from app import create_app
        app = create_app()
        app.config['TESTING'] = True
        cls.client = app.test_client()

    def test_health(self):
        rv = self.client.get('/api/health')
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data)
        self.assertEqual(data['status'], 'ok')

    def test_device_status(self):
        rv = self.client.get('/api/device/status')
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data)
        self.assertIn('device_id', data)

    def test_ai_status(self):
        rv = self.client.get('/api/ai/status')
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data)
        self.assertIn('model_name', data)

    def test_measurements_history(self):
        time.sleep(0.5)
        rv = self.client.get('/api/measurements/history?minutes=1&limit=10')
        self.assertEqual(rv.status_code, 200)

    def test_events_endpoint(self):
        rv = self.client.get('/api/events')
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data)
        self.assertIn('data', data)

    def test_export_json(self):
        rv = self.client.get('/api/export?format=json&minutes=1')
        self.assertEqual(rv.status_code, 200)

    def test_settings(self):
        rv = self.client.get('/api/settings')
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data)
        self.assertIn('data_source', data)


if __name__ == '__main__':
    unittest.main()
