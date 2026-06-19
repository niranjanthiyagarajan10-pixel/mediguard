import { openDB } from 'idb'
import type { Visit, Reminder, Profile, SymptomCheckin } from './types'

// v2 added the keyless 'profile' store; v3 added 'checkins' (daily symptom log). Guard each step
// by oldVersion so an existing database keeps its visits/reminders/profile instead of erroring.
const getDB = () => openDB('mediguard', 3, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('visits', { keyPath: 'id' })
      db.createObjectStore('reminders', { keyPath: 'id' })
    }
    if (oldVersion < 2) db.createObjectStore('profile')
    if (oldVersion < 3) db.createObjectStore('checkins', { keyPath: 'id' })
  }
})

export async function saveVisit(visit: Visit) {
  const db = await getDB()
  await db.put('visits', visit)
}

export async function getVisit(id: string): Promise<Visit | undefined> {
  const db = await getDB()
  return db.get('visits', id)
}

export async function getAllVisits(): Promise<Visit[]> {
  const db = await getDB()
  const all = await db.getAll('visits')
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function deleteVisit(id: string) {
  const db = await getDB()
  await db.delete('visits', id)
}

// Merge-update a stored visit (e.g. ticking an action item done). No new store needed.
export async function updateVisit(id: string, updates: Partial<Visit>) {
  const db = await getDB()
  const existing = await db.get('visits', id)
  if (existing) await db.put('visits', { ...existing, ...updates })
}

export async function saveReminders(reminders: Reminder[]) {
  const db = await getDB()
  const tx = db.transaction('reminders', 'readwrite')
  await Promise.all(reminders.map(r => tx.store.put(r)))
  await tx.done
}

export async function getAllReminders(): Promise<Reminder[]> {
  const db = await getDB()
  return db.getAll('reminders')
}

export async function updateReminder(id: string, updates: Partial<Reminder>) {
  const db = await getDB()
  const existing = await db.get('reminders', id)
  if (existing) await db.put('reminders', { ...existing, ...updates })
}

export async function deleteReminder(id: string) {
  const db = await getDB()
  await db.delete('reminders', id)
}

// Profile is a singleton — one record under a fixed key.
export async function getProfile(): Promise<Profile | undefined> {
  const db = await getDB()
  return db.get('profile', 'me')
}

export async function saveProfile(profile: Profile) {
  const db = await getDB()
  await db.put('profile', profile, 'me')
}

// Symptom check-ins — keyed by date (id == YYYY-MM-DD), so one record per day.
export async function saveCheckin(checkin: SymptomCheckin) {
  const db = await getDB()
  await db.put('checkins', checkin)
}

export async function getCheckin(date: string): Promise<SymptomCheckin | undefined> {
  const db = await getDB()
  return db.get('checkins', date)
}

export async function getRecentCheckins(days = 7): Promise<SymptomCheckin[]> {
  const db = await getDB()
  const all = (await db.getAll('checkins')) as SymptomCheckin[]
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, days)
}

// Everything the app has stored, in one object — for the "Export my data" download. Lets a user
// keep their own backup without us ever sending their data to a server.
export async function exportAllData() {
  const db = await getDB()
  const [visits, reminders, profile, checkins] = await Promise.all([
    db.getAll('visits'),
    db.getAll('reminders'),
    db.get('profile', 'me'),
    db.getAll('checkins'),
  ])
  return { exportedAt: new Date().toISOString(), visits, reminders, profile, checkins }
}

// Wipe every store — the "Delete all my data" action. One transaction so it's all-or-nothing.
export async function clearAllData() {
  const db = await getDB()
  const stores = ['visits', 'reminders', 'profile', 'checkins'] as const
  const tx = db.transaction(stores, 'readwrite')
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()))
  await tx.done
}
