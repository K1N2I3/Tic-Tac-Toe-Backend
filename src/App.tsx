import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  padding: 2rem;
`;

const Title = styled(motion.h1)`
  font-size: 3rem;
  margin-bottom: 2rem;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
`;

const GameBoard = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
`;

const Cell = styled(motion.button)`
  width: 100px;
  height: 100px;
  font-size: 3rem;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const RoomControls = styled.div`
  margin: 2rem 0;
  display: flex;
  gap: 1rem;
`;

const Button = styled(motion.button)`
  padding: 0.8rem 1.5rem;
  font-size: 1.1rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #45a049;
  }
`;

const Input = styled.input`
  padding: 0.8rem;
  font-size: 1.1rem;
  border: none;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  outline: none;

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const Status = styled(motion.div)`
  margin: 1rem 0;
  font-size: 1.2rem;
  color: #4CAF50;
`;

function App() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [roomId, setRoomId] = useState('');
  const [gameStatus, setGameStatus] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [isInGame, setIsInGame] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [isRoomOwner, setIsRoomOwner] = useState(false);

  useEffect(() => {
    socket.on('roomCreated', (id: string) => {
      setRoomId(id);
      setGameStatus('等待对手加入...');
      setIsRoomOwner(true);
    });

    socket.on('opponentJoined', () => {
      setOpponentJoined(true);
      setGameStatus('对手已加入房间，等待你开始游戏');
    });

    socket.on('gameStart', ({ board, currentPlayer }: { board: (string | null)[], currentPlayer: string }) => {
      setBoard(board);
      setIsInGame(true);
      setIsMyTurn(currentPlayer === socket.id);
      setGameStatus(currentPlayer === socket.id ? '你的回合' : '对手回合');
    });

    socket.on('updateBoard', ({ board, currentPlayer }: { board: (string | null)[], currentPlayer: string }) => {
      setBoard(board);
      setIsMyTurn(currentPlayer === socket.id);
      setGameStatus(currentPlayer === socket.id ? '你的回合' : '对手回合');
    });

    socket.on('gameOver', ({ winner }: { winner: string }) => {
      if (winner === 'draw') {
        setGameStatus('平局！');
      } else {
        setGameStatus(`游戏结束！${winner === 'X' ? 'X' : 'O'} 获胜！`);
      }
      setIsInGame(false);
    });

    socket.on('error', (message: string) => {
      setGameStatus(message);
    });

    socket.on('playerDisconnected', () => {
      setGameStatus('对手已断开连接');
      setIsInGame(false);
    });

    return () => {
      socket.off('roomCreated');
      socket.off('opponentJoined');
      socket.off('gameStart');
      socket.off('updateBoard');
      socket.off('gameOver');
      socket.off('error');
      socket.off('playerDisconnected');
    };
  }, []);

  const createRoom = () => {
    socket.emit('createRoom');
  };

  const joinRoom = () => {
    if (roomId) {
      socket.emit('joinRoom', roomId);
    }
  };

  const makeMove = (index: number) => {
    if (isMyTurn && board[index] === null) {
      socket.emit('makeMove', { roomId, index });
    }
  };

  const handleStartGame = () => {
    socket.emit('startGame', roomId);
    setOpponentJoined(false);
  };

  return (
    <Container>
      <Title
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        在线井字棋
      </Title>

      {!isInGame && (
        <RoomControls>
          <Button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={createRoom}
          >
            创建房间
          </Button>
          <Input
            placeholder="输入房间号"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <Button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={joinRoom}
          >
            加入房间
          </Button>
        </RoomControls>
      )}

      <Status
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {gameStatus}
      </Status>

      <GameBoard
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {board.map((cell, index) => (
          <Cell
            key={index}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => makeMove(index)}
          >
            {cell}
          </Cell>
        ))}
      </GameBoard>

      {opponentJoined && isRoomOwner && (
        <Button onClick={handleStartGame}>开始游戏</Button>
      )}
    </Container>
  );
}

export default App; 