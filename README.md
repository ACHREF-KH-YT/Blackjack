# 🃏 Premium Multiplayer Blackjack Table

A premium, full-stack, high-fidelity real-time **Multiplayer Blackjack Table** built with React, Vite, Tailwind CSS v4, Socket.io, Express, and TypeScript. 

Featuring a modern **Stake-style deep-slate layout**, interactive lobby, real-time table hosting, persistent global leaderboards, courtesy refills, and advanced gameplay modes including splits, double-downs, and custom dealer intelligence rules.

---

## ✨ Features

- **🌐 Real-Time Multiplayer Action**: Seamless multi-client synchronization driven by Socket.io. Join/create custom tables with active live seat configurations.
- **🎨 Stake-Style Dark Felt Aesthetics**: Elegant display typography, customized micro-animations with Framer Motion, subtle glowing backdrops, and interactive cards.
- **📈 Global Leaderboards**: Live persistent chip and win-tracking across all players and rounds.
- **🎲 Custom Dealer Rules**: Fully optional dealer modes, with printed felt indicators clearly showing the payout standards.
- **⚡ Pro Gameplay Actions**: Complete player capabilities including **Split**, **Double Down**, **Hit**, and **Stand**.
- **💰 2:1 Natural Blackjack Payout**: Authentic standard payout configurations (e.g., getting a Blackjack from the first 2 cards yields a 2:1 return: betting $50 wins $100 profit, totaling $150 chips back).
- **👁️ Partial Dealer Hole-Card Hide**: Real-time privacy of the dealer's hidden down-card, only revealing it dynamically when the dealer takes their turn.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Motion (Framer Motion), Lucide Icons
- **Backend**: Node.js, Express, Socket.io Server
- **Tooling**: TypeScript, `tsx` (for live TS development running), `esbuild` (bundling for production)

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### 2. Installation
Clone this repository and install all of its dependencies:
```bash
npm install
```

### 3. Run in Development Mode
Start the full-stack development server with hot reload:
```bash
npm run dev
```
The application will launch on `http://localhost:3000`.

### 4. Build for Production
To build the application for standard production deployment:
```bash
npm run build
```
This command compiles static client-side bundles and compiles/bundles the backend server code into a single, high-performance, self-contained file (`dist/server.cjs`) using `esbuild`.

### 5. Start Production Server
Once built, run the production-ready Node server:
```bash
npm run start
```

---

## 📂 Project Structure

```text
├── server.ts              # Entry point for the Express and Socket.io game server
├── src/
│   ├── main.tsx           # Client-side entry point
│   ├── App.tsx            # Main application coordinator (views, routing, sockets)
│   ├── types.ts           # Global strongly typed state declarations
│   ├── components/
│   │   ├── BlackjackTable.tsx  # Dynamic interactive tabletop interface
│   │   ├── TableLobby.tsx      # Lobby browser and host settings panel
│   │   ├── CardItem.tsx        # High-fidelity rendering of active cards
│   │   ├── Leaderboard.tsx     # Competitive chip and win tracking
│   │   └── Dashboard.tsx       # Live game feeds and historic log review
│   ├── gameUtils.ts       # Deck building, scoring, and split mechanics
│   └── index.css          # Tailwind CSS v4 styles and font integrations
├── metadata.json          # Application configuration metadata
├── package.json           # Scripts, server configs, and dependencies
└── tsconfig.json          # TypeScript compiler configurations
```

---

## 🔗 Publishing to GitHub

You can publish this project to GitHub instantly using Google AI Studio:

1. Click on the **Settings Menu** in the top-right corner of the AI Studio interface.
2. Select **Export to GitHub** (or **Download ZIP**).
3. Authenticate with your GitHub account, choose a repository name, and the entire production-ready directory will be pushed seamlessly.

Alternatively, to push via your local terminal:
```bash
git init
git add .
git commit -m "feat: initial commit of premium multiplayer blackjack"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

## 🌐 Deployment & Hosting (Important Note on Vercel)

> [!WARNING]  
> **Do not deploy this application to Vercel.**  
> Vercel is a serverless hosting provider. In serverless environments, background processes terminate instantly, meaning **persistent WebSocket (Socket.io) connections cannot be maintained** and will fail. 

To deploy this full-stack multiplayer application, you should use a hosting service that supports **persistent Node.js container environments**:

### Option 1: Render (Recommended)
1. Sign up/in on [Render.com](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Use the following configuration:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
5. Click **Deploy Web Service**. Render will automatically provision a persistent server and host your app with working real-time WebSockets!

### Option 2: Railway
1. Sign up/in on [Railway.app](https://railway.app/).
2. Select **New Project** -> **Deploy from GitHub repo**.
3. Connect your repository. Railway automatically detects the project files, builds using your build script, and starts the container with the `npm run start` command.

