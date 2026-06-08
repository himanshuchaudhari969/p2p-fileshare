# P2P File Share

A lightweight, decentralized peer-to-peer file sharing web application built with React, Node.js, WebRTC, and Socket.io.

# Live Demo
[https://p2p-fileshare-jet.vercel.app](https://p2p-fileshare-jet.vercel.app)

 # demo video- 

https://drive.google.com/file/d/1fBrk5riVY0gcQX2rKmvV8T6nHQ7WTU5P/view?usp=drive_link 

# Features
- Direct browser-to-browser file transfer using WebRTC
- No file data passes through the server
- Real-time progress bar and transfer status
- Unique Room ID generation for secure sharing
- Works across different devices (laptop, mobile)
- Graceful disconnect handling
- Auto-download on receiver side
- Original filename preserved on download
- SHA-256 inspired chunk-based transfer
- Drag & drop file upload
- SHA-256 hash verification (zero data corruption)
- Real-time transfer speed (MB/s)
- Live connection status indicator

# Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React.js, Vite |
| P2P Communication | WebRTC API |
| Signaling Server | Node.js, Express, Socket.io |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |

# How It Works
1. Sender creates a Room and gets a unique Room ID
2. Receiver joins using the Room ID
3. Signaling server connects both peers via WebRTC handshake
4. File is transferred directly browser-to-browser
5. Receiver gets auto-download when transfer completes

# Run Locally

# Backend
```bash
cd server
npm install
node index.js
```

### Frontend
```bash
cd client
npm install
npm run dev
```

##  Project Structure
```
p2p-fileshare/
├── client/          # React frontend
│   └── src/
│       └── App.jsx
└── server/          # Node.js signaling server
    └── index.js
```
