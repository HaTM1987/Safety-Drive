
export const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;

  // Cancel any currently speaking utterance
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'vi-VN';
  utterance.rate = 1.05; // Slightly faster for urgent driving alerts
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const vnVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VN'));
    if (vnVoice) {
      utterance.voice = vnVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  // Chrome/Safari voice loading handling
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = setVoice;
  } else {
    setVoice();
  }
};
