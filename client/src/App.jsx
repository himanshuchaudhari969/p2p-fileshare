import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("https://p2p-fileshare-si8x.onrender.com");

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [isSender, setIsSender] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const peerRef = useRef(null);
  const channelRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    socket.on("peer-joined", () => {
      setStatus("Receiver joined! Starting connection...");
      startWebRTC(true);
    });
    socket.on("offer", async (data) => {
      await startWebRTC(false);
      await peerRef.current.setRemoteDescription(data.offer);
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("answer", { roomId: data.roomId, answer });
    });
    socket.on("answer", async (data) => {
      await peerRef.current.setRemoteDescription(data.answer);
    });
    socket.on("ice-candidate", async (data) => {
      if (peerRef.current) await peerRef.current.addIceCandidate(data.candidate);
    });
    return () => {
      socket.off("peer-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [roomId]);

  const startWebRTC = async (initiator) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      ],
    });
    peerRef.current = peer;
    peer.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { roomId, candidate: e.candidate });
    };
    if (initiator) {
      const channel = peer.createDataChannel("file");
      channelRef.current = channel;
      setupChannel(channel);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    } else {
      peer.ondatachannel = (e) => {
        channelRef.current = e.channel;
        setupChannel(e.channel);
      };
    }
  };

  const setupChannel = (channel) => {
    channel.binaryType = "arraybuffer";
    channel.onopen = () => setStatus("✅ Connected! Ready to send.");
    channel.onclose = () => setStatus("❌ Connection closed.");
    channel.onmessage = (e) => {
      if (typeof e.data === "string" && e.data.startsWith("FILENAME:")) {
        chunksRef.current.fileName = e.data.replace("FILENAME:", "");
      } else if (e.data === "DONE") {
        const blob = new Blob(chunksRef.current);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = chunksRef.current.fileName || "received_file";
        a.click();
        setStatus("🎉 File received and downloaded!");
        setProgress(100);
      } else {
        chunksRef.current.push(e.data);
        setStatus("📥 Receiving file...");
      }
    };
  };

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    setIsSender(true);
    socket.emit("create-room", id);
    setJoined(true);
    setStatus("🔗 Share the Room ID with receiver!");
  };

  const joinRoom = () => {
    if (!roomId) return;
    socket.emit("join-room", roomId);
    setJoined(true);
    setIsSender(false);
    setStatus("⏳ Waiting for sender...");
  };

  const sendFile = () => {
    if (!file || !channelRef.current) return;
    const CHUNK_SIZE = 16384;
    const reader = new FileReader();
    let offset = 0;
    reader.onload = (e) => {
      channelRef.current.send(e.target.result);
      offset += e.target.result.byteLength;
      setProgress(Math.round((offset / file.size) * 100));
      if (offset < file.size) readSlice(offset);
      else {
        channelRef.current.send("FILENAME:" + file.name);
        channelRef.current.send("DONE");
        setStatus("✅ File sent successfully!");
      }
    };
    const readSlice = (o) => {
      reader.readAsArrayBuffer(file.slice(o, o + CHUNK_SIZE));
    };
    readSlice(0);
    setStatus("📤 Sending file...");
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #e8f4fd 0%, #d6eaf8 50%, #e8f8f5 100%)", fontFamily: "'Segoe UI', sans-serif" }}>
      
      {/* Navbar */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>📂</span>
          <span style={{ fontWeight: "700", fontSize: "18px", color: "#1a73e8" }}>P2P</span>
          <span style={{ fontWeight: "700", fontSize: "18px", color: "#1a1a2e" }}>File Share</span>
        </div>
        <div style={{ background: "rgba(26,115,232,0.1)", padding: "8px 16px", borderRadius: "20px", fontSize: "13px", color: "#1a73e8", fontWeight: "600" }}>
          🔒 Secure • Private • Direct
        </div>
      </nav>

      {/* Hero */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "60px 40px 40px", maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Left Side */}
        <div style={{ flex: 1, maxWidth: "500px" }}>
          <div style={{ fontSize: "14px", color: "#1a73e8", marginBottom: "8px" }}>✈️</div>
          <h1 style={{ fontSize: "52px", fontWeight: "800", color: "#1a1a2e", lineHeight: 1.1, marginBottom: "16px" }}>
            <span style={{ color: "#1a73e8" }}>P2P</span> File Share
          </h1>
          <p style={{ color: "#555", fontSize: "16px", marginBottom: "8px" }}>Transfer files directly between devices</p>
          <p style={{ color: "#555", fontSize: "16px", marginBottom: "40px" }}>
            No upload. No server storage. <span style={{ color: "#1a73e8", fontWeight: "600" }}>End-to-end secure.</span>
          </p>

          {/* Card */}
          <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: "20px", padding: "32px", boxShadow: "0 8px 32px rgba(26,115,232,0.1)" }}>
            {!joined ? (
              <>
                <button onClick={createRoom} style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #1a73e8, #0d47a1)", color: "white", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "600", cursor: "pointer", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  👥 Create Room
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ flex: 1, height: "1px", background: "#ddd" }} />
                  <span style={{ color: "#999", fontSize: "13px" }}>OR</span>
                  <div style={{ flex: 1, height: "1px", background: "#ddd" }} />
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", background: "#f5f5f5", borderRadius: "10px", padding: "0 14px" }}>
                    <span style={{ color: "#1a73e8", fontWeight: "700" }}>#</span>
                    <input placeholder="Enter Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} style={{ border: "none", background: "transparent", padding: "14px 0", fontSize: "15px", outline: "none", width: "100%" }} />
                  </div>
                  <button onClick={joinRoom} style={{ padding: "14px 20px", background: "#1a73e8", color: "white", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "600", cursor: "pointer" }}>
                    Join Room
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                  <div style={{ fontSize: "13px", color: "#999", marginBottom: "6px" }}>Room ID</div>
                  <div style={{ fontSize: "32px", fontWeight: "800", color: "#1a73e8", letterSpacing: "4px" }}>{roomId}</div>
                  <div style={{ fontSize: "13px", color: "#555", marginTop: "8px" }}>{status}</div>
                </div>
                {isSender && (
                  <div>
                    <label style={{ display: "block", border: "2px dashed #1a73e8", borderRadius: "12px", padding: "20px", textAlign: "center", cursor: "pointer", marginBottom: "16px", background: file ? "rgba(26,115,232,0.05)" : "transparent" }}>
                      <input type="file" onChange={(e) => setFile(e.target.files[0])} style={{ display: "none" }} />
                      <div style={{ fontSize: "24px", marginBottom: "6px" }}>📁</div>
                      <div style={{ color: "#1a73e8", fontWeight: "600", fontSize: "14px" }}>{file ? file.name : "Click to select file"}</div>
                    </label>
                    <button onClick={sendFile} disabled={!file} style={{ width: "100%", padding: "14px", background: file ? "linear-gradient(135deg, #1a73e8, #0d47a1)" : "#ccc", color: "white", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "600", cursor: file ? "pointer" : "not-allowed" }}>
                      📤 Send File
                    </button>
                  </div>
                )}
                {progress > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#555", marginBottom: "6px" }}>
                      <span>Progress</span><span>{progress}%</span>
                    </div>
                    <div style={{ background: "#e0e0e0", borderRadius: "10px", height: "8px" }}>
                      <div style={{ background: "linear-gradient(135deg, #1a73e8, #0d47a1)", width: `${progress}%`, height: "8px", borderRadius: "10px", transition: "width 0.3s" }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Side */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: "20px", padding: "30px", boxShadow: "0 8px 24px rgba(26,115,232,0.1)", textAlign: "center" }}>
              <div style={{ fontSize: "48px" }}>💻</div>
              <div style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>Sender</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "24px" }}>📡</div>
              <div style={{ fontSize: "11px", color: "#1a73e8", fontWeight: "600" }}>(•)</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: "20px", padding: "30px", boxShadow: "0 8px 24px rgba(26,115,232,0.1)", textAlign: "center" }}>
              <div style={{ fontSize: "48px" }}>📱</div>
              <div style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>Receiver</div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: "700", fontSize: "18px", color: "#1a73e8" }}>Direct. Fast. Secure.</div>
            <div style={{ color: "#888", fontSize: "14px" }}>Peer to Peer Connection</div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px 60px" }}>
        <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: "20px", padding: "32px", display: "flex", justifyContent: "space-around", boxShadow: "0 4px 20px rgba(26,115,232,0.08)" }}>
          {[
            { icon: "⚡", title: "Instant Transfer", desc: "Share files instantly with high speed" },
            { icon: "🛡️", title: "Secure Connection", desc: "End-to-end encrypted P2P connection" },
            { icon: "☁️", title: "No Upload Needed", desc: "Files never leave your device" },
          ].map((f, i) => (
            <div key={i} style={{ textAlign: "center", flex: 1, padding: "0 20px" }}>
              <div style={{ background: "rgba(26,115,232,0.1)", width: "56px", height: "56px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 12px" }}>{f.icon}</div>
              <div style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a2e", marginBottom: "6px" }}>{f.title}</div>
              <div style={{ color: "#888", fontSize: "13px" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "20px", color: "#aaa", fontSize: "13px", borderTop: "1px solid rgba(26,115,232,0.1)" }}>
        🔒 Your files stay between you and your peer. We don't store anything.
      </div>
    </div>
  );
}

export default App;