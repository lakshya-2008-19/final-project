// server.js
// LUHID backend — plain Express app for Render.com.
// Data: Supabase (Postgres). AI: Gemini (same guardrail logic as before).

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const app = express();
app.use(cors()); // tighten with { origin: 'https://your-frontend-domain' } once you have one
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

// यहाँ रखें:
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

// ---------------------------------------------------------------------------
// Gemini helper (unchanged logic — same guardrail system prompt as before)
// ---------------------------------------------------------------------------
const GUARDRAIL_SYSTEM_PROMPT = `You are Pashu Sahayak, a pre-clinical livestock first-aid assistant used by rural
farmers in India through the LUHID app. You are NOT a veterinarian and must never behave like one.

STRICT RULES (never break these):
1. Never name, dose, or recommend any specific medicine, antibiotic, vaccine, or injectable drug.
2. Never diagnose a specific disease with certainty. You may mention 2-3 possibilities in plain language.
3. Always give safe, general first-aid and isolation/husbandry steps only: e.g. isolate the animal,
   keep it hydrated and shaded, keep the area clean, avoid mixing with the herd, monitor temperature/appetite.
4. Always end by clearly telling the farmer to contact a qualified veterinarian, especially for
   fever, bleeding, difficulty breathing, inability to stand, or symptoms lasting more than a day.
5. If symptoms sound severe or life-threatening (collapse, heavy bleeding, bloat, difficulty breathing,
   suspected poisoning), say this is an EMERGENCY and to call a vet immediately, first, before anything else.
6. Keep the answer short: 4-6 sentences, simple words, no medical jargon.
7. Respond in the same language the farmer used, if given (e.g. Hindi, Marathi, Tamil), otherwise English.

Respond as plain text only. Do not use markdown formatting.`;

async function getTriageAdvice({ species, symptoms, language }) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const userPrompt = `Animal type: ${species || 'unspecified'}
Reported symptoms: ${symptoms}
Preferred reply language: ${language || 'English'}

Give safe pre-clinical first-aid guidance following your rules.`;

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: GUARDRAIL_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').trim();
  return text || 'Unable to generate advice right now. Please isolate the animal, keep it comfortable, and contact a veterinarian.';
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function generateTagCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = 'LUH-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function maskPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••••${digits.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'luhid-api', time: new Date().toISOString() });
});

// Create a new animal + generate its tag code
app.post('/api/animals', async (req, res) => {
  try {
    const { species, breed, sex, ageYears, ownerName, ownerPhone, village, district, notes } = req.body;

    if (!species || !ownerName || !ownerPhone) {
      return res.status(400).json({ error: 'species, ownerName and ownerPhone are required.' });
    }

    let tagCode = generateTagCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await supabase.from('animals').select('id').eq('tag_code', tagCode);
      if (!existing || existing.length === 0) break;
      tagCode = generateTagCode();
    }

    const { data, error } = await supabase
      .from('animals')
      .insert({
        tag_code: tagCode,
        species,
        breed: breed || null,
        sex: sex || null,
        age_years: ageYears || null,
        owner_name: ownerName,
        owner_phone: ownerPhone,
        village: village || null,
        district: district || null,
        notes: notes || null
      })
      .select('id, tag_code, registered_at')
      .single();

    if (error) throw error;
    res.status(201).json({ Id: data.id, TagCode: data.tag_code, RegisteredAt: data.registered_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch an animal's record by tag code, with role-based masking
app.get('/api/animals/:tagCode', async (req, res) => {
  try {
    const { tagCode } = req.params;
    const role = (req.query.role || 'public').toLowerCase(); // 'vet' | 'public'

    const { data: animal, error: animalErr } = await supabase
      .from('animals')
      .select('*')
      .eq('tag_code', tagCode)
      .single();

    if (animalErr || !animal) {
      return res.status(404).json({ error: 'No animal found for that tag.' });
    }

    if (role === 'vet') {
      const { data: healthLogs, error: logsErr } = await supabase
        .from('health_logs')
        .select('*')
        .eq('animal_id', animal.id)
        .order('logged_at', { ascending: false });
      if (logsErr) throw logsErr;

      const { data: vaccinations, error: vaxErr } = await supabase
        .from('vaccination_records')
        .select('*')
        .eq('animal_id', animal.id)
        .order('given_on', { ascending: false });
      if (vaxErr) throw vaxErr;

      return res.json({ role: 'vet', animal, healthLogs, vaccinations });
    }

    // Public / citizen view: masked contact only, no medical history
    res.json({
      role: 'public',
      animal: {
        TagCode: animal.tag_code,
        Species: animal.species,
        Breed: animal.breed,
        Village: animal.village,
        District: animal.district,
        OwnerNameMasked: animal.owner_name ? animal.owner_name.split(' ')[0] + ' ••••' : 'Owner',
        OwnerPhoneMasked: maskPhone(animal.owner_phone)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add a symptom/health log entry for an animal
app.post('/api/animals/:tagCode/logs', async (req, res) => {
  try {
    const { tagCode } = req.params;
    const { symptoms, severity, language, aiAdvice, source } = req.body;

    if (!symptoms) {
      return res.status(400).json({ error: 'symptoms is required.' });
    }

    const { data: animal, error: animalErr } = await supabase
      .from('animals')
      .select('id')
      .eq('tag_code', tagCode)
      .single();

    if (animalErr || !animal) {
      return res.status(404).json({ error: 'No animal found for that tag.' });
    }

    const { data, error } = await supabase
      .from('health_logs')
      .insert({
        animal_id: animal.id,
        symptoms,
        severity: severity || null,
        language: language || null,
        ai_advice: aiAdvice || null,
        source: source || 'online'
      })
      .select('id, logged_at')
      .single();

    if (error) throw error;
    res.status(201).json({ Id: data.id, LoggedAt: data.logged_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// AI first-aid triage via Gemini (guardrails enforced server-side)
app.post('/api/triage', async (req, res) => {
  try {
    const { species, symptoms, language } = req.body;
    if (!symptoms) {
      return res.status(400).json({ error: 'symptoms is required.' });
    }
    const advice = await getTriageAdvice({ species, symptoms, language });
    res.json({ advice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Log a public rescue/GPS alert for a lost or found animal
app.post('/api/animals/:tagCode/rescue', async (req, res) => {
  try {
    const { tagCode } = req.params;
    const { latitude, longitude, message } = req.body || {};

    const { data: animal, error: animalErr } = await supabase
      .from('animals')
      .select('id, owner_name')
      .eq('tag_code', tagCode)
      .single();

    if (animalErr || !animal) {
      return res.status(404).json({ error: 'No animal found for that tag.' });
    }

    const { error } = await supabase.from('rescue_alerts').insert({
      animal_id: animal.id,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      message: message || null
    });

    if (error) throw error;
    res.status(201).json({ ok: true, notified: animal.owner_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`LUHID API listening on port ${PORT}`);
});
