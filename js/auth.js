// js/auth.js

// 1. Initialize Supabase
const SUPABASE_URL = 'https://umnnhdcwdfzctawkmgdp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VcEir1r7E00izTZnR--oJw_vVnJUXh2';
const authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const API_BASE_URL = 'https://pashu-swasthya.onrender.com';

// 2. Elements
const emailInput = document.getElementById("authEmail");
const passwordInput = document.getElementById("authPassword");
const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const authMessage = document.getElementById("authMessage");
const navLoginBtn = document.getElementById("navLoginBtn");
const navLogoutBtn = document.getElementById("navLogoutBtn");

// अलग-अलग जानवरों के लिए रंग
const speciesColors = {
    "Cow": "#2E5B41",      // Green
    "Buffalo": "#2C3E50",  // Dark Navy
    "Goat": "#8D6E63",     // Brown
    "Sheep": "#607D8B",    // Blue Grey
    "Poultry": "#E67E22",  // Orange
    "Other": "#546E7A"
};

// 3. जानवरों को लोड करके *डिटेल वाला* कार्ड बनाने का फंक्शन
async function loadUserAnimals(userEmail) {
    const container = document.getElementById('dynamicCardsContainer');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userEmail}/animals`);
        const animals = await response.json();
        
        if (animals.length > 0) {
            container.innerHTML = ''; // डिफ़ॉल्ट कार्ड हटाएँ
            
            animals.forEach((animal, index) => {
                const color = speciesColors[animal.species] || speciesColors["Other"];
                const delay = index * 0.15;
                
                // Owner & Location Info
                const ownerName = animal.owner_name || 'N/A';
                const ownerPhone = animal.owner_phone || 'N/A';
                const location = [animal.village, animal.district].filter(Boolean).join(', ') || 'Location N/A';
                const regDate = new Date(animal.registered_at).toLocaleDateString();
                
                // Latest Symptoms Logic
                let latestLogHTML = `<div style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">✅ No symptoms logged yet. Animal is healthy!</div>`;
                
                if (animal.health_logs && animal.health_logs.length > 0) {
                    // Sort logs to get the latest one
                    animal.health_logs.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));
                    const latestLog = animal.health_logs[0];
                    const logDate = new Date(latestLog.logged_at).toLocaleDateString();
                    
                    latestLogHTML = `
                        <div style="font-size: 0.75rem; color: #F8B146; text-transform: uppercase; margin-bottom: 3px; font-weight: bold;">⚠️ Latest Symptom (${logDate})</div>
                        <div style="font-size: 0.9rem; line-height: 1.4;">${latestLog.symptoms}</div>
                    `;
                }
                
                // Card HTML with full details
                const cardHTML = `
                <div class="glass-card floating" style="background: ${color}; cursor: pointer; animation-delay: ${delay}s; margin-bottom: 30px; padding: 25px; width: 100%; border: 1px solid rgba(255,255,255,0.2);" onclick="openLogForTag('${animal.tag_code}')">
                    
                    <div class="tag-card__row" style="margin-bottom: 15px;">
                        <span class="tag-card__qr" style="color: #F8B146; font-size: 2.2rem;">▦</span>
                        <div>
                            <div class="tag-card__label" style="color: rgba(255,255,255,0.7);">LUHID TAG</div>
                            <div class="tag-card__code" style="font-size: 1.5rem; font-weight: 700; color: white; letter-spacing: 1px;">${animal.tag_code}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px;">
                        <div>
                            <div style="color: white; font-weight: 700; font-size: 1.5rem;">${animal.animal_name || 'No Name'}</div>
                            <div style="color: rgba(255,255,255,0.8); font-size: 0.9rem; margin-top: 2px;">${animal.species} · ${animal.breed || 'Unknown'}</div>
                        </div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); text-align: right;">
                            Registered<br><strong>${regDate}</strong>
                        </div>
                    </div>
                    
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.9); line-height: 1.6; margin-bottom: 15px;">
                        👤 <strong>${ownerName}</strong> 📞 ${ownerPhone}<br>
                        📍 ${location}
                    </div>
                    
                    <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 3px solid #F8B146;">
                        ${latestLogHTML}
                    </div>
                    
                    <div style="text-align: center; font-size: 0.85rem; font-weight: bold; background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 20px; transition: background 0.3s;">
                        + Tap to log new symptoms
                    </div>
                </div>`;
                
                container.innerHTML += cardHTML;
            });
        }
    } catch (err) {
        console.error("Error fetching animals:", err);
    }
}

// कार्ड पर क्लिक करने पर क्या होगा
window.openLogForTag = function(tagCode) {
    document.getElementById('registerModal').classList.add('is-open');
    document.querySelector('[data-tab="tab-log"]').click();
    document.getElementById('logTagCode').value = tagCode;
};

// 4. Check if user is already logged in
async function checkUser() {
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
        navLoginBtn.style.display = "none";
        navLogoutBtn.style.display = "inline-block";
        navLogoutBtn.textContent = `Logout (${user.email.split('@')[0]})`;
        
        window.currentUserEmail = user.email; 
        loadUserAnimals(user.email); // 🔴 लोड कार्ड्स
    } else {
        navLoginBtn.style.display = "inline-block";
        navLogoutBtn.style.display = "none";
    }
}
checkUser();

// 5. Sign Up
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
        authMessage.textContent = "Success! Account created.";
        authMessage.style.color = "green";
    }
});

// 6. Sign In
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
        checkUser(); // लॉगिन के बाद कार्ड्स भी लोड होंगे
        setTimeout(() => {
            document.getElementById("loginModal").classList.remove("is-open");
            emailInput.value = '';
            passwordInput.value = '';
            authMessage.textContent = '';
        }, 1000);
    }
});

// 7. Sign Out
navLogoutBtn.addEventListener("click", async () => {
    await authClient.auth.signOut();
    window.location.reload(); // पेज रीफ्रेश करके कार्ड्स हटा दें
});
