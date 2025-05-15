const socket = io();
let isAdmin = false;
let currentCategories = {};
let currentMode = 'imposter';

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
  revealButton: document.getElementById('revealButton'),
  endButton: document.getElementById('endButton'),
  answerInput: document.getElementById('answerInput'),
  submitAnswer: document.getElementById('submitAnswer'),
  playerList: document.getElementById('playerList'),
  playerCount: document.getElementById('playerCount'),
  role: document.getElementById('role'),
  contentDisplay: document.getElementById('contentDisplay'),
  answersList: document.getElementById('answersList'),
  roundNumber: document.getElementById('roundNumber')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  elements.nameInput.addEventListener('input', handleNameInput);
  elements.joinButton.addEventListener('click', handleAuth);
  elements.gameMode.addEventListener('change', handleGameModeChange);
  elements.startButton.addEventListener('click', startGame);
  elements.revealButton.addEventListener('click', revealQuestion);
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

function handleAuth() {
  const name = elements.nameInput.value.trim();
  const password = document.getElementById('passwordInput')?.value;
  if (!name) return showError('Please enter a name');

  elements.joinButton.disabled = true;
  elements.joinButton.textContent = 'Joining...';
  
  socket.emit('join', { name, password }, (response) => {
    elements.joinButton.disabled = false;
    elements.joinButton.textContent = 'Join Game';
    if (response?.error) showError(response.error);
  });
}

function handleGameModeChange() {
  updateCategoryOptions();
  updateImposterOptions();
}

function startGame() {
  const category = elements.category.value;
  const imposterCount = parseInt(elements.imposterCount.value);
  const mode = elements.gameMode.value;
  socket.emit('startGame', { category, imposterCount, mode }, handleResponse);
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
  updateCategoryOptions();
});

socket.on('playersUpdate', (players) => {
  elements.playerCount.textContent = players.length;
  elements.playerList.innerHTML = players
    .map(p => `<li>${p.name} ${p.role !== 'unassigned' ? `(${p.role})` : ''}</li>`)
    .join('');
  if (isAdmin) updateImposterOptions();
});

socket.on('adminAuth', ({ success }) => {
  if (success) {
    isAdmin = true;
    elements.authSection.style.display = 'none';
    elements.adminPanel.style.display = 'block';
    elements.playerSection.style.display = 'block';
    updateOptions();
  }
});

socket.on('roleAssignment', ({ role, content, mode }) => {
  elements.playerSection.style.display = 'none';
  elements.gameSection.style.display = 'block';
  elements.role.textContent = role.toUpperCase();
  elements.contentDisplay.innerHTML = `
    <h3>Your ${mode === 'guessing' ? 'Question' : 'Word'}:</h3>
    <p>${content}</p>
    ${role === 'imposter' ? '<p class="imposter-warning">(You are the IMPOSTER!)</p>' : ''}
  `;
  elements.answerSection.style.display = mode === 'guessing' ? 'block' : 'none';
});

socket.on('answersUpdate', (answers) => {
  elements.answersList.innerHTML = answers
    .map(a => `<div class="answer ${a.role}">${a.name}: ${a.answer}</div>`)
    .join('');
});

socket.on('questionRevealed', ({ question, answers }) => {
  elements.answersList.innerHTML = `
    <div class="revealed-question">
      <h3>True Questions:</h3>
      <p>🔵 Crewmate: ${question.crewmate}</p>
      <p>🔴 Imposter: ${question.imposter}</p>
    </div>
    ${answers.map(a => `<div class="answer ${a.role}">${a.name}: ${a.answer}</div>`).join('')}
  `;
});

socket.on('gameStarted', ({ mode }) => {
  currentMode = mode;
  elements.gameSection.style.display = 'block';
});

socket.on('gameEnded', () => {
  elements.gameSection.style.display = 'none';
  elements.answersList.innerHTML = '';
});

socket.on('error', showError);

// Helpers
function updateOptions() {
  updateCategoryOptions();
  updateImposterOptions();
}

function updateCategoryOptions() {
  const mode = elements.gameMode.value;
  const categories = currentCategories[mode === 'imposter' ? 'imposter' : 'guessing'];
  elements.category.innerHTML = `
    <option value="random">Random Category</option>
    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
  `;
}

function updateImposterOptions() {
  const playerCount = elements.playerList.children.length;
  const max = currentMode === 'guessing' ? 1 : Math.min(playerCount - 1, 5);
  elements.imposterCount.innerHTML = Array.from({length: max}, (_, i) => 
    `<option value="${i+1}">${i+1} Imposter${i+1 > 1 ? 's' : ''}</option>`
  ).join('');
  if (max > 0) elements.imposterCount.value = 1;
}

function handleResponse(response) {
  if (response?.error) showError(response.error);
}

function showError(msg) {
  elements.errorEl.textContent = msg;
  setTimeout(() => elements.errorEl.textContent = '', 3000);
}