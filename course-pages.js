document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "chapter") {
        renderChapter();
    }
});

function renderChapter() {
    const chapterId = new URLSearchParams(window.location.search).get("capitulo");
    const chapter = window.curriculum.find(item => item.id === chapterId);
    const container = document.getElementById("chapter-content");

    if (!chapter) {
        showNotFound(container, "No encontramos ese capítulo.");
        return;
    }

    document.title = `Capítulo ${chapter.roman}: ${chapter.title} · MetNum`;
    const topicCards = chapter.topics.map(topic => `
        <article class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col">
            <span class="self-start text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">TEMA ${topic.id}</span>
            <h2 class="mt-4 text-base sm:text-lg font-bold text-slate-900 leading-relaxed">${topic.title}</h2>
            <a href="${topic.href}" class="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-wine hover:bg-brand-wineHover text-white text-sm font-semibold px-4 py-3 transition-colors">
                Entrar al tema<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </a>
        </article>
    `).join("");

    container.innerHTML = `
        <nav class="text-sm text-slate-500 mb-7" aria-label="Ruta de navegación">
            <a href="index.html" class="hover:text-brand-wine">Inicio</a>
            <span class="mx-2" aria-hidden="true">/</span><span>Capítulo ${chapter.roman}</span>
        </nav>
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-wine">${chapter.unit}</p>
        <h1 class="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-950">Capítulo ${chapter.roman}: ${chapter.title}</h1>
        <section class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5" aria-label="Temas del capítulo">
            ${topicCards}
        </section>
    `;
}

function showNotFound(container, message) {
    document.title = "Contenido no encontrado · MetNum";
    container.innerHTML = `
        <section class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <h1 class="text-2xl font-bold text-slate-900">${message}</h1>
            <a href="index.html#capitulos" class="mt-5 inline-flex items-center gap-2 text-brand-wine font-semibold">
                <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>Volver a los capítulos
            </a>
        </section>
    `;
}
