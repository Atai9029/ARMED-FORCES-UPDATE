const stripe = Stripe("ТВОЙ_PUBLIC_KEY"); // вставь свой ключ
const elements = stripe.elements();

const card = elements.create("card", {
    style: {
        base: {
            color: "#ffffff",
            fontSize: "16px"
        }
    }
});

card.mount("#card-element");

const button = document.getElementById("payBtn");
const status = document.getElementById("payment-status");

button.addEventListener("click", async () => {
    status.textContent = "Обработка...";

    const {paymentMethod, error} = await stripe.createPaymentMethod({
        type: "card",
        card: card
    });

    if (error) {
        status.textContent = error.message;
    } else {
        status.textContent = "Карта принята (тестовый режим)";
        console.log(paymentMethod);
    }
});