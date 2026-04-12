import React, { useState, useMemo, useEffect } from 'react';
import { 
  Home, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  BookOpen, 
  Target, 
  GraduationCap, 
  Users, 
  BarChart,
  Menu,
  X,
  Calculator,
  Dices,
  Star,
  Sparkles,
  Award
} from 'lucide-react';
import { ptnData } from './kampusData';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // State for Cari Prodi
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRumpun, setFilterRumpun] = useState('Semua');
  const [filterKategori, setFilterKategori] = useState('Semua');

  // State for Kalkulator
  const [toScore, setToScore] = useState('');
  const [calcResult, setCalcResult] = useState(null);

  // State for Gacha
  const [gachaResult, setGachaResult] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // Kalkulasi data dan persentase keketatan
  // Keketatan (%) = (Daya Tampung / Peminat) * 100.
  const processedData = useMemo(() => {
    return ptnData.map(item => {
      const keketatan = (item.dt / item.peminat) * 100;
      return {
        ...item,
        keketatan: parseFloat(keketatan.toFixed(2)),
      };
    });
  }, []);

  const featuredProdi = useMemo(() => {
    return processedData.find(item => item.isFeatured);
  }, [processedData]);

  const topTightest = useMemo(() => {
    return [...processedData].filter(i => !i.isFeatured).sort((a, b) => a.keketatan - b.keketatan).slice(0, 4);
  }, [processedData]);

  const topLoosest = useMemo(() => {
    return [...processedData].filter(i => !i.isFeatured).sort((a, b) => b.keketatan - a.keketatan).slice(0, 4);
  }, [processedData]);

  const filteredProdi = useMemo(() => {
    return processedData.filter(item => {
      const matchSearch = item.prodi.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.univ.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRumpun = filterRumpun === 'Semua' ? true : item.rumpun === filterRumpun;
      const matchKategori = filterKategori === 'Semua' ? true : item.kategori === filterKategori;
      return matchSearch && matchRumpun && matchKategori;
    });
  }, [searchQuery, filterRumpun, filterKategori, processedData]);

  const getBadgeColor = (keketatan) => {
    if (keketatan < 3) return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    if (keketatan < 7) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  };

  const getBadgeLabel = (keketatan) => {
    if (keketatan < 3) return '🚩 Red Flag';
    if (keketatan < 7) return '🔥 Gas Terus';
    return '🟢 Green Flag';
  };

  const handleCalculate = () => {
    if(!toScore || isNaN(toScore)) return;
    const score = parseInt(toScore);
    const sorted = [...processedData].sort((a, b) => {
      return Math.abs(a.passingGrade - score) - Math.abs(b.passingGrade - score);
    });
    setCalcResult(sorted.slice(0, 3));
  };

  const handleGacha = () => {
    setIsSpinning(true);
    setGachaResult(null);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * processedData.length);
      setGachaResult(processedData[randomIndex]);
      setIsSpinning(false);
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Background Ornaments (Glassmorphism effect) */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-rose-600/20 blur-[120px] pointer-events-none z-0"></div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden transition-all" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 transform transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/30">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">KampusID</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white transition-colors" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="p-4 space-y-2 mt-4">
          <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Menu Utama</p>
          {[
            { id: 'dashboard', icon: Home, label: 'Dashboard' },
            { id: 'search', icon: Search, label: 'Eksplor Prodi' },
            { id: 'calculator', icon: Calculator, label: 'Cek Peluang Lolos' },
            { id: 'gacha', icon: Dices, label: 'Kampus Jodohku (Gacha)' },
          ].map((menu) => (
            <button 
              key={menu.id}
              onClick={() => { setActiveTab(menu.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${
                activeTab === menu.id 
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[inset_0px_0px_20px_rgba(99,102,241,0.1)]' 
                  : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200'
              }`}
            >
              <menu.icon className={`w-5 h-5 transition-transform duration-300 ${activeTab === menu.id ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="font-medium">{menu.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
              GZ
            </div>
            <div>
              <p className="text-sm font-bold text-white">Gen Z Pejuang PTN</p>
              <p className="text-xs text-indigo-400 font-medium tracking-wide">Target: SNBT 2026</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full relative z-10 scrollbar-hide">
        <header className="lg:hidden h-16 bg-slate-900/50 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-2 font-bold text-lg text-white">
             <div className="p-1.5 bg-indigo-500 rounded-lg">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span>KampusID</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-300 p-2">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
              {activeTab === 'dashboard' && 'Welcome back, Pejuang! 🚀'}
              {activeTab === 'search' && 'Eksplor Database PTN Terlengkap 📚'}
              {activeTab === 'calculator' && 'Kalkulator Peluang Lolos 🎯'}
              {activeTab === 'gacha' && 'Gacha Kampus Jodohku 🎲'}
            </h1>
            <p className="text-slate-400 md:text-lg">
              {activeTab === 'dashboard' && 'Jangan kasih kendor! Cek pergerakan keketatan prodi impianmu hari ini.'}
              {activeTab === 'search' && 'Cari info jurusan dengan gampang. Cek mana yang "Red Flag" atau "Green Flag".'}
              {activeTab === 'calculator' && 'Masukkan skor Try Out, mari kita lihat prodi mana yang siap nerima kamu.'}
              {activeTab === 'gacha' && 'Lagi galau mau pilih apa? Biar takdir (dan algoritma) yang memilihkan!'}
            </p>
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* HIGHLIGHT PROMO PNF FIPP UNNES */}
              {featuredProdi && (
                <div className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-300 animate-pulse-slow">
                  <div className="relative bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 overflow-hidden z-10">
                    <div className="absolute top-0 right-0 p-12 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none"></div>
                    
                    <div className="flex-1 space-y-4 relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-widest">
                        <Star className="w-3.5 h-3.5" /> Rekomendasi Emas
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-white">{featuredProdi.prodi}</h2>
                      <p className="text-lg text-amber-200/80 font-medium flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" /> {featuredProdi.univ}
                      </p>
                      <p className="text-slate-300 leading-relaxed max-w-2xl">
                        {featuredProdi.description}
                      </p>
                      <div className="flex flex-wrap gap-4 mt-4">
                        <div className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
                          <span className="text-slate-400 text-xs block mb-1">Daya Tampung</span>
                          <span className="text-xl font-bold text-white">{featuredProdi.dt}</span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
                          <span className="text-slate-400 text-xs block mb-1">Peluang Tembus</span>
                          <span className="text-xl font-bold text-emerald-400">🔥 Sangat Besar</span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
                          <span className="text-slate-400 text-xs block mb-1">Target Aman UTBK</span>
                          <span className="text-xl font-bold text-white">{featuredProdi.passingGrade}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden lg:flex w-64 h-64 shrink-0 bg-gradient-to-br from-amber-400/20 to-yellow-600/5 rounded-full items-center justify-center border-4 border-amber-500/20 relative">
                        <Sparkles className="absolute top-4 right-4 text-amber-400 w-8 h-8 animate-bounce delay-100" />
                        <Sparkles className="absolute bottom-8 left-4 text-yellow-300 w-6 h-6 animate-bounce delay-300" />
                        <GraduationCap className="w-24 h-24 text-amber-400 transform -rotate-12 hover:rotate-12 hover:scale-110 transition-transform duration-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* STATS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: "Total Database", value: `${ptnData.length} Kampus`, icon: BookOpen, color: "from-blue-500 to-cyan-500" },
                  { title: "Avg Target UTBK", value: "645", icon: Target, color: "from-indigo-500 to-purple-500" },
                  { title: "Rata-rata Keketatan", value: "Tinggi 💀", icon: Users, color: "from-rose-500 to-pink-500" },
                  { title: "Kategori Pilihan", value: "Kependidikan", icon: BarChart, color: "from-emerald-500 to-teal-500" }
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-md shadow-lg hover:-translate-y-1 transition-transform cursor-default group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`}></div>
                    <div className={`p-3.5 bg-slate-900/50 rounded-2xl w-fit mb-4 border border-slate-700/50 group-hover:scale-110 transition-transform`}>
                      <stat.icon className="w-6 h-6 text-white"/>
                    </div>
                    <p className="text-sm text-slate-400 font-medium mb-1">{stat.title}</p>
                    <h3 className="text-2xl font-black text-white">{stat.value}</h3>
                  </div>
                ))}
              </div>

              {/* TIGHTEST & LOOSEST GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/40 rounded-3xl border border-slate-700/50 backdrop-blur-md overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 bg-rose-500/10 blur-[60px] rounded-full pointer-events-none"></div>
                  <div className="px-6 py-5 border-b border-slate-700/50 flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-rose-500/20 rounded-lg"><TrendingDown className="w-5 h-5 text-rose-400" /></div>
                    <h2 className="text-lg font-bold text-white">Sirkel Red Flag 🚩</h2>
                  </div>
                  <div className="divide-y divide-slate-700/50 relative z-10">
                    {topTightest.map((item, idx) => (
                      <div key={item.id} className="p-5 hover:bg-slate-700/30 transition-colors flex items-center justify-between">
                        <div className="flex items-start gap-4">
                          <div className="text-lg font-black text-slate-600 mt-0.5">#{idx + 1}</div>
                          <div>
                            <h4 className="font-bold text-slate-200">{item.prodi}</h4>
                            <p className="text-sm text-slate-500 mt-1">{item.univ}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {item.keketatan}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/40 rounded-3xl border border-slate-700/50 backdrop-blur-md overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none"></div>
                  <div className="px-6 py-5 border-b border-slate-700/50 flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-emerald-500/20 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-400" /></div>
                    <h2 className="text-lg font-bold text-white">Jalur VVIP (Peluang Gede) 🟢</h2>
                  </div>
                  <div className="divide-y divide-slate-700/50 relative z-10">
                    {topLoosest.map((item, idx) => (
                      <div key={item.id} className="p-5 hover:bg-slate-700/30 transition-colors flex items-center justify-between">
                        <div className="flex items-start gap-4">
                          <div className="text-lg font-black text-slate-600 mt-0.5">#{idx + 1}</div>
                          <div>
                            <h4 className="font-bold text-slate-200">{item.prodi}</h4>
                            <p className="text-sm text-slate-500 mt-1">{item.univ}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {item.keketatan}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl backdrop-blur-md shadow-xl overflow-hidden flex flex-col relative z-10">
              
              {/* Filter Area */}
              <div className="p-6 border-b border-slate-700/50 bg-slate-900/30 flex flex-col lg:flex-row gap-4 justify-between items-center z-20">
                <div className="relative w-full lg:w-[400px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Ketik impianmu (prodi/kampus)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-600/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-slate-900/50 text-white placeholder-slate-500"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <select 
                    value={filterKategori}
                    onChange={(e) => setFilterKategori(e.target.value)}
                    className="w-full sm:w-auto border border-slate-600/50 bg-slate-900/50 text-slate-200 px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none font-medium cursor-pointer transition-colors hover:bg-slate-800"
                  >
                    <option value="Semua">🔥 Semua Kategori</option>
                    <option value="Kependidikan">📚 Kependidikan</option>
                    <option value="Non-Kependidikan">💼 Non-Kependidikan</option>
                  </select>

                  <select 
                    value={filterRumpun}
                    onChange={(e) => setFilterRumpun(e.target.value)}
                    className="w-full sm:w-auto border border-slate-600/50 bg-slate-900/50 text-slate-200 px-5 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none font-medium cursor-pointer transition-colors hover:bg-slate-800"
                  >
                    <option value="Semua">🌍 Semua Rumpun</option>
                    <option value="Saintek">🔬 Saintek</option>
                    <option value="Soshum">🎨 Soshum</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400 text-sm border-b border-slate-700/50">
                      <th className="px-6 py-5 font-bold uppercase tracking-wider">Universitas & Prodi</th>
                      <th className="px-6 py-5 font-bold uppercase tracking-wider text-right">Daya Tampung</th>
                      <th className="px-6 py-5 font-bold uppercase tracking-wider text-right">Peminat</th>
                      <th className="px-6 py-5 font-bold uppercase tracking-wider text-center">Status</th>
                      <th className="px-6 py-5 font-bold uppercase tracking-wider text-center">Target Skor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filteredProdi.length > 0 ? (
                      filteredProdi.map((item) => (
                        <tr key={item.id} className={`transition-colors hover:bg-slate-800/50 ${item.isFeatured ? 'bg-amber-500/5 border-l-4 border-l-amber-500' : ''}`}>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              {item.isFeatured && <Star className="w-5 h-5 text-amber-400 fill-amber-400 hidden md:block" />}
                              <div>
                                <p className={`font-bold text-lg ${item.isFeatured ? 'text-amber-400' : 'text-slate-100'}`}>
                                  {item.prodi}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-sm text-slate-500 font-medium">{item.univ}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-700 rounded-md text-slate-300">
                                    {item.rumpun}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right font-medium text-slate-300">{item.dt}</td>
                          <td className="px-6 py-5 text-right font-medium text-slate-300">{item.peminat.toLocaleString('id-ID')}</td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex justify-center">
                              <span className={`px-4 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center min-w-[120px] shadow-sm ${getBadgeColor(item.keketatan)}`}>
                                {getBadgeLabel(item.keketatan)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="inline-flex items-center justify-center px-4 py-1.5 bg-slate-900 border border-slate-700 text-indigo-400 font-bold rounded-xl shadow-inner">
                              {item.passingGrade}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-20 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                              <Search className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="text-xl font-bold text-slate-300">Yahh.. Data Nggak Ketemu 😿</p>
                            <p className="text-slate-500 mt-2">Coba ganti filter atau ketik jurusan lain bro/sis.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'calculator' && (
             <div className="max-w-3xl mx-auto space-y-8 relative z-10">
               <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-8 rounded-3xl border border-indigo-500/20 shadow-2xl backdrop-blur-xl">
                 <h2 className="text-2xl font-black text-white mb-2">Masukkan Hasil Try Out Kamu!</h2>
                 <p className="text-slate-400 mb-8">Nggak usah overthinking, masukin nilai realistis TO kamu dan sistem bakal nyari jurusan 3 teratas yang paling aman buat kamu daftar.</p>
                 
                 <div className="flex flex-col md:flex-row gap-4">
                    <input 
                      type="number" 
                      placeholder="Contoh: 650"
                      value={toScore}
                      onChange={(e) => setToScore(e.target.value)}
                      className="flex-1 px-6 py-4 text-2xl font-black text-center md:text-left bg-slate-900/80 border-2 border-indigo-500/30 rounded-2xl focus:outline-none focus:border-indigo-400 text-white placeholder-slate-600 transition-colors"
                    />
                    <button 
                      onClick={handleCalculate}
                      className="px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-lg rounded-2xl shadow-[0px_0px_20px_rgba(99,102,241,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Calculator className="w-6 h-6" /> CEK SEKARANG
                    </button>
                 </div>
               </div>

               {calcResult && (
                 <div className="space-y-4 animate-in slide-in-from-bottom-8 duration-500">
                    <h3 className="text-xl font-bold text-slate-300 flex items-center gap-2">
                       <Target className="text-emerald-400" /> Hasil Kalkulasi (Best Match):
                    </h3>
                    <div className="grid gap-4">
                      {calcResult.map((res, idx) => (
                         <div key={res.id} className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden group">
                           {idx === 0 && <div className="absolute top-0 right-0 w-2 h-full bg-emerald-400"></div>}
                           
                           <div>
                             <div className="flex items-center gap-2 mb-1">
                               <span className="text-xs font-bold px-2 py-1 bg-slate-700 text-slate-300 rounded uppercase tracking-wider">{res.kategori}</span>
                               <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded uppercase tracking-wider">{res.rumpun}</span>
                             </div>
                             <h4 className="text-xl font-bold text-white mt-2">{res.prodi}</h4>
                             <p className="text-slate-400">{res.univ}</p>
                           </div>

                           <div className="text-left md:text-right">
                              <p className="text-sm text-slate-500 mb-1">Target Skor Kampus:</p>
                              <p className="text-3xl font-black text-emerald-400">{res.passingGrade}</p>
                           </div>
                         </div>
                      ))}
                    </div>
                 </div>
               )}
             </div>
          )}

          {activeTab === 'gacha' && (
             <div className="max-w-2xl mx-auto text-center space-y-8 relative z-10 pt-10">
               <div className="w-32 h-32 mx-auto bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(217,70,239,0.5)] mb-6 animate-pulse-slow">
                 <Dices className={`w-16 h-16 text-white ${isSpinning ? 'animate-spin-fast' : ''}`} />
               </div>
               
               <h2 className="text-4xl font-black text-white px-4">Bingung Pilih Jurusan?</h2>
               <p className="text-slate-400 text-lg px-8">Tekan tombol di bawah dan biarkan hoki kamu yang nentuin masa depan! (Jangan dianggap 100% serius ya wkwk 😜)</p>

               <button 
                  onClick={handleGacha}
                  disabled={isSpinning}
                  className={`px-10 py-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-xl rounded-2xl shadow-xl transition-all ${isSpinning ? 'opacity-50 cursor-not-allowed scale-95' : 'hover:scale-105 hover:shadow-[0_0_30px_rgba(217,70,239,0.6)] active:scale-95'}`}
               >
                 {isSpinning ? 'MENGACAK MASA DEPAN...' : '🎲 SPIN GACHA KAMPUS!'}
               </button>

               {gachaResult && !isSpinning && (
                 <div className="mt-12 p-8 bg-slate-800/80 border-2 border-pink-500/30 rounded-3xl backdrop-blur-xl animate-in zoom-in duration-500 relative overflow-hidden">
                    <div className="absolute top-[-50%] left-[-10%] w-full h-[200%] bg-gradient-to-br from-purple-500/10 to-pink-500/10 rotate-12 pointer-events-none"></div>
                    <p className="text-pink-400 font-bold uppercase tracking-widest text-sm mb-4">✨ JODOH KAMU ADALAH ✨</p>
                    <h3 className="text-3xl font-black text-white mb-2">{gachaResult.prodi}</h3>
                    <p className="text-xl text-slate-300 font-medium">{gachaResult.univ}</p>
                    
                    <div className="mt-8 flex items-center justify-center gap-4">
                      <div className="text-center">
                        <p className="text-slate-500 text-xs font-bold uppercase">Keketatan</p>
                        <p className="text-xl font-bold text-white mt-1">{gachaResult.keketatan}%</p>
                      </div>
                      <div className="w-px h-10 bg-slate-700"></div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs font-bold uppercase">Kategori</p>
                        <p className="text-xl font-bold text-white mt-1">{gachaResult.kategori}</p>
                      </div>
                    </div>
                 </div>
               )}
             </div>
          )}

        </div>
      </main>
    </div>
  );
}