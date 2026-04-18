# 🏁 F1 Dashboard — Live Race Companion Features

This dashboard is now a **true live race companion** — designed to be your go-to tool during race weekends.

## 🔴 Live Session Features

### 1. **Desktop Notifications**
- Automatic notifications when sessions start/end
- Alerts for overtakes in real-time
- Safety car and red flag warnings
- Requires browser notification permission (requested on first load)

### 2. **Live Companion Widget**
- Floating widget in bottom-right corner during live sessions
- Shows top 5 positions in real-time
- Race control messages (safety car, red flags, etc.)
- Minimizable and draggable
- Auto-updates every 5 seconds

### 3. **Dynamic Page Title**
- Browser tab shows live countdown timer during sessions
- Format: `🔴 12:34 | Race | F1 Dashboard`
- Updates every second
- Helps you track time remaining even when tab is in background

### 4. **Keyboard Shortcuts** ⌨️
Quick navigation during live sessions:
- `Alt + D` → Dashboard
- `Alt + R` → Drivers
- `Alt + T` → Constructors (Teams)
- `Alt + C` → Calendar
- `Alt + L` → Telemetry (Live)
- `Alt + A` → Analysis
- `Alt + N` → News Feed
- `?` → Show keyboard shortcuts help
- `Esc` → Close modals

### 5. **Smart Refresh Intervals**
- **Live sessions**: Polls every 5 seconds for positions, overtakes, race control
- **Idle mode**: Checks for session start every 15 seconds
- **Adaptive**: Automatically speeds up/slows down based on session status

### 6. **Audio-Visual Alerts**
- Browser notifications with sound (if enabled)
- Visual pulse animation on live indicator
- Color-coded alerts (red for red flags, yellow for safety car)

## 🎯 How to Use During a Race Weekend

### Before the Session
1. Open the dashboard at `http://localhost:5173`
2. Allow browser notifications when prompted
3. Navigate to Dashboard to see next session countdown

### During Live Session
1. **Live Companion** widget appears automatically in bottom-right
2. **Page title** shows live countdown
3. **Notifications** alert you to key events:
   - Overtakes
   - Safety car
   - Red flags
   - Session end
4. Use **keyboard shortcuts** to quickly jump between pages
5. **Minimize** the companion widget if you need more screen space

### Multi-Tab Usage
- Keep dashboard open in a background tab
- Page title updates let you see time remaining
- Notifications work even when tab is not active
- Perfect for watching the race on TV while monitoring data

## 🔧 Technical Implementation

### New Hooks
- `useNotifications()` — Manages browser notification permissions and display
- `useLiveSession()` — Polls session mode and live data, triggers notifications
- `useKeyboardShortcuts()` — Global keyboard navigation

### New Components
- `LiveCompanion` — Floating live timing widget
- `KeyboardShortcutsHelp` — Modal showing all shortcuts

### Backend Enhancements
- Rate limiting (120 req/min default, 30/min on standings)
- Structured logging for debugging
- Input validation on all endpoints
- Proper error handling and WebSocket cleanup

## 🚀 Future Enhancements (Ideas)

- [ ] Picture-in-Picture mode for live timing (browser API support needed)
- [ ] Audio commentary integration
- [ ] Live sector times comparison
- [ ] Push notifications via service worker (offline support)
- [ ] Multi-driver tracking (follow specific drivers)
- [ ] Lap time delta alerts
- [ ] Pit stop predictions
- [ ] Weather radar integration
- [ ] Social media feed integration
- [ ] Voice commands ("Alexa, show me Hamilton's position")

## 📱 Mobile Considerations

- Live companion widget is responsive (full-width on mobile)
- Keyboard shortcuts disabled on touch devices
- Notifications work on mobile browsers that support them
- Consider installing as PWA for better mobile experience

## 🎨 Customization

All live companion styles are in `src/styles.css`:
- `.live-companion` — Main widget
- `.live-companion-alert` — Race control alerts
- `.live-companion-positions` — Position list

Colors and animations can be customized via CSS variables in `:root`.

## 🐛 Troubleshooting

**Notifications not working?**
- Check browser notification permissions in settings
- Some browsers block notifications on localhost — try 127.0.0.1 instead
- Notifications require HTTPS in production

**Live companion not appearing?**
- Check that backend is running (`http://localhost:8000`)
- Verify there's an active F1 session (check OpenF1 API)
- Open browser console for error messages

**Keyboard shortcuts not working?**
- Make sure you're not focused in an input field
- Try clicking on the page background first
- Check browser console for conflicts with extensions

---

**Enjoy the race! 🏎️💨**
