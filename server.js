const express = require('express');
const socketio = require('socket.io');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Game state
let game = {
  players: {},
  isGameActive: false,
  currentWord: null,
  imposter: null
};

// Word list and categories
const words = require('./words.json');
const ADMIN_PASSWORD = 'admin123';

// Helper functions
const getRandomWord = (category = 'random') => {
  if (category === 'random') {
    const categories = Object.keys(words).filter(c => c !== 'random');
    category = categories[Math.floor(Math.random() * categories.length)];
  }
  const categoryWords = words[category] || words.animals;
  return categoryWords[Math.floor(Math.random() * categoryWords.length)];
};

// Routes
app.get('/', (req, res) => res.render('index'));
app.get('/admin', (req, res) => res.render('admin', { password: ADMIN_PASSWORD }));

const server = app.listen(3000, () => console.log('Server running on port 3000'));
const io = socketio(server);

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('joinGame', (name) => {
    try {
      // Validation checks
      if (Object.keys(game.players).length >= 6) {
        socket.emit('errorMessage', 'Game is full!');
        return;
      }
      
      if (!name || name.trim().length < 2) {
        socket.emit('errorMessage', 'Please enter a valid name (min 2 characters)');
        return;
      }

      // Add player to game
      game.players[socket.id] = {
        name: name.trim(),
        role: 'unassigned',
        id: socket.id
      };

      console.log(`Player joined: ${name} (${socket.id})`);
      io.emit('playerUpdate', Object.values(game.players));
      socket.emit('clearError');

    } catch (error) {
      console.error('Join game error:', error);
      socket.emit('errorMessage', 'Error joining game');
    }
  });

  socket.on('startGame', ({ password, category }) => {
    try {
      // Admin validation
      if (password !== ADMIN_PASSWORD) {
        console.log('Invalid admin password attempt');
        socket.emit('errorMessage', 'Invalid admin password!');
        return;
      }
      
      if (Object.keys(game.players).length < 2) {
        socket.emit('errorMessage', 'Need at least 2 players to start!');
        return;
      }

      // Reset game state
      game.isGameActive = true;
      game.currentWord = getRandomWord(category);
      game.imposter = null;

      // Assign imposter
      const playerIds = Object.keys(game.players);
      game.imposter = playerIds[Math.floor(Math.random() * playerIds.length)];

      // Assign roles and notify players
      playerIds.forEach(id => {
        const role = id === game.imposter ? 'imposter' : 'crewmate';
        game.players[id].role = role;
        io.to(id).emit('roleAssignment', {
          role,
          word: role === 'crewmate' ? game.currentWord : '???'
        });
      });

      console.log(`Game started with word: ${game.currentWord}`);
      io.emit('gameStarted');

    } catch (error) {
      console.error('Start game error:', error);
      socket.emit('errorMessage', 'Error starting game');
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete game.players[socket.id];
    io.emit('playerUpdate', Object.values(game.players));
  });
});