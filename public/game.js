const socket = io();
let isAdmin = false;
let currentCategories = {};

// DOM Elements
const elements = {
  authSection: document.getElementById('authSection'),
  adminPanel: document.getElementById('adminPanel'),
  playerSection: document.getElementById('playerSection'),
  gameSection: document.getElementById('gameSection'),
  nameInput: document.getElementById('nameInput'),
  passwordInput: document.getElementById('passwordInput'),
  joinButton: document.getElementById('joinButton'),
  gameMode: document.getElementById('gameMode'),
  category: document.getElementById('category'),
  imposterCount: document.getElementById('imposterCount'),
  startButton: document.getElementById('startButton'),
  revealButton: document.getElementById('revealButton'),
  endButton: document.getElementById('endButton'),
  answerInput: document.getElementById('answerInput'),
  submitAnswer: document.getElementById('submitAnswer'),
  playerList: document.getElementById('playerList'),
  playerCount: document.getElementById('playerCount'),
  roleDisplay: document.getElementById('role'),
  contentDisplay: document.getElementById('contentDisplay'),
  answersList: document.getElementById('answersList'),
  roundNumber: document.getElementById('roundNumber'),
  errorEl: document.getElementById('error')
};

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  elements.nameInput.addEventListener('input', handleNameInput);
  elements.joinButton.addEventListener('click', handleAuth);
  elements.gameMode.addEventListener('change', updateGameOptions);
  elements.startButton.addEventListener('click', startGame);
  elements.revealButton.addEventListener('click', revealQuestion);
  elements.endButton.addEventListener('click', endGame);
  elements.submitAnswer.addEventListener('click', submitAnswer);
  elements.answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });
});

function handleNameInput(e) {
  elements.passwordInput.parentElement.style.display = 
    e.target.value.toLowerCase() === 'admin' ? 'block' : 'none';
}

function handleAuth() {
  const name = elements.nameInput.value.trim();
  const password = elements.passwordInput.value;
  
  if (!name) return showError('Please enter a name');
  
  elements.joinButton.disabled = true;
  socket.emit('join', { name, password }, handleResponse);
}

function updateGameOptions() {
  const mode = elements.gameMode.value;
  updateCategoryOptions(mode);
  updateImposterCount();
}

function updateCategoryOptions(mode) {
  const categories = currentCategories[mode === 'imposter' ? 'imposter' : 'guessing'] || [];
  elements.category.innerHTML = `
    <option value="random">Random Category</option>
    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
  `;
}

function updateImposterCount() {
  const playerCount = elements.playerList.children.length;
  const max = elements.gameMode.value === 'guessing' ? 1 : Math.min(playerCount - 1, 5);
  elements.imposterCount.innerHTML = Array.from({length: max}, (_, i) => 
    `<option value="${i+1}">${i+1} Imposter${i+1 > 1 ? 's' : ''}</option>`
  ).join('');
}

function startGame() {
  const settings = {
    category: elements.category.value,
    imposterCount: parseInt(elements.imposterCount.value),
    mode: elements.gameMode.value
  };
  socket.emit('startGame', settings, handleResponse);
}

function revealQuestion() {
  socket.emit('revealQuestion', handleResponse);
}

function endGame() {
  if (confirm('End current round?')) socket.emit('endGame', handleResponse);
}

function submitAnswer() {
  const answer = elements.answerInput.value.trim();
  if (answer) {
    socket.emit('submitAnswer', answer);
    elements.answerInput.value = '';
  }
}

// Socket Handlers
socket.on('categories', (categories) => {
  currentCategories = categories;
  updateGameOptions();
});

socket.on('playersUpdate', (players) => {
  elements.playerCount.textContent = players.length;
  elements.playerList.innerHTML = players.map(p => `
    <li>${p.name}${p.role ? ` (${isAdmin ? p.role : 'player'})` : ''}</li>
  `).join('');
  
  if (isAdmin) updateImposterCount();
});

socket.on('adminAuth', ({ success }) => {
  if (success) {
    isAdmin = true;
    elements.authSection.style.display = 'none';
    elements.adminPanel.style.display = 'block';
    elements.playerSection.style.display = 'block';
    updateGameOptions();
  }
});

socket.on('roleAssignment', ({ role, content, mode }) => {
  elements.playerSection.style.display = 'none';
  elements.gameSection.style.display = 'block';
  elements.roleDisplay.textContent = `${role.toUpperCase()} ROLE`;
  elements.contentDisplay.innerHTML = `
    <h3>Your ${mode === 'guessing' ? 'Question' : 'Word'}:</h3>
    <div class="content-box">${content}</div>
    ${role === 'imposter' ? '<p class="warning">(You are the IMPOSTER!)</p>' : ''}
  `;
  elements.answerInput.style.display = mode === 'guessing' ? 'block' : 'none';
});

socket.on('answersUpdate', (answers) => {
  elements.answersList.innerHTML = answers.map(a => `
    <div class="answer ${a.role}">
      <span class="player-name">${a.name}:</span>
      <span class="answer-text">${a.answer}</span>
    </div>
  `).join('');
});

socket.on('questionRevealed', ({ question, answers }) => {
  elements.answersList.innerHTML = `
    <div class="revealed-questions">
      <h3>Original Questions:</h3>
      <div class="question crewmate-question">
        <span class="label">Crewmate:</span> ${question.crewmate}
      </div>
      <div class="question imposter-question">
        <span class="label">Imposter:</span> ${question.imposter}
      </div>
    </div>
    ${answers.map(a => `
      <div class="answer ${a.role}">
        <span class="player-name">${a.name}:</span>
        <span class="answer-text">${a.answer}</span>
      </div>
    `).join('')}
  `;
});

socket.on('gameStarted', ({ mode }) => {
  elements.gameSection.style.display = 'block';
  elements.answersList.innerHTML = '';
});

socket.on('gameEnded', () => {
  elements.gameSection.style.display = 'none';
  elements.playerSection.style.display = 'block';
  elements.answersList.innerHTML = '';
  elements.roleDisplay.textContent = '';
  elements.contentDisplay.innerHTML = '';
});

socket.on('error', (message) => showError(message));

// Helpers
function handleResponse(response) {
  elements.joinButton.disabled = false;
  elements.joinButton.textContent = 'Join Game';
  if (response?.error) showError(response.error);
}

function showError(message) {
  elements.errorEl.textContent = message;
  setTimeout(() => elements.errorEl.textContent = '', 3000);
}