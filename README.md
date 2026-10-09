# RF Monitor

![RF Monitor Dashboard] -
![Hardware] - 

**RF Monitor** is a professional-grade Radio Frequency (RF) measurement and analysis dashboard. It ingests live broadband power measurements from a custom ESP32-based hardware node (AD8318 RF detector + NEO-7M GPS) or a built-in simulator, processes the data through a machine-learning anomaly detection pipeline, and visualizes the results on a real-time, responsive React dashboard.

---

##  Features

*   **Real-time RF Dashboard:** Live metrics including Signal Power (dBm), Noise (dBm), SNR, and ADC voltage.
*   **Hardware & Simulator Modes:** Seamlessly switch between a physical ESP32 data source and a software simulator for development and testing.
*   **AI Anomaly Detection:** Real-time inference using an Isolation Forest model to detect statistical deviations and potential RF interference/jammers.
*   **Interactive Coverage Map:** Leaflet + OpenStreetMap integration to map GPS-tagged RF measurements and track geographical signal strength.
*   **RF Copilot:** A built-in chat assistant that can summarize 5-minute/60-minute averages, compare periods, and explain ML anomalies using the live SQLite database.
*   **Data Ingestion API:** A secure `POST /api/device/measurements` endpoint designed for hosted architectures where the ESP32 pushes data to the cloud.

---

##  Architecture

The project consists of a **React/Vite Frontend** and a **Flask Backend**.

```text
ESP32 (Hardware)
   │ (HTTPS POST)
   ▼
Flask Backend ──▶ SQLite Database (Data Persistence)
   │
   └─▶ ML Pipeline (Isolation Forest)
   │
   ▼ (REST API / JSON)
React Frontend (Vite)
```

### Directory Structure
*   **`frontend/`**: React + Vite UI application.
*   **`api/`**: Flask API routes (`routes.py`).
*   **`database/`**: SQLite initialization and queries.
*   **`device/`**: Hardware abstraction (`esp32.py`, `simulator.py`).
*   **`ml/`**: Machine learning models and training scripts.
*   **`rf_processing/`**: Signal processing logic.

---

##  Getting Started & Configuration

### Prerequisites
*   **Python 3.10+**
*   **Node.js 18+** & `npm`

### Local SQLite Setup (Default)
By default, the application runs on SQLite. This requires zero configuration.
1. Create a virtual environment: `python -m venv venv313`
2. Activate it and install dependencies: `pip install -r requirements.txt`
3. Run the backend: `python app.py`
4. In another terminal, run frontend: `cd frontend && npm install && npm run dev`

### PostgreSQL Setup (Production)
For production (e.g., Render), the application automatically switches to PostgreSQL when `DATABASE_URL` is detected.
1. Provision a PostgreSQL database.
2. Set `DATABASE_URL=postgres://user:pass@host/dbname` in your environment.
3. The application will automatically create the PostgreSQL schema on startup if it doesn't exist.

### Required Environment Variables
A sample `.env.example` file is provided. Key variables:
*   `DATABASE_URL`: PostgreSQL connection string (leaves blank for SQLite).
*   `DEVICE_TOKEN`: Secret token for ESP32 API ingestion.
*   `CORS_ORIGINS`: Allowed frontend origins (e.g., `https://rf-frontend.vercel.app`).
*   `VITE_API_BASE` (Frontend): The URL of your deployed Flask API.

---

##  Deployment

### Render Backend Deployment
1. Connect your GitHub repository to Render.
2. Create a **Web Service**.
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `gunicorn -w 1 -b 0.0.0.0:$PORT app:app` (Important: use only 1 worker due to hardware polling).
5. Ensure `DATABASE_URL`, `CORS_ORIGINS`, and `DEVICE_TOKEN` are set in the Render Environment tab.

### Vercel Frontend Deployment
1. Connect the `frontend/` directory to Vercel.
2. **Framework Preset:** Vite
3. **Environment Variable:** Set `VITE_API_BASE` to your Render backend URL (e.g., `https://my-rf-api.onrender.com`). No trailing slash.

---

## 🗄️ Database Migration & Backup

### Migrating SQLite to PostgreSQL
If you have existing data in SQLite and want to move to PostgreSQL:
1. Ensure both `data/rf_monitor.db` exists and `DATABASE_URL` is set in your terminal.
2. Run the safe migration utility:
   ```bash
   python scripts/migrate_sqlite_to_postgres.py
   ```
   *Note: This script will NOT overwrite existing Postgres data or delete the SQLite file.*

### Backup and Recovery
*   **SQLite:** Simply copy the `data/rf_monitor.db` file.
*   **PostgreSQL:** Use `pg_dump` provided by your hosting provider to backup the cloud database.

---

##  Testing

The project includes a comprehensive Python test suite for the device drivers and API ingestion.

To run the local tests (uses SQLite by default):
```bash
python -m unittest discover tests
```

---

##  License

This project is licensed under the MIT License.

