import { create } from 'zustand';

// On définit précisément ce que le store contient
interface BrandState {
  primaryColor: string;
  secondaryColor: string;
  brandName: string;
  forbiddenWords: string[];
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setBrandName: (name: string) => void;
  addForbiddenWord: (word: string) => void;
}

// Création du store avec des valeurs par défaut
export const useBrandStore = create<BrandState>((set) => ({
  primaryColor: '#F97316',
  secondaryColor: '#7C3AED',
  brandName: 'BrandLock',
  forbiddenWords: ['promo', 'gratuit'],
  
  setPrimaryColor: (color: string) => set({ primaryColor: color }),
  setSecondaryColor: (color: string) => set({ secondaryColor: color }),
  setBrandName: (name: string) => set({ brandName: name }),
  addForbiddenWord: (word: string) => set((state) => ({
    forbiddenWords: [...state.forbiddenWords, word]
  })),
}));