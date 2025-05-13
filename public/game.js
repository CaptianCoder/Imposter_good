const socket = io();
let isAdmin = false;
let maxImposters = 5;

// Input handling
document.getElementById('nameInput').addEventListener('input', (e) => {
  const isAdminAttempt = e.target.value.toLowerCase() === 'admin';
  document.getElementById('passwordGroup').style.display = isAdminAttempt ? 'block' : 'none';
});

// Authentication
function handleAuth() {
  const name = document.getElementById('nameInput').value.trim();
  const password = document.getElementById('passwordInput')?.value;
  
  socket.emit('join', { 
    name,
    password: name.toLowerCase() === 'admin' ? password : undefined 
  });
  
  // Clear inputs
  document.getElementById('nameInput').value = '';
  if (document.getElementById('passwordInput')) {
    document.getElementById('passwordInput').value = '';
  }
}

// Game controls
function startGame() {
  const category = document.getElementById('category').value;
  const imposterCount = parseInt(document.getElementById('imposterCount').value);
  socket.emit('startGame', { category, imposterCount });
}

function endGame() {
  if (confirm('Are you sure you want to end the current round?')) {
    socket.emit('endGame');
  }
}

// Socket listeners
socket.on('adminAuth', ({ success, round, maxImposters: adminMax }) => {
  if (success) {
    isAdmin = true;
    maxImposters = adminMax;
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('roundNumber').textContent = round;
  }
});

socket.on('playersUpdate', ({ players, maxImposters: serverMax }) => {
  maxImposters = serverMax;
  document.getElementById('playerCount').textContent = players.length;
  document.getElementById('playerList').innerHTML = players
    .map(p => `<li>${p.name}</li>`).join('');

  // Update imposter count dropdown
  if (isAdmin) {
    const imposterSelect = document.getElementById('imposterCount');
    const playerCount = players.length;
    const maxAllowed = Math.min(playerCount - 1, maxImposters);
    
    imposterSelect.innerHTML = '';
    for (let i = 1; i <= maxAllowed; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `${i} Imposter${i !== 1 ? 's' : ''}`;
      imposterSelect.appendChild(option);
    }
  }
});

socket.on('roleAssignment', ({ role, word }) => {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('gameArea').style.display = 'block';
  document.getElementById('roleDisplay').textContent = role.toUpperCase();
  document.getElementById('wordDisplay').textContent = word;
});

socket.on('errorMessage', (message) => {
  const errorElement = document.getElementById('errorMessage') || 
                      document.getElementById('adminErrorMessage');
  showError(errorElement, message);
});

socket.on('clearError', () => {
  const errorElement = document.getElementById('errorMessage') || 
                      document.getElementById('adminErrorMessage');
  clearError(errorElement);
});

// Helper functions
function showError(element, message) {
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => clearError(element), 5000);
  }
}

function clearError(element) {
  if (element) {
    element.textContent = '';
    element.style.display = 'none';
  }
}