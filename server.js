const express = require('express');
const socketio = require('socket.io');
const path = require('path');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'admin123';
const MAX_PLAYERS = 6;
const words = require('./words.json');
const questions = require('./questions.json');

// Validate game data files
const validateGameData = () => {
  if (!words || !Object.keys(words).length) throw new Error('Invalid words.json');
  if (!questions.categories || !Object.keys(questions.categories).length) throw new Error('Invalid questions.json');
};
validateGameData();

// Game state
let game = {
  players: {},
  admins: new Set(),
  isGameActive: false,
  currentContent: null,
  imposters: [],
  currentRound: 0,
  mode: 'imposter',
  answers: {}
};

// Server setup
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.render('index'));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

const io = socketio(server);

// Helper functions
const getRandomContent = (category, mode) => {
  try {
    if (mode === 'imposter') {
      const categories = Object.keys(words).filter(c => c !== 'random');
      const selectedCategory = categories.includes(category) 
        ? category 
        : categories[Math.floor(Math.random() * categories.length)];
      return words[selectedCategory][Math.floor(Math.random() * words[selectedCategory].length)];
    }

    if (mode === 'guessing') {
      const categories = Object.keys(questions.categories);
      const selectedCategory = categories.includes(category) 
        ? category 
        : categories[0];
      return questions.categories[selectedCategory][
        Math.floor(Math.random() * questions.categories[selectedCategory].length)
      ];
    }
  } catch (error) {
    console.error('Content error:', error);
    return mode === 'imposter' ? 'DefaultWord' : {
      crewmate: "What's your name?",
      imposter: "What's your favorite number?"
    };
  }
};

// Socket.IO handlers
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Player join handler
  socket.on('join', ({ name, password }, callback) => {
    try {
      // Handle admin login
      if (name.toLowerCase() === 'admin') {
        if (password === ADMIN_PASSWORD) {
          game.admins.add(socket.id);
          socket.emit('adminAuth', { success: true });
          return callback?.({ success: true });
        }
        return callback?.({ error: 'Invalid admin password' });
      }

      // Validate regular player
      const cleanName = name?.trim();
      if (!cleanName || cleanName.length < 2) {
        return callback?.({ error: 'Name must be at least 2 characters' });
      }

      if (Object.keys(game.players).length >= MAX_PLAYERS) {
        return callback?.({ error: 'Lobby is full (6 players max)' });
      }

      if (game.isGameActive) {
        return callback?.({ error: 'Game in progress - please wait' });
      }

      // Add new player
      game.players[socket.id] = {
        id: socket.id,
        name: cleanName,
        role: 'unassigned'
      };

      io.emit('playersUpdate', Object.values(game.players));
      console.log(`Player joined: ${cleanName}`);
      return callback?.({ success: true });

    } catch (error) {
      console.error('Join error:', error);
      return callback?.({ error: 'Failed to join game' });
    }
  });

  // Start game handler
  socket.on('startGame', ({ category, imposterCount, mode }, callback) => {
    try {
      // Validate admin
      if (!game.admins.has(socket.id)) {
        return callback?.({ error: 'Admin privileges required' });
      }

      // Validate player count
      const players = Object.keys(game.players);
      if (players.length < 2) {
        return callback?.({ error: 'Need at least 2 players to start' });
      }

      // Validate imposter count
      const maxImposters = mode === 'guessing' ? 1 : Math.min(players.length - 1, 5);
      if (!imposterCount || imposterCount < 1 || imposterCount > maxImposters) {
        return callback?.({ error: `Invalid imposter count (1-${maxImposters})` });
      }

      // Reset game state
      game.currentRound++;
      game.isGameActive = true;
      game.mode = mode;
      game.currentContent = getRandomContent(category, mode);
      game.imposters = [];
      game.answers = {};

      // Select imposters
      while (game.imposters.length < imposterCount) {
        const randomPlayer = players[Math.floor(Math.random() * players.length)];
        if (!game.imposters.includes(randomPlayer)) {
          game.imposters.push(randomPlayer);
        }
      }

      // Assign roles and content
      players.forEach(playerId => {
        const role = game.imposters.includes(playerId) ? 'imposter' : 'crewmate';
        game.players[playerId].role = role;
        
        const content = role === 'crewmate'
          ? (mode === 'imposter' ? game.currentContent : game.currentContent.crewmate)
          : (mode === 'imposter' ? '???' : game.currentContent.imposter);

        io.to(playerId).emit('roleAssignment', { role, content, mode });
      });

      io.emit('gameStarted', { mode, round: game.currentRound });
      return callback?.({ success: true });

    } catch (error) {
      console.error('Start game error:', error);
      return callback?.({ error: 'Failed to start game' });
    }
  });

  // Answer submission handler
  socket.on('submitAnswer', (answer) => {
    try {
      if (!game.isGameActive || !game.players[socket.id]) return;

      game.answers[socket.id] = {
        name: game.players[socket.id].name,
        answer: answer.trim(),
        role: game.players[socket.id].role
      };

      io.emit('answersUpdate', Object.values(game.answers));

    } catch (error) {
      console.error('Answer submission error:', error);
    }
  });

  // End game handler
  socket.on('endGame', (callback) => {
    try {
      if (!game.admins.has(socket.id)) {
        return callback?.({ error: 'Admin privileges required' });
      }

      game.isGameActive = false;
      game.imposters = [];
      game.answers = {};
      Object.values(game.players).forEach(player => {
        player.role = 'unassigned';
      });

      io.emit('gameEnded', game.currentRound);
      return callback?.({ success: true });

    } catch (error) {
      console.error('End game error:', error);
      return callback?.({ error: 'Failed to end game' });
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    try {
      // Remove admin privileges
      if (game.admins.has(socket.id)) {
        game.admins.delete(socket.id);
      }

      // Remove player
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        io.emit('playersUpdate', Object.values(game.players));
      }

      console.log(`Disconnected: ${socket.id}`);

    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });
});