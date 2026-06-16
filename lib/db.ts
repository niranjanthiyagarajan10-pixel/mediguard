import { openDB } from 'idb'
import type { Visit, Reminder } from './types'

const getDB = () => openDB('mediguard', 1, {
  upgrade(db) {
    db.createObjectStore('visits', { keyPath: 'id' })
    db.createObjectStore('reminders', { keyPath: 'id' })
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
