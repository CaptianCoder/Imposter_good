const socket = io();
let players = [];

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Player page elements
  const joinButton = document.getElementById('joinButton');
  const nameInput = document.getElementById('nameInput');
  
  if (joinButton && nameInput) {
    joinButton.addEventListener('click', handleJoin);
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleJoin();
    });
  }

  // Admin page elements
  const startButton = document.getElementById('startButton');
  if (startButton) {
    startButton.addEventListener('click', handleStart);
  }
});

// Player functions
function handleJoin() {
  const name = document.getElementById('nameInput').value.trim();
  const errorElement = document.getElementById('errorMessage');
  
  if (!name) {
    showError(errorElement, 'Please enter a name!');
    return;
  }
  
  socket.emit('joinGame', name);
}

// Admin functions
function handleStart() {
  const password = document.getElementById('password').value.trim();
  const category = document.getElementById('category').value;
  const errorElement = document.getElementById('adminErrorMessage');
  
  if (!password) {
    showError(errorElement, 'Please enter admin password!');
    return;
  }
  
  socket.emit('startGame', { password, category });
}

// Socket event handlers
socket.on('playerUpdate', (updatedPlayers) => {
  players = updatedPlayers;
  document.getElementById('playerCount').textContent = players.length;
  document.getElementById('playerList').innerHTML = players
    .map(player => `<li>${player.name}</li>`).join('');
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