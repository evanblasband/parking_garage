# Parking Garage Frontend

React + TypeScript + Tailwind CSS frontend for the variable pricing parking garage demo.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 (requires backend running on port 8000).

## Architecture

```
src/
├── main.tsx              # Entry point, wraps App with GarageProvider
├── App.tsx               # Main layout, assembles all components
├── index.css             # Tailwind v4 theme (World Cup colors)
├── types/
│   └── index.ts          # TypeScript interfaces matching backend Pydantic models
├── context/
│   └── GarageContext.tsx # React Context + useReducer + WebSocket connection
└── components/
    ├── GarageGrid/       # 10x10 CSS Grid visualization
    ├── BookingPanel/     # Slide-out booking flow with price breakdown
    ├── TimeControls/     # Play/pause + time slider (6 AM - 11:59 PM)
    ├── OperatorPanel/    # Metrics dashboard (revenue, occupancy)
    ├── IntroModal/       # Welcome modal, re-openable via "?" button
    └── MobileWarning/    # Desktop-only warning (<1280px)
```

## State Management

All state flows through `GarageContext`:

- **Server state**: `garageState`, `prices`, `metrics` (from WebSocket)
- **UI state**: `selectedSpaceId`, `holdInfo`, `lastBooking`, `error`
- **Connection state**: `isConnected`, `isReconnecting`

The context provides:
- `state` - Current app state
- `dispatch` - Update local state
- `send` - Send WebSocket messages to backend

## WebSocket Connection

The WebSocket connection is managed in `GarageContext`:
- Auto-connects on mount to `ws://localhost:8000/ws`
- Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Dispatches server messages to reducer
- Shows "Reconnecting..." banner during disconnection

## Custom Theme

FIFA World Cup 2026 colors defined in `index.css` using Tailwind v4 `@theme`:

| Token | Color | Usage |
|-------|-------|-------|
| `wc-blue` | #1a1f4e | Primary background |
| `wc-red` | #c41e3a | Accent, warnings |
| `wc-gold` | #d4af37 | Highlights, revenue |
| `wc-white` | #ffffff | Text |
| `wc-dark` | #0d0f1a | Panels, cards |

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Requirements

- Node.js 18+
- Screen width 1280px+ (mobile warning shown otherwise)
- Backend running on port 8000
