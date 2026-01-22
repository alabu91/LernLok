/**
 * LERNLOK - Lokführer Training Schweiz
 * Version: 3.6.0 (Robust CSV/Excel Comparison)
 */

const SUPABASE_URL = 'https://nsidzovmagohzuwvikev.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zaWR6b3ZtYWdvaHp1d3Zpa2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTYwMjIsImV4cCI6MjA4NDAzMjAyMn0.U4pnm4pvFHif_dVAQnOANSynDEKMELjSoKFBm0KyNLw';

let supabase;
let topics = [];
let allQuestions = [];
let currentTopic = null;
let currentQuestionIndex = 0;
let score = 0;
let selectedAnswers = [];

// --- INITIALISIERUNG ---
async function init() {
    try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        
        await loadData();
        
        document.getElementById('current-year').innerText = new Date().getFullYear();
    } catch (e) {
        console.error("Initialisierungsfehler:", e);
    }
}

async function loadData() {
    const { data: tData } = await supabase.from('topics').select('*').order('title');
    const { data: qData } = await supabase.from('questions').select('*');
    
    topics = tData || [];
    allQuestions = qData || [];
    
    topics.forEach(t => {
        t.questions = allQuestions.filter(q => q.topic_id === t.id);
    });
    
    renderDashboard();
    populateAdminInterfaces();
}

// Hilfsfunktion: Bereinigt Strings von Excel-Artefakten für den Vergleich
function cleanString(str) {
    if (!str) return "";
    return str.toString()
        .replace(/^["']|["']$/g, '') // Entfernt äußere Anführungszeichen
        .replace(/""/g, '"')         // Ersetzt doppelte Anführungszeichen durch einfache
        .trim();
}

// --- NAVIGATION ---
window.switchView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (window.lucide) window.lucide.createIcons();
};

window.showDashboard = () => switchView('dashboard');

window.promptAdminLogin = () => {
    const isAdmin = document.getElementById('admin-view').classList.contains('active');
    if(isAdmin) return showDashboard();
    if (prompt("Admin-Passwort:") === "admin123") switchView('admin-view');
};

window.switchAdminTab = (tab) => {
    document.getElementById('admin-chapters-content').style.display = tab === 'chapters' ? 'block' : 'none';
    document.getElementById('admin-questions-content').style.display = tab === 'questions' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
};

// --- DASHBOARD ---
function renderDashboard() {
    const grid = document.getElementById('topics-grid');
    grid.innerHTML = topics.map(t => `
        <div class="topic-card" onclick="startQuiz('${t.id}')">
            <div class="topic-icon-box"><i data-lucide="${t.icon || 'train'}"></i></div>
            <div style="flex:1">
                <h3 style="margin:0">${t.title}</h3>
                <span style="font-size:0.8rem; color:#64748b">${t.questions.length} Fragen verfügbar</span>
            </div>
            <i data-lucide="play-circle" style="color:#d5001c"></i>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
}

// --- QUIZ LOGIK ---
window.startQuiz = (id) => {
    currentTopic = topics.find(t => t.id === id);
    if (!currentTopic || currentTopic.questions.length === 0) return alert("Dieses Kapitel hat noch keine Fragen.");
    currentQuestionIndex = 0;
    score = 0;
    switchView('quiz-view');
    renderQuestion();
};

function renderQuestion() {
    const q = currentTopic.questions[currentQuestionIndex];
    selectedAnswers = [];
    
    document.getElementById('question-text').innerText = q.question_text;
    document.getElementById('question-counter').innerText = `Frage ${currentQuestionIndex + 1} / ${currentTopic.questions.length}`;
    document.getElementById('progress-bar').style.width = `${(currentQuestionIndex / currentTopic.questions.length) * 100}%`;
    document.getElementById('question-type-badge').innerText = q.type.toUpperCase();
    
    const imgCont = document.getElementById('question-image-container');
    if (q.image_url) {
        document.getElementById('question-image').src = q.image_url;
        imgCont.style.display = 'block';
    } else {
        imgCont.style.display = 'none';
    }

    const optCont = document.getElementById('options-container');
    optCont.innerHTML = '';
    
    if (q.type === 'fill') {
        optCont.innerHTML = `<input type="text" id="q-fill" class="option-btn" style="cursor:text" placeholder="Deine Antwort hier...">`;
    } else {
        // Sicherstellen, dass Optionen ein Array sind
        const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]");
        opts.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = cleanString(opt);
            btn.onclick = () => selectOption(idx, btn, q.type);
            optCont.appendChild(btn);
        });
    }

    document.getElementById('check-btn').style.display = 'block';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('feedback-area').innerHTML = '';
}

function selectOption(idx, btn, type) {
    if (type === 'single') {
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        selectedAnswers = [idx];
        btn.classList.add('selected');
    } else {
        btn.classList.toggle('selected');
        if (selectedAnswers.includes(idx)) selectedAnswers = selectedAnswers.filter(i => i !== idx);
        else selectedAnswers.push(idx);
    }
}

window.checkCurrentAnswer = () => {
    const q = currentTopic.questions[currentQuestionIndex];
    let correct = false;

    // Optionen laden und bereinigen
    const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]");

    if (q.type === 'fill') {
        const val = cleanString(document.getElementById('q-fill').value).toLowerCase();
        correct = val === cleanString(q.correct_answer).toLowerCase();
    } else {
        // Nutzerwahl in Text umwandeln und bereinigen
        const userChoices = selectedAnswers.map(i => cleanString(opts[i])).sort();
        
        // Korrekte Antwort splitten (bei |) und bereinigen
        const correctChoices = cleanString(q.correct_answer)
            .split('|')
            .map(s => cleanString(s))
            .sort();

        // Vergleichen
        correct = JSON.stringify(userChoices) === JSON.stringify(correctChoices);
    }

    if (correct) score++;
    document.getElementById('feedback-area').innerHTML = correct ? 
        '<div class="fb-box success">Richtig! Gut gemacht.</div>' : 
        `<div class="fb-box error">Nicht ganz korrekt. Die richtigen Antworten sind markiert.</div>`;
    
    // Markiere richtige Antworten visuell
    document.querySelectorAll('.option-btn').forEach((btn, idx) => {
        const optText = cleanString(opts[idx]);
        const correctChoices = cleanString(q.correct_answer).split('|').map(s => cleanString(s));
        if (correctChoices.includes(optText)) {
            btn.classList.add('correct-highlight');
            btn.style.borderColor = "#16a34a";
            btn.style.backgroundColor = "#f0fdf4";
        }
    });

    document.getElementById('check-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'block';
};

window.handleNext = () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentTopic.questions.length) renderQuestion();
    else showFinalResults();
};

function showFinalResults() {
    switchView('result-view');
    const p = Math.round((score / currentTopic.questions.length) * 100);
    document.getElementById('result-percentage').innerText = p + "%";
    document.getElementById('result-text').innerText = `${score} von ${currentTopic.questions.length} Fragen richtig beantwortet.`;
}

window.restartQuiz = () => window.startQuiz(currentTopic.id);

// --- ADMIN MANAGEMENT ---
window.renderAdminQuestionsList = () => {
    const filterId = document.getElementById('filter-topic').value;
    const listCont = document.getElementById('admin-questions-list');
    
    let filtered = allQuestions;
    if (filterId !== 'all') {
        filtered = allQuestions.filter(q => q.topic_id === filterId);
    }

    if (filtered.length === 0) {
        listCont.innerHTML = '<p style="padding:20px; text-align:center; color:#94a3b8">Keine Fragen gefunden.</p>';
        return;
    }

    listCont.innerHTML = filtered.map(q => `
        <div class="admin-item question-row">
            <div class="q-info">
                <span class="q-tag">${q.type}</span>
                <p class="q-text-preview">${q.question_text}</p>
            </div>
            <div class="q-actions">
                <button class="edit-btn" onclick="editQuestion('${q.id}')"><i data-lucide="edit-3"></i></button>
                <button class="delete-btn" onclick="deleteItem('questions', '${q.id}')"><i data-lucide="trash-2"></i></button>
            </div>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
};

window.saveQuestion = async () => {
    const id = document.getElementById('q-admin-id').value;
    const questionData = {
        topic_id: document.getElementById('q-admin-topic').value,
        type: document.getElementById('q-admin-type').value,
        question_text: document.getElementById('q-admin-text').value,
        image_url: document.getElementById('q-admin-image').value || null,
        options: [0,1,2,3].map(i => document.getElementById(`q-opt-${i}`).value).filter(v => v.trim() !== ""),
        correct_answer: document.getElementById('q-admin-correct').value
    };

    if (!questionData.question_text || !questionData.correct_answer) return alert("Text und Antwort sind Pflicht!");

    try {
        if (id) {
            await supabase.from('questions').update(questionData).eq('id', id);
        } else {
            await supabase.from('questions').insert([questionData]);
        }
        resetQuestionForm();
        await loadData();
        alert("Erfolgreich gespeichert!");
    } catch (e) {
        alert("Fehler beim Speichern!");
    }
};

window.deleteItem = async (table, id) => {
    if (!confirm("Soll dieses Element wirklich gelöscht werden?")) return;
    await supabase.from(table).delete().eq('id', id);
    await loadData();
};

window.addNewChapter = async () => {
    const title = document.getElementById('new-chapter-title').value;
    if (!title) return;
    await supabase.from('topics').insert([{ title, icon: 'train' }]);
    document.getElementById('new-chapter-title').value = '';
    await loadData();
};

function populateAdminInterfaces() {
    const chapList = document.getElementById('admin-chapters-list');
    chapList.innerHTML = topics.map(t => `
        <div class="admin-item">
            <div>
                <strong>${t.title}</strong>
                <span style="font-size:0.8rem; display:block; color:#94a3b8">${t.questions.length} Fragen</span>
            </div>
            <button class="delete-btn" onclick="deleteItem('topics', '${t.id}')">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `).join('');

    const topicSelect = document.getElementById('q-admin-topic');
    const filterSelect = document.getElementById('filter-topic');
    const optionsHtml = topics.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
    
    topicSelect.innerHTML = optionsHtml;
    filterSelect.innerHTML = '<option value="all">Alle Kapitel</option>' + optionsHtml;

    renderAdminQuestionsList();
}

window.resetQuestionForm = () => {
    document.getElementById('editor-title').innerText = "Frage erstellen";
    document.getElementById('q-admin-id').value = '';
    document.getElementById('q-admin-text').value = '';
    document.getElementById('q-admin-image').value = '';
    document.getElementById('q-admin-correct').value = '';
    [0,1,2,3].forEach(i => document.getElementById(`q-opt-${i}`).value = '');
};

window.editQuestion = (id) => {
    const q = allQuestions.find(x => x.id === id);
    if (!q) return;
    document.getElementById('editor-title').innerText = "Frage bearbeiten";
    document.getElementById('q-admin-id').value = q.id;
    document.getElementById('q-admin-topic').value = q.topic_id;
    document.getElementById('q-admin-type').value = q.type;
    document.getElementById('q-admin-text').value = q.question_text;
    document.getElementById('q-admin-image').value = q.image_url || '';
    document.getElementById('q-admin-correct').value = q.correct_answer;
    const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]");
    [0,1,2,3].forEach(i => {
        document.getElementById(`q-opt-${i}`).value = opts[i] || '';
    });
};

init();