const socket = io();
let isAdmin = false;

// DOM Elements
const elements = {
  authSection: document.getElementById('authSection'),
  adminPanel: document.getElementById('adminPanel'),
  playerSection: document.getElementById('playerSection'),
  gameSection: document.getElementById('gameSection'),
  nameInput: document.getElementById('nameInput'),
  passwordGroup: document.getElementById('passwordGroup'),
  errorEl: document.getElementById('error'),
  joinButton: document.getElementById('joinButton'),
  gameMode: document.getElementById('gameMode'),
  category: document.getElementById('category'),
  imposterCount: document.getElementById('imposterCount'),
  startButton: document.getElementById('startButton'),
  endButton: document.getElementById('endButton'),
  answerInput: document.getElementById('answerInput'),
  submitAnswer: document.getElementById('submitAnswer')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  elements.nameInput.addEventListener('input', handleNameInput);
  elements.joinButton.addEventListener('click', handleAuth);
  elements.gameMode.addEventListener('change', updateImposterOptions);
  elements.startButton.addEventListener('click', startGame);
  elements.endButton.addEventListener('click', endGame);
  elements.submitAnswer.addEventListener('click', submitAnswer);
  elements.answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });
});

// Event Handlers
function handleNameInput(e) {
  elements.passwordGroup.style.display = 
    e.target.value.toLowerCase() === 'admin' ? 'block' : 'none';
}

// Update the handleAuth function:
function handleAuth() {
  const name = elements.nameInput.value.trim();
  const password = document.getElementById('passwordInput')?.value;

  // Basic client-side validation
  if (!name) {
    showError('Please enter a name');
    return;
  }

  // Clear previous errors
  elements.errorEl.textContent = '';

  // Add loading state
  elements.joinButton.disabled = true;
  elements.joinButton.textContent = 'Joining...';

  // Emit join event
  socket.emit('join', {
    name,
    password: name.toLowerCase() === 'admin' ? password : undefined
  }, (response) => {
    // Re-enable button after server response
    elements.joinButton.disabled = false;
    elements.joinButton.textContent = 'Join Game';
    
    if (response && response.error) {
      showError(response.error);
    }
  });
}

// When starting the game from admin panel:
function startGame() {
  const category = document.getElementById('category').value;
  const imposterCount = parseInt(document.getElementById('imposterCount').value);
  const mode = document.getElementById('gameMode').value;
  
  socket.emit('startGame', { category, imposterCount, mode }, (response) => {
    if (response?.error) {
      showError(response.error);
    }
  });
}

// When ending the game:
function endGame() {
  if (confirm('End current round?')) {
    socket.emit('endGame', (response) => {
      if (response?.error) {
        showError(response.error);
      }
    });
  }
}

function submitAnswer() {
  const answer = elements.answerInput.value.trim();
  if (answer) {
    socket.emit('submitAnswer', answer);
    elements.answerInput.value = '';
  }
}

// Socket Handlers
socket.on('playersUpdate', (players) => {
  elements.playerCount.textContent = players.length;
  elements.playerList.innerHTML = players
    .map(p => `<li>${p.name}</li>`)
    .join('');
  
  if (isAdmin) updateImposterOptions();
});

socket.on('adminAuth', ({ success }) => {
  if (success) {
    isAdmin = true;
    elements.authSection.style.display = 'none';
    elements.adminPanel.style.display = 'block';
    updateImposterOptions();
  }
});

socket.on('roleAssignment', ({ role, content, mode }) => {
  elements.playerSection.style.display = 'none';
  elements.gameSection.style.display = 'block';
  elements.role.textContent = role.toUpperCase();
  elements.contentDisplay.textContent = content;
  elements.answerSection.style.display = mode === 'guessing' ? 'block' : 'none';
});

socket.on('updateAnswers', (answers) => {
  elements.answersList.innerHTML = answers
    .map(a => `
      <div class="answer ${a.role}">
        <span class="name">${a.name}:</span>
        <span class="text">${a.answer}</span>
      </div>
    `).join('');
});

socket.on('error', (message) => {
  showError(message);
});

// Helpers
function updateImposterOptions() {
  const playerCount = elements.playerList.children.length;
  const mode = elements.gameMode.value;
  const max = mode === 'guessing' ? 1 : Math.min(playerCount - 1, 5);
  
  elements.imposterCount.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i} Imposter${i !== 1 ? 's' : ''}`;
    elements.imposterCount.appendChild(option);
  }
  if (max > 0) elements.imposterCount.value = 1;
}

function showError(message) {
  elements.errorEl.textContent = message;
  setTimeout(() => elements.errorEl.textContent = '', 3000);
}