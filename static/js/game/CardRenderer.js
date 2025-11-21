/**
 * CardRenderer.js
 * Se encarga de transformar los datos de las cartas en elementos visuales (imágenes)
 */
class CardRenderer {
    constructor() {
        this.basePath = '/static/images/cards';
    }

    /**
     * Genera la ruta de la imagen basada en la convención de nombres
     * Convención: {color}_{valor}.png
     */
    getCardImageSrc(card) {
        if (!card) return `${this.basePath}/back.png`;

        // 1. Normalizar datos (asegurar minúsculas)
        let value = String(card.value).toLowerCase();
        let color = String(card.color).toLowerCase();

        // 2. Mapeo de valores especiales de la API a nombres de archivo
        const specialValues = {
            'draw_two': 'draw2',
            'draw_four': 'draw4',
            'change_color': 'wild',
            'wild': 'wild' // Por si acaso viene como 'wild'
        };

        // Si el valor está en el mapa, usamos el nombre mapeado, si no, el valor original
        if (specialValues[value]) {
            value = specialValues[value];
        }

        // 3. Lógica para Comodines (Wild y Draw4)
        // Estos archivos no llevan prefijo de color (ej: wild.png, wild_draw4.png)
        if (value === 'wild' || value === 'draw4') {
            return `${this.basePath}/${value}.png`;
        }

        // 4. Cartas normales y de acción coloreadas (ej: red_1.png, blue_skip.png)
        return `${this.basePath}/${color}_${value}.png`;
    }

    /**
     * Crea el elemento HTML para una carta en la mano del jugador
     * @param {Object} card - Datos de la carta
     * @param {Number} index - Índice en el array
     * @param {Boolean} isMyTurn - Si es el turno del jugador (para cursor)
     * @returns {HTMLElement}
     */
    createHandCard(card, index, isMyTurn) {
        const cardContainer = document.createElement('div');
        
        // Clases para el CSS (animaciones y hover)
        // Agregamos la clase del color para efectos de borde si es necesario
        cardContainer.className = `card ${card.color}`; 
        cardContainer.dataset.index = index;
        
        // Configuración de interaccion
        if (isMyTurn) {
            cardContainer.style.cursor = 'pointer';
        } else {
            cardContainer.style.cursor = 'not-allowed';
            cardContainer.style.opacity = '0.8'; // Un poco más opaco si no es tu turno
        }

        // Crear la imagen
        const img = document.createElement('img');
        img.src = this.getCardImageSrc(card);
        img.className = 'card__image';
        img.alt = `${card.value} ${card.color}`;
        img.draggable = false; // Prevenir arrastre fantasma de imágenes

        // Manejo de error si la imagen no existe (fallback visual)
        img.onerror = () => {
            console.warn(`Imagen no encontrada: ${img.src}`);
            img.src = `${this.basePath}/back.png`; // Fallback seguro
        };

        cardContainer.appendChild(img);
        return cardContainer;
    }

    /**
     * Renderiza la carta central (pila de descarte)
     * @param {HTMLElement} containerElement - El div #current-card
     * @param {Object} card - Datos de la carta
     */
    renderCenterCard(containerElement, card) {
        if (!containerElement || !card) return;

        // Limpiar contenido anterior
        containerElement.innerHTML = '';
        
        // Actualizar clases del contenedor para el fondo/borde (importante para wild cards jugadas)
        // Si es wild card jugada, 'card.color' tendrá el color elegido por el jugador
        containerElement.className = `current-card ${card.color}`;

        const img = document.createElement('img');
        img.src = this.getCardImageSrc(card);
        img.className = 'card__image';
        img.alt = `Carta actual: ${card.value} ${card.color}`;

        containerElement.appendChild(img);

        if (card.color === 'black' && card.declared_color) {
            const indicator = document.createElement('div');
            indicator.className = 'color-indicator';
            indicator.innerHTML = `
                <div class="color-indicator__dot color-indicator__dot--${card.declared_color}"></div>
                <span class="color-indicator__text">Color: ${card.declared_color}</span>
            `;
            containerElement.appendChild(indicator);
        }
    }
}

export default CardRenderer;