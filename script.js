// Mobile menu toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

// Course Modal Functionality
function openCourseModal(title, description, topics) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-description').innerText = description;
    
    const topicsList = document.getElementById('modal-topics');
    topicsList.innerHTML = '';
    
    topics.forEach(topic => {
        const li = document.createElement('li');
        li.className = 'flex items-center text-slate-700 font-medium';
        li.innerHTML = `<i class="fa-solid fa-circle-check text-indigo-500 mr-2.5 text-xs"></i> ${topic}`;
        topicsList.appendChild(li);
    });

    const modal = document.getElementById('course-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeCourseModal() {
    const modal = document.getElementById('course-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Filter courses functionality
function filterCourses(category, event) {
    const cards = document.querySelectorAll('.course-card');
    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white');
        btn.classList.add('text-slate-300');
    });

    if (event && event.target) {
        event.target.classList.add('bg-indigo-600', 'text-white');
        event.target.classList.remove('text-slate-300');
    }

    cards.forEach(card => {
        if (category === 'all' || card.classList.contains(category)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}