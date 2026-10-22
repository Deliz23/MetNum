// ========================================
// MetNum - Interacción de la Página Principal
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Cerrar modal al hacer clic en el backdrop
    const modal = document.getElementById('course-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCourseModal();
            }
        });
    }

    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCourseModal();
        }
    });
});

let currentCourseUrl = null;

/**
 * Abre el modal con la información detallada del curso
 * @param {string} title - Título del módulo
 * @param {string} description - Descripción técnica
 * @param {string[]} topics - Lista de subtemas incluidos
 * @param {string|null} url - Enlace al laboratorio interactivo (si está disponible)
 */
function openCourseModal(title, description, topics = [], url = null) {
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-description');
    const topicsList = document.getElementById('modal-topics');
    const actionBtn = document.getElementById('modal-action-btn');
    const modal = document.getElementById('course-modal');

    if (!modal) return;

    if (modalTitle) modalTitle.innerText = title;
    if (modalDesc) modalDesc.innerText = description;
    
    if (topicsList) {
        topicsList.innerHTML = '';
        topics.forEach(topic => {
            const li = document.createElement('li');
            li.className = 'flex items-center text-slate-700 font-medium text-sm py-1';
            li.innerHTML = `<i class="fa-solid fa-circle-check text-indigo-500 mr-2.5 text-xs"></i> <span>${topic}</span>`;
            topicsList.appendChild(li);
        });
    }

    currentCourseUrl = url;

    if (actionBtn) {
        if (url) {
            actionBtn.innerHTML = 'Iniciar Módulo <i class="fa-solid fa-arrow-right ml-2 text-xs"></i>';
            actionBtn.className = 'w-1/2 py-2.5 bg-brand-wine hover:bg-brand-wineHover text-white rounded-xl font-semibold text-sm shadow-md transition-colors';
            actionBtn.onclick = () => {
                window.location.href = url;
            };
        } else {
            actionBtn.innerHTML = '<i class="fa-solid fa-clock mr-1.5"></i> En Desarrollo';
            actionBtn.className = 'w-1/2 py-2.5 bg-slate-200 text-slate-500 cursor-not-allowed rounded-xl font-semibold text-sm';
            actionBtn.onclick = () => {
                alert('Este módulo interactivo está actualmente en desarrollo en Python y se integrará próximamente.');
            };
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeCourseModal() {
    const modal = document.getElementById('course-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

/**
 * Filtro de tarjetas por categoría o estado
 */
function filterCourses(category, event) {
    const cards = document.querySelectorAll('.course-card');
    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.classList.remove('bg-brand-wine', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
    });

    if (event && event.currentTarget) {
        event.currentTarget.classList.remove('text-slate-600', 'hover:bg-slate-100');
        event.currentTarget.classList.add('bg-brand-wine', 'text-white', 'shadow-sm');
    }

    cards.forEach(card => {
        const matchesCategory = category === 'all' || card.classList.contains(category);
        card.style.display = matchesCategory ? 'flex' : 'none';
    });
}
