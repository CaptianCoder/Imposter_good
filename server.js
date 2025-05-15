const express = require('express');
const socketio = require('socket.io');
const path = require('path');
const app = express();
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'admin123';
const MAX_PLAYERS = 6;

const words = JSON.parse(fs.readFileSync('words.json', 'utf8'));
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

let game = {
  players: {},
  admins: new Set(),
  isGameActive: false,
  currentQuestion: null,
  imposters: [],
  currentRound: 0,
  mode: 'imposter',
  answers: {},
  categories: {
    imposter: Object.keys(words).filter(c => c !== 'random'),
    guessing: Object.keys(questions.categories)
  }
};

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.render('index'));
app.get('/admin', (req, res) => res.render('admin'));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

const io = socketio(server);

const getRandomContent = (category, mode) => {
  try {
    if (mode === 'imposter') {
      const validCategories = game.categories.imposter;
      const selectedCategory = validCategories.includes(category) 
        ? category 
        : validCategories[Math.floor(Math.random() * validCategories.length)];
      return { 
        type: 'word',
        content: words[selectedCategory][Math.floor(Math.random() * words[selectedCategory].length)]
      };
    }
    if (mode === 'guessing') {
      const validCategories = game.categories.guessing;
      const selectedCategory = validCategories.includes(category)
        ? category
        : validCategories[Math.floor(Math.random() * validCategories.length)];
      const categoryQuestions = questions.categories[selectedCategory];
      const randomQuestion = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];
      return {
        type: 'question',
        content: randomQuestion
      };
    }
  } catch (error) {
    return mode === 'imposter' 
      ? { type: 'word', content: 'DefaultWord' }
      : { type: 'question', content: { crewmate: "What's your name?", imposter: "What's your favorite number?" } };
  }
};

io.on('connection', (socket) => {
  const sendPlayersUpdate = () => {
    io.sockets.sockets.forEach(s => {
      const isAdmin = game.admins.has(s.id);
      const playerData = Object.values(game.players).map(p => ({
        id: p.id,
        name: p.name,
        role: isAdmin ? p.role : undefined
      }));
      s.emit('playersUpdate', playerData);
    });
  };

  socket.emit('categories', game.categories);
  sendPlayersUpdate();

  socket.on('join', ({ name, password }, callback) => {
    if (name.toLowerCase() === 'admin') {
      if (password === ADMIN_PASSWORD) {
        game.admins.add(socket.id);
        socket.emit('adminAuth', { success: true });
        sendPlayersUpdate();
        return callback?.({ success: true });
      }
      return callback?.({ error: 'Invalid admin password' });
    }

    const cleanName = name?.trim();
    if (!cleanName || cleanName.length < 2) return callback?.({ error: 'Name must be at least 2 characters' });
    if (Object.keys(game.players).length >= MAX_PLAYERS) return callback?.({ error: 'Lobby full' });
    if (game.isGameActive) return callback?.({ error: 'Game in progress' });

    game.players[socket.id] = { id: socket.id, name: cleanName, role: 'unassigned' };
    sendPlayersUpdate();
    callback?.({ success: true });
  });

  socket.on('startGame', ({ category, imposterCount, mode }, callback) => {
    if (!game.admins.has(socket.id)) return callback?.({ error: 'Admin required' });
    const players = Object.keys(game.players);
    if (players.length < 2) return callback?.({ error: 'Need 2+ players' });

    game.currentRound++;
    game.isGameActive = true;
    game.mode = mode;
    game.currentQuestion = getRandomContent(category, mode);
    game.imposters = [];
    game.answers = {};

    while (game.imposters.length < imposterCount) {
      const randomPlayer = players[Math.floor(Math.random() * players.length)];
      if (!game.imposters.includes(randomPlayer)) game.imposters.push(randomPlayer);
    }

    players.forEach(playerId => {
      const role = game.imposters.includes(playerId) ? 'imposter' : 'crewmate';
      game.players[playerId].role = role;
      
      let content;
      if (mode === 'imposter') {
        content = role === 'crewmate' 
          ? game.currentQuestion.content 
          : '???';
      } else {
        content = game.currentQuestion.content[role];
      }

      io.to(playerId).emit('roleAssignment', { 
        role, 
        content,
        mode
      });
    });

    io.emit('gameStarted', { mode, round: game.currentRound });
    callback?.({ success: true });
  });

  socket.on('submitAnswer', (answer) => {
    if (!game.isGameActive || !game.players[socket.id]) return;
    game.answers[socket.id] = {
      name: game.players[socket.id].name,
      answer: answer.trim(),
      role: game.players[socket.id].role
    };
    io.emit('answersUpdate', Object.values(game.answers));
  });

  socket.on('revealQuestion', (callback) => {
    if (!game.admins.has(socket.id)) return callback?.({ error: 'Admin required' });
    io.emit('questionRevealed', {
      question: game.currentQuestion.content,
      answers: Object.values(game.answers)
    });
    callback?.({ success: true });
  });

  socket.on('endGame', (callback) => {
    if (!game.admins.has(socket.id)) return callback?.({ error: 'Admin required' });
    
    game.isGameActive = false;
    game.imposters = [];
    game.answers = {};
    Object.values(game.players).forEach(p => p.role = 'unassigned');
    
    io.emit('gameEnded');
    sendPlayersUpdate();
    callback?.({ success: true });
  });

  socket.on('disconnect', () => {
    if (game.admins.has(socket.id)) game.admins.delete(socket.id);
    if (game.players[socket.id]) {
      delete game.players[socket.id];
      sendPlayersUpdate();
    }
  });
});