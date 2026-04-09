const SELECTED_CHARACTER_ID_KEY = 'dream:selected-character-id';

export function getSelectedSimulatorCharacterId() {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(SELECTED_CHARACTER_ID_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function setSelectedSimulatorCharacterId(characterId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SELECTED_CHARACTER_ID_KEY, characterId);
}

export function clearSelectedSimulatorCharacterId() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SELECTED_CHARACTER_ID_KEY);
}
