/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ClipboardList, 
  Users, 
  Settings, 
  Printer, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Trash2,
  QrCode
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Nomenclature = {
  article: string;
  name: string;
  active: boolean;
};

type Person = {
  id: string;
  name: string;
  position: string;
  department: string;
};

type User = {
  login: string;
  password?: string;
};

type Entry = {
  id: string;
  section: string;
  machine: string;
  operator: string;
  packer?: string;
  itemArticle: string;
  itemName: string;
  qtyPcs: number;
  qtyKg: number;
  wasteKg: number;
  wastePercent: number;
  speed: number;
  packing: number;
  timeInfo: string;
  boxId: string;
  edgeWasteKg?: number; // For Extruders
  cutWasteKg?: number;  // For Maika
  meters?: number;      // For Flexo
};

type ShiftData = {
  date: string;
  shift: string;
  master: string;
  personnel: Record<string, number>;
  entries: Entry[];
};

// --- Constants ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbxWPWZQRYQQHj0UoBE_2BFCh7f_oRFmnOHlFzYqCjLI8Pk89_RopS1nJ299KivmUQ3d/exec";

const SECTIONS = [
  { id: "PFM", name: "Пакетоформирующий уч. (ПФМ)", machines: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], type: "GP" },
  { id: "SAFE", name: "Сейф-Машина", machines: [1], type: "GP" },
  { id: "DOY", name: "Дой-Пак", machines: [1], type: "GP" },
  { id: "EXTRUDER", name: "Экструзия", machines: ["№1 ДК (Большой)", "№2 (ПВД)", "№3 (ПНД)", "№4 (ПНД)"], type: "FILM" },
  { id: "FLEXO", name: "Флексопечать", machines: ["№1 (1200)", "№2 (1600)", "№3 (Турция)"], type: "FILM" },
  { id: "MAIKA", name: "Майка", machines: [1], type: "GP" },
  { id: "REITER", name: "Рейтер", machines: [1], type: "GP" },
  { id: "UGOLOK", name: "Уголок", machines: [1], type: "FILM" },
  { id: "SLITTER", name: "Слиттер", machines: [1], type: "FILM" },
];

const PERSONNEL_PFM = [
  { id: "pfm_adjusters", name: "Наладчики" },
  { id: "pfm_operators", name: "Операторы" },
  { id: "pfm_packers", name: "Упаковщики" },
  { id: "pfm_loaders", name: "Грузчики" },
];

const PERSONNEL_OTHERS = [
  { id: "print", name: "Печать" },
  { id: "extrusion", name: "Экструзия" },
  { id: "safe", name: "Сейф-пакет" },
  { id: "doy", name: "Дой-Пак" },
  { id: "maika", name: "Майка" },
  { id: "petlya", name: "Петля" },
  { id: "granulator", name: "Гранулятор" },
  { id: "slitter", name: "Слиттер" },
  { id: "ugolok", name: "Уголок" },
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  
  // Data from Sheets
  const [people, setPeople] = useState<Person[]>([]);
  const [gpList, setGpList] = useState<Nomenclature[]>([]);
  const [filmList, setFilmList] = useState<Nomenclature[]>([]);
  const [passList, setPassList] = useState<User[]>([]);

  // Form State
  const [shiftData, setShiftData] = useState<ShiftData>({
    date: new Date().toISOString().split('T')[0],
    shift: "1",
    master: "",
    personnel: {},
    entries: []
  });

  // UI State
  const [activeTab, setActiveTab] = useState<"header" | "personnel" | "production" | "review">("header");
  const [activeSection, setActiveSection] = useState<string>("PFM");
  const [selectedMachines, setSelectedMachines] = useState<Record<string, string[]>>({});
  const [qrModal, setQrModal] = useState<{ entryId: string; count: number } | null>(null);

  // --- Fetch Data ---
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setFetchError(null);
    fetch(`${GAS_URL}?action=getData`)
      .then(res => {
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setPeople((data.people || []).map((p: any, i: number) => ({ ...p, id: p.id || `person-${i}` })));
        setGpList((data.gp || []).filter((i: Nomenclature) => i.active).map((i: any, idx: number) => ({ ...i, article: i.article || `gp-${idx}` })));
        setFilmList((data.film || []).filter((i: Nomenclature) => i.active).map((i: any, idx: number) => ({ ...i, article: i.article || `film-${idx}` })));
        
        // Ensure passList has unique logins, or fallback to index
        const uniquePassList = (data.pass || []).map((p: any, idx: number) => ({
          ...p,
          login: p.login || `user-${idx}`
        }));
        setPassList(uniquePassList);
        
        setLoading(false);
        setIsDemoMode(false);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setFetchError(err.message || "Не удалось подключиться к Google Таблице");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const enableDemoMode = () => {
    setPeople([
      { id: "1", name: "Виноградова Т. Ю.", position: "Мастер", department: "Бригада №1" },
      { id: "2", name: "Туйгунова Л. Г.", position: "Мастер", department: "Бригада №2" },
      { id: "3", name: "Воронина Е.В.", position: "Мастер", department: "Бригада №3" },
      { id: "4", name: "Гончар О. И.", position: "Мастер", department: "Бригада №4" },
      { id: "5", name: "Петров П.П.", position: "Оператор", department: "Бригада №1" }
    ]);
    setGpList([
      { article: "GP001", name: "Сейф-пакет 250х350", active: true },
      { article: "GP002", name: "Курьер-пакет 100х150", active: true }
    ]);
    setFilmList([
      { article: "F001", name: "Пленка ПВД 500мм", active: true },
      { article: "F002", name: "Пленка ПНД 300мм", active: true }
    ]);
    setPassList([
      { login: "Виноградова Т. Ю.", password: "1111" },
      { login: "Туйгунова Л. Г.", password: "2222" },
      { login: "Воронина Е.В.", password: "3333" },
      { login: "Гончар О. И.", password: "4444" }
    ]);
    setIsDemoMode(true);
    setLoading(false);
    setFetchError(null);
    // Removed auto-login to allow testing the login dropdown
  };

  // --- Auth ---
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const login = (formData.get("login") as string || "").trim();
    const password = (formData.get("password") as string || "").trim();

    // Сравниваем логин и пароль, приводя всё к строке и убирая пробелы
    const user = passList.find(u => 
      String(u.login).trim() === login && 
      String(u.password || "").trim() === password
    );

    if (user) {
      setIsLoggedIn(true);
      setCurrentUser(user);
      setShiftData(prev => ({ ...prev, master: user.login }));
    } else {
      console.log("Неудачная попытка входа:", { login, password });
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  // --- Handlers ---
  const toggleMachine = (sectionId: string, machine: string) => {
    const current = selectedMachines[sectionId] || [];
    if (current.includes(machine)) {
      // Remove machine entries
      setShiftData(s => ({
        ...s,
        entries: s.entries.filter(e => !(e.section === sectionId && e.machine === machine))
      }));
      setSelectedMachines(prev => ({ ...prev, [sectionId]: current.filter(m => m !== machine) }));
    } else {
      // Add first entry for machine
      addEntry(sectionId, machine);
      setSelectedMachines(prev => ({ ...prev, [sectionId]: [...current, machine] }));
    }
  };

  const addEntry = (section: string, machine: string) => {
    const newEntry: Entry = {
      id: Math.random().toString(36).substr(2, 9),
      section,
      machine,
      operator: "",
      packer: "",
      itemArticle: "",
      itemName: "",
      qtyPcs: 0,
      qtyKg: 0,
      wasteKg: 0,
      wastePercent: 0,
      speed: 0,
      packing: 0,
      timeInfo: "0:00",
      boxId: ""
    };
    setShiftData(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
  };

  const updateEntry = (id: string, field: keyof Entry, value: any) => {
    setShiftData(prev => ({
      ...prev,
      entries: prev.entries.map(e => {
        if (e.id === id) {
          const updated = { ...e, [field]: value };
          // Auto-calculate waste %
          if (field === "qtyKg" || field === "wasteKg") {
            const total = Number(updated.qtyKg) + Number(updated.wasteKg);
            updated.wastePercent = total > 0 ? Math.round((Number(updated.wasteKg) / total) * 1000) / 10 : 0;
          }
          return updated;
        }
        return e;
      })
    }));
  };

  const removeEntry = (id: string) => {
    setShiftData(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id)
    }));
  };

  const handleNextFromHeader = () => {
    if (!shiftData.date) {
      alert("Выберите дату");
      return;
    }

    const d = new Date(shiftData.date);
    d.setHours(0, 0, 0, 0);
    // Timezone offset fix for accurate day calculation
    const selectedDays = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / (1000 * 60 * 60 * 24));
    const selectedShiftId = selectedDays * 2 + (shiftData.shift === "2" ? 1 : 0);

    const now = new Date();
    const currentHour = now.getHours();
    let logicalDate = new Date(now);
    let logicalShift = "1";

    if (currentHour < 8) {
      logicalDate.setDate(logicalDate.getDate() - 1);
      logicalShift = "2";
    } else if (currentHour >= 20) {
      logicalShift = "2";
    } else {
      logicalShift = "1";
    }
    
    logicalDate.setHours(0, 0, 0, 0);
    const currentDays = Math.floor((logicalDate.getTime() - logicalDate.getTimezoneOffset() * 60000) / (1000 * 60 * 60 * 24));
    const currentShiftId = currentDays * 2 + (logicalShift === "2" ? 1 : 0);

    if (selectedShiftId < currentShiftId - 1) {
      alert("Выбрана уже сданная смена (прошлый период).");
      return;
    }
    if (selectedShiftId > currentShiftId) {
      alert("Нельзя выбрать смену из будущего.");
      return;
    }

    setActiveTab("personnel");
  };

  const handleSubmit = async () => {
    // Basic Validation
    const incomplete = shiftData.entries.some(e => {
      if (!e.operator || !e.itemArticle || e.qtyKg === 0) return true;
      if (e.section === "PFM") {
        if (!e.qtyPcs || e.qtyPcs === 0) return true;
        if (!e.packing || e.packing === 0) return true;
      }
      return false;
    });
    
    if (incomplete) {
      alert("Пожалуйста, заполните все обязательные поля (Оператор, Номенклатура, Выработка кг. Для ПФМ также: Выработка шт и Фасовка)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(shiftData),
      });
      const result = await response.json();
      if (result.status === "success") {
        alert("Отчёт успешно отправлен!");
        window.location.reload();
      }
    } catch (err) {
      alert("Ошибка при отправке: " + err);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Render Helpers ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Загрузка данных из таблицы...</p>
        </div>
      </div>
    );
  }

  if (fetchError && !isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 border border-red-100">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-red-50 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-4">Ошибка подключения</h1>
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm mb-6 border border-red-100">
            <p className="font-bold mb-1">Причина:</p>
            <p>{fetchError}</p>
            <p className="mt-3 text-xs opacity-80">
              Обычно это значит, что скрипт Google не опубликован как "Веб-приложение" с доступом для "Всех" (Anyone), 
              либо вы не авторизовали его, перейдя по ссылке.
            </p>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={fetchData}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-100"
            >
              Повторить попытку
            </button>
            <button 
              onClick={enableDemoMode}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all"
            >
              Запустить Демо-режим (без таблицы)
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400 text-center">
            Проверьте URL скрипта в коде и настройки публикации в Google Apps Script.
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <motion.div 
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-200"
        >
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-50 rounded-full">
              <ClipboardList className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Вход в систему</h1>
          <p className="text-center text-slate-500 mb-8">Отчёты производства плёнки и ГП</p>
          
          {isDemoMode && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs text-center font-medium">
              Включен ДЕМО-РЕЖИМ. Пароли: <span className="font-bold">1111, 2222, 3333, 4444</span>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Логин (Мастер)</label>
              <select 
                name="login" 
                required 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
              >
                <option value="">Выберите логин</option>
                {passList.map((u, idx) => (
                  <option key={`${u.login}-${idx}`} value={u.login}>{u.login}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Пароль {shake && <span className="text-red-500 text-xs ml-2 animate-pulse">Неверный пароль!</span>}</label>
              <input 
                name="password" 
                type="password" 
                required 
                className={cn(
                  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all",
                  shake ? "border-red-500 bg-red-50" : "border-slate-300"
                )}
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-200"
            >
              Войти
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-blue-600" />
              <h1 className="text-lg font-bold text-slate-800 hidden sm:block">Отчёт производства</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">Мастер:</p>
                <p className="text-sm font-semibold text-slate-800">{shiftData.master}</p>
              </div>
              <button 
                onClick={() => setIsLoggedIn(false)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
          <nav className="flex gap-4 py-2">
            {[
              { id: "header", label: "Смена", icon: Settings },
              { id: "personnel", label: "Люди", icon: Users },
              { id: "production", label: "Выработка", icon: ClipboardList },
              { id: "review", label: "Проверка", icon: CheckCircle2 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  activeTab === tab.id 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                    : "text-slate-500 hover:bg-slate-100"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Tab: Header */}
        {activeTab === "header" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Параметры смены
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата</label>
                <input 
                  type="date" 
                  value={shiftData.date}
                  onChange={e => setShiftData(s => ({ ...s, date: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Смена</label>
                <select 
                  value={shiftData.shift}
                  onChange={e => setShiftData(s => ({ ...s, shift: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="1">1 смена (День)</option>
                  <option value="2">2 смена (Ночь)</option>
                </select>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button 
                onClick={handleNextFromHeader}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Далее <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab: Personnel */}
        {activeTab === "personnel" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Количество людей на участках
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* PFM Section */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider flex items-center justify-between">
                    Уч. ПФМ
                    <span className="text-[10px] font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">Кол-во, чел</span>
                  </h3>
                  <div className="space-y-3">
                    {PERSONNEL_PFM.map(role => (
                      <div key={role.id} className="flex items-center justify-between group">
                        <span className="text-sm text-slate-700 font-medium">{role.name}</span>
                        <input 
                          type="number" 
                          min="0"
                          value={shiftData.personnel[role.id] || ""}
                          onChange={e => setShiftData(s => ({ 
                            ...s, 
                            personnel: { ...s.personnel, [role.id]: parseInt(e.target.value) || 0 } 
                          }))}
                          className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                          placeholder="0"
                        />
                      </div>
                    ))}
                    <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900">
                      <span className="text-sm uppercase">ИТОГО уч. ПФМ:</span>
                      <div className="w-20 text-center py-2 bg-blue-600 text-white rounded-lg shadow-sm">
                        {PERSONNEL_PFM.reduce((sum, role) => sum + (shiftData.personnel[role.id] || 0), 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Sections */}
              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                  {PERSONNEL_OTHERS.map(role => (
                    <div key={role.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                      <span className="text-sm text-slate-600 font-medium">{role.name}</span>
                      <input 
                        type="number" 
                        min="0"
                        value={shiftData.personnel[role.id] || ""}
                        onChange={e => setShiftData(s => ({ 
                          ...s, 
                          personnel: { ...s.personnel, [role.id]: parseInt(e.target.value) || 0 } 
                        }))}
                        className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-between pt-6 border-t border-slate-100">
              <button 
                onClick={() => setActiveTab("header")}
                className="flex items-center gap-2 text-slate-500 font-medium hover:text-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Назад
              </button>
              <button 
                onClick={() => setActiveTab("production")}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Далее <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab: Production */}
        {activeTab === "production" && (
          <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Sidebar Sections */}
            <aside className="lg:w-64 flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-32">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Участки</h3>
                </div>
                <nav className="flex flex-col">
                  {SECTIONS.map(section => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors border-l-4",
                        activeSection === section.id 
                          ? "bg-blue-50 border-blue-600 text-blue-700" 
                          : "text-slate-600 border-transparent hover:bg-slate-50"
                      )}
                    >
                      {section.name}
                      <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                        {(selectedMachines[section.id] || []).length}
                      </span>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-grow space-y-6">
              {/* Datalists for autocomplete */}
              <datalist id={`nom-list-${activeSection}`}>
                {(SECTIONS.find(s => s.id === activeSection)?.type === "GP" ? gpList : filmList).map((i, idx) => (
                  <option key={`${i.article}-${idx}`} value={i.name}>{i.article}</option>
                ))}
              </datalist>
              <datalist id="operator-list">
                {people.map((p, idx) => (
                  <option key={`${p.id}-${idx}`} value={p.name}>{p.position}</option>
                ))}
              </datalist>
              
              {/* Machine Selection (Checkboxes) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Выберите работающие машины:</h3>
                <div className="flex flex-wrap gap-3">
                  {SECTIONS.find(s => s.id === activeSection)?.machines.map(m => (
                    <button
                      key={m}
                      onClick={() => toggleMachine(activeSection, m.toString())}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                        (selectedMachines[activeSection] || []).includes(m.toString())
                          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100"
                          : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                      )}
                    >
                      {typeof m === "number" ? `№ ${m}` : m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Machine Entry Forms */}
              {(selectedMachines[activeSection] || []).map(machineName => (
                <div key={machineName} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800">Машина: {machineName}</h4>
                    <button 
                      onClick={() => addEntry(activeSection, machineName)}
                      className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:text-blue-700"
                    >
                      <Plus className="w-3 h-3" /> Добавить номенклатуру
                    </button>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {shiftData.entries
                      .filter(e => e.section === activeSection && e.machine === machineName)
                      .map((entry, idx) => (
                        <div key={entry.id} className="p-6 space-y-6">
                          <div className="flex justify-between items-center">
                            <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                              Номенклатура #{idx + 1}
                            </span>
                            {idx > 0 && (
                              <button onClick={() => removeEntry(entry.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="lg:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Оператор</label>
                              <input 
                                list="operator-list"
                                value={entry.operator}
                                onChange={e => updateEntry(entry.id, "operator", e.target.value)}
                                placeholder="Начните вводить имя..."
                                className={cn(
                                  "w-full px-3 py-2 border rounded-lg text-sm outline-none",
                                  !entry.operator ? "border-red-200 bg-red-50" : "border-slate-200"
                                )}
                              />
                            </div>

                            {activeSection === "PFM" && (
                              <div className="lg:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Упаковщик (необязательно)</label>
                                <input 
                                  list="operator-list"
                                  value={entry.packer || ""}
                                  onChange={e => updateEntry(entry.id, "packer", e.target.value)}
                                  placeholder="Начните вводить имя..."
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                                />
                              </div>
                            )}

                            <div className="lg:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Номенклатура</label>
                              <input 
                                list={`nom-list-${activeSection}`}
                                value={entry.itemName || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  const list = SECTIONS.find(s => s.id === activeSection)?.type === "GP" ? gpList : filmList;
                                  const item = list.find(i => i.name === val || i.article === val);
                                  
                                  if (item) {
                                    updateEntry(entry.id, "itemArticle", item.article);
                                    updateEntry(entry.id, "itemName", item.name);
                                  } else {
                                    updateEntry(entry.id, "itemArticle", "");
                                    updateEntry(entry.id, "itemName", val);
                                  }
                                }}
                                onBlur={() => {
                                  if (!entry.itemArticle) {
                                    updateEntry(entry.id, "itemName", "");
                                  }
                                }}
                                placeholder="Начните вводить наименование или артикул..."
                                className={cn(
                                  "w-full px-3 py-2 border rounded-lg text-sm outline-none",
                                  !entry.itemArticle ? "border-red-200 bg-red-50" : "border-slate-200"
                                )}
                              />
                            </div>

                            {!["EXTRUDER", "FLEXO", "UGOLOK", "SLITTER"].includes(activeSection) && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Выработка (шт)</label>
                                <input 
                                  type="number" 
                                  value={entry.qtyPcs || ""}
                                  onChange={e => updateEntry(entry.id, "qtyPcs", parseInt(e.target.value) || 0)}
                                  className={cn(
                                    "w-full px-3 py-2 border rounded-lg text-sm outline-none",
                                    activeSection === "PFM" && !entry.qtyPcs ? "border-red-200 bg-red-50" : "border-slate-200"
                                  )}
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Выработка (кг)</label>
                              <input 
                                type="number" 
                                step="0.1"
                                value={entry.qtyKg || ""}
                                onChange={e => updateEntry(entry.id, "qtyKg", parseFloat(e.target.value) || 0)}
                                className={cn(
                                  "w-full px-3 py-2 border rounded-lg text-sm outline-none",
                                  entry.qtyKg === 0 ? "border-red-200 bg-red-50" : "border-slate-200"
                                )}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Отход (кг)</label>
                              <input 
                                type="number" 
                                step="0.1"
                                value={entry.wasteKg || ""}
                                onChange={e => updateEntry(entry.id, "wasteKg", parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                              />
                            </div>

                            {!["UGOLOK", "SLITTER"].includes(activeSection) && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                  {activeSection === "EXTRUDER" ? "Скорость (кг/час)" : activeSection === "FLEXO" ? "Скорость (м/мин)" : "Скорость (уд/мин)"}
                                </label>
                                <input 
                                  type="number" 
                                  value={entry.speed || ""}
                                  onChange={e => updateEntry(entry.id, "speed", parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                                />
                              </div>
                            )}

                            {!["EXTRUDER", "FLEXO", "UGOLOK", "SLITTER"].includes(activeSection) && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Фасовка (шт/кор)</label>
                                <input 
                                  type="number" 
                                  value={entry.packing || ""}
                                  onChange={e => updateEntry(entry.id, "packing", parseInt(e.target.value) || 0)}
                                  className={cn(
                                    "w-full px-3 py-2 border rounded-lg text-sm outline-none",
                                    activeSection === "PFM" && !entry.packing ? "border-red-200 bg-red-50" : "border-slate-200"
                                  )}
                                />
                              </div>
                            )}

                            <div className="flex items-end">
                              <button 
                                onClick={() => setQrModal({ entryId: entry.id, count: 1 })}
                                className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors"
                              >
                                <QrCode className="w-4 h-4" /> Печать QR
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <button 
                  onClick={() => setActiveTab("personnel")}
                  className="text-slate-500 font-medium hover:text-slate-700"
                >
                  Назад
                </button>
                <button 
                  onClick={() => setActiveTab("review")}
                  className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Проверить отчёт <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Review */}
        {activeTab === "review" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Итоговый просмотр</h2>
                <p className="text-sm text-slate-500">Проверьте данные перед отправкой в лог</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{shiftData.date}</p>
                <p className="text-xs text-slate-500">{shiftData.shift} смена</p>
              </div>
            </div>

            <div className="p-6">
              {(() => {
                const gpEntries = shiftData.entries.filter(e => SECTIONS.find(s => s.id === e.section)?.type === "GP");
                const filmEntries = shiftData.entries.filter(e => SECTIONS.find(s => s.id === e.section)?.type === "FILM");

                return (
                  <div className="space-y-8">
                    {gpEntries.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Выработка Готовой Продукции</h3>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                              <tr>
                                <th className="px-4 py-3 border-b border-slate-100">Участок</th>
                                <th className="px-4 py-3 border-b border-slate-100">Машина</th>
                                <th className="px-4 py-3 border-b border-slate-100">Оператор</th>
                                <th className="px-4 py-3 border-b border-slate-100">Продукция</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-right">Кол-во (шт)</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-right">Кол-во (кг)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {gpEntries.map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-medium text-slate-600">
                                    {SECTIONS.find(s => s.id === entry.section)?.name || entry.section}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-800">{entry.machine}</td>
                                  <td className="px-4 py-3 text-slate-600">{entry.operator}</td>
                                  <td className="px-4 py-3 text-slate-600 min-w-[250px] whitespace-normal">{entry.itemName}</td>
                                  <td className="px-4 py-3 text-right font-bold">{entry.section === "PFM" ? entry.qtyPcs : "-"}</td>
                                  <td className="px-4 py-3 text-right font-bold">{entry.qtyKg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {filmEntries.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Выработка Плёнки</h3>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                              <tr>
                                <th className="px-4 py-3 border-b border-slate-100">Участок</th>
                                <th className="px-4 py-3 border-b border-slate-100">Машина</th>
                                <th className="px-4 py-3 border-b border-slate-100">Оператор</th>
                                <th className="px-4 py-3 border-b border-slate-100">Продукция</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-right">Кол-во (кг)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filmEntries.map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-medium text-slate-600">
                                    {SECTIONS.find(s => s.id === entry.section)?.name || entry.section}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-800">{entry.machine}</td>
                                  <td className="px-4 py-3 text-slate-600">{entry.operator}</td>
                                  <td className="px-4 py-3 text-slate-600 min-w-[250px] whitespace-normal">{entry.itemName}</td>
                                  <td className="px-4 py-3 text-right font-bold">{entry.qtyKg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {shiftData.entries.length === 0 && (
                      <div className="py-12 text-center border border-slate-200 rounded-xl border-dashed">
                        <p className="text-slate-400 italic">Нет внесенных данных</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const totalQty = shiftData.entries.reduce((acc, e) => acc + e.qtyKg, 0);
                const totalWaste = shiftData.entries.reduce((acc, e) => acc + e.wasteKg, 0);
                const totalPercent = totalQty + totalWaste > 0 ? (totalWaste / (totalQty + totalWaste)) * 100 : 0;

                const bySection: Record<string, { qty: number, waste: number, qtyPcs: number, boxes: number }> = {};
                const byMachine: Record<string, { qty: number, waste: number }> = {};

                shiftData.entries.forEach(e => {
                  const secName = SECTIONS.find(s => s.id === e.section)?.name || e.section;
                  if (!bySection[secName]) bySection[secName] = { qty: 0, waste: 0, qtyPcs: 0, boxes: 0 };
                  bySection[secName].qty += e.qtyKg;
                  bySection[secName].waste += e.wasteKg;
                  bySection[secName].qtyPcs += (e.qtyPcs || 0);
                  
                  if (e.packing && e.packing > 0 && e.qtyPcs) {
                    bySection[secName].boxes += (e.qtyPcs / e.packing);
                  }

                  const mKey = `${secName} - ${e.machine}`;
                  if (!byMachine[mKey]) byMachine[mKey] = { qty: 0, waste: 0 };
                  byMachine[mKey].qty += e.qtyKg;
                  byMachine[mKey].waste += e.wasteKg;
                });

                return (
                  <div className="mt-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs text-blue-600 font-bold uppercase mb-1">Всего выработка</p>
                        <p className="text-2xl font-black text-blue-800">
                          {totalQty.toFixed(1)} <span className="text-sm font-normal">кг</span>
                        </p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <p className="text-xs text-red-600 font-bold uppercase mb-1">Всего отход</p>
                        <p className="text-2xl font-black text-red-800">
                          {totalWaste.toFixed(1)} <span className="text-sm font-normal">кг</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold uppercase mb-1">Итого % брака</p>
                        <p className="text-2xl font-black text-slate-800">
                          {totalPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {Object.keys(bySection).length > 0 && (
                      <>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="p-4 bg-slate-50 border-b border-slate-200">
                            <p className="text-sm font-bold text-slate-800">Итого по участкам</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                                <tr>
                                  <th className="px-4 py-3 border-b border-slate-100">Участок</th>
                                  <th className="px-4 py-3 border-b border-slate-100 text-right">Кол-во (шт)</th>
                                  <th className="px-4 py-3 border-b border-slate-100 text-right">Кол-во (кг)</th>
                                  <th className="px-4 py-3 border-b border-slate-100 text-right">Коробок</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-sm">
                                {Object.entries(bySection).map(([sec, data]) => (
                                  <tr key={sec} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{sec}</td>
                                    <td className="px-4 py-3 text-right font-bold">{data.qtyPcs > 0 ? data.qtyPcs : "-"}</td>
                                    <td className="px-4 py-3 text-right font-bold">{data.qty.toFixed(1)}</td>
                                    <td className="px-4 py-3 text-right font-bold">{data.boxes > 0 ? (Math.round(data.boxes * 10) / 10) : "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <p className="text-sm font-bold text-slate-800 mb-3">Брак по участкам</p>
                            <div className="space-y-2">
                              {Object.entries(bySection).map(([sec, data]) => {
                                const pct = data.qty + data.waste > 0 ? (data.waste / (data.qty + data.waste)) * 100 : 0;
                                return (
                                  <div key={sec} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-slate-600">{sec}</span>
                                    <span className={cn("font-bold", pct > 5 ? "text-red-600" : "text-green-600")}>
                                      {pct.toFixed(1)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <p className="text-sm font-bold text-slate-800 mb-3">Брак по машинам</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                              {Object.entries(byMachine).map(([mac, data]) => {
                                const pct = data.qty + data.waste > 0 ? (data.waste / (data.qty + data.waste)) * 100 : 0;
                                return (
                                  <div key={mac} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-slate-600">{mac}</span>
                                    <span className={cn("font-bold", pct > 5 ? "text-red-600" : "text-green-600")}>
                                      {pct.toFixed(1)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="mt-10 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button 
                  onClick={() => setActiveTab("production")}
                  className="text-slate-500 font-medium hover:text-slate-700"
                >
                  Вернуться к редактированию
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting || shiftData.entries.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 bg-green-600 text-white px-10 py-4 rounded-2xl font-black text-lg hover:bg-green-700 transition-all shadow-xl shadow-green-100 disabled:opacity-50 disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Send className="w-6 h-6" /> ОТПРАВИТЬ ОТЧЁТ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Печать QR этикеток</h3>
              <button onClick={() => setQrModal(null)} className="text-slate-400 hover:text-slate-600">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center">
              {(() => {
                const entry = shiftData.entries.find(e => e.id === qrModal.entryId);
                if (!entry) return null;
                
                const qrData = JSON.stringify({
                  d: shiftData.date,
                  s: shiftData.shift,
                  m: shiftData.master,
                  o: entry.operator,
                  a: entry.itemArticle,
                  p: entry.packing,
                  id: `BOX-${Date.now()}`
                });

                return (
                  <>
                    <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl mb-6 shadow-sm">
                      <QRCodeSVG value={qrData} size={180} />
                    </div>
                    
                    <div className="text-center space-y-1 mb-8">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{entry.itemArticle}</p>
                      <p className="text-sm font-bold text-slate-800">{entry.itemName}</p>
                      <p className="text-xs text-slate-500">Оператор: {entry.operator}</p>
                      <p className="text-xs text-slate-500">Фасовка: {entry.packing} шт/кор</p>
                    </div>

                    <div className="w-full space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Количество коробок</label>
                        <input 
                          type="number" 
                          min="1"
                          value={qrModal.count}
                          onChange={e => setQrModal({ ...qrModal, count: parseInt(e.target.value) || 1 })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-center text-lg"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          window.print();
                          setQrModal(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                      >
                        <Printer className="w-5 h-5" /> ПЕЧАТАТЬ ({qrModal.count})
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .fixed.inset-0, .fixed.inset-0 * { visibility: visible; }
          .fixed.inset-0 { position: absolute; left: 0; top: 0; width: 100%; }
          button, label, input { display: none !important; }
          .shadow-2xl { shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
}
