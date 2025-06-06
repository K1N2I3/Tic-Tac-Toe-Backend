const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000","https://tic-tac-60wj4d3u3-ken-lins-projects-98d57120.vercel.app"],
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('用户已连接:', socket.id);

  socket.on('createRoom', () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms.set(roomId, {
      players: [socket.id],
      board: Array(9).fill(null),
      currentPlayer: socket.id
    });
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.players.length < 2) {
      room.players.push(socket.id);
      socket.join(roomId);
      io.to(roomId).emit('opponentJoined');
    } else {
      socket.emit('error', '房间已满或不存在');
    }
  });

  socket.on('startGame', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      io.to(roomId).emit('gameStart', {
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    }
  });

  socket.on('makeMove', ({ roomId, index }) => {
    const room = rooms.get(roomId);
    if (room && room.currentPlayer === socket.id) {
      if (room.board[index] === null) {
        room.board[index] = room.players.indexOf(socket.id) === 0 ? 'X' : 'O';
        room.currentPlayer = room.players.find(id => id !== socket.id);
        io.to(roomId).emit('updateBoard', {
          board: room.board,
          currentPlayer: room.currentPlayer
        });

        const winner = checkWinner(room.board);
        if (winner) {
          io.to(roomId).emit('gameOver', { winner });
          // rooms.delete(roomId);
        } else if (room.board.every(cell => cell !== null)) {
          io.to(roomId).emit('gameOver', { winner: 'draw' });
          // rooms.delete(roomId);
        }
      }
    }
  });

  socket.on('restartGame', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.board = Array(9).fill(null);
      room.currentPlayer = room.players[Math.floor(Math.random() * room.players.length)];
      io.to(roomId).emit('restartGame', {
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    }
  });

  socket.on('leaveRoom', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.players = room.players.filter(id => id !== socket.id);
      socket.leave(roomId);
      io.to(roomId).emit('playerDisconnected');
      if (room.players.length === 0) {
        rooms.delete(roomId);
      }
    }
    socket.emit('leftRoom');
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.players.includes(socket.id)) {
        io.to(roomId).emit('playerDisconnected');
        rooms.delete(roomId);
      }
    });
  });
});

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横向
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 纵向
    [0, 4, 8], [2, 4, 6] // 对角线
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 