const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL || "*"
      : ["http://localhost:3000"],
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
      currentPlayer: socket.id,
      roomOwner: socket.id,  // 添加房主标识
      ownerMoveCount: 0  // 房主连续下棋计数
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
        room.ownerMoveCount = 0; // 重置房主连续下棋计数
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

  // 删除术事件处理
  socket.on('useCheat', ({ roomId, index }) => {
    const room = rooms.get(roomId);
    // 验证是否为房主且位置有棋子
    if (room && room.roomOwner === socket.id && room.board[index] !== null) {
      const removedPiece = room.board[index];
      room.board[index] = null;  // 删除棋子
      
      io.to(roomId).emit('cheatUsed', {
        board: room.board,
        message: `房主使用了删除术！`
      });

      // 检查删除棋子后是否改变游戏结果
      const winner = checkWinner(room.board);
      if (winner) {
        io.to(roomId).emit('gameOver', { winner });
      }
    }
  });

  // 影分身之术事件处理
  socket.on('useClone', ({ roomId, index }) => {
    const room = rooms.get(roomId);
    // 验证是否为房主且位置为空
    if (room && room.roomOwner === socket.id && room.board[index] === null) {
      room.board[index] = room.players.indexOf(socket.id) === 0 ? 'X' : 'O';
      room.ownerMoveCount++;  // 增加房主连续下棋计数
      
      let message = `房主使用了影分身之术！(${room.ownerMoveCount}/2)`;
      
      // 检查是否需要切换回合
      if (room.ownerMoveCount >= 2) {
        room.currentPlayer = room.players.find(id => id !== socket.id);
        room.ownerMoveCount = 0;
        message += " - 轮到对手了！";
      }
      
      io.to(roomId).emit('cloneUsed', {
        board: room.board,
        message: message,
        moveCount: room.ownerMoveCount,
        currentPlayer: room.currentPlayer
      });

      // 检查是否获胜
      const winner = checkWinner(room.board);
      if (winner) {
        io.to(roomId).emit('gameOver', { winner });
      } else if (room.board.every(cell => cell !== null)) {
        io.to(roomId).emit('gameOver', { winner: 'draw' });
      }
    }
  });

  socket.on('restartGame', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.board = Array(9).fill(null);
      room.currentPlayer = room.players[Math.floor(Math.random() * room.players.length)];
      room.ownerMoveCount = 0;  // 重置房主连续下棋计数
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