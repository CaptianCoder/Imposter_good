const express = require('express');
const socketio = require('socket.io');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Game state
let game = {
  players: {},
  admins: new Set(),
  isGameActive: false,
  currentWord: null,
  imposters: [],
  currentRound: 0,
  maxImposters: 5 // Maximum allowed imposters
};

// Configuration
const ADMIN_PASSWORD = 'admin123';
const words = require('./words.json');

// Helper functions
const getRandomWord = (category = 'random') => {
  if (category === 'random') {
    const categories = Object.keys(words).filter(c => c !== 'random');
    category = categories[Math.floor(Math.random() * categories.length)];
  }
  return words[category][Math.floor(Math.random() * words[category].length)];
};

app.get('/', (req, res) => res.render('index'));

const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Server running');
});

const io = socketio(server);

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('join', ({ name, password }) => {
    // Admin authentication
    if (name.toLowerCase() === 'admin') {
      if (password === ADMIN_PASSWORD) {
        game.admins.add(socket.id);
        socket.emit('adminAuth', { 
          success: true, 
          round: game.currentRound,
          maxImposters: game.maxImposters
        });
        console.log(`Admin connected: ${socket.id}`);
      } else {
        socket.emit('error', 'Invalid admin password');
      }
      return;
    }

    // Regular player join
    if (game.isGameActive) {
      socket.emit('error', 'Game in progress. Please wait for next round.');
      return;
    }

    if (Object.keys(game.players).length >= 6) {
      socket.emit('error', 'Game is full!');
      return;
    }

    if (!name || name.length < 2) {
      socket.emit('error', 'Invalid name (min 2 characters)');
      return;
    }

    game.players[socket.id] = { name, role: 'unassigned' };
    io.emit('playersUpdate', {
      players: Object.values(game.players),
      maxImposters: game.maxImposters
    });
  });

  socket.on('startGame', ({ category, imposterCount }) => {
    if (!game.admins.has(socket.id)) return;

    const playerCount = Object.keys(game.players).length;
    const maxAllowed = Math.min(playerCount - 1, game.maxImposters);
    
    if (imposterCount > maxAllowed || imposterCount < 1) {
      socket.emit('error', `Invalid imposter count (1-${maxAllowed})`);
      return;
    }

    game.currentRound++;
    game.isGameActive = true;
    game.currentWord = getRandomWord(category);
    
    // Select imposters
    game.imposters = [];
    const playerIds = Object.keys(game.players);
    while (game.imposters.length < imposterCount) {
      const randomPlayer = playerIds[Math.floor(Math.random() * playerIds.length)];
      if (!game.imposters.includes(randomPlayer)) {
        game.imposters.push(randomPlayer);
      }
    }

    // Assign roles
    playerIds.forEach(id => {
      const role = game.imposters.includes(id) ? 'imposter' : 'crewmate';
      game.players[id].role = role;
      io.to(id).emit('role', {
        role,
        word: role === 'crewmate' ? game.currentWord : '???'
      });
    });

    io.emit('gameStarted', game.currentRound);
  });

  socket.on('endGame', () => {
    if (!game.admins.has(socket.id)) return;

    game.isGameActive = false;
    game.currentWord = null;
    game.imposters = [];

    Object.keys(game.players).forEach(id => {
      game.players[id].role = 'unassigned';
    });

    io.emit('gameEnded', game.currentRound);
  });

  socket.on('disconnect', () => {
    game.admins.delete(socket.id);
    delete game.players[socket.id];
    io.emit('playersUpdate', {
      players: Object.values(game.players),
      maxImposters: game.maxImposters
    });
  });
});