// Variables globales
let map;
let playerMarker;
let targetMarker;
let playerPosition = null;
let targetPosition = null;
let currentTargetIndex = -1;
let markersData = [];
let completedMarkers = [];
let watchId = null;
let lastDistance = null;

// Elementos del DOM
const loadFileBtn = document.getElementById('load-file-btn');
const gameStatus = document.getElementById('game-status');
const targetName = document.getElementById('target-name');
const targetDistance = document.getElementById('target-distance');
const distanceDirection = document.getElementById('distance-direction');
const questionPanel = document.getElementById('question-panel');
const questionText = document.getElementById('question-text');
const answersContainer = document.getElementById('answers-container');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const completedCount = document.getElementById('completed-count');
const remainingCount = document.getElementById('remaining-count');

// Inicialización del mapa
function initMap() {
    map = L.map('map').setView([38.7895, 0.1667], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// Cargar archivo JSON
async function loadJsonFile() {
    try {
        const filePath = await window.electronAPI.selectJsonFile();
        if (!filePath) return;

        const response = await fetch(filePath);
        const data = await response.json();
        
        markersData = data.markers || [];
        completedMarkers = [];
        currentTargetIndex = -1;
        
        if (markersData.length > 0) {
            gameStatus.textContent = `Archivo cargado: ${data.name} - ${markersData.length} puntos`;
            startGame();
        } else {
            gameStatus.textContent = "El archivo no contiene puntos de interés";
        }
    } catch (error) {
        console.error("Error loading JSON file:", error);
        gameStatus.textContent = "Error al cargar el archivo";
    }
}

// Iniciar el juego
function startGame() {
    // Detener cualquier seguimiento anterior
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
    
    // Iniciar seguimiento de ubicación
    if (navigator.geolocation) {
        gameStatus.textContent = "Buscando tu ubicación...";
        
        watchId = navigator.geolocation.watchPosition(
            position => {
                playerPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                updatePlayerPosition();
                findClosestMarker();
            },
            error => {
                console.error("Geolocation error:", error);
                gameStatus.textContent = "Error al obtener la ubicación";
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    } else {
        gameStatus.textContent = "Geolocalización no soportada por tu navegador";
    }
    
    updateStats();
}

// Actualizar la posición del jugador en el mapa
function updatePlayerPosition() {
    if (!playerPosition) return;
    
    if (!playerMarker) {
        playerMarker = L.marker([playerPosition.lat, playerPosition.lng], {
            icon: L.divIcon({
                className: 'player-icon',
                html: '📍',
                iconSize: [30, 30]
            })
        }).addTo(map);
    } else {
        playerMarker.setLatLng([playerPosition.lat, playerPosition.lng]);
    }
    
    map.panTo([playerPosition.lat, playerPosition.lng], { animate: true, duration: 1 });
}

// Encontrar el marcador más cercano
function findClosestMarker() {
    if (!playerPosition || markersData.length === 0) return;
    
    // Filtrar marcadores no completados
    const availableMarkers = markersData.filter((_, index) => !completedMarkers.includes(index));
    
    if (availableMarkers.length === 0) {
        gameStatus.textContent = "¡Has completado todos los puntos!";
        return;
    }
    
    // Calcular distancias a todos los marcadores disponibles
    const markersWithDistances = availableMarkers.map(marker => {
        const distance = calculateDistance(
            playerPosition.lat, playerPosition.lng,
            marker.lat, marker.lng
        );
        return { ...marker, distance };
    });
    
    // Ordenar por distancia
    markersWithDistances.sort((a, b) => a.distance - b.distance);
    
    const closestMarker = markersWithDistances[0];
    const closestMarkerIndex = markersData.findIndex(m => 
        m.lat === closestMarker.lat && m.lng === closestMarker.lng
    );
    
    // Actualizar el marcador objetivo si es diferente al actual
    if (currentTargetIndex !== closestMarkerIndex) {
        currentTargetIndex = closestMarkerIndex;
        setTargetMarker(closestMarker);
    } else {
        updateTargetDistance(closestMarker.distance);
    }
    
    // Verificar si el jugador está lo suficientemente cerca
    if (closestMarker.distance <= 0.03) { // 30 metros
        showQuestionPanel(markersData[currentTargetIndex]);
    }
}

// Calcular distancia entre dos puntos en km
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Establecer el marcador objetivo
function setTargetMarker(marker) {
    if (targetMarker) {
        map.removeLayer(targetMarker);
    }
    
    targetMarker = L.marker([marker.lat, marker.lng], {
        icon: L.divIcon({
            className: 'target-icon',
            html: '🎯',
            iconSize: [30, 30]
        })
    }).addTo(map);
    
    targetName.textContent = marker.title;
    updateTargetDistance(marker.distance);
    
    // Dibujar línea entre jugador y objetivo
    if (playerPosition) {
        drawPath(playerPosition, { lat: marker.lat, lng: marker.lng });
    }
}

// Actualizar la distancia al objetivo
function updateTargetDistance(distance) {
    const distanceInMeters = Math.round(distance * 1000);
    targetDistance.textContent = `${distanceInMeters} metros`;
    
    // Mostrar si el jugador se está acercando o alejando
    if (lastDistance !== null) {
        if (distance < lastDistance) {
            distanceDirection.textContent = "Te estás acercando";
            distanceDirection.style.color = "#2ecc71";
        } else if (distance > lastDistance) {
            distanceDirection.textContent = "Te estás alejando";
            distanceDirection.style.color = "#e74c3c";
        } else {
            distanceDirection.textContent = "Misma distancia";
            distanceDirection.style.color = "#666";
        }
    }
    lastDistance = distance;
}

// Dibujar línea entre dos puntos
function drawPath(start, end) {
    // Limpiar cualquier ruta anterior
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });
    
    const path = L.polyline([start, end], {
        color: '#3498db',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);
}

// Mostrar panel de preguntas
function showQuestionPanel(marker) {
    if (!marker.questions || marker.questions.length === 0) {
        completeMarker();
        return;
    }
    
    // Seleccionar una pregunta aleatoria
    const randomQuestion = marker.questions[Math.floor(Math.random() * marker.questions.length)];
    questionText.textContent = randomQuestion.question;
    
    // Mezclar respuestas
    const answers = [
        { text: randomQuestion.correctAnswer, isCorrect: true },
        ...randomQuestion.wrongAnswers.map(answer => ({ text: answer, isCorrect: false }))
    ].sort(() => Math.random() - 0.5);
    
    // Mostrar respuestas
    answersContainer.innerHTML = '';
    answers.forEach(answer => {
        const answerBtn = document.createElement('button');
        answerBtn.className = 'answer-option';
        answerBtn.textContent = answer.text;
        answerBtn.dataset.correct = answer.isCorrect;
        answerBtn.addEventListener('click', () => selectAnswer(answerBtn));
        answersContainer.appendChild(answerBtn);
    });
    
    submitAnswerBtn.disabled = true;
    questionPanel.classList.remove('hidden');
    gameStatus.textContent = "Responde la pregunta sobre este lugar";
}

// Seleccionar respuesta
function selectAnswer(button) {
    // Deseleccionar todas las respuestas
    document.querySelectorAll('.answer-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Seleccionar la respuesta clickeada
    button.classList.add('selected');
    submitAnswerBtn.disabled = false;
}

// Enviar respuesta
function submitAnswer() {
    const selectedAnswer = document.querySelector('.answer-option.selected');
    if (!selectedAnswer) return;
    
    const isCorrect = selectedAnswer.dataset.correct === 'true';
    
    if (isCorrect) {
        gameStatus.textContent = "¡Respuesta correcta!";
        completeMarker();
    } else {
        gameStatus.textContent = "Respuesta incorrecta. Inténtalo de nuevo.";
        questionPanel.classList.add('hidden');
    }
}

// Completar marcador
function completeMarker() {
    if (currentTargetIndex >= 0 && !completedMarkers.includes(currentTargetIndex)) {
        completedMarkers.push(currentTargetIndex);
        updateStats();
        
        // Cambiar el icono del marcador completado
        if (targetMarker) {
            targetMarker.setIcon(L.divIcon({
                className: 'completed-icon',
                html: '✅',
                iconSize: [30, 30]
            }));
        }
    }
    
    questionPanel.classList.add('hidden');
    currentTargetIndex = -1;
    lastDistance = null;
    distanceDirection.textContent = "-";
}

// Actualizar estadísticas
function updateStats() {
    completedCount.textContent = completedMarkers.length;
    remainingCount.textContent = markersData.length - completedMarkers.length;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadFileBtn.addEventListener('click', loadJsonFile);
    submitAnswerBtn.addEventListener('click', submitAnswer);
});