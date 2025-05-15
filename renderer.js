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
let currentQuestion = null;

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

// Cargar archivo JSON automáticamente
async function loadJsonFile() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/Jaime2273/geo-game/main/javea.json');
        const data = await response.json();
        
        markersData = data.markers || [];
        completedMarkers = [];
        currentTargetIndex = -1;
        currentQuestion = null;
        
        if (markersData.length > 0) {
            gameStatus.textContent = `Juego cargado: ${data.name} - ${markersData.length} puntos`;
            startGame();
        } else {
            gameStatus.textContent = "El archivo no contiene puntos de interés";
        }
    } catch (error) {
        console.error("Error al cargar JSON:", error);
        gameStatus.textContent = "Error al cargar los datos del juego";
    }
}

// Iniciar el juego
function startGame() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
    
    if (navigator.geolocation) {
        gameStatus.textContent = "Buscando tu ubicación...";
        
        const options = {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 5000
        };
        
        watchId = navigator.geolocation.watchPosition(
            position => {
                const newPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                if (!playerPosition || 
                    calculateDistance(playerPosition.lat, playerPosition.lng, newPos.lat, newPos.lng) > 0.01) {
                    playerPosition = newPos;
                    updatePlayerPosition();
                    findClosestMarker();
                }
            },
            error => {
                console.error("Geolocation error:", error);
                gameStatus.textContent = "Error al obtener la ubicación";
            },
            options
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
            }),
            zIndexOffset: 1000
        }).addTo(map);
    } else {
        playerMarker.setLatLng([playerPosition.lat, playerPosition.lng]);
    }
    
    const currentZoom = map.getZoom();
    const playerLatLng = [playerPosition.lat, playerPosition.lng];
    const mapCenter = map.getCenter();
    const distanceToCenter = map.distance(mapCenter, playerLatLng);
    
    if (distanceToCenter > 50) {
        map.panTo(playerLatLng, {
            animate: true,
            duration: 1,
            easeLinearity: 0.25
        });
    }
}

// Encontrar el marcador más cercano
function findClosestMarker() {
    if (!playerPosition || markersData.length === 0) return;
    
    const availableMarkers = markersData.filter((_, index) => !completedMarkers.includes(index));
    
    if (availableMarkers.length === 0) {
        gameStatus.textContent = "¡Has completado todos los puntos!";
        return;
    }
    
    const markersWithDistances = availableMarkers.map(marker => {
        const distance = calculateDistance(
            playerPosition.lat, playerPosition.lng,
            marker.lat, marker.lng
        );
        return { ...marker, distance };
    });
    
    markersWithDistances.sort((a, b) => a.distance - b.distance);
    
    const closestMarker = markersWithDistances[0];
    const closestMarkerIndex = markersData.findIndex(m => 
        m.lat === closestMarker.lat && m.lng === closestMarker.lng
    );
    
    if (currentTargetIndex !== closestMarkerIndex) {
        currentTargetIndex = closestMarkerIndex;
        setTargetMarker(closestMarker);
    } else {
        updateTargetDistance(closestMarker.distance);
    }
    
    if (closestMarker.distance <= 0.03) {
        showQuestionPanel(markersData[currentTargetIndex]);
    }
}

// Calcular distancia entre dos puntos en km
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
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
    
    if (playerPosition) {
        drawPath(playerPosition, { lat: marker.lat, lng: marker.lng });
    }
}

// Actualizar la distancia al objetivo
function updateTargetDistance(distance) {
    const distanceInMeters = Math.round(distance * 1000);
    targetDistance.textContent = `${distanceInMeters} metros`;
    
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

function showQuestionPanel(marker) {
    if (!marker.questions || marker.questions.length === 0) {
        completeMarker();
        return;
    }
    
    // Solo mezclar las respuestas la primera vez que se muestra esta pregunta
    if (!currentQuestion) {
        const question = marker.questions[0]; // Usamos siempre la primera pregunta para consistencia
        
        // Mezclar las respuestas solo una vez y guardar ese orden
        const shuffledAnswers = [
            { text: question.correctAnswer, isCorrect: true },
            ...question.wrongAnswers.map(answer => ({ text: answer, isCorrect: false }))
        ].sort(() => Math.random() - 0.5);
        
        currentQuestion = {
            questionObj: question,
            answers: shuffledAnswers // Guardamos el orden mezclado
        };
    }
    
    // Mostrar la pregunta y las respuestas (en el orden ya mezclado)
    questionText.textContent = currentQuestion.questionObj.question;
    answersContainer.innerHTML = '';
    
    currentQuestion.answers.forEach(answer => {
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
    document.querySelectorAll('.answer-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
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
        
        if (targetMarker) {
            targetMarker.setIcon(L.divIcon({
                className: 'completed-icon',
                html: '✅',
                iconSize: [30, 30]
            }));
        }
    }
    
    currentQuestion = null;
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