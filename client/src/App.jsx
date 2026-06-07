import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

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
      if (peerRef.current) {
        await peerRef.current.addIceCandidate(data.candidate);
      }
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
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = peer;

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: e.candidate });
      }
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
    channel.onopen = () => setStatus("Connected! Ready to send.");
    channel.onclose = () => setStatus("Connection closed.");

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
    setStatus("File received and downloaded!");
    setProgress(100);
  } else {
    chunksRef.current.push(e.data);
    setStatus("Receiving file...");
     }
    };
  };

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    setIsSender(true);
    socket.emit("create-room", id);
    setJoined(true);
    setStatus("Room created! Share the Room ID with receiver.");
  };

  const joinRoom = () => {
    socket.emit("join-room", roomId);
    setJoined(true);
    setIsSender(false);
    setStatus("Joined room! Waiting for sender...");
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

      if (offset < file.size) {
        readSlice(offset);
      } else {
        channelRef.current.send("FILENAME:" + file.name);
        channelRef.current.send("DONE");
        setStatus("File sent successfully!");
      }
    };

    const readSlice = (o) => {
      const slice = file.slice(o, o + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
    setStatus("Sending file...");
  };

  return (
    <div style={{ textAlign: "center", marginTop: "80px", fontFamily: "Arial", background: "#111", minHeight: "100vh", color: "white", padding: "20px" }}>
      <h1>P2P File Share</h1>

      {!joined ? (
        <div>
          <button onClick={createRoom} style={{ margin: "10px", padding: "12px 24px", fontSize: "16px", cursor: "pointer" }}>
            Create Room
          </button>
          <br />
          <input
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ margin: "10px", padding: "10px", fontSize: "16px", width: "200px" }}
          />
          <button onClick={joinRoom} style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}>
            Join Room
          </button>
        </div>
      ) : (
        <div>
          <h2>Room ID: <span style={{ color: "#4ade80" }}>{roomId}</span></h2>
          <p>{status}</p>

          {isSender && (
            <div>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ margin: "10px" }}
              />
              <br />
              <button
                onClick={sendFile}
                disabled={!file}
                style={{ padding: "12px 24px", fontSize: "16px", cursor: "pointer", marginTop: "10px" }}
              >
                Send File
              </button>
            </div>
          )}

          {progress > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ background: "#333", borderRadius: "10px", width: "300px", margin: "0 auto" }}>
                <div style={{ background: "#4ade80", width: `${progress}%`, height: "20px", borderRadius: "10px", transition: "width 0.3s" }} />
              </div>
              <p>{progress}%</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;