
import {
    applyActionCode,
    getIdToken,
    onAuthStateChanged,
    reload,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import { auth } from "./firebase-config.js";

const statusElement = document.getElementById("verificationStatus");
const emailElement = document.getElementById("emailAddress");
const checkButton = document.getElementById("checkVerification");
const resendButton = document.getElementById("resendVerification");
const continueLink = document.getElementById("continueLink");

const parameters = new URLSearchParams(window.location.search);

const VERIFY_EMAIL_URL =
    "https://pedrohml69.github.io/Taskly-novo/pages/verify-email.html";

let currentUser = null;
let resendBlockedUntil = 0;

function showStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.setAttribute("aria-live", isError ? "assertive" : "polite");
    statusElement.dataset.state = isError ? "error" : "info";
}

function getDeliveryErrorMessage(code) {
    if (
        code === "auth/unauthorized-domain" ||
        code === "auth/invalid-continue-uri"
    ) {
        return "O domínio desta página não está autorizado no Firebase Authentication. Confira os domínios autorizados e a URL de ação.";
    }

    if (code === "auth/operation-not-allowed") {
        return "O envio está desativado no Firebase Authentication. Habilite o provedor Email/Password.";
    }

    if (code === "auth/too-many-requests") {
        return "O Firebase limitou temporariamente o envio. Aguarde um pouco.";
    }

    if (code === "auth/network-request-failed") {
        return "Falha de conexão ao enviar o e-mail. Verifique sua internet.";
    }

    return "Não foi possível enviar o e-mail de verificação. Confira as configurações do Firebase.";
}

function updateControls() {
    resendButton.hidden = !currentUser || currentUser.emailVerified;
    checkButton.hidden = !currentUser || currentUser.emailVerified;

    continueLink.href = currentUser?.emailVerified
        ? "./dashboard.html"
        : "./login.html";

    continueLink.textContent = currentUser?.emailVerified
        ? "Continuar para o Taskly"
        : "Voltar ao login";
}

async function refreshVerificationState() {
    if (!currentUser) {
        showStatus("Entre após verificar o endereço de e-mail.");
        updateControls();
        return;
    }

    try {
        await reload(currentUser);

        if (currentUser.emailVerified) {
            await getIdToken(currentUser, true);

            emailElement.textContent = `E-mail: ${currentUser.email || ""}`;

            showStatus(
                "E-mail verificado com sucesso! Você já pode continuar para o Taskly."
            );
        } else {
            emailElement.textContent = `E-mail: ${currentUser.email || ""}`;

            showStatus(
                "Este endereço ainda não foi verificado. Confira sua caixa de entrada e use o botão de reenvio se necessário."
            );
        }
    } catch (error) {
        console.error("Erro ao atualizar verificação:", error);

        showStatus(
            "Não foi possível verificar o estado da conta. Tente novamente.",
            true
        );
    }

    updateControls();
}

async function handleVerificationLink() {
    const mode = parameters.get("mode");
    const actionCode = parameters.get("oobCode");

    if (mode !== "verifyEmail" || !actionCode) {
        return;
    }

    showStatus("Validando o link de verificação...");

    try {
        await applyActionCode(auth, actionCode);

        if (auth.currentUser) {
            currentUser = auth.currentUser;
            await refreshVerificationState();
        } else {
            showStatus(
                "E-mail verificado com sucesso! Entre na sua conta para continuar."
            );

            updateControls();

            setTimeout(() => {
                window.location.href = "./login.html";
            }, 3000);
        }

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

    } catch (error) {
        console.error("Erro ao validar link:", error);

        showStatus(
            "Este link é inválido, expirou ou já foi utilizado. Entre na sua conta para solicitar outro.",
            true
        );

        updateControls();
    }
}

checkButton.addEventListener("click", () => {
    void refreshVerificationState();
});

resendButton.addEventListener("click", async () => {
    if (!currentUser || currentUser.emailVerified) {
        return;
    }

    if (Date.now() < resendBlockedUntil) {
        showStatus("Aguarde antes de solicitar outro e-mail.", true);
        return;
    }

    resendButton.disabled = true;

    try {
        await sendEmailVerification(currentUser, {
            url: VERIFY_EMAIL_URL
        });

        resendBlockedUntil = Date.now() + 30000;

        showStatus("Enviamos outro e-mail de verificação.");

        setTimeout(() => {
            resendButton.disabled = false;
        }, 30000);

    } catch (error) {
        console.error("Erro ao reenviar e-mail:", error);

        showStatus(getDeliveryErrorMessage(error.code), true);

        resendButton.disabled = false;
    }
});

continueLink.addEventListener("click", async (event) => {
    if (!currentUser || currentUser.emailVerified) {
        return;
    }

    event.preventDefault();

    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao encerrar sessão:", error);
    }

    window.location.href = "./login.html";
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (user?.email) {
        emailElement.textContent = `E-mail: ${user.email}`;
    }

    updateControls();

    if (parameters.get("delivery") === "failed") {
        showStatus(
            getDeliveryErrorMessage(parameters.get("reason")),
            true
        );
    } else if (user) {
        await refreshVerificationState();
    } else if (!parameters.has("oobCode")) {
        showStatus(
            "Depois de verificar seu e-mail, entre na sua conta para continuar."
        );
    }
});

void handleVerificationLink();
