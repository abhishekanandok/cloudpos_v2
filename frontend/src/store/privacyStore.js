import { create } from 'zustand';

const usePrivacyStore = create((set) => ({
  isRevealed: false,
  toggle: () => set((state) => ({ isRevealed: !state.isRevealed })),
}));

export default usePrivacyStore;
