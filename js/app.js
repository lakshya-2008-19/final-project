// app.js — UI wiring for LUHID.

/* ---------- Modal open/close ---------- */
document.querySelectorAll('[data-open]').forEach((btn) => {
  btn.addEventListener('click', () => openModal(btn.dataset.open));
});
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.closest('.modal')));
});
document.querySelectorAll('.modal').forEach((modal) => {
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal.is-open').forEach(closeModal);
});

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); }
}
function closeModal(modal) {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  stopAllScanners();
}

/* ---------- Tabs inside register modal ---------- */
document.querySelectorAll('.tabs__btn').forEach((tabBtn) => {
  tabBtn.addEventListener('click', () => {
    const container = tabBtn.closest('.modal__panel');
    container.querySelectorAll('.tabs__btn').forEach((b) => b.classList.remove('is-active'));
    container.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('is-active'));
    tabBtn.classList.add('is-active');
    container.querySelector(`#${tabBtn.dataset.tab}`).classList.add('is-active');
  });
});

/* ---------- Online/offline badge ---------- */
const netBadge = document.getElementById('netBadge');
function updateNetBadge() {
  if (navigator.onLine) {
    netBadge.textContent = '● Online';
    netBadge.classList.remove('is-offline');
  } else {
    netBadge.textContent = '● Offline — logs will queue';
    netBadge.classList.add('is-offline');
  }
}
window.addEventListener('online', updateNetBadge);
window.addEventListener('offline', updateNetBadge);
updateNetBadge();

/* =======================================================================
   FARMER: Register animal
   ======================================================================= */
let currentTagCode = null;

const registerForm = document.getElementById('registerForm');
const registerStatus = document.getElementById('registerStatus');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerStatus.textContent = 'Registering...';
  registerStatus.classList.remove('is-error');

  const fd = new FormData(registerForm);
  const payload = Object.fromEntries(fd.entries());
  if (payload.ageYears) payload.ageYears = parseFloat(payload.ageYears);

  try {
    const result = await Api.createAnimal(payload);
    currentTagCode = result.TagCode;
    registerStatus.textContent = `Registered! Tag: ${result.TagCode}`;
    document.getElementById('logTagCode').value = currentTagCode;
    await renderTagResult(currentTagCode, payload);
    // jump to the tag tab automatically
    document.querySelector('[data-tab="tab-tag"]').click();
  } catch (err) {
    registerStatus.textContent = err.message;
    registerStatus.classList.add('is-error');
  }
});

async function renderTagResult(tagCode, animalInfo) {
  const box = document.getElementById('tagResult');
  box.innerHTML = `
    <canvas id="qrCanvas"></canvas>
    <h3>${tagCode}</h3>
    <p class="muted">${animalInfo.species || ''} ${animalInfo.breed ? '· ' + animalInfo.breed : ''}${animalInfo.village ? ' · ' + animalInfo.village : ''}</p>
    <p class="muted">Print this QR and fix it to a durable ear tag. Anyone scanning it can help reunite a lost animal; vets who scan it see the full medical history.</p>
  `;
  try {
    await QRCode.toCanvas(document.getElementById('qrCanvas'), tagCode, { width: 180, margin: 1, color: { dark: '#14261D', light: '#FBF9F2' } });
  } catch (err) {
    console.warn('QR generation failed', err);
  }
}

/* =======================================================================
   FARMER: Symptom logger (icon chips + voice + offline queue)
   ======================================================================= */
const selectedSymptoms = new Set();
document.querySelectorAll('.icon-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('is-selected');
    const s = chip.dataset.symptom;
    if (selectedSymptoms.has(s)) selectedSymptoms.delete(s); else selectedSymptoms.add(s);
  });
});

// Voice input via Web Speech API (works on Chrome/Edge/Android; gracefully degrades elsewhere)
const micBtn = document.getElementById('micBtn');
const symptomText = document.getElementById('symptomText');
let recognizer = null;
let isRecording = false;

function getRecognizer() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.continuous = false;
  r.interimResults = false;
  r.lang = mapLanguageToLocale(document.getElementById('logLanguage').value);
  r.onresult = (e) => {
    const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ');
    symptomText.value = (symptomText.value ? symptomText.value + ' ' : '') + transcript;
  };
  r.onend = () => { isRecording = false; micBtn.classList.remove('is-recording'); };
  r.onerror = () => { isRecording = false; micBtn.classList.remove('is-recording'); };
  return r;
}

function mapLanguageToLocale(lang) {
  const map = { Hindi: 'hi-IN', Marathi: 'mr-IN', Tamil: 'ta-IN', Telugu: 'te-IN', Punjabi: 'pa-IN', English: 'en-IN' };
  return map[lang] || 'en-IN';
}

micBtn.addEventListener('click', () => {
  if (!isRecording) {
    recognizer = getRecognizer();
    if (!recognizer) {
      alert('Voice input is not supported in this browser. Please type your symptoms instead.');
      return;
    }
    recognizer.start();
    isRecording = true;
    micBtn.classList.add('is-recording');
  } else {
    recognizer && recognizer.stop();
  }
});

const submitLogBtn = document.getElementById('submitLogBtn');
const logStatus = document.getElementById('logStatus');
const adviceBox = document.getElementById('adviceBox');
const adviceText = document.getElementById('adviceText');

submitLogBtn.addEventListener('click', async () => {
  const tagCode = document.getElementById('logTagCode').value.trim();
  const freeText = symptomText.value.trim();
  const severity = document.getElementById('logSeverity').value;
  const language = document.getElementById('logLanguage').value;
  const species = registerForm.species ? registerForm.species.value : '';

  const symptomsCombined = [...selectedSymptoms, freeText].filter(Boolean).join('; ');

  if (!tagCode) { setStatus(logStatus, 'Please enter the animal\'s tag code.', true); return; }
  if (!symptomsCombined) { setStatus(logStatus, 'Please select or describe at least one symptom.', true); return; }

  setStatus(logStatus, 'Getting AI first-aid advice...');
  adviceBox.hidden = true;

  let aiAdvice = null;
  try {
    if (navigator.onLine) {
      const triage = await Api.triage({ species, symptoms: symptomsCombined, language });
      aiAdvice = triage.advice;
      adviceText.textContent = aiAdvice;
      adviceBox.hidden = false;
    }
  } catch (err) {
    console.warn('Triage call failed:', err.message);
  }

  const logPayload = { symptoms: symptomsCombined, severity, language, aiAdvice, source: 'online' };

  if (navigator.onLine) {
    try {
      await Api.addLog(tagCode, logPayload);
      setStatus(logStatus, 'Saved to the animal\'s health record.');
    } catch (err) {
      // fall back to offline queue if the save itself failed
      LocalQueue.push({ tagCode, ...logPayload });
      setStatus(logStatus, 'Could not reach the server — saved locally and will sync automatically.', true);
    }
  } else {
    LocalQueue.push({ tagCode, ...logPayload });
    setStatus(logStatus, 'You are offline — saved locally. It will sync automatically once you\'re back online.');
  }

  renderQueue();
  // reset the picker for the next entry
  selectedSymptoms.clear();
  document.querySelectorAll('.icon-chip.is-selected').forEach((c) => c.classList.remove('is-selected'));
  symptomText.value = '';
});

function setStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle('is-error', isError);
}

/* ---------- Offline queue rendering + manual sync ---------- */
function renderQueue() {
  const list = document.getElementById('queueList');
  const items = LocalQueue.getAll();
  if (items.length === 0) {
    list.innerHTML = '<li class="muted" style="border:none;background:none;">No pending entries.</li>';
    return;
  }
  list.innerHTML = items.map((item) => `
    <li>
      <span>${item.tagCode} — ${item.symptoms.slice(0, 60)}${item.symptoms.length > 60 ? '…' : ''}</span>
      <span class="${item._synced ? 'tag-synced' : 'tag-pending'}">${item._synced ? 'SYNCED' : 'PENDING'}</span>
    </li>
  `).join('');
}
renderQueue();

document.getElementById('syncNowBtn').addEventListener('click', async () => {
  await LocalQueue.syncAll();
  renderQueue();
});
window.addEventListener('online', () => setTimeout(renderQueue, 800));

/* =======================================================================
   VETERINARIAN: look up full EHR by tag
   ======================================================================= */
const vetLookupBtn = document.getElementById('vetLookupBtn');
const vetTagInput = document.getElementById('vetTagInput');
const vetResult = document.getElementById('vetResult');
const vetStatus = document.getElementById('vetStatus');

vetLookupBtn.addEventListener('click', () => lookupVet(vetTagInput.value.trim()));
vetTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') lookupVet(vetTagInput.value.trim()); });

async function lookupVet(tagCode) {
  if (!tagCode) return;
  setStatus(vetStatus, 'Looking up...');
  vetResult.hidden = true;
  try {
    const data = await Api.getAnimal(tagCode, 'vet');
    renderVetResult(data);
    setStatus(vetStatus, '');
  } catch (err) {
    setStatus(vetStatus, err.message, true);
  }
}

function renderVetResult(data) {
  const a = data.animal;
  const logsHtml = data.healthLogs.length
    ? data.healthLogs.map((l) => `
        <div class="ehr__log ${l.Severity === 'severe' || l.Severity === 'emergency' ? 'ehr__log--severe' : ''}">
          <time>${new Date(l.LoggedAt).toLocaleString()} · ${l.Severity || 'unspecified'}</time>
          <div>${escapeHtml(l.Symptoms)}</div>
          ${l.AiAdvice ? `<div class="muted">AI advice given: ${escapeHtml(l.AiAdvice)}</div>` : ''}
        </div>`).join('')
    : '<p class="muted">No symptom logs yet.</p>';

  const vaxHtml = data.vaccinations.length
    ? data.vaccinations.map((v) => `<div class="ehr__log">${escapeHtml(v.VaccineName)} — given ${new Date(v.GivenOn).toLocaleDateString()}${v.NextDueOn ? `, next due ${new Date(v.NextDueOn).toLocaleDateString()}` : ''}</div>`).join('')
    : '<p class="muted">No vaccination records yet.</p>';

  vetResult.innerHTML = `
    <div class="ehr__header">
      <h3>${a.Species}${a.Breed ? ' · ' + a.Breed : ''} — ${a.TagCode}</h3>
      <p>Owner: ${escapeHtml(a.OwnerName)} · ${escapeHtml(a.OwnerPhone)} · ${escapeHtml(a.Village || '')}</p>
    </div>
    <div class="ehr__section"><h4>Symptom history</h4>${logsHtml}</div>
    <div class="ehr__section"><h4>Vaccinations</h4>${vaxHtml}</div>
  `;
  vetResult.hidden = false;
}

/* =======================================================================
   CITIZEN: masked lookup + GPS rescue alert
   ======================================================================= */
const citizenLookupBtn = document.getElementById('citizenLookupBtn');
const citizenTagInput = document.getElementById('citizenTagInput');
const citizenResult = document.getElementById('citizenResult');
const citizenStatus = document.getElementById('citizenStatus');
let lastCitizenTag = null;

citizenLookupBtn.addEventListener('click', () => lookupCitizen(citizenTagInput.value.trim()));
citizenTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') lookupCitizen(citizenTagInput.value.trim()); });

async function lookupCitizen(tagCode) {
  if (!tagCode) return;
  setStatus(citizenStatus, 'Looking up...');
  citizenResult.hidden = true;
  try {
    const data = await Api.getAnimal(tagCode, 'public');
    lastCitizenTag = tagCode;
    renderCitizenResult(data.animal);
    setStatus(citizenStatus, '');
  } catch (err) {
    setStatus(citizenStatus, err.message, true);
  }
}

function renderCitizenResult(a) {
  citizenResult.innerHTML = `
    <h3>${a.Species}${a.Breed ? ' · ' + a.Breed : ''}</h3>
    <p class="muted">${a.Village ? a.Village + ', ' : ''}${a.District || ''}</p>
    <p>Owner: <strong>${escapeHtml(a.OwnerNameMasked)}</strong> · ${escapeHtml(a.OwnerPhoneMasked)}</p>
    <button type="button" class="btn btn--primary" id="alertOwnerBtn">📍 Alert owner with my location</button>
  `;
  citizenResult.hidden = false;
  document.getElementById('alertOwnerBtn').addEventListener('click', sendRescueAlert);
}

function sendRescueAlert() {
  if (!navigator.geolocation) {
    submitRescue(null, null);
    return;
  }
  setStatus(citizenStatus, 'Getting your location...');
  navigator.geolocation.getCurrentPosition(
    (pos) => submitRescue(pos.coords.latitude, pos.coords.longitude),
    () => submitRescue(null, null)
  );
}

async function submitRescue(lat, lng) {
  try {
    await Api.rescueAlert(lastCitizenTag, { latitude: lat, longitude: lng, message: 'Found via LUHID public scan' });
    setStatus(citizenStatus, 'Thank you! The owner has been notified with your location.');
  } catch (err) {
    setStatus(citizenStatus, err.message, true);
  }
}

/* =======================================================================
   QR SCANNING (camera) — used by both vet and citizen portals
   ======================================================================= */
let activeScanner = null;

function startScanner(videoId, onResult) {
  stopAllScanners();
  const videoEl = document.getElementById(videoId);
  videoEl.hidden = false;

  const scannerId = videoId + '-scanner';
  if (!document.getElementById(scannerId)) {
    const div = document.createElement('div');
    div.id = scannerId;
    videoEl.after(div);
  }
  videoEl.style.display = 'none'; // html5-qrcode renders its own video into the div

  activeScanner = new Html5Qrcode(scannerId);
  activeScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: 220 },
    (decodedText) => {
      onResult(decodedText);
      stopAllScanners();
    },
    () => {} // ignore per-frame scan errors
  ).catch((err) => {
    alert('Could not access the camera: ' + err);
  });
}

function stopAllScanners() {
  if (activeScanner) {
    activeScanner.stop().catch(() => {});
    activeScanner.clear && activeScanner.clear();
    activeScanner = null;
  }
  document.querySelectorAll('.scan-video').forEach((v) => (v.hidden = true));
}

document.getElementById('vetScanBtn').addEventListener('click', () => {
  startScanner('vetScanVideo', (text) => { vetTagInput.value = text; lookupVet(text); });
});
document.getElementById('citizenScanBtn').addEventListener('click', () => {
  startScanner('citizenScanVideo', (text) => { citizenTagInput.value = text; lookupCitizen(text); });
});

/* ---------- utils ---------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// js/app.js (Breed Auto-select Logic)

const breedData = {
  "Cow": ["Gir", "Sahiwal", "Red Sindhi", "Tharparkar", "Holstein Friesian (HF)", "Jersey", "Mixed/Desi", "Other"],
  "Buffalo": ["Murrah", "Jafarabadi", "Surti", "Mehsana", "Nili Ravi", "Mixed/Desi", "Other"],
  "Goat": ["Jamnapari", "Beetal", "Barbari", "Black Bengal", "Sirohi", "Mixed/Desi", "Other"],
  "Sheep": ["Marwari", "Deccani", "Nellore", "Gaddi", "Mixed/Desi", "Other"],
  "Poultry": ["Aseel", "Kadaknath", "Leghorn", "Rhode Island Red", "Broiler", "Layer", "Other"],
  "Other": ["Specify in notes"]
};

const speciesSelect = document.getElementById('speciesSelect');
const breedSelect = document.getElementById('breedSelect');

if (speciesSelect && breedSelect) {
  speciesSelect.addEventListener('change', function() {
    const selectedSpecies = this.value;
    
    // Clear current options
    breedSelect.innerHTML = '';
    
    if (selectedSpecies && breedData[selectedSpecies]) {
      // Add new options based on selected species
      breedData[selectedSpecies].forEach(breed => {
        const option = document.createElement('option');
        option.value = breed;
        option.textContent = breed;
        breedSelect.appendChild(option);
      });
    } else {
      // Default if nothing selected
      const defaultOption = document.createElement('option');
      defaultOption.value = "";
      defaultOption.textContent = "Select species first...";
      breedSelect.appendChild(defaultOption);
    }
  });
}
