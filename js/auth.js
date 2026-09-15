// js/auth.js

// 1. Initialize Supabase
// **IMPORTANT:** Replace these with your actual Supabase URL and ANON KEY from the Supabase Dashboard
const SUPABASE_URL = 'https://umnnhdcwdfzctawkmgdp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VcEir1r7E00izTZnR--oJw_vVnJUXh2';
const authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Elements
const emailInput = document.getElementById("authEmail");
const passwordInput = document.getElementById("authPassword");
const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const authMessage = document.getElementById("authMessage");
const navLoginBtn = document.getElementById("navLoginBtn");
const navLogoutBtn = document.getElementById("navLogoutBtn");

// 3. Check if user is already logged in
async function checkUser() {
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
        navLoginBtn.style.display = "none";
        navLogoutBtn.style.display = "inline-block";
        navLogoutBtn.textContent = `Logout (${user.email.split('@')[0]})`;
    } else {
        navLoginBtn.style.display = "inline-block";
        navLogoutBtn.style.display = "none";
    }
}
checkUser();

// 4. Sign Up
signUpBtn.addEventListener("click", async () => {
    authMessage.textContent = "Creating account...";
    authMessage.style.color = "var(--color-primary)";
    
    const { data, error } = await authClient.auth.signUp({
        email: emailInput.value,
        password: passwordInput.value,
    });

    if (error) {
        authMessage.textContent = error.message;
        authMessage.style.color = "red";
    } else {
        authMessage.textContent = "Success! Please check your email to verify.";
        authMessage.style.color = "green";
    }
});

// 5. Sign In
signInBtn.addEventListener("click", async () => {
    authMessage.textContent = "Signing in...";
    authMessage.style.color = "var(--color-primary)";

    const { data, error } = await authClient.auth.signInWithPassword({
        email: emailInput.value,
        password: passwordInput.value,
    });

    if (error) {
        authMessage.textContent = error.message;
        authMessage.style.color = "red";
    } else {
        authMessage.textContent = "Login Successful!";
        authMessage.style.color = "green";
        checkUser();
        setTimeout(() => {
            document.getElementById("loginModal").classList.remove("is-open");
            emailInput.value = '';
            passwordInput.value = '';
            authMessage.textContent = '';
        }, 1000);
    }
});

// 6. Sign Out
navLogoutBtn.addEventListener("click", async () => {
    await authClient.auth.signOut();
    checkUser();
});
