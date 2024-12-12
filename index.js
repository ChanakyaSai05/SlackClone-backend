import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { ExpressPeerServer } from "peer";
import authRoutes from "./routes/auth.js";
import channelRoutes from "./routes/channels.js";
import messageRoutes from "./routes/messages.js";
import userRoutes from "./routes/users.js";
import invitationRoutes from "./routes/invitations.js";
import boardRoutes from "./routes/boards.js";
import sectionRoutes from "./routes/sections.js";
import cardRoutes from "./routes/cards.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Set up PeerJS server with STUN/TURN configuration
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/myapp",
  allow_discovery: true,
  proxied: true,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  },
});

app.use("/peerjs", peerServer);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://slack-clone-frontend-tau.vercel.app",
    ],
    methods: ["GET", "POST"],
  },
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Keep track of online users with their socket IDs and peer IDs
const onlineUsers = new Map(); // userId -> { socketId, peerId }
const userPeers = new Map(); // userId -> peerId

// PeerJS connection handling
peerServer.on("connection", (client) => {
  console.log("PeerJS Client connected:", client.getId());
  const userId = client.getId().split("-")[0];
  if (userId) {
    userPeers.set(userId, client.getId());
    io.emit("peer_connected", { userId, peerId: client.getId() });
  }
});

peerServer.on("disconnect", (client) => {
  console.log("PeerJS Client disconnected:", client.getId());
  const userId = client.getId().split("-")[0];
  if (userId) {
    userPeers.delete(userId);
    io.emit("peer_disconnected", { userId });
  }
});

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://slack-clone-frontend-tau.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);
app.use(express.json());
app.use("/uploads", express.static("./uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/sections",sectionRoutes);
app.use("/api/cards", cardRoutes);

// File upload endpoint
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const fileUrl = `uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("user_connected", async (userId) => {
    if (userId) {
      socket.userId = userId;
      const peerId = userPeers.get(userId);
      onlineUsers.set(userId, { socketId: socket.id, peerId });

      await User.findByIdAndUpdate(userId, { status: "online" });
      io.emit("user_status_change", { userId, status: "online" });

      const onlineUsersList = Array.from(onlineUsers.entries()).map(
        ([id, data]) => ({
          userId: id,
          ...data,
        })
      );
      socket.emit("online_users", onlineUsersList);

      socket.broadcast.emit("user_connected", {
        userId,
        socketId: socket.id,
        peerId,
      });
    }
  });

  socket.on("peer_id", ({ userId, peerId }) => {
    console.log("Peer ID received:", userId, peerId);
    if (userId && peerId) {
      userPeers.set(userId, peerId);
      const userInfo = onlineUsers.get(userId);
      if (userInfo) {
        onlineUsers.set(userId, { ...userInfo, peerId });
        io.emit("peer_updated", { userId, peerId });
      }
    }
  });

  socket.on("get_peer_id", ({ targetUserId }, callback) => {
    const peerId = userPeers.get(targetUserId);
    const userInfo = onlineUsers.get(targetUserId);
    callback({
      peerId,
      isOnline: !!userInfo,
      socketId: userInfo?.socketId,
    });
  });

  socket.on("call_user", ({ targetUserId }) => {
    const userInfo = onlineUsers.get(targetUserId);
    if (userInfo?.socketId) {
      const callerInfo = onlineUsers.get(socket.userId);
      io.to(userInfo.socketId).emit("incoming_call", {
        callerId: socket.userId,
        callerPeerId: callerInfo?.peerId,
      });
    } else {
      socket.emit("call_error", { message: "User is not available" });
    }
  });

  socket.on("answer_call", ({ targetUserId }) => {
    const userInfo = onlineUsers.get(targetUserId);
    if (userInfo?.socketId) {
      const answererInfo = onlineUsers.get(socket.userId);
      io.to(userInfo.socketId).emit("call_accepted", {
        answererPeerId: answererInfo?.peerId,
      });
    }
  });

  socket.on("call_error", ({ targetUserId, error }) => {
    const userInfo = onlineUsers.get(targetUserId);
    if (userInfo?.socketId) {
      io.to(userInfo.socketId).emit("call_failed", { error });
    }
  });

  socket.on("end_call", ({ targetUserId }) => {
    const userInfo = onlineUsers.get(targetUserId);
    if (userInfo?.socketId) {
      io.to(userInfo.socketId).emit("call_ended", {
        userId: socket.userId,
      });
    }
  });

  socket.on("annotation_data", ({ targetUserId, pathData }) => {
    const userInfo = onlineUsers.get(targetUserId);
    if (userInfo?.socketId) {
      io.to(userInfo.socketId).emit("receive_annotation", { pathData });
    }
  });

  socket.on("join_channel", (channelId) => {
    if (channelId) {
      socket.join(channelId);
    }
  });

  socket.on("leave_channel", (channelId) => {
    if (channelId) {
      socket.leave(channelId);
    }
  });

  socket.on("send_message", (message) => {
    if (message.channelId) {
      if (message.channelId.startsWith("dm-")) {
        const recipientId = message.channelId.replace("dm-", "");
        const recipientSocketId = onlineUsers.get(recipientId)?.socketId;

        if (recipientSocketId) {
          io.to(recipientSocketId).emit("receive_message", {
            ...message,
            channelId: `dm-${socket.userId}`,
          });
        }
        socket.emit("receive_message", message);
      } else {
        io.to(message.channelId).emit("receive_message", message);
      }
    }
  });
  // Board and card real-time updates
  socket.on("join_board", (boardId) => {
    socket.join(`board:${boardId}`);
  });

  socket.on("card_moved", (data) => {
    socket.to(`board:${data.boardId}`).emit("card_updated", data);
  });

  socket.on("card_created", (data) => {
    socket.to(`board:${data.boardId}`).emit("new_card", data);
  });

  socket.on("section_updated", (data) => {
    socket.to(`board:${data.boardId}`).emit("section_changed", data);
  });
  // adding newly created sockets
  socket.on("section_created", (data) => {
    socket.to(`board:${data.boardId}`).emit("new_section", data);
  });
  socket.on("card_deleted", (data) => {
    // console.log(data, "card deleted");
    socket.to(`board:${data.boardId}`).emit("delete_card", data);
  });
  socket.on("section_deleted", (data) => {
    // console.log(data, "section deleted");
    socket.to(`board:${data.boardId}`).emit("delete_section", data);
  });

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id, socket.userId);
    if (socket.userId) {
      userPeers.delete(socket.userId);
      onlineUsers.delete(socket.userId);

      await User.findByIdAndUpdate(socket.userId, { status: "offline" });

      io.emit("user_status_change", {
        userId: socket.userId,
        status: "offline",
      });

      io.emit("user_disconnected", { userId: socket.userId });
    }
  });
});
// socket.on("create_card", (data) => {
//   const { listId, card } = data;
//   io.to(`board_${card.boardId}`).emit("card_created", { listId, card });
// });

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
