// server.js (Clean Backend Code - No 'window' errors)
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const GUARDRAIL_SYSTEM_PROMPT = `You are Pashu Sahayak, a pre-clinical livestock first-aid assistant used by rural farmers in India through the LUHID app. You are NOT a veterinarian and must never behave like one.

STRICT RULES (never break these):
1. Never name, dose, or recommend any specific medicine, antibiotic, vaccine, or injectable drug.
2. Never diagnose a specific disease with certainty. You may mention 2-3 possibilities in plain language.
3. Always give safe, general first-aid and isolation/husbandry steps only.
4. Always end by clearly telling the farmer to contact a qualified veterinarian.
5. If symptoms sound severe or life-threatening, say this is an EMERGENCY.
6. Keep the answer short: 4-6 sentences.
7. Respond in the same language the farmer used.

Respond as plain text only. Do not use markdown formatting.`;

async function getTriageAdvice({ species, symptoms, language }) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set.');

  const fullPrompt = `${GUARDRAIL_SYSTEM_PROMPT}\n---\nAnimal type: ${species || 'unspecified'}\nReported symptoms: ${symptoms}\nPreferred reply language: ${language || 'English'}\n\nGive safe pre-clinical first-aid guidance following your rules.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
  });

  const text = result.response.text();
  return text?.trim() || 'Unable to generate advice right now. Please isolate the animal, keep it comfortable, and contact a veterinarian.';
}

function generateTagCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LUH-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function maskPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return '••••••' + digits.slice(-4);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'luhid-api', time: new Date().toISOString() });
});

app.post('/api/animals', async (req, res) => {
  try {
    const { species, breed, animalName, userEmail, ageYears, ownerName, ownerPhone, village, district, notes } = req.body;
    
    if (!species || !ownerName || !ownerPhone || !animalName) {
      return res.status(400).json({ error: 'species, animalName, ownerName and ownerPhone are required.' });
    }
    
    let tagCode = generateTagCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await supabase.from('animals').select('id').eq('tag_code', tagCode);
      if (!existing || existing.length === 0) break;
      tagCode = generateTagCode();
    }
    
    const { data, error } = await supabase.from('animals').insert({
      tag_code: tagCode, 
      animal_name: animalName, 
      user_email: userEmail,   
      species, 
      breed: breed || null, 
      age_years: ageYears || null, 
      owner_name: ownerName, 
      owner_phone: ownerPhone,
      village: village || null, 
      district: district || null, 
      notes: notes || null
    }).select('id, tag_code, registered_at').single();
    
    if (error) throw error;
    res.status(201).json({ Id: data.id, TagCode: data.tag_code, RegisteredAt: data.registered_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:email/animals', async (req, res) => {
  try {
    const { email } = req.params;
    const { data, error } = await supabase
      .from('animals')
      .select('*, health_logs(symptoms, logged_at)')
      .eq('user_email', email)
      .order('registered_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/animals/:tagCode', async (req, res) => {
  try {
    const { tagCode } = req.params;
    const role = (req.query.role || 'public').toLowerCase();

    const { data: animal, error: animalErr } = await supabase.from('animals').select('*').eq('tag_code', tagCode).single();
    if (animalErr || !animal) {
      return res.status(404).json({ error: 'No animal found for that tag.' });
    }

    if (role === 'vet') {
      const { data: healthLogs } = await supabase.from('health_logs').select('*').eq('animal_id', animal.id).order('logged_at', { ascending: false });
      const { data: vaccinations } = await supabase.from('vaccination_records').select('*').eq('animal_id', animal.id).order('given_on', { ascending: false });

      return res.json({
        role: 'vet',
        animal: { ...animal, TagCode: animal.tag_code, AnimalName: animal.animal_name, Species: animal.species, Breed: animal.breed, AgeYears: animal.age_years, OwnerName: animal.owner_name, OwnerPhone: animal.owner_phone, Village: animal.village, District: animal.district, Notes: animal.notes, RegisteredAt: animal.registered_at },
        healthLogs: (healthLogs || []).map(l => ({ ...l, Id: l.id, Symptoms: l.symptoms, Severity: l.severity, Language: l.language, AiAdvice: l.ai_advice, Source: l.source, LoggedAt: l.logged_at })),
        vaccinations: (vaccinations || []).map(v => ({ ...v, Id: v.id, VaccineName: v.vaccine_name, GivenOn: v.given_on, NextDueOn: v.next_due_on }))
      });
    }

    res.json({
      role: 'public',
      animal: { TagCode: animal.tag_code, AnimalName: animal.animal_name, Species: animal.species, Breed: animal.breed, Village: animal.village, District: animal.district, OwnerNameMasked: animal.owner_name ? animal.owner_name.split(' ')[0] + ' ••••' : 'Owner', OwnerPhoneMasked: maskPhone(animal.owner_phone) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/animals/:tagCode/logs', async (req, res) => {
  try {
    const { tagCode } = req.params;
    const { symptoms, severity, language, aiAdvice, source } = req.body;
    if (!symptoms) return res.status(400).json({ error: 'symptoms is required.' });
    const { data: animal, error: animalErr } = await supabase.from('animals').select('id').eq('tag_code', tagCode).single();
    if (animalErr || !animal) return res.status(404).json({ error: 'No animal found for that tag.' });
    const { data, error } = await supabase.from('health_logs').insert({
      animal_id: animal.id, symptoms, severity: severity || null, language: language || null,
      ai_advice: aiAdvice || null, source: source || 'online'
    }).select('id, logged_at').single();
    if (error) throw error;
    res.status(201).json({ Id: data.id, LoggedAt: data.logged_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/triage', async (req, res) => {
  try {
    const { species, symptoms, language } = req.body;
    if (!symptoms) return res.status(400).json({ error: 'symptoms is required.' });
    const advice = await getTriageAdvice({ species, symptoms, language });
    res.json({ advice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('LUHID API listening on port ' + PORT);
});
