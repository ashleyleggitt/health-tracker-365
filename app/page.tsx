"use client";

import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ashley-health-tracker-v5";

type Frequency = "daily" | "weekly";
type Category = "health" | "routine" | "movement" | "food" | "mindset" | "other";
type AppTab = "today" | "calendar" | "habits" | "insights";

type Habit = {
  id: string;
  name: string;
  category: Category;
  frequency: Frequency;
  weeklyTarget: number;
  archived?: boolean;
};

type HabitLog = Record<string, string[]>;

type MealEntry = {
  id: string;
  name: string;
  calories?: number;
  note?: string;
};

type WorkoutEntry = {
  id: string;
  name: string;
  duration?: number;
  note?: string;
};

type ScheduleEntry = {
  id: string;
  title: string;
  note?: string;
};

type DayEntry = {
  weight?: string;
  calories?: string;
  mood?: string;
  flareLevel?: string;
  feeling?: string;
  triggers?: string;
  notes?: string;
  meals: MealEntry[];
  workouts: WorkoutEntry[];
  schedule: ScheduleEntry[];
};

type Store = {
  habits: Habit[];
  logs: HabitLog;
  dayEntries: Record<string, DayEntry>;
};

const categoryOptions: Category[] = ["health", "routine", "movement", "food", "mindset", "other"];
const moodOptions = ["", "Great", "Okay", "Low", "Stressed", "Irritable", "Tired"];
const flareOptions = ["", "None", "Mild", "Moderate", "Bad"];

function icon(label: string) {
  const map: Record<string, string> = {
    today: "☀️",
    calendar: "🗓️",
    habits: "✅",
    insights: "📊",
    weight: "⚖️",
    meals: "🍽️",
    flare: "💛",
    streak: "🔥",
    workouts: "🏃🏽‍♀️",
    schedule: "📝",
    add: "+",
    reset: "↺",
    archive: "✕",
  };
  return map[label] || "•";
}

function safeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLong(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMonthTitle(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getWeekDates(base = new Date()) {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);

  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

function getLast30Days() {
  const dates: string[] = [];
  const base = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  const leading = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < leading; i++) cells.push({ date: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(year, month, day).toISOString().slice(0, 10),
      day,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
  return cells;
}

function loadStore(): Store {
  if (typeof window === "undefined") return { habits: [], logs: {}, dayEntries: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { habits: [], logs: {}, dayEntries: {} };
    const parsed = JSON.parse(raw);
    return {
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      logs: parsed.logs && typeof parsed.logs === "object" ? parsed.logs : {},
      dayEntries: parsed.dayEntries && typeof parsed.dayEntries === "object" ? parsed.dayEntries : {},
    };
  } catch {
    return { habits: [], logs: {}, dayEntries: {} };
  }
}

function createEmptyDayEntry(): DayEntry {
  return {
    weight: "",
    calories: "",
    mood: "",
    flareLevel: "",
    feeling: "",
    triggers: "",
    notes: "",
    meals: [],
    workouts: [],
    schedule: [],
  };
}

function getDayEntry(dayEntries: Record<string, DayEntry>, date: string): DayEntry {
  return dayEntries[date] || createEmptyDayEntry();
}

function updateDayEntry(
  dayEntries: Record<string, DayEntry>,
  date: string,
  updater: (current: DayEntry) => DayEntry
) {
  const current = getDayEntry(dayEntries, date);
  return {
    ...dayEntries,
    [date]: updater(current),
  };
}

function getEntries(logs: HabitLog, habitId: string) {
  return logs[habitId] || [];
}

function isDone(logs: HabitLog, habitId: string, date: string) {
  return getEntries(logs, habitId).includes(date);
}

function toggleLog(logs: HabitLog, habitId: string, date: string): HabitLog {
  const current = new Set(getEntries(logs, habitId));
  if (current.has(date)) current.delete(date);
  else current.add(date);
  return { ...logs, [habitId]: Array.from(current).sort() };
}

function countInDates(logs: HabitLog, habitId: string, dates: string[]) {
  const current = new Set(getEntries(logs, habitId));
  return dates.filter((d) => current.has(d)).length;
}

function getStreak(logs: HabitLog, habitId: string) {
  const set = new Set(getEntries(logs, habitId));
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function runInternalTests() {
  const week = getWeekDates(new Date("2026-03-25T12:00:00"));
  if (week.length !== 7) throw new Error("Test failed: week should have 7 dates");
  if (week[0] !== "2026-03-23") throw new Error("Test failed: week should start on Monday");

  const toggledOnce = toggleLog({}, "habit-1", "2026-03-25");
  if (!isDone(toggledOnce, "habit-1", "2026-03-25")) throw new Error("Test failed: toggle should add date");

  const toggledTwice = toggleLog(toggledOnce, "habit-1", "2026-03-25");
  if (isDone(toggledTwice, "habit-1", "2026-03-25")) throw new Error("Test failed: second toggle should remove date");

  const empty = createEmptyDayEntry();
  if (empty.meals.length !== 0 || empty.workouts.length !== 0 || empty.schedule.length !== 0) {
    throw new Error("Test failed: empty day entry collections should start empty");
  }

  const monthCells = getMonthCells(2026, 2);
  if (monthCells.length < 35) throw new Error("Test failed: month grid should include full weeks");

  const updated = updateDayEntry({}, "2026-03-25", (current) => ({ ...current, weight: "250" }));
  if (getDayEntry(updated, "2026-03-25").weight !== "250") {
    throw new Error("Test failed: updateDayEntry should persist field changes");
  }
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-[#eadfbe] bg-white/95 p-4 shadow-[0_12px_30px_rgba(180,150,85,0.12)] backdrop-blur-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-stone-900 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  emoji,
}: {
  label: string;
  value: string;
  subtext: string;
  emoji: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#eadfbe] bg-white/95 p-4 shadow-[0_12px_26px_rgba(180,150,85,0.10)]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f9edc7] to-[#ebd79d] text-lg text-[#7b612c] shadow-sm">
        <span aria-hidden="true">{emoji}</span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b48a32]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-900">{value}</p>
      <p className="mt-1 text-sm text-stone-500">{subtext}</p>
    </div>
  );
}

function SmallPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#ecdcb5] bg-[#faf1dd] px-2.5 py-1 text-[11px] text-[#896c33] shadow-sm">
      {children}
    </span>
  );
}

function TabButton({
  active,
  emoji,
  label,
  onClick,
}: {
  active: boolean;
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-gradient-to-b from-[#f8eecf] to-[#efdcae] text-stone-900 shadow-[0_8px_18px_rgba(193,156,77,0.24)]"
          : "text-stone-500"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${
          active ? "bg-white/80 shadow-sm" : "bg-[#fff9eb]"
        }`}
        aria-hidden="true"
      >
        {emoji}
      </span>
      <span>{label}</span>
    </button>
  );
}

function PrimaryButton({ children, onClick, className = "", type = "button" }: { children: React.ReactNode; onClick?: () => void; className?: string; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border border-[#d8c48a] bg-gradient-to-b from-[#f7ebc7] to-[#ecd9a7] px-4 py-2.5 text-sm font-medium text-stone-800 shadow-[0_8px_20px_rgba(190,160,90,0.18)] transition hover:brightness-[1.02] ${className}`}
    >
      {children}
    </button>
  );
}

export default function HealthTrackerPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AppTab>("today");
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog>({});
  const [dayEntries, setDayEntries] = useState<Record<string, DayEntry>>({});
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [habitForm, setHabitForm] = useState({
    name: "",
    category: "health" as Category,
    frequency: "daily" as Frequency,
    weeklyTarget: 3,
  });
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [mealForm, setMealForm] = useState({ name: "", calories: "", note: "" });
  const [workoutForm, setWorkoutForm] = useState({ name: "", duration: "", note: "" });
  const [scheduleForm, setScheduleForm] = useState({ title: "", note: "" });

  useEffect(() => {
    runInternalTests();
    const data = loadStore();
    setHabits(data.habits);
    setLogs(data.logs);
    setDayEntries(data.dayEntries);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ habits, logs, dayEntries }));
  }, [habits, logs, dayEntries, ready]);

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const weekDates = getWeekDates();
  const last30Days = getLast30Days();
  const today = todayKey();
  const todayEntry = getDayEntry(dayEntries, today);
  const selectedEntry = getDayEntry(dayEntries, selectedDate);
  const monthCells = getMonthCells(monthCursor.year, monthCursor.month);
  const monthTitle = formatMonthTitle(monthCursor.year, monthCursor.month);

  const selectedHabits =
    selectedHabitId === "all"
      ? activeHabits
      : activeHabits.filter((h) => h.id === selectedHabitId);

  const completedToday = activeHabits.filter((h) => isDone(logs, h.id, today)).length;
  const bestStreak = activeHabits.length ? Math.max(...activeHabits.map((h) => getStreak(logs, h.id))) : 0;
  const totalHabitCheckins30 = activeHabits.reduce((sum, h) => sum + countInDates(logs, h.id, last30Days), 0);
  const workoutCount30 = last30Days.reduce((sum, date) => sum + getDayEntry(dayEntries, date).workouts.length, 0);
  const mealCount30 = last30Days.reduce((sum, date) => sum + getDayEntry(dayEntries, date).meals.length, 0);
  const flareDays30 = last30Days.filter((date) => {
    const flare = getDayEntry(dayEntries, date).flareLevel;
    return flare === "Mild" || flare === "Moderate" || flare === "Bad";
  }).length;
  const daysWithWeight30 = last30Days.filter((date) => Boolean(getDayEntry(dayEntries, date).weight)).length;
  const calorieValues30 = last30Days
    .map((date) => Number(getDayEntry(dayEntries, date).calories || ""))
    .filter((value) => Number.isFinite(value) && value > 0);
  const avgCalories30 = calorieValues30.length
    ? Math.round(calorieValues30.reduce((sum, value) => sum + value, 0) / calorieValues30.length)
    : 0;

  const upcomingSchedule = Object.entries(dayEntries)
    .filter(([date, entry]) => date >= today && entry.schedule.length > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 10);

  const recentFlares = Object.entries(dayEntries)
    .filter(([, entry]) => entry.flareLevel === "Mild" || entry.flareLevel === "Moderate" || entry.flareLevel === "Bad")
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8);

  function addHabit() {
    if (!habitForm.name.trim()) return;
    const newHabit: Habit = {
      id: safeId(),
      name: habitForm.name.trim(),
      category: habitForm.category,
      frequency: habitForm.frequency,
      weeklyTarget: habitForm.frequency === "daily" ? 7 : Math.max(1, habitForm.weeklyTarget),
    };
    setHabits((prev) => [newHabit, ...prev]);
    setHabitForm({ name: "", category: "health", frequency: "daily", weeklyTarget: 3 });
    setShowHabitForm(false);
  }

  function archiveHabit(id: string) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, archived: true } : h)));
    if (selectedHabitId === id) setSelectedHabitId("all");
  }

  function resetToday() {
    let next = { ...logs };
    activeHabits.forEach((habit) => {
      if (isDone(next, habit.id, today)) next = toggleLog(next, habit.id, today);
    });
    setLogs(next);
  }

  function setField(date: string, field: keyof Omit<DayEntry, "meals" | "workouts" | "schedule">, value: string) {
    setDayEntries((prev) =>
      updateDayEntry(prev, date, (current) => ({
        ...current,
        [field]: value,
      }))
    );
  }

  function addMeal(date: string) {
    if (!mealForm.name.trim()) return;
    const newMeal: MealEntry = {
      id: safeId(),
      name: mealForm.name.trim(),
      calories: mealForm.calories ? Number(mealForm.calories) : undefined,
      note: mealForm.note.trim() || undefined,
    };
    setDayEntries((prev) =>
      updateDayEntry(prev, date, (current) => ({
        ...current,
        meals: [newMeal, ...current.meals],
      }))
    );
    setMealForm({ name: "", calories: "", note: "" });
  }

  function addWorkout(date: string) {
    if (!workoutForm.name.trim()) return;
    const newWorkout: WorkoutEntry = {
      id: safeId(),
      name: workoutForm.name.trim(),
      duration: workoutForm.duration ? Number(workoutForm.duration) : undefined,
      note: workoutForm.note.trim() || undefined,
    };
    setDayEntries((prev) =>
      updateDayEntry(prev, date, (current) => ({
        ...current,
        workouts: [newWorkout, ...current.workouts],
      }))
    );
    setWorkoutForm({ name: "", duration: "", note: "" });
  }

  function addScheduleItem(date: string) {
    if (!scheduleForm.title.trim()) return;
    const newItem: ScheduleEntry = {
      id: safeId(),
      title: scheduleForm.title.trim(),
      note: scheduleForm.note.trim() || undefined,
    };
    setDayEntries((prev) =>
      updateDayEntry(prev, date, (current) => ({
        ...current,
        schedule: [newItem, ...current.schedule],
      }))
    );
    setScheduleForm({ title: "", note: "" });
  }

  function removeMeal(date: string, id: string) {
    setDayEntries((prev) =>
      updateDayEntry(prev, date, (current) => ({
        ...current,
        meals: current.meals.filter((item) => item.id !== id),
      }))
    );
  }

  function removeWorkout(date: string, id: string) {
    setDayEntries((prev) =>
      updateDayEntry(prev, date, (current) => ({
        ...current,
        workouts: current.workouts.filter((item) => item.id !== id),
      }))
    );
  }

  function removeScheduleItem(date: string, id: string) {
    setDayEntries((prev) =>
      updateDayEntry(prev, date, (current) => ({
        ...current,
        schedule: current.schedule.filter((item) => item.id !== id),
      }))
    );
  }

  function renderDayEditor(date: string) {
    const entry = getDayEntry(dayEntries, date);

    return (
      <div className="space-y-4">
        <SectionCard title="Quick check-in" subtitle={`For ${formatDateLong(date)}`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Daily weight</label>
              <input
                value={entry.weight || ""}
                onChange={(e) => setField(date, "weight", e.target.value)}
                className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Calories</label>
              <input
                value={entry.calories || ""}
                onChange={(e) => setField(date, "calories", e.target.value)}
                className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Mood</label>
              <select
                value={entry.mood || ""}
                onChange={(e) => setField(date, "mood", e.target.value)}
                className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
              >
                {moodOptions.map((mood) => (
                  <option key={mood} value={mood}>{mood || "Select mood"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Flare level</label>
              <select
                value={entry.flareLevel || ""}
                onChange={(e) => setField(date, "flareLevel", e.target.value)}
                className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
              >
                {flareOptions.map((flare) => (
                  <option key={flare} value={flare}>{flare || "Select flare"}</option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Meals + calories" subtitle="Add what you ate for this day.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={mealForm.name}
              onChange={(e) => setMealForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf] sm:col-span-2"
            />
            <input
              value={mealForm.calories}
              onChange={(e) => setMealForm((prev) => ({ ...prev, calories: e.target.value }))}
              className="rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
            />
          </div>
          <textarea
            value={mealForm.note}
            onChange={(e) => setMealForm((prev) => ({ ...prev, note: e.target.value }))}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
          />
          <PrimaryButton onClick={() => addMeal(date)} className="mt-3">
            <span aria-hidden="true">{icon("add")}</span>
            Add Meal
          </PrimaryButton>

          <div className="mt-4 space-y-2">
            {entry.meals.length === 0 ? <p className="text-sm text-stone-500">No meals logged yet.</p> : null}
            {entry.meals.map((meal) => (
              <div key={meal.id} className="rounded-2xl border border-[#ede2cb] bg-[#fffcf7] p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{meal.name}</p>
                    <p className="text-sm text-stone-500">{meal.calories ? `${meal.calories} cal` : "Calories not added"}</p>
                    {meal.note ? <p className="mt-1 text-sm text-stone-600">{meal.note}</p> : null}
                  </div>
                  <button onClick={() => removeMeal(date, meal.id)} className="rounded-xl p-2 text-stone-500 transition hover:bg-[#f8efdc]" aria-label="Remove meal">
                    <span aria-hidden="true">{icon("archive")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Workouts + progress" subtitle="Log movement and how your body handled it.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={workoutForm.name}
              onChange={(e) => setWorkoutForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf] sm:col-span-2"
            />
            <input
              value={workoutForm.duration}
              onChange={(e) => setWorkoutForm((prev) => ({ ...prev, duration: e.target.value }))}
              className="rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
            />
          </div>
          <textarea
            value={workoutForm.note}
            onChange={(e) => setWorkoutForm((prev) => ({ ...prev, note: e.target.value }))}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
          />
          <PrimaryButton onClick={() => addWorkout(date)} className="mt-3">
            <span aria-hidden="true">{icon("add")}</span>
            Add Workout
          </PrimaryButton>

          <div className="mt-4 space-y-2">
            {entry.workouts.length === 0 ? <p className="text-sm text-stone-500">No workouts logged yet.</p> : null}
            {entry.workouts.map((workout) => (
              <div key={workout.id} className="rounded-2xl border border-[#ede2cb] bg-[#fffcf7] p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{workout.name}</p>
                    <p className="text-sm text-stone-500">{workout.duration ? `${workout.duration} min` : "Duration not added"}</p>
                    {workout.note ? <p className="mt-1 text-sm text-stone-600">{workout.note}</p> : null}
                  </div>
                  <button onClick={() => removeWorkout(date, workout.id)} className="rounded-xl p-2 text-stone-500 transition hover:bg-[#f8efdc]" aria-label="Remove workout">
                    <span aria-hidden="true">{icon("archive")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Schedule / to do" subtitle="Plan one thing for the day or add a reminder.">
          <input
            value={scheduleForm.title}
            onChange={(e) => setScheduleForm((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
          />
          <textarea
            value={scheduleForm.note}
            onChange={(e) => setScheduleForm((prev) => ({ ...prev, note: e.target.value }))}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-3 py-3 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
          />
          <PrimaryButton onClick={() => addScheduleItem(date)} className="mt-3">
            <span aria-hidden="true">{icon("add")}</span>
            Add To Schedule
          </PrimaryButton>

          <div className="mt-4 space-y-2">
            {entry.schedule.length === 0 ? <p className="text-sm text-stone-500">No schedule items yet.</p> : null}
            {entry.schedule.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#ede2cb] bg-[#fffcf7] p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{item.title}</p>
                    {item.note ? <p className="mt-1 text-sm text-stone-600">{item.note}</p> : null}
                  </div>
                  <button onClick={() => removeScheduleItem(date, item.id)} className="rounded-xl p-2 text-stone-500 transition hover:bg-[#f8efdc]" aria-label="Remove schedule item">
                    <span aria-hidden="true">{icon("archive")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Mood, triggers, and notes" subtitle="Track how your body and mind are doing.">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">How you&apos;re feeling</label>
            <textarea
              value={entry.feeling || ""}
              onChange={(e) => setField(date, "feeling", e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-stone-700">Potential food triggers</label>
            <textarea
              value={entry.triggers || ""}
              onChange={(e) => setField(date, "triggers", e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-stone-700">Daily notes</label>
            <textarea
              value={entry.notes || ""}
              onChange={(e) => setField(date, "notes", e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
            />
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-center px-4 py-4 sm:px-6 lg:px-8 md:grid-cols-[1fr_auto_1fr]">
  <div className="w-full text-center md:col-start-2">
    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b48a32]">Simple wellness planning</p>
    <h1
      className="mt-1 bg-gradient-to-r from-[#d2b16a] via-[#b78c39] to-[#826227] bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-3xl"
    >
      Health Tracker 365
    </h1>
  </div>
  <div className="hidden gap-2 md:col-start-3 md:flex md:justify-end">
    <TabButton active={tab === "today"} emoji={icon("today")} label="Today" onClick={() => setTab("today")} />
    <TabButton active={tab === "calendar"} emoji={icon("calendar")} label="Calendar" onClick={() => setTab("calendar")} />
    <TabButton active={tab === "habits"} emoji={icon("habits")} label="Habits" onClick={() => setTab("habits")} />
    <TabButton active={tab === "insights"} emoji={icon("insights")} label="Insights" onClick={() => setTab("insights")} />
  </div>
</div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        {tab === "today" ? (
          <div className="space-y-5">
            <SectionCard title="Today" subtitle={formatDateLong(today)}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Habits" value={`${completedToday}/${activeHabits.length || 0}`} subtext="Done today" emoji={icon("habits")} />
                <MetricCard label="Weight" value={todayEntry.weight || "-"} subtext="Today check-in" emoji={icon("weight")} />
                <MetricCard label="Meals" value={`${todayEntry.meals.length}`} subtext="Logged today" emoji={icon("meals")} />
                <MetricCard label="Flare" value={todayEntry.flareLevel || "-"} subtext="Today status" emoji={icon("flare")} />
              </div>
            </SectionCard>

            {renderDayEditor(today)}
          </div>
        ) : null}

        {tab === "calendar" ? (
          <div className="space-y-5">
            <SectionCard title="Calendar" subtitle="Tap a day, then log everything underneath.">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setMonthCursor((prev) =>
                      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
                    )
                  }
                  className="rounded-2xl border border-[#e5dbc7] bg-[#fffdf8] px-3 py-2 text-sm shadow-sm transition hover:bg-[#fbf3df]"
                >
                  Prev
                </button>
                <div className="text-sm font-medium text-stone-700">{monthTitle}</div>
                <button
                  onClick={() =>
                    setMonthCursor((prev) =>
                      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
                    )
                  }
                  className="rounded-2xl border border-[#e5dbc7] bg-[#fffdf8] px-3 py-2 text-sm shadow-sm transition hover:bg-[#fbf3df]"
                >
                  Next
                </button>
              </div>

              <div className="mb-3 grid grid-cols-7 gap-2 text-center text-[10px] font-medium uppercase tracking-wide text-stone-500">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthCells.map((cell, index) => {
                  const day = cell.date ? getDayEntry(dayEntries, cell.date) : null;
                  const flare = day?.flareLevel || "";
                  const hasMeal = Boolean(day?.meals.length);
                  const hasWorkout = Boolean(day?.workouts.length);
                  const hasWeight = Boolean(day?.weight);

                  return (
                    <button
                      key={`${cell.date || "empty"}-${index}`}
                      disabled={!cell.date}
                      onClick={() => cell.date && setSelectedDate(cell.date)}
                      className={`aspect-square rounded-2xl border p-1.5 text-left transition ${
                        cell.date ? "border-[#e6dcc6] bg-[#fffdf8] shadow-sm hover:bg-[#fbf3df]" : "border-transparent bg-transparent"
                      } ${cell.date === selectedDate ? "ring-2 ring-[#d2b16a]" : ""}`}
                    >
                      {cell.date ? (
                        <>
                          <div className="text-xs font-medium text-stone-700">{cell.day}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {hasMeal ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
                            {hasWorkout ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}
                            {flare && flare !== "None" ? <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> : null}
                            {hasWeight ? <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> : null}
                          </div>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Selected day" subtitle={formatDateLong(selectedDate)}>
              <div className="flex flex-wrap gap-2">
                <SmallPill>Weight: {selectedEntry.weight || "-"}</SmallPill>
                <SmallPill>Calories: {selectedEntry.calories || "-"}</SmallPill>
                <SmallPill>Mood: {selectedEntry.mood || "-"}</SmallPill>
                <SmallPill>Flare: {selectedEntry.flareLevel || "-"}</SmallPill>
                <SmallPill>{selectedEntry.meals.length} meals</SmallPill>
                <SmallPill>{selectedEntry.workouts.length} workouts</SmallPill>
              </div>
            </SectionCard>

            {renderDayEditor(selectedDate)}
          </div>
        ) : null}

        {tab === "habits" ? (
          <div className="space-y-5">
            <SectionCard title="Habits" subtitle="Clean, simple habit tracking that works well on your phone.">
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={() => setShowHabitForm(true)}>
                  <span aria-hidden="true">{icon("add")}</span>
                  Add Habit
                </PrimaryButton>
                <button
                  onClick={resetToday}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#e5dbc7] bg-[#fffdf8] px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-[#fbf3df]"
                >
                  <span aria-hidden="true">{icon("reset")}</span>
                  Reset Today
                </button>
              </div>
            </SectionCard>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Today" value={`${completedToday}/${activeHabits.length || 0}`} subtext="Completed" emoji={icon("habits")} />
              <MetricCard label="Streak" value={`${bestStreak}`} subtext="Best current streak" emoji={icon("streak")} />
              <MetricCard label="30 days" value={`${totalHabitCheckins30}`} subtext="Total check-ins" emoji={icon("insights")} />
              <MetricCard label="Active" value={`${activeHabits.length}`} subtext="Current habits" emoji={icon("today")} />
            </div>

            <SectionCard title="Today&apos;s habit list" subtitle="Tap the circle to check it off.">
              {activeHabits.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#d7ccb7] bg-[#fcf7ed] p-8 text-center">
                  <p className="text-base font-medium text-stone-700">No habits yet</p>
                  <p className="mt-2 text-sm text-stone-500">Start with a few simple habits.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeHabits.map((habit) => {
                    const done = isDone(logs, habit.id, today);
                    const streak = getStreak(logs, habit.id);
                    const weeklyDone = countInDates(logs, habit.id, weekDates);
                    const weeklyTarget = habit.frequency === "daily" ? 7 : habit.weeklyTarget;
                    const percent = Math.min(100, Math.round((weeklyDone / Math.max(weeklyTarget, 1)) * 100));

                    return (
                      <div key={habit.id} className="rounded-3xl border border-[#e8dcc4] bg-[#fffdf8] p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setLogs((prev) => toggleLog(prev, habit.id, today))}
                            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg transition ${
                              done
                                ? "border-[#c89d49] bg-gradient-to-b from-[#f8e9bf] to-[#eacb84] text-[#6f5522]"
                                : "border-[#d9ceb9] bg-white"
                            }`}
                            aria-label={`Toggle ${habit.name}`}
                          >
                            {done ? "✓" : "○"}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-base font-semibold text-stone-900">{habit.name}</h3>
                                <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">
                                  {habit.category} • {habit.frequency === "daily" ? "daily" : `${habit.weeklyTarget}x weekly`}
                                </p>
                              </div>
                              <button
                                onClick={() => archiveHabit(habit.id)}
                                className="rounded-xl p-2 text-stone-500 transition hover:bg-[#f8efdc]"
                                title="Archive habit"
                              >
                                <span aria-hidden="true">{icon("archive")}</span>
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                              <div className="rounded-2xl border border-[#eee3cd] bg-white p-3">
                                <p className="text-[11px] uppercase tracking-wide text-stone-500">Streak</p>
                                <p className="mt-1 font-semibold text-stone-900">{streak}d</p>
                              </div>
                              <div className="rounded-2xl border border-[#eee3cd] bg-white p-3">
                                <p className="text-[11px] uppercase tracking-wide text-stone-500">Week</p>
                                <p className="mt-1 font-semibold text-stone-900">{weeklyDone}/{weeklyTarget}</p>
                              </div>
                              <div className="rounded-2xl border border-[#eee3cd] bg-white p-3">
                                <p className="text-[11px] uppercase tracking-wide text-stone-500">Progress</p>
                                <p className="mt-1 font-semibold text-stone-900">{percent}%</p>
                              </div>
                            </div>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#efe5cf]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#efd08b] via-[#d1a857] to-[#b78532] transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Week view" subtitle="Tap across the week for quick logging.">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SmallPill>{totalHabitCheckins30} check-ins in last 30 days</SmallPill>
                <select
                  value={selectedHabitId}
                  onChange={(e) => setSelectedHabitId(e.target.value)}
                  className="rounded-2xl border border-[#e5dbc7] bg-[#fffdf8] px-3 py-2.5 text-sm outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
                >
                  <option value="all">All habits</option>
                  {activeHabits.map((habit) => (
                    <option key={habit.id} value={habit.id}>{habit.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 overflow-x-auto">
                <div className="min-w-[560px] space-y-3">
                  {selectedHabits.map((habit) => (
                    <div key={habit.id} className="rounded-3xl border border-[#e8dcc4] bg-[#fffdf8] p-3 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-stone-900">{habit.name}</h3>
                          <p className="text-xs text-stone-500">Tap any day to toggle.</p>
                        </div>
                        <SmallPill>{habit.frequency === "daily" ? "Daily" : `${habit.weeklyTarget}x weekly`}</SmallPill>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {weekDates.map((date) => {
                          const done = isDone(logs, habit.id, date);
                          const isTodayCell = date === today;
                          const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
                          const dayNumber = new Date(`${date}T12:00:00`).getDate();

                          return (
                            <button
                              key={date}
                              onClick={() => setLogs((prev) => toggleLog(prev, habit.id, date))}
                              className={`rounded-2xl border p-3 text-center transition ${
                                done
                                  ? "border-[#d4b96e] bg-gradient-to-b from-[#fbf1d4] to-[#f3e0ab]"
                                  : "border-[#e6dcc6] bg-white"
                              } ${isTodayCell ? "ring-1 ring-[#ccb070]" : ""}`}
                            >
                              <div className="text-xs text-stone-500">{label}</div>
                              <div className="mt-1 text-sm font-semibold text-stone-900">{dayNumber}</div>
                              <div className="mt-2 flex justify-center">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-[#c8aa5a] bg-[#eed89a]" : "border-[#e3d8c1] bg-[#fcfaf5]"}`}>
                                  {done ? "✓" : ""}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {tab === "insights" ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Workouts" value={`${workoutCount30}`} subtext="Last 30 days" emoji={icon("workouts")} />
              <MetricCard label="Meals" value={`${mealCount30}`} subtext="Last 30 days" emoji={icon("meals")} />
              <MetricCard label="Flare days" value={`${flareDays30}`} subtext="With symptoms" emoji={icon("flare")} />
              <MetricCard label="Weights" value={`${daysWithWeight30}`} subtext="Days checked in" emoji={icon("weight")} />
            </div>

            <SectionCard title="Pattern snapshot" subtitle="Simple stats to help you notice trends.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-[#e8dcc4] bg-[#fffdf8] p-4 shadow-sm">
                  <p className="text-sm font-medium text-stone-700">Average calories</p>
                  <p className="mt-2 text-3xl font-semibold text-stone-900">{avgCalories30 || "-"}</p>
                  <p className="mt-1 text-sm text-stone-500">Based on days where calories were entered</p>
                </div>
                <div className="rounded-3xl border border-[#e8dcc4] bg-[#fffdf8] p-4 shadow-sm">
                  <p className="text-sm font-medium text-stone-700">Habit consistency</p>
                  <p className="mt-2 text-3xl font-semibold text-stone-900">{totalHabitCheckins30}</p>
                  <p className="mt-1 text-sm text-stone-500">Total habit check-ins across the last 30 days</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Upcoming schedule" subtitle="Pulled from the dates you already filled in.">
              <div className="space-y-2">
                {upcomingSchedule.length === 0 ? <p className="text-sm text-stone-500">No upcoming schedule items yet.</p> : null}
                {upcomingSchedule.map(([date, entry]) => (
                  <div key={date} className="rounded-3xl border border-[#e8dcc4] bg-[#fffdf8] p-4 shadow-sm">
                    <p className="text-sm font-semibold text-stone-900">{formatDateLong(date)}</p>
                    <div className="mt-2 space-y-2">
                      {entry.schedule.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-[#eee3cd] bg-white p-3">
                          <p className="font-medium text-stone-900">{item.title}</p>
                          {item.note ? <p className="mt-1 text-sm text-stone-600">{item.note}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Recent flare log" subtitle="A quick look at symptom days.">
              <div className="space-y-2">
                {recentFlares.length === 0 ? <p className="text-sm text-stone-500">No flare days logged yet.</p> : null}
                {recentFlares.map(([date, entry]) => (
                  <div key={date} className="rounded-3xl border border-[#e8dcc4] bg-[#fffdf8] p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <SmallPill>{formatDateShort(date)}</SmallPill>
                      <SmallPill>Flare: {entry.flareLevel || "-"}</SmallPill>
                      <SmallPill>Mood: {entry.mood || "-"}</SmallPill>
                    </div>
                    {entry.triggers ? <p className="mt-3 text-sm text-stone-700"><span className="font-medium">Triggers:</span> {entry.triggers}</p> : null}
                    {entry.notes ? <p className="mt-2 text-sm text-stone-600">{entry.notes}</p> : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#eadfbe] bg-[rgba(255,252,245,0.96)] px-3 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-2 rounded-[28px] border border-[#eadfbe] bg-white/95 p-2 shadow-[0_16px_34px_rgba(180,150,85,0.18)]">
          <TabButton active={tab === "today"} emoji={icon("today")} label="Today" onClick={() => setTab("today")} />
          <TabButton active={tab === "calendar"} emoji={icon("calendar")} label="Calendar" onClick={() => setTab("calendar")} />
          <TabButton active={tab === "habits"} emoji={icon("habits")} label="Habits" onClick={() => setTab("habits")} />
          <TabButton active={tab === "insights"} emoji={icon("insights")} label="Insights" onClick={() => setTab("insights")} />
        </div>
      </div>

      {showHabitForm ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[28px] border border-[#eadfbe] bg-white/95 p-5 shadow-[0_20px_50px_rgba(90,70,20,0.18)] backdrop-blur-sm">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b48a32]">New Habit</p>
              <h2 className="mt-2 text-xl font-semibold text-stone-900">Add a new habit</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Habit name</label>
                <input
                  value={habitForm.name}
                  onChange={(e) => setHabitForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Category</label>
                  <select
                    value={habitForm.category}
                    onChange={(e) => setHabitForm((prev) => ({ ...prev, category: e.target.value as Category }))}
                    className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Frequency</label>
                  <select
                    value={habitForm.frequency}
                    onChange={(e) => setHabitForm((prev) => ({ ...prev, frequency: e.target.value as Frequency }))}
                    className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              {habitForm.frequency === "weekly" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Times per week</label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={habitForm.weeklyTarget}
                    onChange={(e) => setHabitForm((prev) => ({ ...prev, weeklyTarget: Number(e.target.value) || 1 }))}
                    className="w-full rounded-2xl border border-[#e6dcc6] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#d0b06a] focus:ring-2 focus:ring-[#f3e6bf]"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowHabitForm(false)}
                className="flex-1 rounded-2xl border border-[#e5dbc7] bg-[#fffdf8] px-4 py-3 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-[#fbf3df]"
              >
                Cancel
              </button>
              <PrimaryButton onClick={addHabit} className="flex-1 justify-center">
                Save Habit
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
