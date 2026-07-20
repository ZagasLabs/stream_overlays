import { EN_ACCEPTED, EN_ANSWERS } from "../data/en.js";
import { ES_ACCEPTED, ES_ANSWERS } from "../data/es.js";
import { normalizeWord } from "./game.js";

const DICTIONARIES = Object.freeze({ en: { answers: EN_ANSWERS, accepted: EN_ACCEPTED }, es: { answers: ES_ANSWERS, accepted: ES_ACCEPTED } });

export function getDictionary(lang = "en", wordLength = 5, accents = "fold") {
  const source = DICTIONARIES[lang] || DICTIONARIES.en;
  const normalize = (word) => normalizeWord(word, accents);
  const answers = [...new Set(source.answers.map(normalize))].filter((word) => [...word].length === wordLength);
  const accepted = [...new Set([...source.accepted, ...source.answers].map(normalize))].filter((word) => [...word].length === wordLength);
  return { answers, accepted };
}
