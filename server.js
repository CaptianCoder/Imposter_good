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
  currentContent: null,
  imposters: [],
  currentRound: 0,
  mode: 'imposter',
  answers: {}
};

const ADMIN_PASSWORD = 'admin123';
const words = require('./words.json');
const questions = require('./questions.json');

const getRandomContent = (category, mode) => {
  if (mode === 'imposter') {
    const categories = category === 'random' 
      ? Object.keys(words).filter(c => c !== 'random') 
      : [category];
    const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    return words[selectedCategory][Math.floor(Math.random() * words[selectedCategory].length)];
  }
  
  if (mode === 'guessing') {
    const categoryQuestions = questions.categories[category] || questions.categories.basic;
    return categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];
  }
};

app.get('/', (req, res) => res.render('index'));

const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Server running');
});

const io = socketio(server);

io.on('connection', (socket) => {
  socket.on('join', ({ name, password }) => {
    if (name.toLowerCase() === 'admin') {
      if (password === ADMIN_PASSWORD) {
        game.admins.add(socket.id);
        socket.emit('adminAuth', { success: true });
        console.log(`Admin authenticated: ${socket.id}`);
      } else {
        socket.emit('error', 'Invalid admin password');
      }
      return;
    }

    if (game.isGameActive) {
      socket.emit('error', 'Game in progress');
      return;
    }

    if (Object.keys(game.players).length >= 6) {
      socket.emit('error', 'Lobby full');
      return;
    }

    if (!name || name.length < 2) {
      socket.emit('error', 'Invalid name');
      return;
    }

    game.players[socket.id] = { name, role: 'unassigned' };
    io.emit('playersUpdate', Object.values(game.players));
  });

  socket.on('startGame', ({ category, imposterCount, mode }) => {
    if (!game.admins.has(socket.id)) {
      socket.emit('error', 'Unauthorized');
      return;
    }

    const players = Object.keys(game.players);
    if (players.length < 2) {
      socket.emit('error', 'Need at least 2 players');
      return;
    }

    const maxImposters = mode === 'guessing' ? 1 : Math.min(players.length - 1, 5);
    if (!imposterCount || imposterCount < 1 || imposterCount > maxImposters) {
      socket.emit('error', `Invalid imposters (1-${maxImposters})`);
      return;
    }

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

    // Assign roles
    players.forEach(id => {
      const role = game.imposters.includes(id) ? 'imposter' : 'crewmate';
      game.players[id].role = role;
      
      const content = role === 'crewmate'
        ? (mode === 'imposter' ? game.currentContent : game.currentContent.crewmate)
        : (mode === 'imposter' ? '???' : game.currentContent.imposter);

      io.to(id).emit('roleAssignment', { role, content, mode });
    });

    io.emit('gameStarted', { mode, round: game.currentRound });
  });

  socket.on('submitAnswer', (answer) => {
    if (!game.isGameActive || !game.players[socket.id]) return;
    
    game.answers[socket.id] = {
      name: game.players[socket.id].name,
      answer: answer.trim(),
      role: game.players[socket.id].role
    };
    
    io.emit('updateAnswers', Object.values(game.answers));
  });

  socket.on('endGame', () => {
    if (!game.admins.has(socket.id)) return;
    
    game.isGameActive = false;
    game.imposters = [];
    game.answers = {};
    Object.values(game.players).forEach(p => p.role = 'unassigned');
    io.emit('gameEnded', game.currentRound);
  });

  socket.on('disconnect', () => {
    game.admins.delete(socket.id);
    delete game.players[socket.id];
    io.emit('playersUpdate', Object.values(game.players));
  });
});