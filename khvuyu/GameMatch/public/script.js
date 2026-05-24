const API_URL = 'http://localhost:3000/api';

let selectedGenres = new Set();
let genresList = [];

async function loadGenres() {
    const response = await fetch(`${API_URL}/genres`);
    genresList = await response.json();
    
    const container = document.getElementById('genresList');
    genresList.forEach(genre => {
        const btn = document.createElement('div');
        btn.className = 'genre-btn';
        btn.textContent = genre.name_ru;
        btn.dataset.id = genre.id;
        btn.onclick = () => {
            if (selectedGenres.has(genre.id)) {
                selectedGenres.delete(genre.id);
                btn.classList.remove('selected');
            } else {
                selectedGenres.add(genre.id);
                btn.classList.add('selected');
            }
        };
        container.appendChild(btn);
    });
}

async function searchGames() {
    const gpu = document.getElementById('gpu').value;
    const cpu = document.getElementById('cpu').value;
    const ram = document.getElementById('ram').value;
    
    const params = new URLSearchParams({ gpu, cpu, ram });
    if (selectedGenres.size > 0) {
        params.append('genres', Array.from(selectedGenres).join(','));
    }
    
    const response = await fetch(`${API_URL}/games?${params}`);
    const games = await response.json();
    
    const container = document.getElementById('resultsList');
    container.innerHTML = '';
    
    games.forEach(game => {
        const div = document.createElement('div');
        div.className = 'game-item';
        div.style.borderLeftColor = game.compatibility.color;
        div.innerHTML = `
            <div class="game-name">🎮 ${game.name}</div>
            <div class="game-specs">
                💻 Требует: ${game.min_gpu} | ${game.min_cpu} | ${game.min_ram} ГБ
            </div>
            <div class="compat-badge" style="background: ${game.compatibility.color}20; color: ${game.compatibility.color}">
                ${game.compatibility.text}
            </div>
        `;
        container.appendChild(div);
    });
}

const slider = document.getElementById('ram');
const ramValue = document.getElementById('ramValue');
slider.addEventListener('input', () => {
    ramValue.textContent = `${slider.value} ГБ`;
});

document.getElementById('searchBtn').addEventListener('click', searchGames);
loadGenres();
setTimeout(searchGames, 500);