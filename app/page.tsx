"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Dumbbell,
  Edit3,
  Flame,
  Home,
  LineChart,
  NotebookTabs,
  Plus,
  Repeat,
  Save,
  Scale,
  Smile,
  Trash2,
  Trophy,
  Utensils,
  Weight,
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const gold = "#C9A227";
const cream = "#FBF7EF";
const darkText = "#1F1B16";

type Tab = "dashboard" | "weight" | "photos" | "food" | "workouts" | "habits" | "insights";

type WeightEntry = { id: number; date: string; weight: number; bodyFat?: number };
type PhotoEntry = { id: number; date: string; type: string; url: string };
type ExerciseEntry = { id: number; name: string; duration: string; sets: string; reps: string; weight: string };
type WorkoutEntry = { id: number; date: string; exercises: ExerciseEntry[] };
type HabitEntry = { id: number; name: string; category: string };
type HabitLog = Record<number, string[]>;
type MealEntry = { id: number; date: string; name: string; calories: string };
type DailyEntry = { mood: string; note: string };
type DailyEntries = Record<string, DailyEntry>;

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string) {
  if (!date) return "No date";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function cleanNumber(value: string | number | undefined) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can fail if browser storage is full, especially with many progress photos.
  }
}

function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return d.toISOString().slice(0, 10);
}

function isThisWeek(date: string) {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const target = new Date(`${date}T12:00:00`);
  return target >= start && target < end;
}

function weekKey(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function GoldIcon({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl ${large ? "h-12 w-12 sm:h-14 sm:w-14" : "h-10 w-10 sm:h-11 sm:w-11"}`}
      style={{ color: gold, background: "#FFF8E8" }}
    >
      {children}
    </div>
  );
}

function PlaceholderText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-gray-400 ${className}`}>{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[26px] border border-[#eadfbe] bg-white p-4 shadow-sm sm:rounded-[30px] sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-gray-600">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "block w-full min-w-0 max-w-full box-border rounded-2xl border border-[#efe6d2] bg-[#FFFDF8] p-3 text-base outline-none placeholder:text-gray-300 focus:border-[#C9A227] focus:ring-4 focus:ring-[#F3E7C4] sm:text-lg";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white shadow-sm transition hover:brightness-95";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#efe6d2] bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-[#FFF8E8]";
const deleteButton = "inline-flex items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-rose-500 transition hover:bg-rose-100";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-4 overflow-hidden rounded-full bg-[#F4EAD6]">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: gold }} />
    </div>
  );
}

function HabitRing({ value, empty = false }: { value: number; empty?: boolean }) {
  const radius = 54;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36">
      <svg className="absolute h-28 w-28 -rotate-90 sm:h-36 sm:w-36" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#F4EAD6" strokeWidth={stroke} />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={empty ? "#E9DEC9" : gold}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={empty ? circumference : offset}
        />
      </svg>
      <div className="text-center">
        <p className={`text-2xl font-semibold sm:text-3xl ${empty ? "text-gray-400" : "text-stone-950"}`}>{empty ? "0%" : `${value}%`}</p>
        <p className="text-xs text-gray-500">complete</p>
      </div>
    </div>
  );
}

function MiniWeightChart({ weights }: { weights: WeightEntry[] }) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  if (sorted.length < 2) {
    return <div className="flex h-44 items-center justify-center rounded-3xl bg-[#FFF8E8] text-center text-gray-400">Log at least two weights to see your trend.</div>;
  }

  const values = sorted.map((w) => w.weight);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const width = 700;
  const height = 220;
  const pad = 26;
  const points = sorted
    .map((entry, index) => {
      const x = pad + (index / Math.max(sorted.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((entry.weight - min) / Math.max(max - min, 1)) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#f7f0df] to-[#fff8e8] p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
        <span>Weight trend</span>
        <span>Last 30 entries</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <polyline fill="none" stroke={gold} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" points={points} />
        {sorted.map((entry, index) => {
          const x = pad + (index / Math.max(sorted.length - 1, 1)) * (width - pad * 2);
          const y = height - pad - ((entry.weight - min) / Math.max(max - min, 1)) * (height - pad * 2);
          return <circle key={entry.id} cx={x} cy={y} r="6" fill="white" stroke={gold} strokeWidth="4" />;
        })}
      </svg>
    </div>
  );
}

function DateNavigator({
  selectedDate,
  onPrevious,
  onNext,
  onDateChange
}: {
  selectedDate: string;
  onPrevious: () => void;
  onNext: () => void;
  onDateChange: (date: string) => void;
}) {
  return (
    <div className="mb-5 rounded-[28px] border border-[#eadfbe] bg-white p-3 shadow-sm sm:p-4">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button
          type="button"
          onClick={onPrevious}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#eadfbe] bg-[#FFF8E8] text-stone-800 sm:h-14 sm:w-14"
          aria-label="Previous day"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="min-w-0 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Selected Date</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <CalendarDays size={22} color={gold} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="min-w-0 max-w-[210px] px-5 py-3 text-lg font-bold cursor-pointer rounded-2xl border border-[#eadfbe] bg-[#FFF8E8] px-2 py-2 text-center text-sm font-semibold text-stone-900 outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#F3E7C4] sm:max-w-none sm:px-4 sm:text-lg"
              style={{ colorScheme: "light" }}
              aria-label="Jump to date"
            />
          </div>
    </div>

        <button
          type="button"
          onClick={onNext}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#eadfbe] bg-[#FFF8E8] text-stone-800 sm:h-14 sm:w-14"
          aria-label="Next day"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}

export default function HealthTracker365() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedDate, setSelectedDate] = useState(() => readStorage<string>("ht365-selectedDate", todayInputDate()));

  const [startingWeight, setStartingWeight] = useState(() => readStorage<string>("ht365-startingWeight", ""));
  const [goalWeight, setGoalWeight] = useState(() => readStorage<string>("ht365-goalWeight", ""));
  const [weightInput, setWeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [weights, setWeights] = useState<WeightEntry[]>(() => readStorage<WeightEntry[]>("ht365-weights", []));
  const [editingWeightId, setEditingWeightId] = useState<number | null>(null);

  const [photos, setPhotos] = useState<PhotoEntry[]>(() => readStorage<PhotoEntry[]>("ht365-photos", []));
  const [photoType, setPhotoType] = useState("Front");
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);

  const [workouts, setWorkouts] = useState<WorkoutEntry[]>(() => readStorage<WorkoutEntry[]>("ht365-workouts", []));
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseDuration, setExerciseDuration] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [exerciseWeight, setExerciseWeight] = useState("");
  const [draftExercises, setDraftExercises] = useState<ExerciseEntry[]>([]);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);

  const [habits, setHabits] = useState<HabitEntry[]>(() => readStorage<HabitEntry[]>("ht365-habits", []));
  const [habitLogs, setHabitLogs] = useState<HabitLog>(() => readStorage<HabitLog>("ht365-habitLogs", {}));
  const [habitName, setHabitName] = useState("");
  const [habitCategory, setHabitCategory] = useState("Routine");
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);

  const [mealName, setMealName] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [meals, setMeals] = useState<MealEntry[]>(() => readStorage<MealEntry[]>("ht365-meals", []));
  const [editingMealId, setEditingMealId] = useState<number | null>(null);

  const [dailyEntries, setDailyEntries] = useState<DailyEntries>(() => readStorage<DailyEntries>("ht365-dailyEntries", {}));
  const [moodInput, setMoodInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => writeStorage("ht365-selectedDate", selectedDate), [selectedDate]);
  useEffect(() => writeStorage("ht365-startingWeight", startingWeight), [startingWeight]);
  useEffect(() => writeStorage("ht365-goalWeight", goalWeight), [goalWeight]);
  useEffect(() => writeStorage("ht365-weights", weights), [weights]);
  useEffect(() => writeStorage("ht365-photos", photos), [photos]);
  useEffect(() => writeStorage("ht365-workouts", workouts), [workouts]);
  useEffect(() => writeStorage("ht365-habits", habits), [habits]);
  useEffect(() => writeStorage("ht365-habitLogs", habitLogs), [habitLogs]);
  useEffect(() => writeStorage("ht365-meals", meals), [meals]);
  useEffect(() => writeStorage("ht365-dailyEntries", dailyEntries), [dailyEntries]);

  useEffect(() => {
    if (!editingMealId) {
      setMealName("");
      setMealCalories("");
    }
    if (!editingWeightId) {
      setWeightInput("");
      setBodyFatInput("");
    }
    if (!editingWorkoutId) {
      setDraftExercises([]);
      clearExerciseFormOnly();
    }
  }, [selectedDate]);

  const selectedDailyEntry = dailyEntries[selectedDate] || { mood: "", note: "" };

  const selectedWeights = weights.filter((weight) => weight.date === selectedDate).sort((a, b) => b.id - a.id);
  const selectedWeight = selectedWeights[0] ?? null;
  const selectedMeals = meals.filter((meal) => meal.date === selectedDate).sort((a, b) => b.id - a.id);
  const selectedWorkouts = workouts.filter((workout) => workout.date === selectedDate).sort((a, b) => b.id - a.id);
  const selectedHabitCount = habits.filter((habit) => habitLogs[habit.id]?.includes(selectedDate)).length;

  const startNum = cleanNumber(startingWeight);
  const goalNum = cleanNumber(goalWeight);
  const sortedWeightsNewest = [...weights].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const latestWeight = sortedWeightsNewest[0]?.weight ?? null;
  const hasWeightSetup = Boolean(startNum && latestWeight && goalNum && startNum > goalNum);
  const totalLost = hasWeightSetup && startNum && latestWeight ? Math.max(0, startNum - latestWeight) : 0;
  const remaining = hasWeightSetup && latestWeight && goalNum ? Math.max(0, latestWeight - goalNum) : 0;
  const goalProgress = hasWeightSetup && startNum && latestWeight && goalNum ? Math.round(((startNum - latestWeight) / (startNum - goalNum)) * 100) : 0;

  const workoutsThisWeek = workouts.filter((workout) => isThisWeek(workout.date)).length;
  const habitProgress = habits.length > 0 ? Math.round((selectedHabitCount / habits.length) * 100) : 0;
  const hasHabits = habits.length > 0;

  const groupedWeights = useMemo(() => {
    const groups = new Map<string, WeightEntry[]>();
    weights.forEach((entry) => groups.set(weekKey(entry.date), [...(groups.get(weekKey(entry.date)) || []), entry]));
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, entries]) => {
        const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
        const avg = entries.reduce((sum, entry) => sum + entry.weight, 0) / entries.length;
        return { key, label: isThisWeek(key) ? "This Week" : weekLabel(key), average: avg, entries: sortedEntries };
      });
  }, [weights]);

  const strengthPRs = useMemo(() => {
    const best = new Map<string, { weight: number; date: string }>();
    workouts.forEach((workout) =>
      workout.exercises.forEach((exercise) => {
        const weight = cleanNumber(exercise.weight);
        const name = exercise.name.trim();
        if (!name || !weight) return;
        const key = name.toLowerCase();
        const current = best.get(key);
        if (!current || weight > current.weight) best.set(key, { weight, date: workout.date });
      })
    );
    return Array.from(best.entries()).map(([name, data]) => ({ name, ...data }));
  }, [workouts]);

  const nav: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Home", icon: <Home size={22} /> },
    { id: "weight", label: "Weight", icon: <Scale size={22} /> },
    { id: "photos", label: "Photos", icon: <Camera size={22} /> },
    { id: "food", label: "Food", icon: <NotebookTabs size={22} /> },
    { id: "workouts", label: "Workout", icon: <Dumbbell size={22} /> },
    { id: "habits", label: "Habits", icon: <CheckCircle2 size={22} /> },
    { id: "insights", label: "Insights", icon: <LineChart size={22} /> }
  ];

  function changeSelectedDate(amount: number) {
    setSelectedDate((current) => addDays(current, amount));
  }

  function clearWeightForm() {
    setEditingWeightId(null);
    setWeightInput("");
    setBodyFatInput("");
  }

  function saveWeight() {
    const weight = cleanNumber(weightInput);
    if (!weight) return;
    const entry = { id: editingWeightId ?? Date.now(), date: selectedDate, weight, bodyFat: bodyFatInput ? Number(bodyFatInput) : undefined };
    setWeights((prev) => (editingWeightId ? prev.map((w) => (w.id === editingWeightId ? entry : w)) : [entry, ...prev.filter((w) => w.date !== selectedDate)]));
    clearWeightForm();
  }

  function editWeight(entry: WeightEntry) {
    setEditingWeightId(entry.id);
    setSelectedDate(entry.date);
    setWeightInput(String(entry.weight));
    setBodyFatInput(entry.bodyFat ? String(entry.bodyFat) : "");
    setTab("weight");
  }

  function deleteWeight(id: number) {
    setWeights((prev) => prev.filter((entry) => entry.id !== id));
    if (editingWeightId === id) clearWeightForm();
  }

  function handlePhotoUpload(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setPhotos((prev) => [{ id: Date.now(), date: selectedDate, type: photoType, url: reader.result as string }, ...prev]);
    };
    reader.readAsDataURL(file);
  }

  function editPhoto(photo: PhotoEntry) {
    setEditingPhotoId(photo.id);
    setSelectedDate(photo.date);
    setPhotoType(photo.type);
    setTab("photos");
  }

  function savePhotoEdit() {
    if (!editingPhotoId) return;
    setPhotos((prev) => prev.map((p) => (p.id === editingPhotoId ? { ...p, date: selectedDate, type: photoType } : p)));
    setEditingPhotoId(null);
    setPhotoType("Front");
  }

  function cancelPhotoEdit() {
    setEditingPhotoId(null);
    setPhotoType("Front");
  }

  function deletePhoto(id: number) {
    setPhotos((prev) => prev.filter((photo) => photo.id !== id));
    if (editingPhotoId === id) cancelPhotoEdit();
  }

  function clearExerciseFormOnly() {
    setEditingExerciseId(null);
    setExerciseName("");
    setExerciseDuration("");
    setExerciseSets("");
    setExerciseReps("");
    setExerciseWeight("");
  }

  function addOrUpdateExercise() {
    if (!exerciseName.trim()) return;
    const exercise = { id: editingExerciseId ?? Date.now(), name: exerciseName.trim(), duration: exerciseDuration, sets: exerciseSets, reps: exerciseReps, weight: exerciseWeight };
    setDraftExercises((prev) => (editingExerciseId ? prev.map((e) => (e.id === editingExerciseId ? exercise : e)) : [...prev, exercise]));
    clearExerciseFormOnly();
  }

  function editDraftExercise(exercise: ExerciseEntry) {
    setEditingExerciseId(exercise.id);
    setExerciseName(exercise.name);
    setExerciseDuration(exercise.duration);
    setExerciseSets(exercise.sets);
    setExerciseReps(exercise.reps);
    setExerciseWeight(exercise.weight);
  }

  function deleteDraftExercise(id: number) {
    setDraftExercises((prev) => prev.filter((exercise) => exercise.id !== id));
    if (editingExerciseId === id) clearExerciseFormOnly();
  }

  function clearWorkoutForm() {
    setEditingWorkoutId(null);
    setDraftExercises([]);
    clearExerciseFormOnly();
  }

  function saveWorkout() {
    if (draftExercises.length === 0) return;
    const workout = { id: editingWorkoutId ?? Date.now(), date: selectedDate, exercises: draftExercises };
    setWorkouts((prev) => (editingWorkoutId ? prev.map((w) => (w.id === editingWorkoutId ? workout : w)) : [workout, ...prev]));
    clearWorkoutForm();
  }

  function editWorkout(workout: WorkoutEntry) {
    setEditingWorkoutId(workout.id);
    setSelectedDate(workout.date);
    setDraftExercises(workout.exercises.map((e) => ({ ...e })));
    clearExerciseFormOnly();
    setTab("workouts");
  }

  function repeatWorkout(workout: WorkoutEntry) {
    setWorkouts((prev) => [{ id: Date.now(), date: selectedDate, exercises: workout.exercises.map((e) => ({ ...e, id: Date.now() + Math.random() })) }, ...prev]);
  }

  function deleteWorkout(id: number) {
    setWorkouts((prev) => prev.filter((workout) => workout.id !== id));
    if (editingWorkoutId === id) clearWorkoutForm();
  }

  function clearHabitForm() {
    setEditingHabitId(null);
    setHabitName("");
    setHabitCategory("Routine");
  }

  function addOrUpdateHabit() {
    if (!habitName.trim()) return;
    const habit = { id: editingHabitId ?? Date.now(), name: habitName.trim(), category: habitCategory };
    setHabits((prev) => (editingHabitId ? prev.map((h) => (h.id === editingHabitId ? habit : h)) : [habit, ...prev]));
    clearHabitForm();
  }

  function editHabit(habit: HabitEntry) {
    setEditingHabitId(habit.id);
    setHabitName(habit.name);
    setHabitCategory(habit.category);
    setTab("habits");
  }

  function toggleHabitForSelectedDate(habitId: number) {
    setHabitLogs((prev) => {
      const current = new Set(prev[habitId] || []);
      current.has(selectedDate) ? current.delete(selectedDate) : current.add(selectedDate);
      return { ...prev, [habitId]: Array.from(current).sort() };
    });
  }

  function deleteHabit(id: number) {
    setHabits((prev) => prev.filter((habit) => habit.id !== id));
    setHabitLogs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingHabitId === id) clearHabitForm();
  }

  function clearMealForm() {
    setEditingMealId(null);
    setMealName("");
    setMealCalories("");
  }

  function addOrUpdateMeal() {
    if (!mealName.trim()) return;
    const meal = { id: editingMealId ?? Date.now(), date: selectedDate, name: mealName.trim(), calories: mealCalories };
    setMeals((prev) => (editingMealId ? prev.map((m) => (m.id === editingMealId ? meal : m)) : [meal, ...prev]));
    clearMealForm();
  }

  function editMeal(meal: MealEntry) {
    setEditingMealId(meal.id);
    setSelectedDate(meal.date);
    setMealName(meal.name);
    setMealCalories(meal.calories);
    setTab("food");
  }

  function deleteMeal(id: number) {
    setMeals((prev) => prev.filter((meal) => meal.id !== id));
    if (editingMealId === id) clearMealForm();
  }

  function saveDailyEntry() {
    setDailyEntries((prev) => ({ ...prev, [selectedDate]: { mood: moodInput, note: noteInput } }));
    setMoodInput("");
    setNoteInput("");
  }

  function editDailyEntry() {
    setMoodInput(selectedDailyEntry.mood || "");
    setNoteInput(selectedDailyEntry.note || "");
    setTab("food");
  }

  function clearDailyEntry() {
    setDailyEntries((prev) => {
      const next = { ...prev };
      delete next[selectedDate];
      return next;
    });
    setMoodInput("");
    setNoteInput("");
  }

  const latestPhoto = useMemo(() => photos[0], [photos]);
  const firstPhoto = useMemo(() => photos[photos.length - 1], [photos]);
  const photosForSelectedDate = photos.filter((photo) => photo.date === selectedDate);

  return (
    <div className="min-h-screen pb-28" style={{ background: cream, color: darkText }}>
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 text-center sm:mb-8 sm:text-left">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Health Tracker <span style={{ color: "#E4C985" }}>365</span>
            </h1>
            <p className="mt-1 text-base text-gray-500 sm:mt-2 sm:text-lg">Track your health. Transform your life.</p>
          </div>
        </header>

        <DateNavigator
          selectedDate={selectedDate}
          onPrevious={() => changeSelectedDate(-1)}
          onNext={() => changeSelectedDate(1)}
          onDateChange={(date) => setSelectedDate(date)}
        />

        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
              <Card>
                <GoldIcon large><Scale size={30} /></GoldIcon>
                <h2 className="mt-4 text-base font-semibold sm:text-xl">Weight Progress</h2>
                {latestWeight ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-4xl">{latestWeight} <span className="text-sm font-normal sm:text-xl">lbs</span></p>
                    <p className="mt-1 text-gray-500">current weight</p>
                    <div className="mt-5"><ProgressBar value={goalProgress} /></div>
                    <p className="mt-2 text-sm text-gray-500">{hasWeightSetup ? `${totalLost.toFixed(1)} lbs lost` : "Add start + goal weight"}</p>
                  </>
                ) : (
                  <>
                    <PlaceholderText className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">Log first weight</PlaceholderText>
                    <PlaceholderText className="mt-1 text-sm">Your trend will show here</PlaceholderText>
                    <div className="mt-6"><ProgressBar value={0} /></div>
                    <button onClick={() => setTab("weight")} className="mt-5 text-sm font-semibold" style={{ color: gold }}>Open weight log ›</button>
                  </>
                )}
              </Card>

              <Card>
                <GoldIcon large><Trophy size={30} /></GoldIcon>
                <h2 className="mt-4 text-base font-semibold sm:text-xl">Strength PRs</h2>
                {strengthPRs.length > 0 ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-4xl">{strengthPRs.length}</p>
                    <p className="mt-1 text-gray-500">records tracked</p>
                  </>
                ) : (
                  <>
                    <PlaceholderText className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">No records yet</PlaceholderText>
                    <PlaceholderText className="mt-1 text-sm">Log exercise weight to track PRs</PlaceholderText>
                  </>
                )}
                <button onClick={() => setTab("workouts")} className="mt-8 flex w-full justify-between text-gray-700">View PRs <span>›</span></button>
              </Card>

              <Card>
                <GoldIcon large><Flame size={30} /></GoldIcon>
                <h2 className="mt-4 text-base font-semibold sm:text-xl">Workouts</h2>
                {workoutsThisWeek > 0 ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-4xl">{workoutsThisWeek}</p>
                    <p className="mt-1 text-gray-500">this week</p>
                  </>
                ) : (
                  <>
                    <PlaceholderText className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">Log first workout</PlaceholderText>
                    <PlaceholderText className="mt-1 text-sm">Your weekly total will show here</PlaceholderText>
                  </>
                )}
                <button onClick={() => setTab("workouts")} className="mt-8 flex w-full justify-between text-gray-700">View Workouts <span>›</span></button>
              </Card>

              <Card>
                <GoldIcon large><CheckCircle2 size={30} /></GoldIcon>
                <h2 className="mt-4 text-base font-semibold sm:text-xl">Habits</h2>
                <HabitRing value={habitProgress} empty={!hasHabits} />
                {hasHabits ? <p className="mt-3 text-center text-gray-500">{selectedHabitCount} of {habits.length} completed</p> : <PlaceholderText className="mt-3 text-center text-sm">Set up habits to track</PlaceholderText>}
              </Card>
            </div>

            <Card>
              <div className="grid gap-5 md:grid-cols-[1fr_2fr_1fr] md:items-center">
                <div>
                  <GoldIcon><Weight size={28} /></GoldIcon>
                  {hasWeightSetup ? <p className="mt-3 text-3xl font-semibold" style={{ color: gold }}>{goalProgress}%</p> : <PlaceholderText className="mt-3 text-2xl font-semibold">Set goal</PlaceholderText>}
                  <p className="text-gray-500">goal progress</p>
                </div>
                <div>
                  <p className="mb-2 text-center text-gray-600">{hasWeightSetup ? `${remaining.toFixed(1)} lbs to go` : "Enter starting + goal weight"}</p>
                  <ProgressBar value={goalProgress} />
                </div>
                <div className="md:text-right">
                  <p className="text-gray-500">Goal Weight</p>
                  {goalNum ? <p className="text-3xl font-semibold" style={{ color: gold }}>{goalNum} lbs</p> : <PlaceholderText className="text-2xl font-semibold">Add goal</PlaceholderText>}
                </div>
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-3 text-xl font-semibold"><CalendarDays color={gold} /> Selected Day</h2>
                  <span className="whitespace-nowrap text-sm font-medium sm:text-base" style={{ color: gold }}>{formatDate(selectedDate)}</span>
                </div>
                {[
                  [<Scale key="scale" />, "Weight", selectedWeight ? `${selectedWeight.weight} lbs` : "Enter weight", "weight"],
                  [<Utensils key="meal" />, "Meals", selectedMeals.length ? `${selectedMeals.length} logged` : "Log meal", "food"],
                  [<Dumbbell key="workout" />, "Workout", selectedWorkouts.length > 0 ? `${selectedWorkouts.length} logged` : "Log workout", "workouts"],
                  [<CheckCircle2 key="habits" />, "Habits", hasHabits ? `${selectedHabitCount}/${habits.length}` : "Set habits", "habits"],
                  [<Smile key="mood" />, "Mood", selectedDailyEntry.mood || "Add mood", "food"],
                  [<Edit3 key="note" />, "Notes", selectedDailyEntry.note ? "Added" : "Add note", "food"]
                ].map((row) => (
                  <button key={String(row[1])} onClick={() => setTab(row[3] as Tab)} className="flex w-full items-center justify-between border-b border-[#efe6d2] py-4 text-left last:border-b-0">
                    <span className="flex items-center gap-3 text-gray-700"><span style={{ color: gold }}>{row[0]}</span>{row[1]}</span>
                    <span className="flex items-center gap-3 text-gray-400">{row[2]} <span>›</span></span>
                  </button>
                ))}
              </Card>

              <Card>
                <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold"><Edit3 color={gold} /> Quick Log</h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    [<Scale key="qw" size={34} />, "Weight", "weight"],
                    [<Dumbbell key="qwo" size={34} />, "Workout", "workouts"],
                    [<Utensils key="qm" size={34} />, "Meal", "food"],
                    [<CheckCircle2 key="qh" size={34} />, "Habit", "habits"],
                    [<Smile key="qs" size={34} />, "Mood", "food"],
                    [<NotebookTabs key="qn" size={34} />, "Note", "food"]
                  ].map((item) => (
                    <button key={String(item[1])} onClick={() => setTab(item[2] as Tab)} className="rounded-3xl border border-[#efe6d2] bg-white p-4 hover:bg-[#FFF8E8]">
                      <div className="flex justify-center" style={{ color: gold }}>{item[0]}</div>
                      <p className="mt-2 text-sm text-gray-700">{item[1]}</p>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "weight" && (
          <div className="space-y-6">
            <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[24px] border border-[#eadfbe] bg-white p-4 shadow-sm">
                <p className="text-sm text-stone-500 sm:text-lg">Current Weight</p>
                {latestWeight ? <p className="mt-5 text-2xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{latestWeight} lb</p> : <PlaceholderText className="mt-5 text-xl font-semibold sm:text-3xl">Log weight</PlaceholderText>}
              </div>
              <div className="rounded-[24px] border border-[#eadfbe] bg-white p-4 shadow-sm">
                <p className="text-sm text-stone-500 sm:text-lg">Goal Weight</p>
                <input value={goalWeight} placeholder="175" onChange={(e) => setGoalWeight(e.target.value)} className="mt-4 w-full rounded-2xl border border-[#efe6d2] bg-[#FFFDF8] p-2 text-2xl font-semibold tracking-tight outline-none placeholder:text-gray-300 focus:border-[#C9A227] focus:ring-4 focus:ring-[#F3E7C4] sm:mt-7 sm:p-3 sm:text-3xl" />
              </div>
              <div className="rounded-[24px] border border-[#eadfbe] bg-white p-4 shadow-sm">
                <p className="text-sm text-stone-500 sm:text-lg">Starting Weight</p>
                <input value={startingWeight} placeholder="265" onChange={(e) => setStartingWeight(e.target.value)} className="mt-4 w-full rounded-2xl border border-[#efe6d2] bg-[#FFFDF8] p-2 text-2xl font-semibold tracking-tight outline-none placeholder:text-gray-300 focus:border-[#C9A227] focus:ring-4 focus:ring-[#F3E7C4] sm:mt-7 sm:p-3 sm:text-3xl" />
              </div>
              <div className="rounded-[24px] border border-[#eadfbe] bg-white p-4 shadow-sm">
                <p className="text-sm text-stone-500 sm:text-lg">Total Lost</p>
                {hasWeightSetup ? <p className="mt-5 text-2xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{totalLost.toFixed(1)} lb</p> : <PlaceholderText className="mt-5 text-xl font-semibold sm:text-3xl">Set goal</PlaceholderText>}
              </div>
            </div>

            <Card>
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-semibold"><Scale color={gold} /> Weight Tracking</h2>
              <p className="text-gray-500">Your newest logged weight becomes your current weight automatically.</p>
            </Card>

            <Card>
              <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold"><Plus color={gold} /> {editingWeightId ? "Edit Weight" : `Log Weight for ${formatDate(selectedDate)}`}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Weight"><input value={weightInput} placeholder="254.8" onChange={(e) => setWeightInput(e.target.value)} className={inputClass} /></Field>
                <Field label="Body Fat %"><input value={bodyFatInput} placeholder="Optional" onChange={(e) => setBodyFatInput(e.target.value)} className={inputClass} /></Field>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={saveWeight} className={primaryButton} style={{ background: gold }}><Save size={18} />{editingWeightId ? "Update Weight" : "Save Weight"}</button>
                {editingWeightId && <button onClick={clearWeightForm} className={secondaryButton}><X size={18} />Cancel</button>}
              </div>
              {selectedWeight && !editingWeightId ? <p className="mt-3 text-sm text-gray-500">Saved for this date: {selectedWeight.weight} lb</p> : null}
            </Card>

            <Card><h2 className="mb-4 text-xl font-semibold">30-Day Weight Trend</h2><MiniWeightChart weights={weights} /></Card>

            <Card>
              <h2 className="mb-4 text-xl font-semibold">Weight History</h2>
              <div className="space-y-5">
                {groupedWeights.length === 0 ? <p className="text-gray-400">No weights logged yet.</p> : null}
                {groupedWeights.map((group) => (
                  <div key={group.key} className="overflow-hidden rounded-3xl border border-[#efe6d2]">
                    <div className="flex items-center justify-between bg-[#C9A227] px-4 py-2 text-white">
                      <p className="font-semibold">{group.label}</p>
                      <p className="font-semibold">{group.average.toFixed(1)} lbs avg</p>
                    </div>
                    <div className="divide-y divide-[#efe6d2] bg-white">
                      {group.entries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-4 p-4">
                          <div>
                            <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
                            <p className="text-2xl font-semibold">{entry.weight} <span className="text-sm font-normal text-gray-500">lbs</span></p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg text-gray-500">{entry.bodyFat ? `${entry.bodyFat}% Fat` : ""}</p>
                            <button onClick={() => editWeight(entry)} className={secondaryButton}><Edit3 size={18} /></button>
                            <button onClick={() => deleteWeight(entry.id)} className={deleteButton}><Trash2 size={18} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "photos" && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-semibold"><Camera color={gold} /> Progress Photos</h2>
              <p className="mb-4 text-gray-500">Photos save to the selected date.</p>
              <div className="grid gap-4 md:grid-cols-3">
                <select value={photoType} onChange={(e) => setPhotoType(e.target.value)} className={inputClass}>
                  <option>Front</option><option>Side</option><option>Back</option><option>Flex</option>
                </select>
                {editingPhotoId ? (
                  <div className="flex gap-3 md:col-span-2">
                    <button onClick={savePhotoEdit} className={primaryButton} style={{ background: gold }}><Save size={18} />Update Photo</button>
                    <button onClick={cancelPhotoEdit} className={secondaryButton}><X size={18} />Cancel</button>
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e.target.files?.[0])} className={`${inputClass} md:col-span-2`} />
                )}
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-xl font-semibold">Before / After</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="overflow-hidden rounded-3xl bg-[#FFF8E8]">{firstPhoto ? <img src={firstPhoto.url} alt="Before progress" className="h-80 w-full object-cover" /> : <div className="flex h-80 items-center justify-center text-gray-400">First photo</div>}<p className="p-4 font-medium">Before</p></div>
                <div className="overflow-hidden rounded-3xl bg-[#FFF8E8]">{latestPhoto ? <img src={latestPhoto.url} alt="After progress" className="h-80 w-full object-cover" /> : <div className="flex h-80 items-center justify-center text-gray-400">Latest photo</div>}<p className="p-4 font-medium">After</p></div>
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-xl font-semibold">Photos for {formatDate(selectedDate)}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {photosForSelectedDate.length === 0 ? <p className="text-gray-500">No photos for this date.</p> : null}
                {photosForSelectedDate.map((photo) => (
                  <div key={photo.id} className="overflow-hidden rounded-3xl border border-[#efe6d2] bg-white">
                    <img src={photo.url} alt={`${photo.type} progress`} className="h-60 w-full object-cover" />
                    <div className="flex items-center justify-between p-4">
                      <div><p className="font-semibold">{photo.type}</p><p className="text-sm text-gray-500">{formatDate(photo.date)}</p></div>
                      <div className="flex gap-2"><button onClick={() => editPhoto(photo)} className={secondaryButton}><Edit3 size={18} /></button><button onClick={() => deletePhoto(photo.id)} className={deleteButton}><Trash2 size={18} /></button></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "food" && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-semibold"><NotebookTabs color={gold} /> Daily Food Log</h2>
              <p className="mb-4 text-gray-500">Meals save to {formatDate(selectedDate)}.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meal"><input value={mealName} placeholder="Example: smoothie" onChange={(e) => setMealName(e.target.value)} className={inputClass} /></Field>
                <Field label="Calories"><input value={mealCalories} placeholder="Optional" onChange={(e) => setMealCalories(e.target.value)} className={inputClass} /></Field>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={addOrUpdateMeal} className={primaryButton} style={{ background: gold }}><Save size={18} />{editingMealId ? "Update Meal" : "Add Meal"}</button>
                {editingMealId && <button onClick={clearMealForm} className={secondaryButton}><X size={18} />Cancel</button>}
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold"><Smile color={gold} /> Mood + Notes</h2>
              <p className="mb-4 text-gray-500">Save mood and notes for {formatDate(selectedDate)}.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mood"><input value={moodInput} placeholder={selectedDailyEntry.mood || "Example: Good"} onChange={(e) => setMoodInput(e.target.value)} className={inputClass} /></Field>
                <Field label="Daily Note"><input value={noteInput} placeholder={selectedDailyEntry.note || "Add a quick note"} onChange={(e) => setNoteInput(e.target.value)} className={inputClass} /></Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={saveDailyEntry} className={primaryButton} style={{ background: gold }}><Save size={18} />Save Mood + Note</button>
                {(selectedDailyEntry.mood || selectedDailyEntry.note) && <button onClick={editDailyEntry} className={secondaryButton}><Edit3 size={18} />Edit Saved</button>}
                {(selectedDailyEntry.mood || selectedDailyEntry.note) && <button onClick={clearDailyEntry} className={deleteButton}><Trash2 size={18} /></button>}
              </div>
              {(selectedDailyEntry.mood || selectedDailyEntry.note) && (
                <div className="mt-4 rounded-3xl bg-[#FFF8E8] p-4">
                  {selectedDailyEntry.mood ? <p><b>Mood:</b> {selectedDailyEntry.mood}</p> : null}
                  {selectedDailyEntry.note ? <p className="mt-1"><b>Note:</b> {selectedDailyEntry.note}</p> : null}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-xl font-semibold">Meals for {formatDate(selectedDate)}</h2>
              <div className="space-y-3">
                {selectedMeals.length === 0 ? <p className="text-gray-400">No meals logged for this date.</p> : null}
                {selectedMeals.map((meal) => (
                  <div key={meal.id} className="flex items-center justify-between rounded-3xl bg-[#FFF8E8] p-4">
                    <div><p className="font-semibold">{meal.name}</p><p className="text-sm text-gray-500">{formatDate(meal.date)} {meal.calories ? `· ${meal.calories} calories` : ""}</p></div>
                    <div className="flex gap-2"><button onClick={() => editMeal(meal)} className={secondaryButton}><Edit3 size={18} /></button><button onClick={() => deleteMeal(meal.id)} className={deleteButton}><Trash2 size={18} /></button></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "workouts" && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-semibold"><Dumbbell color={gold} /> Workouts</h2>
              <p className="mb-5 text-gray-500">Add exercises or cardio, then save to {formatDate(selectedDate)}. Repeat copies a past workout to the selected date.</p>
              <div className="rounded-3xl bg-[#FFF8E8] p-4">
                <h3 className="mb-3 font-semibold">{editingExerciseId ? "Edit Exercise" : "Add Exercise or Cardio"}</h3>
                {editingWorkoutId && <p className="mb-3 text-sm font-semibold text-gray-500">Editing saved workout from {formatDate(selectedDate)}</p>}
                <div className="grid gap-3 md:grid-cols-6">
                  <Field label="Exercise"><input value={exerciseName} placeholder="Treadmill or hip thrust" onChange={(e) => setExerciseName(e.target.value)} className={inputClass} /></Field>
                  <Field label="Duration"><input value={exerciseDuration} placeholder="45 min optional" onChange={(e) => setExerciseDuration(e.target.value)} className={inputClass} /></Field>
                  <Field label="Sets"><input value={exerciseSets} placeholder="3 optional" onChange={(e) => setExerciseSets(e.target.value)} className={inputClass} /></Field>
                  <Field label="Reps"><input value={exerciseReps} placeholder="10 optional" onChange={(e) => setExerciseReps(e.target.value)} className={inputClass} /></Field>
                  <Field label="Weight"><input value={exerciseWeight} placeholder="90 optional" onChange={(e) => setExerciseWeight(e.target.value)} className={inputClass} /></Field>
                  <button onClick={addOrUpdateExercise} className={`${secondaryButton} self-end`}><Plus size={18} />{editingExerciseId ? "Update" : "Add"}</button>
                </div>
                {editingExerciseId && <button onClick={clearExerciseFormOnly} className={`${secondaryButton} mt-3`}><X size={18} />Cancel Exercise Edit</button>}
                <div className="mt-3 space-y-2">
                  {draftExercises.length === 0 ? <p className="text-sm text-gray-400">No exercises added yet.</p> : null}
                  {draftExercises.map((exercise) => (
                    <div key={exercise.id} className="flex items-center justify-between rounded-2xl bg-white p-3 text-sm">
                      <span><b>{exercise.name}</b>{exercise.duration ? ` · ${exercise.duration}` : ""}{exercise.sets ? ` · ${exercise.sets} sets` : ""}{exercise.reps ? ` · ${exercise.reps} reps` : ""}{exercise.weight ? ` · ${exercise.weight} lb` : ""}</span>
                      <div className="flex gap-2"><button onClick={() => editDraftExercise(exercise)} className={secondaryButton}><Edit3 size={18} /></button><button onClick={() => deleteDraftExercise(exercise.id)} className={deleteButton}><Trash2 size={18} /></button></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={saveWorkout} className={primaryButton} style={{ background: gold }}><Save size={18} />{editingWorkoutId ? "Update Workout" : `Save Workout to ${formatDate(selectedDate)}`}</button>
                {editingWorkoutId && <button onClick={clearWorkoutForm} className={secondaryButton}><X size={18} />Cancel Edit</button>}
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-xl font-semibold">Workouts for {formatDate(selectedDate)}</h2>
              <div className="space-y-3">
                {selectedWorkouts.length === 0 ? <p className="text-gray-400">No workouts saved for this date.</p> : null}
                {selectedWorkouts.map((workout) => (
                  <div key={workout.id} className="rounded-3xl bg-[#FFF8E8] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><p className="font-semibold">{formatDate(workout.date)}</p><p className="text-sm text-gray-500">{workout.exercises.length} exercises</p></div>
                      <div className="flex flex-wrap gap-2"><button onClick={() => editWorkout(workout)} className={secondaryButton}><Edit3 size={16} />Edit</button><button onClick={() => repeatWorkout(workout)} className={secondaryButton}><Repeat size={16} />Repeat</button><button onClick={() => deleteWorkout(workout.id)} className={deleteButton}><Trash2 size={18} /></button></div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {workout.exercises.map((exercise) => <p key={exercise.id} className="text-sm text-gray-700"><b>{exercise.name}</b>{exercise.duration ? ` · ${exercise.duration}` : ""}{exercise.sets ? ` · ${exercise.sets} sets` : ""}{exercise.reps ? ` · ${exercise.reps} reps` : ""}{exercise.weight ? ` · ${exercise.weight} lb` : ""}</p>)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "habits" && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-semibold"><CheckCircle2 color={gold} /> Habit Tracking</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Habit Name"><input value={habitName} placeholder="Example: Vitamins" onChange={(e) => setHabitName(e.target.value)} className={inputClass} /></Field>
                <Field label="Category"><select value={habitCategory} onChange={(e) => setHabitCategory(e.target.value)} className={inputClass}><option>Routine</option><option>Health</option><option>Movement</option><option>Food</option><option>Mindset</option></select></Field>
                <button onClick={addOrUpdateHabit} className={`${primaryButton} self-end`} style={{ background: gold }}><Save size={18} />{editingHabitId ? "Update Habit" : "Add Habit"}</button>
              </div>
              {editingHabitId && <button onClick={clearHabitForm} className={`${secondaryButton} mt-4`}><X size={18} />Cancel</button>}
            </Card>

            <Card>
              <h2 className="mb-4 text-xl font-semibold">Check Habits for {formatDate(selectedDate)}</h2>
              <div className="mt-5 space-y-3">
                {habits.length === 0 ? <p className="text-gray-400">No habits yet. Add one above.</p> : null}
                {habits.map((habit) => {
                  const done = habitLogs[habit.id]?.includes(selectedDate) || false;
                  return (
                    <div key={habit.id} className={`flex items-center justify-between rounded-3xl border p-4 ${done ? "border-[#C9A227] bg-[#FFF8E8]" : "border-[#efe6d2] bg-white"}`}>
                      <button onClick={() => toggleHabitForSelectedDate(habit.id)} className="flex flex-1 items-center gap-3 text-left">
                        <CheckCircle2 color={done ? gold : "#bbb"} />
                        <div><p className="font-semibold">{habit.name}</p><p className="text-sm text-gray-500">{habit.category} · {done ? "completed" : "tap to complete"}</p></div>
                      </button>
                      <div className="flex gap-2"><button onClick={() => editHabit(habit)} className={secondaryButton}><Edit3 size={18} /></button><button onClick={() => deleteHabit(habit.id)} className={deleteButton}><Trash2 size={18} /></button></div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {tab === "insights" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card><GoldIcon large><LineChart size={34} /></GoldIcon><h2 className="mt-4 text-2xl font-semibold">Selected Day Snapshot</h2><p className="mt-2 text-gray-500">Date: {formatDate(selectedDate)}</p><p className="text-gray-500">Meals: {selectedMeals.length}</p><p className="text-gray-500">Workouts: {selectedWorkouts.length}</p><p className="text-gray-500">Habits completed: {selectedHabitCount}/{habits.length}</p></Card>
            <Card><GoldIcon large><Trophy size={34} /></GoldIcon><h2 className="mt-4 text-2xl font-semibold">Progress Summary</h2><p className="mt-2 text-gray-500">Total lost: {hasWeightSetup ? `${totalLost.toFixed(1)} lb` : "Set up weight first"}</p><p className="text-gray-500">Strength PRs: {strengthPRs.length}</p><p className="text-gray-500">Progress photos: {photos.length}</p></Card>
          </div>
        )}
      </main>

      <nav className="fixed bottom-3 left-3 right-3 z-50 rounded-[28px] border border-[#efe6d2] bg-white/95 p-2 shadow-lg backdrop-blur sm:left-1/2 sm:max-w-3xl sm:-translate-x-1/2">
        <div className="grid grid-cols-7 gap-1">
          {nav.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className="flex flex-col items-center justify-center rounded-2xl px-1 py-2 text-[11px] font-medium transition hover:bg-[#FFF8E8] sm:text-sm" style={{ color: tab === item.id ? gold : "#777" }}>
              {item.icon}
              <span className="mt-1 hidden sm:block">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
