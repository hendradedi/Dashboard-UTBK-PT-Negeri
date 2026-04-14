import React, { useState, useEffect, useRef } from 'react';
import {
  Users, FileSpreadsheet, PlayCircle, Settings, LogOut,
  CheckCircle, XCircle, AlertCircle, Clock, ChevronRight, ChevronLeft,
  Download, Upload, Video, Link, Save, Edit, X,
  Megaphone, GraduationCap, BookOpen, Phone, Mail, UserCircle, CheckSquare, Heart,
  RefreshCw, Trash2, Plus, Search
} from 'lucide-react';

// --- FIREBASE INTEGRATION ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, collection, addDoc, updateDoc, doc, deleteDoc,
  setDoc, onSnapshot, writeBatch, query, where, limit, getDocs, getDoc
} from "firebase/firestore";

// --- UTBK 2026 SUBTEST DEFINITIONS ---
const UTBK_SUBTESTS = [
  { id: 'PU', name: 'Penalaran Umum (PU)', durationMin: 30 },
  { id: 'PPU', name: 'Pengetahuan Pemahaman Umum (PPU)', durationMin: 15 },
  { id: 'PBM', name: 'Kem. Memahami Bacaan & Menulis (PBM)', durationMin: 25 },
  { id: 'PK', name: 'Pengetahuan Kuantitatif (PK)', durationMin: 20 },
  { id: 'LBI', name: 'Literasi Bahasa Indonesia', durationMin: 45 },
  { id: 'LBE', name: 'Literasi Bahasa Inggris', durationMin: 30 },
  { id: 'PM', name: 'Penalaran Matematika (PM)', durationMin: 30 },
];

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyA0WUeiKi3ttr4kUNN6DlDBI8I_ig6PA54",
  authDomain: "try-out-ujian-mandiri-pt.firebaseapp.com",
  projectId: "try-out-ujian-mandiri-pt",
  storageBucket: "try-out-ujian-mandiri-pt.firebasestorage.app",
  messagingSenderId: "503456334864",
  appId: "1:503456334864:web:0e225d771ac6201c1c3695"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tryout-app';

export default function App() {
  // --- STATE MANAJEMEN ---
  const [view, setView] = useState(() => sessionStorage.getItem('tryout_view') || 'login');
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('tryout_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authUser, setAuthUser] = useState(null);

  // Data Aplikasi (Terhubung ke Firebase)
  const [users, setUsers] = useState([]);
  const [questions, setQuestions] = useState([]);

  // State Pengaturan Sistem
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingTime, setMeetingTime] = useState('08:00 WIB');
  const [announcement, setAnnouncement] = useState(''); // State baru untuk pengumuman Admin
  const [waGroupLink, setWaGroupLink] = useState('');
  const [isExamOpen, setIsExamOpen] = useState(false); // Kontrol buka/tutup ujian oleh Admin
  const [maxParticipants, setMaxParticipants] = useState(0); // 0 = tidak ada batas
  const [adminConfig, setAdminConfig] = useState({ username: 'admin', password: 'admin', assistants: [] });

  // State Admin Panel (diangkat ke level App agar tidak di-reset saat Firestore update)
  const [adminActiveTab, setAdminActiveTab] = useState('peserta');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editQuestionForm, setEditQuestionForm] = useState({ kategori: 'PU', text: '', answer: '', options: { A: '', B: '', C: '', D: '', E: '' } });

  // State Tryout User
  const [userAnswers, setUserAnswers] = useState(() => {
    const saved = sessionStorage.getItem('tryout_answers');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(() => {
    const saved = sessionStorage.getItem('tryout_qIdx');
    return saved ? parseInt(saved) : 0;
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = sessionStorage.getItem('tryout_time');
    return saved ? parseInt(saved) : 5400;
  });
  const timerRef = useRef(null);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => { sessionStorage.setItem('tryout_view', view); }, [view]);
  useEffect(() => { sessionStorage.setItem('tryout_user', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { sessionStorage.setItem('tryout_answers', JSON.stringify(userAnswers)); }, [userAnswers]);
  useEffect(() => { sessionStorage.setItem('tryout_qIdx', currentQuestionIdx.toString()); }, [currentQuestionIdx]);
  useEffect(() => { sessionStorage.setItem('tryout_time', timeLeft.toString()); }, [timeLeft]);

  // Load Dependencies & Firebase Auth
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init error:", err);
        setAuthUser({ uid: 'unauthenticated-guest' });
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setAuthUser(user);
    });

    return () => unsubscribe();
  }, []);

  // Firebase Real-time Listeners (Optimized to save reads)
  // We track questions and users ONLY for admin to power Leaderboard & Bank Soal.
  // Normal users rely on single getDocs during login or session cache.
  useEffect(() => {
    if (!authUser) return;

    let unsubUsers = () => { };
    let unsubQuestions = () => { };

    if (currentUser?.role === 'admin' || currentUser?.role === 'asisten') {
      const partsRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
      unsubUsers = onSnapshot(partsRef, (snap) => {
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.error("Listener error users:", err));
    }

    if (currentUser?.role === 'admin') {
      const questsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
      unsubQuestions = onSnapshot(questsRef, (snap) => {
        setQuestions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.error("Listener error questions:", err));
    }

    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'live');
    const unsubSettings = onSnapshot(settingsRef, (document) => {
      if (document.exists()) {
        setMeetingLink(document.data().meetingLink || '');
        setMeetingTime(document.data().meetingTime || '08:00 WIB');
        setAnnouncement(document.data().announcement || '');
        setWaGroupLink(document.data().waGroupLink || '');
        setIsExamOpen(document.data().isExamOpen || false);
        setMaxParticipants(document.data().maxParticipants ?? 0);
      }
    }, (err) => console.error("Listener error settings:", err));

    const adminRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
    const unsubAdmin = onSnapshot(adminRef, (document) => {
      if (document.exists()) {
        const data = document.data();
        setAdminConfig({
          username: data.username || 'admin',
          password: data.password || 'admin',
          assistants: data.assistants || []
        });
      }
    }, (err) => console.error("Listener error admin:", err));

    return () => {
      unsubUsers();
      unsubQuestions();
      unsubSettings();
      unsubAdmin();
    };
  }, [authUser, currentUser?.role]);

  // --- LOGIC AUTH ---
  const fetchQuestionsOnce = async () => {
    try {
      if (sessionStorage.getItem('tryout_cached_qs')) {
        setQuestions(JSON.parse(sessionStorage.getItem('tryout_cached_qs')));
        return;
      }
      const questsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
      const snap = await getDocs(questsRef);
      const qs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuestions(qs);
      sessionStorage.setItem('tryout_cached_qs', JSON.stringify(qs));
    } catch (e) { console.error("Gagal memuat soal", e); }
  };

  const handleLogin = async (username, password) => {
    // KODE DARURAT LUPA PASSWORD ADMIN
    if (username === 'resetadmin' && password === '123') {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), { username: 'admin', password: 'admin' });
        alert('BERHASIL DIRESET! Silakan login menggunakan username: admin, password: admin');
        return false;
      } catch (e) { alert('Gagal mereset password.'); }
    }

    try {
      const adminRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
      const adminSnap = await getDoc(adminRef);
      if (adminSnap.exists()) {
        const conf = adminSnap.data();
        if (username === conf.username && password === conf.password) {
          setCurrentUser({ role: 'admin', name: 'Administrator' });
          setView('admin');
          return true;
        }
        if (conf.assistants) {
          const asisten = conf.assistants.find(a => a.username === username && a.password === password);
          if (asisten) {
            setCurrentUser({ role: 'asisten', name: asisten.name || 'Asisten Admin' });
            setView('admin');
            return true;
          }
        }
      } else {
        if (username === adminConfig.username && password === adminConfig.password) {
          setCurrentUser({ role: 'admin', name: 'Administrator' });
          setView('admin');
          return true;
        }
      }
    } catch (e) { console.error("Admin check failed", e); }

    try {
      const partsRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
      const q = query(partsRef, where('username', '==', username), where('password', '==', password), limit(1));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const participant = { id: docSnap.id, ...docSnap.data() };
        setCurrentUser({ ...participant, role: 'user' });
        setUserAnswers(participant.answers || {});

        const isActive = participant.isActive === undefined ? true : participant.isActive;
        if (!isActive) {
          setView('activation');
        } else {
          setView(participant.finished ? 'result' : 'user');
        }

        if (!participant.finished) {
          await fetchQuestionsOnce(); // Load questions efficiently
        }
        return true;
      }
    } catch (error) {
      console.error("Login query failed:", error);
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    setUserAnswers({});
    setCurrentQuestionIdx(0);
    setTimeLeft(5400);
    sessionStorage.clear();
    clearInterval(timerRef.current);
  };

  const handleRegister = async (name, username, password, school, targetUniversity, targetMajor, whatsapp, email) => {
    const usernameLower = username.toLowerCase();
    if (usernameLower === adminConfig.username.toLowerCase()) return false;

    const partsRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');

    // Cek kuota peserta jika kuota diaktifkan (maxParticipants > 0)
    if (maxParticipants > 0) {
      try {
        const countSnap = await getDocs(partsRef);
        if (countSnap.size >= maxParticipants) return 'quota_full';
      } catch (e) {
        console.error("Error checking quota:", e);
      }
    }

    // Cek duplikat lewat query yang efisien
    try {
      const q = query(partsRef, where('username', '==', username), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) return false;
    } catch (e) {
      console.error("Error checking register:", e);
      return false;
    }

    const activationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newUser = {
      username, password, name, school, targetUniversity, targetMajor, whatsapp, email,
      score: null, finished: false, createdAt: new Date().toISOString(),
      answers: {}, violations: 0, startTime: null,
      activationCode, isActive: false
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'participants'), newUser);
      return true;
    } catch (error) {
      console.error("Error adding document: ", error);
      return false;
    }
  };

  // --- KOMPONEN: LOGIN ---
  const LoginView = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [school, setSchool] = useState('');
    const [targetUniversity, setTargetUniversity] = useState('');
    const [targetMajor, setTargetMajor] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const onSubmit = async (e) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setIsLoading(true);

      if (isRegister) {
        const success = await handleRegister(name, username, password, school, targetUniversity, targetMajor, whatsapp, email);
        if (success === true) {
          setSuccessMsg('Pendaftaran berhasil! Silakan masuk dengan akun Anda.');
          setIsRegister(false);
          setName(''); setUsername(''); setPassword(''); setSchool('');
          setTargetUniversity(''); setTargetMajor(''); setWhatsapp(''); setEmail('');
        } else if (success === 'quota_full') {
          setError(`Pendaftaran ditutup. Kuota peserta (${maxParticipants} orang) telah penuh. Hubungi panitia untuk informasi lebih lanjut.`);
        } else {
          setError('Username sudah digunakan! Silakan pilih username yang lain.');
        }
      } else {
        const success = await handleLogin(username, password);
        if (!success) {
          setError('Username atau password salah!');
        }
      }
      setIsLoading(false);
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <GraduationCap size={32} />
            </div>
            <h1 className="text-3xl font-bold text-blue-800 mb-2">Simulasi SNBT</h1>
            <p className="text-gray-500">{isRegister ? 'Buat akun peserta baru' : 'Masuk untuk memulai tryout'}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg flex items-center gap-2 text-sm">
              <CheckCircle size={16} /> {successMsg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asal Sekolah</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Contoh: SMAN 1 Jakarta"
                  required
                />
              </div>
            )}
            {isRegister && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kampus Tujuan</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={targetUniversity}
                    onChange={(e) => setTargetUniversity(e.target.value)}
                    placeholder="Contoh: UI"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program Studi</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={targetMajor}
                    onChange={(e) => setTargetMajor(e.target.value)}
                    placeholder="Contoh: Kedokteran"
                    required
                  />
                </div>
              </div>
            )}
            {isRegister && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WA Aktif</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Contoh: 0812..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@contoh.com"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-70"
            >
              {isLoading ? 'Memproses...' : (isRegister ? 'Daftar Sekarang' : 'Masuk')}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMsg(''); }}
              className="text-blue-600 hover:underline font-medium"
            >
              {isRegister ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar di sini'}
            </button>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
          Made with <Heart size={16} className="text-red-500 fill-red-500" /> by Laboratorium Pendidikan Non Formal FIPP UNNES
        </div>
      </div>
    );
  };

  // --- KOMPONEN: DASHBOARD ADMIN ---
  const AdminView = () => {
    const [activeTab, setActiveTab] = [adminActiveTab, setAdminActiveTab];
    const [genCount, setGenCount] = useState(5);
    const [importMsg, setImportMsg] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [searchScore, setSearchScore] = useState('');

    // State Admin
    const [newAdminUser, setNewAdminUser] = useState(adminConfig.username);
    const [newAdminPass, setNewAdminPass] = useState(adminConfig.password);

    // State Asisten
    const [newAsistenName, setNewAsistenName] = useState('');
    const [newAsistenUser, setNewAsistenUser] = useState('');
    const [newAsistenPass, setNewAsistenPass] = useState('');

    const handleAddAsisten = async (e) => {
      e.preventDefault();
      if (!newAsistenName || !newAsistenUser || !newAsistenPass) return;
      const updatedAssistants = [...(adminConfig.assistants || []), { name: newAsistenName, username: newAsistenUser, password: newAsistenPass, id: Date.now().toString() }];
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), { assistants: updatedAssistants }, { merge: true });
        setNewAsistenName(''); setNewAsistenUser(''); setNewAsistenPass('');
        setSaveStatus('Asisten ditambahkan!');
        setTimeout(() => setSaveStatus(''), 3000);
      } catch (e) {
        alert("Gagal menambah asisten.");
      }
    };

    const handleRemoveAsisten = async (id) => {
      if (!window.confirm("Yakin ingin menghapus asisten ini?")) return;
      const updatedAssistants = (adminConfig.assistants || []).filter(a => a.id !== id);
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), { assistants: updatedAssistants }, { merge: true });
        setSaveStatus('Asisten dihapus!');
        setTimeout(() => setSaveStatus(''), 3000);
      } catch (e) {
        alert("Gagal menghapus asisten.");
      }
    };

    // State Pengaturan Sistem untuk form edit
    const [formMeetingLink, setFormMeetingLink] = useState(meetingLink);
    const [formMeetingTime, setFormMeetingTime] = useState(meetingTime);
    const [formAnnouncement, setFormAnnouncement] = useState(announcement);
    const [formWaGroupLink, setFormWaGroupLink] = useState(waGroupLink);
    const [formMaxParticipants, setFormMaxParticipants] = useState(maxParticipants);

    // Sync state ketika data firebase berubah
    useEffect(() => {
      setFormMeetingLink(meetingLink);
      setFormMeetingTime(meetingTime);
      setFormAnnouncement(announcement);
      setFormWaGroupLink(waGroupLink);
      setFormMaxParticipants(maxParticipants);
    }, [meetingLink, meetingTime, announcement, waGroupLink, maxParticipants]);

    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({ username: '', password: '' });

    const openEditModal = (user) => {
      setEditingUser(user);
      setEditForm({ username: user.username, password: user.password });
    };

    const handleUpdateUser = async (e) => {
      e.preventDefault();
      try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', editingUser.id);
        await updateDoc(userRef, {
          username: editForm.username,
          password: editForm.password
        });
        setEditingUser(null);
        setImportMsg('Akun peserta berhasil diubah!');
        setTimeout(() => setImportMsg(''), 3000);
      } catch (error) {
        alert("Gagal mengubah data peserta.");
      }
    };

    const handleResetKode = async (userId) => {
      if (window.confirm("Buat ulang kode aktivasi untuk peserta ini? (Kode lama akan hangus)")) {
        try {
          const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', userId);
          await updateDoc(userRef, { activationCode: newCode, isActive: false });
          setImportMsg('Kode aktivasi berhasil direset!');
          setTimeout(() => setImportMsg(''), 3000);
        } catch (e) {
          alert('Gagal mereset kode aktivasi.');
        }
      }
    };

    const handleValidasiPeserta = async (userId, userName) => {
      if (window.confirm(`Validasi peserta ${userName}? Peserta akan langsung aktif ujian tanpa perlu memasukkan kode.`)) {
        try {
          const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', userId);
          await updateDoc(userRef, { isActive: true });
          setImportMsg('Peserta berhasil divalidasi!');
          setTimeout(() => setImportMsg(''), 3000);
        } catch (e) {
          alert('Gagal memvalidasi peserta.');
        }
      }
    };

    const handleResetParticipant = async (userId) => {
      if (window.confirm("Yakin ingin mereset ujian peserta ini? Jawaban, waktu, dan skor akan dihapus.")) {
        try {
          const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', userId);
          await updateDoc(userRef, { score: null, finished: false, answers: {}, violations: 0, startTime: null });
          setImportMsg('Peserta berhasil direset!');
          setTimeout(() => setImportMsg(''), 3000);
        } catch (e) {
          alert('Gagal mereset.');
        }
      }
    };

    const openEditQuestionModal = (q) => {
      setEditingQuestion(q);
      setEditQuestionForm({ kategori: q.kategori || 'PU', text: q.text, answer: q.answer, options: { ...q.options } });
    };

    const handleUpdateQuestion = async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();
      if (!editingQuestion) return;
      try {
        const qRef = doc(db, 'artifacts', appId, 'public', 'data', 'questions', editingQuestion.id);
        await updateDoc(qRef, {
          kategori: editQuestionForm.kategori,
          text: editQuestionForm.text,
          answer: editQuestionForm.answer,
          options: editQuestionForm.options
        });
        setEditingQuestion(null);
        setImportMsg('Soal berhasil diperbarui!');
        setTimeout(() => setImportMsg(''), 3000);
      } catch (err) { alert('Gagal memperbarui soal.'); }
    };

    const handleDeleteQuestion = async (id) => {
      if (window.confirm("Hapus soal ini?")) {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', id));
          setImportMsg('Satu soal dihapus.');
          setTimeout(() => setImportMsg(''), 3000);
        } catch (e) { }
      }
    };

    const handleDeleteAllQuestions = async () => {
      if (window.confirm("HATI-HATI! Anda yakin ingin menghapus SEMUA soal yang ada di bank soal?")) {
        try {
          setImportMsg("Sedang menghapus...");
          const batch = writeBatch(db);
          questions.forEach(q => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'questions', q.id)));
          await batch.commit();
          setImportMsg('Semua soal berhasil dihapus!');
          setTimeout(() => setImportMsg(''), 3000);
        } catch (err) { alert('Gagal menghapus semua soal.'); }
      }
    };

    const handleExportQuestions = () => {
      if (!window.XLSX) { setImportMsg("Library Excel belum siap."); return; }
      const dataToExport = questions.map((q, i) => ({
        "No": i + 1,
        "Wacana": q.wacana || "",
        "Soal": q.text,
        "A": q.options.A || "",
        "B": q.options.B || "",
        "C": q.options.C || "",
        "D": q.options.D || "",
        "E": q.options.E || "",
        "Kunci": q.answer,
        "Kategori": q.kategori || "PU"
      }));
      const ws = window.XLSX.utils.json_to_sheet(dataToExport);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Bank_Soal");
      window.XLSX.writeFile(wb, "Arsip_Bank_Soal_Tryout.xlsx");
    };

    const handleSaveAdminCredentials = async () => {
      setSaveStatus('Menyimpan admin...');
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), {
          username: newAdminUser,
          password: newAdminPass
        });
        setSaveStatus('Akun Admin Diperbarui!');
        setTimeout(() => setSaveStatus(''), 3000);
      } catch (e) {
        setSaveStatus('Gagal menyimpan.');
      }
    };

    const handleSaveSettings = async () => {
      setSaveStatus('Menyimpan info...');
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'live'), {
          meetingLink: formMeetingLink,
          meetingTime: formMeetingTime,
          announcement: formAnnouncement,
          waGroupLink: formWaGroupLink,
          maxParticipants: parseInt(formMaxParticipants) || 0
        });
        setSaveStatus('Info Tersimpan!');
        setTimeout(() => setSaveStatus(''), 3000);
      } catch (e) {
        setSaveStatus('Gagal menyimpan.');
      }
    };

    const generateUsers = async () => {
      setImportMsg('Sedang mengenerate akun...');
      try {
        const batch = writeBatch(db);
        const participantsRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
        for (let i = 0; i < genCount; i++) {
          const rnd = Math.floor(Math.random() * 9000) + 1000;
          const ref = doc(participantsRef);
          batch.set(ref, {
            username: `peserta${rnd}`,
            password: Math.random().toString(36).slice(-6),
            name: `Peserta ${rnd}`,
            school: '-', targetUniversity: '-', targetMajor: '-', whatsapp: '-', email: '-',
            score: null, finished: false, createdAt: new Date().toISOString(),
            answers: {}, violations: 0, startTime: null,
            isActive: true
          });
        }
        await batch.commit();
        setImportMsg('Akun berhasil dibuat!');
        setTimeout(() => setImportMsg(''), 3000);
      } catch (e) {
        setImportMsg('Gagal membuat akun: ' + e.message);
      }
    };

    const exportToExcel = () => {
      if (!window.XLSX) { setImportMsg("Library Excel belum siap."); return; }
      const dataToExport = users.map(u => ({
        "Nama Lengkap": u.name, "Username": u.username, "Password": u.password,
        "Kode Aktivasi": u.activationCode || '-', "Status Akun": u.isActive === false ? "Belum Aktif" : "Aktif",
        "Asal Sekolah": u.school || '-', "Kampus Tujuan": u.targetUniversity || '-',
        "Program Studi": u.targetMajor || '-', "Nomor WA": u.whatsapp || '-', "Email": u.email || '-',
        "Status Tryout": u.finished ? "Selesai" : "Belum / Berlangsung", "Skor": u.score !== null ? u.score : '-'
      }));
      const ws = window.XLSX.utils.json_to_sheet(dataToExport);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Data_Peserta");
      window.XLSX.writeFile(wb, "Data_Peserta_Tryout.xlsx");
    };

    const parseWordContent = (text) => {
      const output = [];
      let currentWacana = ''; // Wacana aktif yang sedang berlaku

      // Pisahkan file menjadi blok-blok dengan pemisah ===WACANA=== atau ===SOAL===
      // atau cukup baris kosong ganda
      const rawBlocks = text.split(/\n\s*\n/).filter(b => b.trim().length > 5);

      rawBlocks.forEach(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const firstLineUpper = (lines[0] || '').toUpperCase();

        // Deteksi blok WACANA
        if (
          firstLineUpper.includes('===WACANA===') ||
          firstLineUpper.startsWith('WACANA:') ||
          firstLineUpper.startsWith('BACAAN:') ||
          firstLineUpper.startsWith('TEKS:') ||
          firstLineUpper.startsWith('PASSAGE:')
        ) {
          // Simpan seluruh isi blok ini sebagai wacana aktif
          const wacanaLines = lines.slice(
            (firstLineUpper.includes('===WACANA===') || firstLineUpper.includes(':')) ? 1 : 0
          );
          // Untuk WACANA:, ambil teks setelah tanda titik dua juga
          const prefix = lines[0].indexOf(':');
          const firstContent = prefix >= 0 ? lines[0].substring(prefix + 1).trim() : '';
          currentWacana = [firstContent, ...lines.slice(1)].filter(Boolean).join('\n').trim();
          return; // Blok ini hanya mengisi currentWacana, bukan soal
        }

        // Deteksi reset wacana
        if (firstLineUpper.includes('===NEW===') || firstLineUpper.includes('===BARU===')) {
          currentWacana = '';
          return;
        }

        // Proses blok soal
        let kategori = 'LBI', soalStr = '', opsiA = '', opsiB = '', opsiC = '', opsiD = '', opsiE = '', kunci = 'A';
        let currentKey = 'none';
        let tempSoalLine = [];

        lines.forEach(line => {
          const upperLine = line.toUpperCase();
          if (upperLine.startsWith('KATEGORI:') || upperLine.startsWith('SUBTES:')) {
            kategori = line.substring(line.indexOf(':') + 1).trim();
          } else if (upperLine.startsWith('SOAL:') || upperLine.startsWith('PERTANYAAN:')) {
            currentKey = 'Soal';
            tempSoalLine.push(line.substring(line.indexOf(':') + 1).trim());
          } else if (upperLine.startsWith('KUNCI:') || upperLine.startsWith('JAWABAN:')) {
            kunci = line.substring(line.indexOf(':') + 1).trim();
          } else if (line.match(/^A[\.)]/i)) {
            currentKey = 'A'; opsiA = line.replace(/^A[\.)\s]*/i, '').trim();
          } else if (line.match(/^B[\.)]/i)) {
            currentKey = 'B'; opsiB = line.replace(/^B[\.)\s]*/i, '').trim();
          } else if (line.match(/^C[\.)]/i)) {
            currentKey = 'C'; opsiC = line.replace(/^C[\.)\s]*/i, '').trim();
          } else if (line.match(/^D[\.)]/i)) {
            currentKey = 'D'; opsiD = line.replace(/^D[\.)\s]*/i, '').trim();
          } else if (line.match(/^E[\.)]/i)) {
            currentKey = 'E'; opsiE = line.replace(/^E[\.)\s]*/i, '').trim();
          } else if (/^\d+[\.)\s]/.test(line) && currentKey === 'none') {
            // Baris bernomor (misal: 1. atau 1)) = awal soal baru
            currentKey = 'Soal';
            tempSoalLine.push(line.replace(/^\d+[\.)\s]+/, '').trim());
          } else {
            if (currentKey === 'Soal') tempSoalLine.push(line);
            else if (currentKey === 'A') opsiA += '\n' + line;
            else if (currentKey === 'B') opsiB += '\n' + line;
            else if (currentKey === 'C') opsiC += '\n' + line;
            else if (currentKey === 'D') opsiD += '\n' + line;
            else if (currentKey === 'E') opsiE += '\n' + line;
          }
        });

        soalStr = tempSoalLine.join('\n').trim();

        if (soalStr && (opsiA || opsiB)) {
          output.push({
            kategori: kategori.toUpperCase(),
            wacana: currentWacana || '', // Sertakan wacana aktif
            text: soalStr,
            options: { A: opsiA.trim(), B: opsiB.trim(), C: opsiC.trim(), D: opsiD.trim(), E: opsiE.trim() },
            answer: kunci.toUpperCase().replace(/[^A-E]/g, '') || 'A'
          });
        }
      });
      return output;
    };

    const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileName = file.name.toLowerCase();

      const saveToFirestore = async (newQuestions) => {
        if (newQuestions.length === 0) {
          setImportMsg("File kosong atau format salah. Tidak ada soal yang tersimpan.");
          return;
        }
        setImportMsg("Sedang memproses dan menggabungkan soal...");
        const batch = writeBatch(db);
        const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');

        // Smart Merge: normalkan teks soal lama untuk perbandingan
        const existingByText = {};
        questions.forEach(q => {
          const key = q.text?.trim().toLowerCase();
          if (key) existingByText[key] = q;
        });

        let addedCount = 0, updatedCount = 0;
        newQuestions.forEach(newQ => {
          const key = newQ.text?.trim().toLowerCase();
          const existing = existingByText[key];
          if (existing) {
            // Soal sudah ada → update (timpa dengan versi baru)
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'questions', existing.id), {
              kategori: newQ.kategori,
              text: newQ.text,
              options: newQ.options,
              answer: newQ.answer
            });
            updatedCount++;
          } else {
            // Soal baru → tambahkan
            batch.set(doc(questionsRef), newQ);
            addedCount++;
          }
        });

        await batch.commit();
        setImportMsg(`Selesai! ${addedCount} soal ditambahkan, ${updatedCount} soal diperbarui. Soal lama yang tidak ada di file tetap dipertahankan.`);
      };

      if (fileName.endsWith('.docx')) {
        if (!window.mammoth) {
          setImportMsg('Library Mammoth (Word) belum siap. Tunggu beberapa detik lalu coba lagi.');
          return;
        }
        setImportMsg("Membaca file Word...");
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const arrayBuffer = evt.target.result;
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            const parsedQuestions = parseWordContent(result.value);
            if (parsedQuestions.length === 0) {
              setImportMsg("Tidak ada soal terdeteksi. Pastikan format menggunakan WACANA:, SOAL:, A., B., Kunci: atau nomor berurutan.");
              return;
            }
            await saveToFirestore(parsedQuestions);
          } catch (err) {
            console.error(err);
            setImportMsg("Terjadi kesalahan membaca file Word. Pastikan file adalah .docx yang valid.");
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        if (!window.XLSX) { setImportMsg("Library Excel sedang dimuat."); return; }
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const bstr = evt.target.result;
            const wb = window.XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = window.XLSX.utils.sheet_to_json(ws);

            let carryWacana = ''; // Carry-forward: wacana berlaku hingga diganti
            const parsedQuestions = data.map((row) => {
              // Baca kode kategori: cek kolom bernama 'Kategori'/'Subtes' ATAU kolom terakhir
              const allKeys = Object.keys(row);
              const lastKey = allKeys[allKeys.length - 1];
              const lastVal = (row[lastKey] || '').toString().trim().toUpperCase();
              const VALID_CODES = ['PU', 'PPU', 'PBM', 'PK', 'LBI', 'LBE', 'PM'];
              const kategoriFromLast = VALID_CODES.includes(lastVal) ? lastVal : null;
              const kategori = (
                row['Kategori'] || row['Subtes'] || row['kategori'] || kategoriFromLast || 'PU'
              ).toString().trim().toUpperCase();

              // Wacana carry-forward: jika baris ini punya kolom Wacana/Bacaan, simpan. Jika kosong, pakai wacana sebelumnya.
              const rowWacana = (row['Wacana'] || row['Bacaan'] || row['Teks'] || row['Passage'] || '').toString().trim();
              if (rowWacana) carryWacana = rowWacana;

              return {
                kategori,
                wacana: carryWacana,
                text: row['Soal'] || row['Pertanyaan'] || "Soal tidak terbaca",
                options: {
                  A: row['A'] || row['Opsi A'] || "",
                  B: row['B'] || row['Opsi B'] || "",
                  C: row['C'] || row['Opsi C'] || "",
                  D: row['D'] || row['Opsi D'] || "",
                  E: row['E'] || row['Opsi E'] || ""
                },
                answer: (row['Kunci'] || row['Jawaban'] || 'A').toString().trim().toUpperCase()
              };
            });
            await saveToFirestore(parsedQuestions);
          } catch (error) {
            setImportMsg("Terjadi kesalahan membaca Excel.");
          }
        };
        reader.readAsBinaryString(file);
      } else {
        setImportMsg("Format tidak didukung. Harap upload .xlsx atau .docx");
      }
    };

    return (
      <div className="min-h-screen bg-gray-100 relative flex flex-col">
        <nav className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Settings size={24} />
            <h1 className="text-xl font-bold">Admin Panel Tryout</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 hover:bg-blue-800 px-3 py-1 rounded transition">
            <LogOut size={18} /> Keluar
          </button>
        </nav>

        <div className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 space-y-2">
            <button onClick={() => setActiveTab('peserta')} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${activeTab === 'peserta' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'}`}>
              <Users size={20} /> Kelola Peserta
            </button>
            {currentUser?.role === 'admin' && (
              <>
                <button onClick={() => setActiveTab('soal')} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${activeTab === 'soal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'}`}>
                  <FileSpreadsheet size={20} /> Bank Soal
                </button>
                <button onClick={() => setActiveTab('hasil')} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${activeTab === 'hasil' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'}`}>
                  <CheckCircle size={20} /> Hasil Tryout
                </button>
                <button onClick={() => setActiveTab('pengaturan')} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${activeTab === 'pengaturan' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'}`}>
                  <Settings size={20} /> Pengaturan Sistem
                </button>
              </>
            )}
          </div>

          <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            {/* TAB PESERTA & SOAL & HASIL SAMA SEPERTI SEBELUMNYA ... */}
            {activeTab === 'peserta' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Kelola Data Peserta</h2>
                {importMsg && <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded-lg text-sm">{importMsg}</div>}
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                  {currentUser?.role === 'admin' ? (
                    <div className="flex gap-4">
                      <input type="number" min="1" max="100" value={genCount} onChange={(e) => setGenCount(parseInt(e.target.value) || 1)} className="border border-gray-300 rounded-lg px-4 py-2 w-32" title="Jumlah akun" />
                      <button onClick={generateUsers} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Generate Random</button>
                    </div>
                  ) : <div />}
                  <button onClick={exportToExcel} className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium shadow-sm"><Download size={18} /> Export Data (Excel)</button>
                </div>
                <div className="overflow-x-auto pb-10">
                  <table className="w-full border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-200">
                        <th className="py-3 px-4 text-left font-semibold text-gray-600">Nama & Asal Sekolah</th>
                        <th className="py-3 px-4 text-left font-semibold text-gray-600">Akun Login</th>
                        <th className="py-3 px-4 text-left font-semibold text-gray-600">Tujuan Studi</th>
                        <th className="py-3 px-4 text-left font-semibold text-gray-600">Status & WA</th>
                        <th className="py-3 px-4 text-center font-semibold text-gray-600">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan="4" className="py-4 text-center text-gray-500">Belum ada data</td></tr>
                      ) : users.map(u => (
                        <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-4">
                            <div className="font-medium text-gray-800">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.school}</div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="font-mono text-blue-600 text-sm">{u.username}</div>
                            <div className="font-mono text-xs text-gray-400">pwd: {u.password}</div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="text-sm">{u.targetUniversity}</div>
                            <div className="text-xs text-gray-500">{u.targetMajor}</div>
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex flex-col items-start gap-1">
                              {(u.isActive === undefined || u.isActive) ? (
                                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">SUDAH AKTIF</span>
                              ) : (
                                <>
                                  <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200">BELUM AKTIF</span>
                                  {u.activationCode && (
                                    <div className="flex gap-1 items-center mt-1">
                                      <a href={`https://wa.me/${(u.whatsapp || '').replace(/^0/, '62')}?text=Halo%20${encodeURIComponent(u.name)},%20berikut%20adalah%20kode%20aktivasi%20akun%20Simulasi%20SNBT%20kamu:%20*${u.activationCode}*%0A%0ASilakan%20masukkan%20kode%20tersebut%20setelah%20login%20untuk%20mengakses%20dashboard.`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded transition border border-blue-200 shadow-sm flex items-center gap-1">
                                        Kirim via WA
                                      </a>
                                      <button onClick={() => handleValidasiPeserta(u.id, u.name)} className="text-xs font-bold bg-green-50 text-green-700 hover:bg-green-200 px-2 py-1 rounded transition border border-green-300 shadow-sm" title="Validasi Manual">
                                        Validasi
                                      </button>
                                      <button onClick={() => handleResetKode(u.id)} className="text-xs font-bold bg-gray-50 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition border border-gray-300 shadow-sm" title="Buat & Reset Ulang Kode">
                                        <RefreshCw size={12} />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                              <div className="text-xs text-gray-500 font-mono mt-1">{u.whatsapp || '-'}</div>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-center flex items-center justify-center gap-2">
                            {currentUser?.role === 'admin' && (
                              <>
                                <button onClick={() => openEditModal(u)} className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-blue-100 hover:text-blue-600 transition" title="Edit Akun"><Edit size={16} /></button>
                                <button onClick={() => handleResetParticipant(u.id)} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition" title="Reset Ujian"><AlertCircle size={16} /></button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'soal' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                  <h2 className="text-2xl font-bold">Kelola Bank Soal</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportQuestions} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium text-sm shadow-sm">
                      <Download size={16} /> Arsipkan ke Excel
                    </button>
                    {currentUser?.role === 'admin' && (
                      <button onClick={handleDeleteAllQuestions} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium text-sm shadow-sm">
                        <Trash2 size={16} /> Hapus Semua
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 mb-6">
                  <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                  <div className="mb-5 text-sm text-gray-600 space-y-2">
                    <p className="font-semibold text-gray-700">Format Excel yang didukung:</p>
                    <div className="inline-block text-left bg-white border border-gray-200 rounded-lg px-4 py-3 font-mono text-xs text-gray-600">
                      <span className="text-gray-400">Kolom:</span> <span className="text-amber-600 font-bold">Wacana</span> | Soal | A | B | C | D | E | Kunci | <span className="text-blue-600 font-bold">Kategori</span>
                      <br />
                      <span className="text-gray-400">Kode Kategori:</span> <span className="text-blue-600 font-bold">PU  PPU  PBM  PK  LBI  LBE  PM</span>
                    </div>
                    <p className="text-gray-500">Kolom <b className="text-amber-600">Wacana</b> opsional — cukup diisi 1x di baris pertama, baris di bawahnya otomatis mewarisi. Kolom <b>Kategori</b> bisa di posisi mana saja. Format Word (.docx) juga didukung.</p>
                  </div>
                  <label className="bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition">
                    Pilih File Baru (.xlsx / .docx) — Soal lama yang tidak ada di file akan dipertahankan <input type="file" accept=".xlsx, .xls, .docx" className="hidden" onChange={handleFileUpload} />
                  </label>
                  {importMsg && <p className="mt-4 text-blue-600 font-medium">{importMsg}</p>}
                </div>

                <h3 className="font-semibold text-lg mb-3">Daftar Soal ({questions.length})</h3>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {questions.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 border rounded-lg bg-gray-50">Belum ada soal, silakan upload file Excel.</div>
                  ) : questions.map((q, i) => (
                    <div key={q.id} className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm flex flex-col md:flex-row gap-4 justify-between transition hover:border-blue-300">
                      <div className="flex-1">
                        <p className="font-medium mb-3 text-gray-800 whitespace-pre-wrap">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mr-2">{q.kategori || 'PU'}</span>
                          <span className="font-bold mr-1">{i + 1}.</span> {q.text}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                          <p><span className="font-bold mr-1">A.</span> {q.options.A}</p> <p><span className="font-bold mr-1">B.</span> {q.options.B}</p>
                          <p><span className="font-bold mr-1">C.</span> {q.options.C}</p> <p><span className="font-bold mr-1">D.</span> {q.options.D}</p>
                          {q.options.E && <p><span className="font-bold mr-1">E.</span> {q.options.E}</p>}
                        </div>
                        <p className="text-xs bg-green-100 text-green-800 inline-block px-2 py-1 rounded font-bold border border-green-200">Kunci Jawaban: {q.answer}</p>
                      </div>
                      {currentUser?.role === 'admin' && (
                        <div className="flex sm:flex-col gap-2">
                          <button onClick={() => openEditQuestionModal(q)} className="p-2 h-fit bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-100" title="Edit Soal"><Edit size={16} /></button>
                          <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 h-fit bg-red-50 text-red-600 hover:bg-red-100 rounded border border-red-100" title="Hapus Soal ini"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'hasil' && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Hasil Tryout Peserta</h2>
                
                {/* UI Pencarian & Reset Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Cari nama peserta..."
                      value={searchScore}
                      onChange={(e) => setSearchScore(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  {searchScore && (
                    <button
                      onClick={() => setSearchScore('')}
                      className="flex items-center gap-2 text-gray-700 hover:text-red-600 bg-gray-100 px-3 py-2 rounded-lg transition-all font-medium border border-gray-200"
                    >
                      <X size={18} /> Reset
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-200">
                        <th className="py-3 px-4 text-left font-semibold text-gray-600">Peserta</th>
                        <th className="py-3 px-4 text-left font-semibold text-gray-600">WA & Email</th>
                        <th className="py-3 px-4 text-left font-semibold text-gray-600">Skor</th>
                        <th className="py-3 px-4 text-center font-semibold text-gray-600">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter(u => (u.name || '').toLowerCase().includes(searchScore.toLowerCase()))
                        .sort((a, b) => (b.score || 0) - (a.score || 0))
                        .map((u, i) => (
                        <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-gray-400 min-w-[24px]">#{i + 1}</span>
                              <div>
                                <div className="font-bold text-gray-800">{u.name}</div>
                                <div className="text-xs text-gray-500">{u.school}</div>
                                {u.violations > 0 && <div className="mt-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full inline-block font-bold border border-red-200" title="Terdeteksi menyontek/ganti tab">{u.violations} Pelanggaran</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <a 
                                href={`https://wa.me/${(u.whatsapp || '').replace(/^0/, '62').replace(/[^\d]/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5 transition"
                              >
                                <Phone size={14} className="text-green-600" />
                                {u.whatsapp || '-'}
                              </a>
                              <div className="text-xs text-gray-500 flex items-center gap-1.5 font-mono">
                                <Mail size={14} className="text-gray-400" />
                                {u.email || '-'}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-extrabold text-xl text-blue-700">{u.score !== null ? u.score : '-'}</td>
                          <td className="py-3 px-4 text-center">
                             {currentUser?.role === 'admin' && (
                               <button 
                                 onClick={() => handleResetParticipant(u.id)} 
                                 className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition shadow-sm border border-red-100" 
                                 title="Reset Ujian (Hapus Skor & Jawaban)"
                               >
                                 <RefreshCw size={16} />
                               </button>
                             )}
                          </td>
                        </tr>
                      ))}
                      {users.length > 0 && users.filter(u => (u.name || '').toLowerCase().includes(searchScore.toLowerCase())).length === 0 && (
                        <tr>
                          <td colSpan="4" className="py-12 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Search size={32} className="text-gray-300" />
                              <p>Tidak ditemukan peserta dengan nama "<span className="font-bold text-gray-700">{searchScore}</span>"</p>
                              <button onClick={() => setSearchScore('')} className="text-blue-600 hover:underline text-sm font-medium">Hapus Pencarian</button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {users.length === 0 && (
                        <tr><td colSpan="4" className="py-12 text-center text-gray-500 font-medium">Belum ada data peserta.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'pengaturan' && (
              <div className="space-y-8">

                {/* === KONTROL MULAI UJIAN === */}
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><PlayCircle size={24} className="text-blue-600" /> Kontrol Pelaksanaan Ujian</h2>
                  <div className={`p-6 rounded-xl border-2 ${isExamOpen ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-300'}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-4 h-4 rounded-full animate-pulse ${isExamOpen ? 'bg-green-500' : 'bg-red-400'}`}></div>
                          <h3 className={`text-xl font-bold ${isExamOpen ? 'text-green-800' : 'text-red-700'}`}>
                            {isExamOpen ? 'Ujian Sedang BERLANGSUNG' : 'Ujian Belum Dibuka'}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600">
                          {isExamOpen
                            ? 'Peserta yang sudah aktif dapat memulai dan mengerjakan soal tryout sekarang.'
                            : 'Peserta belum dapat memulai ujian. Klik tombol di samping untuk membuka akses ujian.'}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const newStatus = !isExamOpen;
                          const label = newStatus ? 'MEMBUKA' : 'MENUTUP';
                          if (!window.confirm(`Yakin ingin ${label} sesi ujian? Perubahan langsung berlaku untuk semua peserta.`)) return;
                          try {
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'live'), { isExamOpen: newStatus }, { merge: true });
                          } catch (e) { alert('Gagal mengubah status ujian.'); }
                        }}
                        className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-base shadow-md transition-all ${isExamOpen
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-green-600 hover:bg-green-700'
                          }`}
                      >
                        {isExamOpen ? <><X size={20} /> Tutup Ujian</> : <><PlayCircle size={20} /> Buka Ujian Sekarang</>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* === KUOTA PESERTA === */}
                <div>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Users size={24} className="text-indigo-600" /> Kuota Peserta</h2>
                  <div className="bg-indigo-50 p-6 rounded-xl border-2 border-indigo-200">
                    {/* Indikator visual */}
                    <div className="mb-5">
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-sm text-indigo-700 font-medium">Peserta Terdaftar</p>
                          <p className="text-3xl font-extrabold text-indigo-800">{users.length} <span className="text-base font-semibold text-indigo-500">/ {maxParticipants > 0 ? maxParticipants : '∞'}</span></p>
                        </div>
                        <div className="text-right">
                          {maxParticipants > 0 ? (
                            <span className={`text-sm font-bold px-3 py-1 rounded-full border ${users.length >= maxParticipants ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'}`}>
                              {users.length >= maxParticipants ? '🔴 Kuota Penuh' : `🟢 Sisa ${maxParticipants - users.length} slot`}
                            </span>
                          ) : (
                            <span className="text-sm font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">🔓 Tidak Terbatas</span>
                          )}
                        </div>
                      </div>
                      {maxParticipants > 0 && (
                        <div className="w-full bg-indigo-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all duration-500 ${users.length >= maxParticipants ? 'bg-red-500' : users.length / maxParticipants > 0.8 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min((users.length / maxParticipants) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {/* Input kuota */}
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-indigo-700 mb-1">Batas Maksimum Peserta</label>
                        <input
                          type="number"
                          min="0"
                          value={formMaxParticipants}
                          onChange={(e) => setFormMaxParticipants(e.target.value)}
                          placeholder="0 = tidak ada batas"
                          className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg text-indigo-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        />
                        <p className="text-xs text-indigo-500 mt-1">Isi <strong>0</strong> untuk menonaktifkan batas kuota (pendaftaran tidak terbatas).</p>
                      </div>
                      <button
                        onClick={handleSaveSettings}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium shadow-sm h-fit"
                      >
                        <Save size={18} /> Simpan Kuota
                      </button>
                      {saveStatus && saveStatus.includes('Info') && <span className="text-green-600 font-medium text-sm">{saveStatus}</span>}
                    </div>
                  </div>
                </div>

                {/* Bagian Pengaturan Dashboard User */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">Pengaturan Dashboard Peserta</h2>
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Video size={16} /> Link Tautan Zoom / Google Meet</label>
                      <input
                        type="url" value={formMeetingLink} onChange={(e) => setFormMeetingLink(e.target.value)}
                        placeholder="https://zoom.us/j/..." className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Clock size={16} /> Waktu Mulai Live</label>
                      <input
                        type="text" value={formMeetingTime} onChange={(e) => setFormMeetingTime(e.target.value)}
                        placeholder="08:00 WIB" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Megaphone size={16} /> Pengumuman dari Admin</label>
                      <textarea
                        value={formAnnouncement} onChange={(e) => setFormAnnouncement(e.target.value)}
                        placeholder="Tulis instruksi atau pengumuman penting untuk dibaca peserta..." rows="3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Link size={16} /> Tautan Grup WhatsApp Peserta</label>
                      <input
                        type="url" value={formWaGroupLink} onChange={(e) => setFormWaGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..." className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save size={18} /> Simpan Pengaturan Dashboard</button>
                      {saveStatus && saveStatus.includes('Info') && <span className="text-green-600 font-medium">{saveStatus}</span>}
                    </div>
                  </div>
                </div>

                {/* Bagian Pengaturan Akun Admin */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">Ubah Akun Administrator</h2>
                  <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username Admin Baru</label>
                        <input type="text" value={newAdminUser} onChange={(e) => setNewAdminUser(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password Admin Baru</label>
                        <input type="text" value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={handleSaveAdminCredentials} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-black flex items-center gap-2"><Save size={18} /> Perbarui Kredensial</button>
                      {saveStatus && saveStatus.includes('Admin') && <span className="text-green-600 font-medium">{saveStatus}</span>}
                    </div>
                  </div>
                </div>

                {/* Bagian Pengaturan Asisten Admin */}
                <div>
                  <h2 className="text-2xl font-bold mb-4">Kelola Asisten Admin</h2>
                  <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-500 mb-4">Asisten Admin dapat membantu memantau peserta dan mengirimkan kode aktivasi, namun tidak dapat mengedit bank soal atau pengaturan sistem inti.</p>

                    <div className="mb-6 space-y-3">
                      {(adminConfig.assistants || []).length === 0 ? (
                        <div className="text-sm text-gray-400 bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">Belum ada akun asisten</div>
                      ) : (adminConfig.assistants || []).map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div>
                            <p className="font-bold text-sm text-gray-800">{a.name}</p>
                            <p className="text-xs text-gray-500 font-mono">user: {a.username} | pass: {a.password}</p>
                          </div>
                          <button onClick={() => handleRemoveAsisten(a.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Hapus Asisten">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <h3 className="font-bold text-gray-700 text-sm mb-3 border-t pt-4">Tambah Asisten Baru</h3>
                    <form onSubmit={handleAddAsisten} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div><input type="text" value={newAsistenName} onChange={e => setNewAsistenName(e.target.value)} placeholder="Nama Asisten" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
                      <div><input type="text" value={newAsistenUser} onChange={e => setNewAsistenUser(e.target.value)} placeholder="Username" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
                      <div><input type="text" value={newAsistenPass} onChange={e => setNewAsistenPass(e.target.value)} placeholder="Password" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required /></div>
                      <div className="sm:col-span-3 flex items-center justify-between">
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"><Plus size={16} /> Tambah Asisten</button>
                        {saveStatus && saveStatus.includes('Asisten') && <span className="text-green-600 font-medium text-sm">{saveStatus}</span>}
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="py-4 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
          Made with <Heart size={16} className="text-red-500 fill-red-500" /> by Laboratorium Pendidikan Non Formal FIPP UNNES
        </div>

        {/* Modal Edit Peserta */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative">
              <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
              <h3 className="text-xl font-bold mb-4">Edit Akun Peserta</h3>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Username Baru</label><input type="text" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label><input type="text" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm" required /></div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 mt-2">Simpan Perubahan</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Edit Soal */}
        {editingQuestion && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingQuestion(null); }}
          >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setEditingQuestion(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 p-1 rounded-full"><X size={20} /></button>
              <h3 className="text-xl font-bold mb-4 border-b pb-2">Edit Soal Tryout</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Subtes (Kategori)</label>
                  <select value={editQuestionForm.kategori} onChange={(e) => setEditQuestionForm({ ...editQuestionForm, kategori: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white font-bold outline-none mb-3">
                    {UTBK_SUBTESTS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Pertanyaan / Soal</label>
                  <textarea rows="4" value={editQuestionForm.text} onChange={(e) => setEditQuestionForm({ ...editQuestionForm, text: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  {['A', 'B', 'C', 'D', 'E'].map(opt => (
                    <div key={opt}>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Pilihan {opt}</label>
                      <input type="text" value={editQuestionForm.options[opt]} onChange={(e) => setEditQuestionForm({ ...editQuestionForm, options: { ...editQuestionForm.options, [opt]: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-bold text-green-700 mb-1">Kunci Jawaban</label>
                    <select value={editQuestionForm.answer} onChange={(e) => setEditQuestionForm({ ...editQuestionForm, answer: e.target.value })} className="w-full px-3 py-2 border-2 border-green-500 rounded-md text-sm bg-green-50 text-green-800 font-bold outline-none">
                      {['A', 'B', 'C', 'D', 'E'].map(opt => <option key={opt} value={opt}>Jawaban Benar: {opt}</option>)}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setEditingQuestion(null)} className="px-6 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">Batal</button>
                  <button
                    type="button"
                    onClick={handleUpdateQuestion}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center gap-2"
                  >
                    <Save size={18} /> Simpan Pembaruan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- KOMPONEN: DASHBOARD USER ---
  const UserDashboard = () => {
    // State untuk checklist kesiapan peserta
    const [readiness, setReadiness] = useState({
      internet: false,
      zoom: false,
      honesty: false
    });

    const isReady = readiness.internet && readiness.zoom && readiness.honesty;

    const toggleReady = (field) => {
      setReadiness(prev => ({ ...prev, [field]: !prev[field] }));
    };

    return (
      <div className="min-h-screen bg-gray-50 pb-12 flex flex-col">
        {/* Navbar */}
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="font-bold text-gray-800 leading-tight">Portal Tryout SNBT</h1>
              <p className="text-xs text-gray-500">Sistem CBT Terintegrasi</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-600 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition font-medium text-sm">
            <LogOut size={18} /> Keluar
          </button>
        </nav>

        <div className="max-w-6xl mx-auto px-4 mt-8 flex-1 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* KOLOM KIRI: Identitas & Info Personal */}
            <div className="space-y-6">
              {/* Kartu Profil */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
                    <UserCircle size={48} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold">{currentUser?.name}</h2>
                  <p className="text-blue-100 text-sm mt-1">{currentUser?.username}</p>
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Informasi Akademik</h3>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-50 rounded-lg text-gray-500"><BookOpen size={18} /></div>
                    <div>
                      <p className="text-xs text-gray-500">Asal Sekolah</p>
                      <p className="font-medium text-gray-800">{currentUser?.school || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><GraduationCap size={18} /></div>
                    <div>
                      <p className="text-xs text-gray-500">Target Kampus & Prodi</p>
                      <p className="font-bold text-blue-700">{currentUser?.targetUniversity || '-'}</p>
                      <p className="text-sm font-medium text-gray-700">{currentUser?.targetMajor || '-'}</p>
                    </div>
                  </div>

                  <hr className="border-gray-100 my-2" />
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Kontak</h3>
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-gray-400" />
                    <p className="text-sm text-gray-700">{currentUser?.whatsapp || '-'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-gray-400" />
                    <p className="text-sm text-gray-700">{currentUser?.email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Status Pengerjaan (Jika Sudah Selesai) */}
              {currentUser?.finished && (
                <div className="bg-green-50 border border-green-200 p-6 rounded-2xl text-center">
                  <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                  <h3 className="text-green-800 font-bold mb-1">Tryout Telah Diselesaikan</h3>
                  <p className="text-sm text-green-600 mb-4">Anda sudah mensubmit jawaban ujian ini.</p>
                  <button onClick={() => setView('result')} className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 w-full">
                    Lihat Skor Kembali
                  </button>
                </div>
              )}
            </div>

            {/* KOLOM KANAN: Pengumuman, Zoom, dan Action CBT */}
            <div className="lg:col-span-2 space-y-6">

              {/* Promosi PNF FIPP UNNES Banner */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6 text-white text-center sm:text-left">
                <div className="bg-white/20 p-4 rounded-full flex-shrink-0">
                  <GraduationCap size={48} className="text-yellow-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">Masa Depanmu Dimulai di Sini!</h3>
                  <p className="text-blue-100 mb-4 text-sm leading-relaxed">
                    <i>"Mari bersama membangun masyarakat cerdas dan berdaya bersama PNF UNNES!"</i>
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                    {waGroupLink && (
                      <a href={waGroupLink} target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition duration-300">
                        <Users size={16} /> Gabung Grup WA
                      </a>
                    )}
                    <a href="https://www.pnfunnes.org" target="_blank" rel="noopener noreferrer" className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition duration-300">
                      <Link size={16} /> Website PNF
                    </a>
                    <a href="https://www.instagram.com/pnfunnes/" target="_blank" rel="noopener noreferrer" className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition duration-300">
                      <span className="font-serif">IG</span> @pnfunnes
                    </a>
                    <a href="https://www.tiktok.com/@prodi.pnf.unnes" target="_blank" rel="noopener noreferrer" className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition duration-300">
                      <span className="font-[system-ui] font-bold tracking-tight">TikTok</span> @prodi.pnf.unnes
                    </a>
                  </div>
                </div>
              </div>

              {/* Pengumuman Admin (Hanya tampil jika admin mengisi) */}
              {announcement && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
                  <div className="p-3 bg-yellow-100 text-yellow-600 rounded-xl">
                    <Megaphone size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-yellow-800 mb-1">Pengumuman dari Admin</h3>
                    <p className="text-yellow-700 text-sm whitespace-pre-wrap leading-relaxed">{announcement}</p>
                  </div>
                </div>
              )}

              {/* Integrasi Zoom */}
              {meetingLink && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col sm:flex-row items-center sm:items-stretch">
                  <div className="bg-indigo-600 p-6 flex flex-col justify-center items-center text-white w-full sm:w-1/3 text-center">
                    <Video size={40} className="mb-2 opacity-80" />
                    <h3 className="font-bold">Sesi Live & Arahan</h3>
                    <p className="text-indigo-200 text-sm mt-1">{meetingTime}</p>
                  </div>
                  <div className="p-6 flex-1 w-full text-center sm:text-left flex flex-col justify-center">
                    <h4 className="font-bold text-gray-800 mb-2">Penting sebelum memulai!</h4>
                    <p className="text-sm text-gray-600 mb-4">Pengawas ujian akan memberikan instruksi, membagikan token (jika ada), dan mengabsen peserta. Silakan bergabung terlebih dahulu.</p>
                    <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white transition w-full sm:w-max">
                      <Link size={18} /> Klik di sini untuk Gabung Zoom
                    </a>
                  </div>
                </div>
              )}

              {/* Area Aksi Tryout & Checklist */}
              {!currentUser?.finished && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Simulasi Computer Based Test</h2>
                  <p className="text-gray-500 mb-6">Uji kemampuan Anda dengan standar soal terbaru.</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                      <p className="text-xs text-gray-500 uppercase font-bold">Total Soal</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">{questions.length}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                      <p className="text-xs text-gray-500 uppercase font-bold">Total Waktu</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">195 <span className="text-sm font-medium text-gray-500">Mnt</span></p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center col-span-2 flex flex-col justify-center">
                      <p className="text-xs text-gray-500 uppercase font-bold">Tipe Pengerjaan (UTBK)</p>
                      <p className="text-sm font-medium text-gray-800 mt-1">7 Subtes Berurutan. Anda tidak dapat kembali ke subtes sebelumnya jika waktu habis.</p>
                    </div>
                  </div>

                  {/* GATE: Ujian Belum Dibuka Admin */}
                  {!isExamOpen ? (
                    <div className="text-center py-8 px-4 border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl">
                      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock size={32} className="text-orange-500" />
                      </div>
                      <h3 className="text-xl font-bold text-orange-800 mb-2">Menunggu Instruksi Admin</h3>
                      <p className="text-orange-700 text-sm max-w-md mx-auto leading-relaxed">
                        Sesi ujian belum dibuka oleh pengawas. Harap tunggu instruksi dari admin melalui Zoom atau WhatsApp. Halaman ini akan otomatis aktif ketika ujian dibuka.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2 text-orange-500 text-xs font-medium">
                        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div>
                        Memantau status ujian secara realtime...
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Checklist Kesiapan */}
                      <div className="mb-6 p-5 border border-blue-100 bg-blue-50/50 rounded-xl">
                        <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2"><CheckSquare size={18} /> Checklist Kesiapan</h3>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={readiness.internet} onChange={() => toggleReady('internet')} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                            <span className="text-sm text-gray-700 group-hover:text-blue-800">Koneksi internet saya stabil.</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={readiness.zoom} onChange={() => toggleReady('zoom')} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                            <span className="text-sm text-gray-700 group-hover:text-blue-800">Saya sudah membaca tata tertib dan bergabung di grup/Zoom.</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={readiness.honesty} onChange={() => toggleReady('honesty')} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                            <span className="text-sm text-gray-700 group-hover:text-blue-800">Saya bersedia mengerjakan tryout secara mandiri dan jujur.</span>
                          </label>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (questions.length === 0) {
                            alert("Mohon maaf, bank soal saat ini masih kosong/belum disiapkan oleh Admin.");
                          } else if (!isReady) {
                            alert("Silakan centang semua checklist kesiapan terlebih dahulu.");
                          } else {
                            if (!currentUser?.subtestStartTime) {
                              try {
                                const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', currentUser.id);
                                const startTimeStr = new Date().toISOString();
                                await updateDoc(userRef, { subtestStartTime: startTimeStr, currentSubtestIdx: 0 });
                                setCurrentUser(prev => ({ ...prev, subtestStartTime: startTimeStr, currentSubtestIdx: 0 }));
                              } catch (e) {
                                console.error("Gagal memulai timer server:", e);
                              }
                            }
                            setCurrentQuestionIdx(0);
                            setView('tryout');
                          }
                        }}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md ${(!isReady || questions.length === 0) ? 'bg-gray-300 text-gray-500 hover:bg-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      >
                        <PlayCircle size={24} /> {questions.length === 0 ? 'Soal Belum Tersedia' : (isReady ? 'Mulai Kerjakan Tryout Sekarang' : 'Ceklist kesiapan di atas untuk memulai')}
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
          Made with <Heart size={16} className="text-red-500 fill-red-500" /> by Laboratorium Pendidikan Non Formal FIPP UNNES
        </div>
      </div>
    );
  };

  // --- KOMPONEN: UJIAN (CBT) ---
  const TryoutView = () => {
    // State pengelolaan batas waktu subtes
    const [subtestIdx, setSubtestIdx] = useState(currentUser?.currentSubtestIdx || 0);
    const activeSubtest = UTBK_SUBTESTS[subtestIdx];

    // 1. Randomisasi Soal & Opsi Berdasarkan ID
    const getSeededRandom = (s) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
      return function () { h = Math.imul(1525642, h) + 1 | 0; return (h >>> 0) / 4294967296; }
    };

    const { shuffledQuestions, shuffledOptions } = React.useMemo(() => {
      const rand = getSeededRandom(currentUser?.id || 'seed');
      // Hanya ambil soal yang match dengan kategori di activeSubtest
      const filtered = questions.filter(q => q.kategori === activeSubtest?.id || (!q.kategori && activeSubtest?.id === 'PU'));
      const sQuestions = [...filtered].sort(() => rand() - 0.5);
      const sOptions = {};
      sQuestions.forEach(q => {
        const keys = ['A', 'B', 'C', 'D', 'E'].filter(k => q.options && q.options[k]);
        keys.sort(() => rand() - 0.5);
        sOptions[q.id] = keys;
      });
      return { shuffledQuestions: sQuestions, shuffledOptions: sOptions };
    }, [questions, currentUser, activeSubtest]);

    const q = shuffledQuestions[currentQuestionIdx] || null;

    // 2. Timer Berbasis Subtes
    const MAX_SECONDS = (activeSubtest?.durationMin || 30) * 60;

    useEffect(() => {
      if (!currentUser?.subtestStartTime) return;
      const startT = new Date(currentUser.subtestStartTime).getTime();

      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startT) / 1000);
        const rem = Math.max(0, MAX_SECONDS - elapsed);
        setTimeLeft(rem);
        if (rem <= 0) {
          clearInterval(timerRef.current);
          handleNextSubtest(true); // auto next
        }
      };

      updateTimer(); // Initial call
      timerRef.current = setInterval(updateTimer, 1000);
      return () => clearInterval(timerRef.current);
    }, [currentUser?.subtestStartTime, activeSubtest]);

    const handleNextSubtest = async (isAuto = false) => {
      if (!isAuto) {
        if (!window.confirm("Yakin ingin pindah ke Subtes berikutnya? Anda TIDAK BISA KEMBALI ke soal pada subtes ini lagi.")) return;
      } else {
        alert("Waktu Habis! Anda akan diarahkan ke Subtes Berikutnya secara otomatis.");
      }

      if (subtestIdx >= UTBK_SUBTESTS.length - 1) {
        finishTryout();
      } else {
        const nextIdx = subtestIdx + 1;
        const newStartTime = new Date().toISOString();
        try {
          const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', currentUser.id);
          await updateDoc(userRef, {
            currentSubtestIdx: nextIdx,
            subtestStartTime: newStartTime,
            answers: userAnswers // save just in case
          });
          setCurrentUser(prev => ({ ...prev, currentSubtestIdx: nextIdx, subtestStartTime: newStartTime }));
          setSubtestIdx(nextIdx);
          setCurrentQuestionIdx(0); // reset index for new subtest
        } catch (e) { console.error("Gagal ganti subtes", e); }
      }
    };

    // Anti Cheat: Visibility Change
    useEffect(() => {
      const handleVisibilityChange = async () => {
        if (document.hidden) {
          const currentVio = (currentUser?.violations || 0) + 1;
          alert(`Peringatan! Anda terdeteksi keluar dari layar ujian. (Peringatan ke-${currentVio}). Jika mencapai 3x, ujian otomatis berakhir!`);

          if (currentUser?.id) {
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', currentUser.id);
            await updateDoc(userRef, { violations: currentVio });
          }

          if (currentVio >= 3) {
            finishTryout();
            alert("Ujian otomatis diakhiri karena pelanggaran percobaan menyontek.");
          } else {
            setCurrentUser(prev => ({ ...prev, violations: currentVio }));
          }
        }
      };
      // only active if in TryoutView
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [currentUser]);

    const formatTime = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAnswer = async (option) => {
      const newAnswers = { ...userAnswers, [q.id]: option };
      setUserAnswers(newAnswers);
      // Removed Firebase live autosave per option to save Read/Write quota.
      // sessionStorage already handles browser-level restore.
    };

    const finishTryout = async () => {
      clearInterval(timerRef.current);
      let correct = 0;
      questions.forEach(quest => { if (userAnswers[quest.id] === quest.answer) correct++; });
      const finalScore = Math.round((correct / questions.length) * 1000) || 0;

      if (currentUser && currentUser.id) {
        try {
          const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', currentUser.id);
          await updateDoc(userRef, { score: finalScore, finished: true, answers: userAnswers });
          setCurrentUser(prev => ({ ...prev, score: finalScore, finished: true }));
        } catch (error) { console.error("Gagal update score:", error); }
      } else {
        setCurrentUser(prev => ({ ...prev, score: finalScore, finished: true }));
      }
      setView('result');
    };

    const confirmSubmit = () => {
      if (window.confirm("Apakah Anda yakin ingin menyelesaikan tryout? Anda tidak bisa kembali setelah ini.")) {
        finishTryout();
      }
    };

    if (!q) return <div className="p-8 text-center">Memuat soal...</div>;

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-10">
          <div className="font-bold text-xl text-blue-700 hidden sm:block">CBT Sistem</div>
          <div className="flex items-center gap-4">
            <div className={`p-1.5 rounded bg-red-50 text-red-600 font-bold text-xs ${currentUser?.violations > 0 ? '' : 'hidden'}`}>
              <AlertCircle size={14} className="inline mr-1" /> {currentUser?.violations} Pelanggaran
            </div>
            <div className="hidden sm:block">
              <span className="text-xs text-gray-500 block">Subtes {subtestIdx + 1}/7</span>
              <span className="text-sm font-bold text-blue-800">{activeSubtest?.id}</span>
            </div>
            <div className={`flex items-center gap-2 px-6 py-2 rounded-full font-mono font-bold text-xl sm:text-2xl shadow-sm ${timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-700'}`}>
              <Clock size={24} /> {formatTime(timeLeft)}
            </div>
            <button onClick={() => handleNextSubtest(false)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition text-sm font-medium shadow-sm">
              {subtestIdx >= UTBK_SUBTESTS.length - 1 ? 'Selesai Ujian' : 'Lanjut Subtes'}
            </button>
          </div>
        </header>

        <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col lg:flex-row gap-4">

          {/* PANEL KIRI: Wacana/Bacaan (hanya muncul jika ada wacana) */}
          {q?.wacana && (
            <div className="w-full lg:w-2/5 bg-amber-50 border border-amber-200 rounded-xl shadow-sm flex flex-col">
              <div className="px-4 py-3 bg-amber-100 border-b border-amber-200 rounded-t-xl flex items-center gap-2">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">📖 Teks / Wacana</span>
                <span className="text-xs text-amber-600">(Baca untuk menjawab soal ini)</span>
              </div>
              <div className="p-5 overflow-y-auto max-h-[calc(100vh-200px)] text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {q.wacana}
              </div>
            </div>
          )}

          {/* PANEL TENGAH/KANAN: Area Soal */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-full font-bold shadow-sm">{currentQuestionIdx + 1}</span>
                <span className="text-gray-500 font-medium text-sm">Soal {currentQuestionIdx + 1} dari {shuffledQuestions.length}</span>
              </div>
              <div className="text-base text-gray-800 mb-6 whitespace-pre-wrap leading-relaxed font-medium">{q?.text}</div>
              <div className="space-y-3">
                {(shuffledOptions[q.id] || []).map(opt => (
                  <label key={opt} onClick={() => handleAnswer(opt)} className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all ${userAnswers[q.id] === opt ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.01]' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${userAnswers[q.id] === opt ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400'}`}>
                      {userAnswers[q.id] === opt && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <div><span className="font-bold mr-2 text-gray-500">{opt}.</span>{q.options[opt]}</div>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between bg-gray-50 rounded-b-xl">
              <button onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))} disabled={currentQuestionIdx === 0} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 transition shadow-sm"><ChevronLeft size={18} /> Sebelumnya</button>
              <button onClick={() => setCurrentQuestionIdx(prev => Math.min(shuffledQuestions.length - 1, prev + 1))} disabled={currentQuestionIdx === shuffledQuestions.length - 1} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition shadow-sm">Selanjutnya <ChevronRight size={18} /></button>
            </div>
          </div>

          {/* PANEL NAVIGASI Kanan */}
          <div className="w-full lg:w-56 bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-fit">
            <h3 className="font-bold text-gray-700 mb-4 pb-2 border-b flex justify-between">Navigasi <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{shuffledQuestions.length}</span></h3>
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
              {shuffledQuestions.map((quest, idx) => {
                const isAnswered = !!userAnswers[quest.id];
                const isCurrent = currentQuestionIdx === idx;
                return (
                  <button key={quest.id} onClick={() => setCurrentQuestionIdx(idx)} className={`h-10 w-full rounded-lg font-medium border transition-all ${isCurrent ? 'ring-2 ring-blue-600 ring-offset-2' : ''} ${isAnswered ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t space-y-3 text-sm">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-600 rounded"></div><span className="text-gray-600">Terjawab</span></div> <span className="font-bold">{Object.keys(userAnswers).length}</span></div>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-gray-300 rounded"></div><span className="text-gray-600">Sisa</span></div> <span className="font-bold">{shuffledQuestions.length - Object.keys(userAnswers).length}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // --- KOMPONEN: AKTIVASI ---
  const ActivationView = () => {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleActivate = async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (code.toUpperCase().trim() === currentUser?.activationCode?.toUpperCase()) {
        try {
          const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', currentUser.id);
          await updateDoc(userRef, { isActive: true });
          setCurrentUser(prev => ({ ...prev, isActive: true }));
          setView('user');
        } catch (err) {
          setError('Gagal memverifikasi. Periksa koneksi internet Anda.');
        }
      } else {
        setError('Kode aktivasi salah! Silakan periksa kembali pesan WhatsApp dari Admin.');
      }
      setLoading(false);
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border-t-8 border-blue-600">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-gray-800">Aktivasi Akun</h2>
          <p className="text-gray-500 mb-6 text-sm">Akun Anda belum aktif. Masukkan kode aktivasi yang telah dikirimkan oleh Admin melalui WhatsApp Anda untuk mengakses Dashboard Tryout.</p>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2"><AlertCircle size={16} /> {error}</div>}

          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Masukkan Kode (misal: A1B2C3)"
                className="w-full px-4 py-4 text-center text-2xl font-bold tracking-[0.2em] border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase bg-gray-50 placeholder:text-gray-300 placeholder:text-lg placeholder:tracking-normal placeholder:font-normal"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-bold text-lg disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
            </button>
          </form>

          <button onClick={handleLogout} className="mt-6 flex items-center justify-center gap-2 mx-auto text-sm text-gray-500 hover:text-red-500 font-medium">
            <LogOut size={16} /> Kembali ke Login
          </button>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
          Made with <Heart size={16} className="text-red-500 fill-red-500" /> by Laboratorium Pendidikan Non Formal FIPP UNNES
        </div>
      </div>
    );
  };

  // --- KOMPONEN: HASIL ---
  const ResultView = () => {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg text-center">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} />
          </div>
          <h1 className="text-3xl font-bold mb-2">Tryout Selesai!</h1>
          <p className="text-gray-600 mb-8">Terima kasih telah mengikuti simulasi tryout.</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-8">
            <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-1">Skor Anda</p>
            <p className="text-5xl font-bold text-blue-700">{currentUser?.score || 0}</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-indigo-800 mb-2">Tertarik Karir Masa Depan di Bidang Pendidikan?</h3>
            <p className="text-indigo-600 mb-4 text-sm leading-relaxed">
              Apapun impianmu, jadikan <b>Prodi PNF FIPP UNNES</b> sebagai langkah pertamamu. <i>Mari bersama membangun masyarakat cerdas dan berdaya bersama PNF UNNES!</i>
            </p>
            <div className="flex justify-center gap-4">
              <a href="https://www.pnfunnes.org" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-white px-4 py-2 rounded-lg border border-indigo-200 shadow-sm transition">
                🌐 Web Resmi PNF
              </a>
              <a href="https://www.instagram.com/pnfunnes/" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-800 font-bold text-sm bg-white px-4 py-2 rounded-lg border border-pink-200 shadow-sm transition">
                📸 Instagram @pnfunnes
              </a>
            </div>
          </div>

          <button onClick={handleLogout} className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-medium">Selesai & Keluar</button>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500 flex items-center justify-center gap-1">
          Made with <Heart size={16} className="text-red-500 fill-red-500" /> by Laboratorium Pendidikan Non Formal FIPP UNNES
        </div>
      </div>
    );
  };

  switch (view) {
    case 'login': return <LoginView />;
    case 'admin': return <AdminView />;
    case 'activation': return <ActivationView />;
    case 'user': return <UserDashboard />;
    case 'tryout': return <TryoutView />;
    case 'result': return <ResultView />;
    default: return <LoginView />;
  }
}
