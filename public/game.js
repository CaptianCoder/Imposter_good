const socket = io();
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nameInput').addEventListener('input', e => {
    const isAdminAttempt = e.target.value.toLowerCase() === 'admin';
    document.getElementById('passwordGroup').style.display = isAdminAttempt ? 'block' : 'none';
  });

  document.getElementById('gameMode').addEventListener('change', updateImposterOptions);
});

function handleAuth() {
  const name = document.getElementById('nameInput').value.trim();
  const password = document.getElementById('passwordInput')?.value;
  
  socket.emit('join', { 
    name,
    password: name.toLowerCase() === 'admin' ? password : undefined 
  });
  
  clearInputs();
}

function startGame() {
  const category = document.getElementById('category').value;
  const imposterCount = parseInt(document.getElementById('imposterCount').value);
  const mode = document.getElementById('gameMode').value;
  
  if (!category || !imposterCount || !mode) return;
  
  socket.emit('startGame', { category, imposterCount, mode });
}

function updateImposterOptions() {
  const mode = document.getElementById('gameMode').value;
  const playerCount = document.getElementById('playerList').children.length;
  const max = mode === 'guessing' ? 1 : Math.min(playerCount - 1, 5);
  
  const select = document.getElementById('imposterCount');
  select.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i} Imposter${i !== 1 ? 's' : ''}`;
    select.appendChild(option);
  }
}

socket.on('adminAuth', ({ success }) => {
  if (!success) return;
  
  isAdmin = true;
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  updateImposterOptions();
});

socket.on('playersUpdate', (players) => {
  document.getElementById('playerCount').textContent = players.length;
  document.getElementById('playerList').innerHTML = players
    .map(p => `<li>${p.name}</li>`).join('');
    
  if (isAdmin) updateImposterOptions();
});

socket.on('roleAssignment', ({ role, content, mode }) => {
  document.getElementById('playerSection').style.display = 'none';
  const gameSection = document.getElementById('gameSection');
  gameSection.style.display = 'block';
  
  document.getElementById('role').textContent = role.toUpperCase();
  document.getElementById('contentDisplay').textContent = content;
  
  document.getElementById('answerSection').style.display = mode === 'guessing' 
    ? 'block' 
    : 'none';
});

socket.on('updateAnswers', (answers) => {
  document.getElementById('answersList').innerHTML = answers
    .map(a => `
      <div class="answer ${a.role}">
        <span class="name">${a.name}:</span>
        <span class="text">${a.answer}</span>
      </div>
    `).join('');
});

socket.on('error', (message) => {
  const errorEl = document.getElementById('error');
  errorEl.textContent = message;
  setTimeout(() => errorEl.textContent = '', 3000);
});

function clearInputs() {
  document.getElementById('nameInput').value = '';
  const passwordInput = document.getElementById('passwordInput');
  if (passwordInput) passwordInput.value = '';
}