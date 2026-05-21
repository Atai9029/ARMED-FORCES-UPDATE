function changeImage(img) {
    const mainImage = document.getElementById("mainImage");
    mainImage.src = img.src;

    const thumbs = document.querySelectorAll(".thumbs img");
    thumbs.forEach(item => item.classList.remove("active"));

    img.classList.add("active");
}