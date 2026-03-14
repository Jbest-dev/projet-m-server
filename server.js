const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Stockage des rooms en mémoire
const rooms = {}

io.on("connection", (socket) => {
  console.log("Joueur connecté:", socket.id)

  // Créer une room
  socket.on("create_room", ({ playerName }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase()
    rooms[roomCode] = {
      players: [{ id: socket.id, name: playerName, ready: false }],
      gameState: null
    }
    socket.join(roomCode)
    socket.emit("room_created", { roomCode })
    console.log(`Room créée: ${roomCode} par ${playerName}`)
  })

  // Rejoindre une room
  socket.on("join_room", ({ roomCode, playerName }) => {
    const room = rooms[roomCode]
    if (!room) {
      socket.emit("error", { message: "Room introuvable !" })
      return
    }
    if (room.players.length >= 4) {
      socket.emit("error", { message: "Room pleine !" })
      return
    }
    room.players.push({ id: socket.id, name: playerName, ready: false })
    socket.join(roomCode)
    socket.emit("room_joined", { roomCode, players: room.players })
    io.to(roomCode).emit("player_joined", { players: room.players })
    console.log(`${playerName} a rejoint la room ${roomCode}`)
  })

  // Synchroniser le gameState d'un joueur
  socket.on("sync_state", ({ roomCode, playerId, gameState }) => {
    if (!rooms[roomCode]) return
    io.to(roomCode).emit("state_updated", { playerId, gameState })
  })

  // Déconnexion
  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode]
      room.players = room.players.filter(p => p.id !== socket.id)
      if (room.players.length === 0) {
        delete rooms[roomCode]
      } else {
        io.to(roomCode).emit("player_left", { players: room.players })
      }
    }
    console.log("Joueur déconnecté:", socket.id)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`)
})