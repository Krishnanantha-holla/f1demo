# F1 Dashboard Frontend

React + Vite frontend for the F1 live companion dashboard.

## Scripts

- `npm run dev` - start local development server
- `npm run build` - production build
- `npm run preview` - preview production build locally
- `npm run lint` - run ESLint

## Environment

- `VITE_API_BASE_URL` (optional): backend API base, default `http://localhost:8000/api`
- `VITE_USE_LIVE_WS` (optional): set to `true` to use backend WebSocket live stream (`/ws/live`)
- `VITE_WS_BASE` (optional): override WS host, e.g. `ws://127.0.0.1:8000`

## Local Development

1. Start backend API on port `8000`.
2. Run:
   ```bash
   npm install
   npm run dev
   ```
3. Open the Vite URL printed in terminal (usually `http://localhost:5173`).
