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
// js/auth.js में नीचे जोड़ें:

const API_BASE_URL = 'https://pashu-swasthya.onrender.com'; // अपनी रेंडर URL कन्फर्म कर लें

// अलग-अलग जानवरों के लिए रंग
const speciesColors = {
    "Cow": "#2E5B41",      // Green
    "Buffalo": "#2C3E50",  // Dark Navy
    "Goat": "#8D6E63",     // Brown
    "Sheep": "#607D8B",    // Blue Grey
    "Poultry": "#E67E22",  // Orange
    "Other": "#546E7A"
};

// जानवरों को लोड करके कार्ड बनाने वाला फंक्शन
async function loadUserAnimals(userEmail) {
    const container = document.getElementById('dynamicCardsContainer');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userEmail}/animals`);
        const animals = await response.json();
        
        if (animals.length > 0) {
            container.innerHTML = ''; // डिफ़ॉल्ट कार्ड हटाएँ
            
            animals.forEach((animal, index) => {
                const color = speciesColors[animal.species] || speciesColors["Other"];
                // 3D स्टैक इफ़ेक्ट के लिए थोड़ा सा डिले और ऑफसेट
                const delay = index * 0.2;
                
                const cardHTML = `
                <div class="glass-card floating" style="background: ${color}; cursor: pointer; animation-delay: ${delay}s; margin-bottom: -100px; position: relative; z-index: ${10 - index};" onclick="openLogForTag('${animal.tag_code}')">
                    <div class="tag-card__row">
                        <span class="tag-card__qr" style="color: #F8B146; font-size: 2rem;">▦</span>
                        <div>
                            <div class="tag-card__label" style="color: rgba(255,255,255,0.7);">LUHID TAG</div>
                            <div class="tag-card__code" style="font-size: 1.4rem; font-weight: 700; color: white;">${animal.tag_code}</div>
                        </div>
                    </div>
                    <div class="tag-card__divider" style="background: rgba(255,255,255,0.2); margin: 15px 0; height: 1px;"></div>
                    <div class="tag-card__meta" style="color: white; font-weight: 700; font-size: 1.2rem;">${animal.animal_name}</div>
                    <div class="tag-card__meta" style="color: rgba(255,255,255,0.8); margin-top: 5px;">${animal.species} · ${animal.breed || 'Unknown'}</div>
                    <div style="margin-top: 10px; font-size: 0.8rem; background: rgba(0,0,0,0.2); display: inline-block; padding: 5px 10px; border-radius: 20px;">Tap to log symptoms</div>
                </div>`;
                
                container.innerHTML += cardHTML;
            });
        }
    } catch (err) {
        console.error("Error fetching animals:", err);
    }
}

// कार्ड पर क्लिक करने पर क्या होगा? (लॉग सिम्टम्स खुल जाएगा)
window.openLogForTag = function(tagCode) {
    // रजिस्टर मोडल खोलें
    document.getElementById('registerModal').classList.add('is-open');
    // Tab 2 (Log Symptoms) पर स्विच करें
    document.querySelector('[data-tab="tab-log"]').click();
    // टैग नंबर ऑटो-फिल कर दें
    document.getElementById('logTagCode').value = tagCode;
};

// अपने पुराने checkUser() फंक्शन में इसे जोड़ लें
async function checkUser() {
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
        navLoginBtn.style.display = "none";
        navLogoutBtn.style.display = "inline-block";
        navLogoutBtn.textContent = `Logout (${user.email.split('@')[0]})`;
        
        // 🔴 यह लाइन जोड़ें ताकि लॉगिन होते ही कार्ड आ जाएं:
        loadUserAnimals(user.email); 
        // ग्लोबल में ईमेल सेव कर लें ताकि रजिस्टर करते वक़्त इस्तेमाल हो
        window.currentUserEmail = user.email; 
    } else {
        navLoginBtn.style.display = "inline-block";
        navLogoutBtn.style.display = "none";
    }
}
