document.addEventListener("DOMContentLoaded", () => {
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    if (!mobileMenuBtn || !mobileMenu) return;

    mobileMenuBtn.addEventListener("click", () => {
        mobileMenu.classList.toggle("hidden");
        mobileMenuBtn.setAttribute(
            "aria-expanded",
            String(!mobileMenu.classList.contains("hidden"))
        );
    });
});
