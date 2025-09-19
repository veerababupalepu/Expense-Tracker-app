# Expense Tracker (Flask + MySQL + HTML/CSS/JS)

A responsive expense tracker with totals, CRUD, category filter, and a Chart.js doughnut chart.

## Features
- Add, edit, delete entries (income or expense)
- Shows total income, expenses, and balance
- Category filter and spending-by-category chart
- Persists to MySQL via Flask API
- LocalStorage cache for offline/refresh resilience
- Responsive layout (CSS Grid/Flex)

## Backend Setup (Windows PowerShell)
1. Create and populate a MySQL database:
```sql
CREATE DATABASE IF NOT EXISTS expense_tracker CHARACTER SET utf8mb4;
USE expense_tracker;
-- Then run backend/migrations/schema.sql
```
2. Create a virtual environment and install deps:
```powershell
cd "backend"
python -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
3. Configure environment variables (create `.env` in `backend/`):
```
FLASK_DEBUG=1
FLASK_RUN_HOST=0.0.0.0
FLASK_RUN_PORT=5000
SECRET_KEY=change-me
DB_HOST=localhost
DB_PORT=3306
DB_NAME=expense_tracker
DB_USER=root
DB_PASSWORD=your_password
CORS_ORIGINS=*
```
4. Run the API:
```powershell
python wsgi.py
```
API will start at http://localhost:5000

## Frontend Setup
Simply open `frontend/index.html` in your browser. For best results, serve it with a simple HTTP server so CORS and relative paths work smoothly.

Example using PowerShell (Python 3):
```powershell
cd "frontend"
python -m http.server 8080
```
Then visit http://localhost:8080

## API Endpoints
- GET `/api/expenses?category=Food` — list
- POST `/api/expenses` — create `{title, amount, date, category, type}`
- PUT `/api/expenses/:id` — update any subset of fields
- DELETE `/api/expenses/:id` — delete
- GET `/api/summary` — `{income, expense, balance, byCategory}`

## Notes
- Update `API_BASE` in `frontend/assets/app.js` if backend runs on a different host/port.
- Basic validation on both client and server. Amount must be a number; required fields enforced.
- Chart.js is pulled from a CDN.


