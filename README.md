# Bull & Bear: A Telegram Mini App Trading Game

A real-time multiplayer card game built for Telegram Mini Apps where players manage stock portfolios across four market sectors, using strategic card placement and AI opponents to maximize profits.

## 🎮 Game Overview

**Bull & Bear** is a competitive trading card game where 2–5 players (human + AI) manage investment portfolios across four sectors: **Technology**, **Finance**, **Energy**, and **Pharma**.

### Gameplay Loop

Each turn, players allocate three cards:
1. **Portfolio** – Add to personal portfolio for scoring
2. **Market** – Place in sector markets to influence bull/bear sentiment
3. **Opponent** – Play cards to disrupt opponents' strategies

Players earn points based on portfolio alignment with final market sentiment. Strategic placement, sector prediction, and timely disruption determine victory.

### Key Features

- **Live Multiplayer** – Real-time gameplay via WebSocket (Socket.io)
- **AI Opponents** – Four distinct personality profiles with unique strategies
- **Telegram Integration** – Play directly in Telegram Mini App with secure authentication
- **Dynamic Market** – Bull/bear index shifts as cards are played
- **Persistent Games** – Progress saved to database for reconnection
- **Responsive UI** – Works on mobile and desktop with Tailwind CSS

---

## 🤖 AI Personalities

### **Hunter** – Aggressive Disruptor
Prioritizes **hostile takeovers** and market sabotage. Targets the leader, places bear cards in sectors where opponents have holdings, removes high-value assets.

### **Jess** – Mission-Focused Builder
Pursues **sector missions** aligned with personal strategy. Places bull cards to boost portfolio scoring, avoids hostile takeovers, targets weakest opponent.

### **Mandy** – Market Chaos Agent
Destabilizes **high-activity sectors**. Flips market sentiment opposite to current direction, creates volatility, focuses on opponent with most cards in target sector.

### **Ruth** – Adaptive Strategist
Changes approach based on position:
- **Trailing** → Hunts (aggressive)
- **Leading** → Builds (defensive)
- **Midpack** → Balances mission + market leverage

---

## 🏗️ Tech Stack

### Backend
- **Node.js** with Express
- **Socket.io** – Real-time WebSocket communication
- **Telegram Bot API** – Mini App authentication (`telegramAuth.js`)
- **ES Modules** – Modern JavaScript architecture

### Frontend
- **React 18** – Component-driven UI
- **Vite** – Lightning-fast build tooling
- **Tailwind CSS** – Utility-first styling
- **Socket.io Client** – Live game synchronization

### Deployment
- **Railway** – Containerized deployment
- **Telegram Mini App SDK** – Browser WebApp integration

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (check with `node -v`)
- npm or yarn
- Telegram Bot (for Mini App setup)

### Installation

```bash
# Clone repository
git clone https://github.com/syncpartners1/Bull-Bear-Game.git
cd Bull-Bear-Game

# Install dependencies
npm install

# Install in subdirectories if using separate client/server
cd server && npm install
cd ../client && npm install
```

### Local Development

#### Start Backend Server
```bash
cd server
npm run dev  # or: npm start
# Server runs on http://localhost:3000
```

#### Start Frontend Dev Server
```bash
cd client
npm run dev
# Frontend runs on http://localhost:5173 (Vite default)
```

#### Browser Testing (without Telegram)
The app supports browser access without Telegram authentication:
1. Navigate to `http://localhost:5173`
2. Enter a name and Telegram ID (can be any string for testing)
3. Create or join a game lobby

#### Telegram Mini App Testing
1. Set `BOT_TOKEN` in `.env` for your Telegram bot
2. Use Telegram BotFather to create a Mini App link
3. Test via Telegram client

### Environment Variables

**`.env` (Server)**
```
PORT=3000
NODE_ENV=development
TELEGRAM_BOT_TOKEN=<your-bot-token>
```

**`.env` (Client)**
```
VITE_API_URL=http://localhost:3000
```

---

## 📁 Project Structure

```
Bull-Bear-Game/
├── server/
│   ├── src/
│   │   ├── server.js              # Express app entry point
│   │   ├── socketHandlers.js      # WebSocket event handlers
│   │   ├── gameEngine.js          # Core game logic (card allocation, scoring)
│   │   ├── gameState.js           # Game/lobby state management
│   │   ├── aiPlayer.js            # AI decision functions (4 profiles)
│   │   ├── telegramAuth.js        # Telegram Mini App authentication
│   │   ├── missions.js            # Mission card definitions
│   │   └── ...
│   ├── package.json
│   └── Dockerfile
│
├── client/
│   ├── src/
│   │   ├── App.jsx                # Main app component
│   │   ├── components/
│   │   │   ├── Board.jsx          # Game board layout
│   │   │   ├── Hand.jsx           # Player hand & turn controls
│   │   │   ├── MarketTrack.jsx    # Sector market display
│   │   │   ├── Portfolio.jsx      # Player portfolio
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── GameContext.jsx    # Global game state (React Context)
│   │   ├── hooks/
│   │   │   ├── useGame.js         # Game context hook
│   │   │   └── useSocket.js       # WebSocket connection hook
│   │   ├── utils/
│   │   │   └── cardAssets.js      # Card image asset mapping
│   │   └── assets/
│   │       └── cards/             # PNG card images
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── README.md (this file)
├── docker-compose.yml
└── package.json (root)
```

---

## 🎯 Game Mechanics

### Card Types
- **Share Unit** (value 1) – Basic portfolio asset
- **Regulated Asset** (value 1) – Protected from hostile takeovers
- **Insider Trading** (value 1) – Grants ability to peek at opponent cards
- **Strategic Merger** (value 2) – Higher scoring potential
- **Hostile Takeover** (value 1) – Remove opponent's asset from play
- **Pivot** – Wild card usable in any sector

### Market System
Each sector has **bull** and **bear** zones. The market index is:
- **+1 (Bull)** if total bull value > bear value
- **-1 (Bear)** if total bear value > bull value
- **0 (Neutral)** if equal

Portfolio score = cards owned × final market sentiment.

### Scoring
Final scores are calculated after all turns based on:
- Portfolio value × sector sentiment (final bull/bear index)
- Regulated assets grant bonus protection
- Highest total score wins

---

## 🔌 WebSocket Events

### Client → Server
- `join_game` – Create or join a lobby
- `start_game` – Host starts game with AI count
- `allocate_card` – Place card in portfolio/market/opponent
- `activate_hostile_takeover` – Use hostile takeover ability
- `skip_hostile_takeover` – Decline hostile takeover

### Server → Client
- `game_created` – New lobby created with ID
- `joined_game` – Player joined successfully
- `lobby_updated` – Lobby state changed
- `game_started` – Game begins, initial cards dealt
- `game_state` – Full game state broadcast
- `turn_started` – Your turn + hand cards
- `card_allocated` – Card placement confirmed
- `hostile_takeover_activated` – Asset removed
- `game_over` – Final scores and winner

---

## 🚂 Deployment (Railway)

### Push to GitHub
```bash
git add .
git commit -m "Game update"
git push origin main
```

Railway auto-builds and deploys on every push to `main`.

### View Logs
```bash
# Using Railway CLI
railway logs

# Or check Railway dashboard: https://railway.app
```

### Production URL
- https://bull-and-bear.up.railway.app
- Telegram Mini App link configured via BotFather

---

## 🧪 Testing

### Run Tests
```bash
# Backend
cd server && npm test

# Frontend
cd client && npm test
```

### Test Checklist
- [ ] Browser access without Telegram authentication
- [ ] Telegram Mini App join/create flow
- [ ] AI opponent turns execute correctly
- [ ] Card images load for all sectors
- [ ] Hostile takeover mechanic removes correct cards
- [ ] Market sentiment updates properly
- [ ] Scoring calculates correctly
- [ ] Disconnect/reconnect preserves game state
- [ ] Loading screen shows progress

---

## 🐛 Known Issues & TODOs

- Card filenames have inconsistent casing (mapped in `cardAssets.js`)
- Mission card implementation pending
- Spectator mode not yet implemented
- Chat/emotes feature on roadmap

---

## 📝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add feature"`
3. Push: `git push origin feature/your-feature`
4. Submit pull request with clear description

---

## 📄 License

MIT License – See LICENSE file for details

---

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/syncpartners1/Bull-Bear-Game/issues)
- **Telegram Bot**: [@BullAndBearBot](https://t.me/BullAndBearBot)
- **Author**: syncpartners1

---

**Happy trading! 📈📉**
