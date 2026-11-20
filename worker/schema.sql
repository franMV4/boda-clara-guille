CREATE TABLE IF NOT EXISTS respuestas (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  nombre TEXT NOT NULL,
  asiste TEXT NOT NULL,
  acompanante TEXT,
  autobus_ida INTEGER,
  autobus_vuelta INTEGER,
  menus TEXT,
  alergias TEXT,
  cancion TEXT,
  cancion_enlace TEXT,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
