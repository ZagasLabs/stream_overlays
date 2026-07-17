import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [englishSource, spanishSource] = process.argv.slice(2);
if (!englishSource || !spanishSource) {
  console.error("Usage: node scripts/generate-wordlists.mjs EN_50K.txt ES_50K.txt");
  process.exit(1);
}

const answers = {
  en: [
    "calm", "game", "play", "chat", "team", "hope", "glow", "moon", "star", "wave", "bold", "cool", "kind", "warm", "epic", "move", "luck", "open", "fire", "rain",
    "crane", "slate", "light", "heart", "smile", "dream", "brave", "spark", "sound", "cloud", "storm", "sweet", "magic", "quick", "proud", "fresh", "dance", "world", "plant", "stone", "ocean", "flame", "shine", "laugh", "peace", "happy", "tiger", "beach", "music", "space", "watch", "power", "story", "green", "black", "white", "pixel", "frame", "round", "guess", "party", "sunny", "water", "earth", "metal", "radio",
    "stream", "bright", "friend", "puzzle", "orange", "silver", "planet", "wonder", "guitar", "camera", "gentle", "future", "rocket", "flower", "energy", "little", "people", "signal", "simple", "moment",
    "waiting", "rainbow", "network", "journey", "crystal", "balance", "imagine", "freedom", "channel", "special", "picture", "welcome", "playful", "natural", "sharing",
    "together", "creative", "audience", "midnight", "electric", "friendly", "teamwork", "sunshine", "surprise", "champion", "positive", "festival", "graphics", "everyone"
  ],
  es: [
    "amor", "luna", "casa", "vida", "reto", "risa", "azul", "rojo", "nube", "onda", "alma", "bien", "café", "cine", "nota", "idea", "giro", "meta", "gran",
    "grito", "juego", "calma", "luces", "noche", "mundo", "magia", "ritmo", "ronda", "pista", "playa", "cielo", "dulce", "feliz", "audio", "video", "sueño", "fuego", "color", "amigo", "claro", "gente", "punto", "radio", "frase", "tabla", "pausa", "salto", "genial", "mejor", "todos", "buena", "bravo", "brisa", "campo", "canto", "cerca", "costa", "creer", "grupo", "joven", "libre", "mente", "motor", "nuevo", "orden", "papel", "parte", "reloj", "serie", "tarde", "valor",
    "equipo", "charla", "alegre", "suerte", "fuerza", "sonido", "espera", "rápido", "cámara", "acción", "idioma", "música", "regalo", "verdad", "futuro", "bonito", "brillo", "camino", "cantar", "cometa", "dibujo", "enigma", "fiesta", "grande", "jugada", "lluvia", "mirada", "paleta", "prueba", "sonrisa",
    "palabra", "energía", "colores", "jugando", "amistad", "mensaje", "alegría", "artista", "campeón", "directo", "espacio", "historia", "musical", "natural", "planeta", "primero", "respeto", "sincero",
    "victoria", "pantalla", "creativo", "sorpresa", "universo", "aventura", "positivo", "amistoso", "festival", "libertad", "melodía", "perfecto", "proyecto", "resuelto"
  ]
};

generate("en", englishSource);
generate("es", spanishSource);

function generate(language, sourcePath) {
  const sourceWords = readFileSync(sourcePath, "utf8").split(/\r?\n/).map((line) => line.split(/\s+/)[0]).filter(Boolean);
  const normalized = sourceWords.map((word) => normalize(word, language)).filter((word) => word && [...word].length >= 4 && [...word].length <= 8);
  const accepted = [...new Set([...answers[language], ...normalized])].slice(0, 10_000);
  const prefix = language.toUpperCase();
  const contents = `// Adapted from FrequencyWords 2018 (${language}), CC BY-SA 4.0. See wordlestream/data/NOTICE.md.\n` +
    `export const ${prefix}_ANSWERS = Object.freeze(${JSON.stringify([...new Set(answers[language])])});\n` +
    `export const ${prefix}_ACCEPTED = Object.freeze(${JSON.stringify(accepted)});\n`;
  writeFileSync(resolve(`wordlestream/data/${language}.js`), contents);
}

function normalize(word, language) {
  const value = String(word).normalize("NFKC").toLocaleLowerCase(language);
  return /^[\p{L}]+$/u.test(value) ? value : "";
}
