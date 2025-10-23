import type { Diary, Invitation } from '../types/types';

const DIARY_CACHE_KEY = 'cached_diaries';
const INVITATION_CACHE_KEY = 'cached_invitations';
const LAST_SYNC_KEY = 'last_sync_time';

export const cacheService = {
  // Diaries
  getDiaries(): Diary[] {
    try {
      const cached = localStorage.getItem(DIARY_CACHE_KEY);
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error reading diaries from cache:', error);
      return [];
    }
  },

  setDiaries(diaries: Diary[]): void {
    try {
      localStorage.setItem(DIARY_CACHE_KEY, JSON.stringify(diaries));
    } catch (error) {
      console.error('Error saving diaries to cache:', error);
    }
  },

  updateDiary(diaryId: string, updates: Partial<Diary>): void {
    const diaries = this.getDiaries();
    const index = diaries.findIndex(d => d.id === diaryId);
    if (index !== -1) {
      diaries[index] = { ...diaries[index], ...updates, updatedAt: new Date().toISOString() };
      this.setDiaries(diaries);
    }
  },

  addDiary(diary: Diary): void {
    const diaries = this.getDiaries();
    const exists = diaries.find(d => d.id === diary.id);
    if (!exists) {
      diaries.push(diary);
      this.setDiaries(diaries);
    }
  },

  removeDiary(diaryId: string): void {
    const diaries = this.getDiaries();
    this.setDiaries(diaries.filter(d => d.id !== diaryId));
  },

  // Invitations
  getInvitations(): Invitation[] {
    try {
      const cached = localStorage.getItem(INVITATION_CACHE_KEY);
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error reading invitations from cache:', error);
      return [];
    }
  },

  setInvitations(invitations: Invitation[]): void {
    try {
      localStorage.setItem(INVITATION_CACHE_KEY, JSON.stringify(invitations));
    } catch (error) {
      console.error('Error saving invitations to cache:', error);
    }
  },

  // Sync tracking
  getLastSyncTime(): number {
    try {
      const time = localStorage.getItem(LAST_SYNC_KEY);
      return time ? parseInt(time) : 0;
    } catch {
      return 0;
    }
  },

  setLastSyncTime(time: number): void {
    localStorage.setItem(LAST_SYNC_KEY, time.toString());
  },

  // Clear all cache
  clearAll(): void {
    localStorage.removeItem(DIARY_CACHE_KEY);
    localStorage.removeItem(INVITATION_CACHE_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }
};