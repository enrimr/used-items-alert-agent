/**
 * Store en memoria y persistencia en JSON
 * Guarda los items ya vistos para detectar nuevos
 */

const fs = require('fs');
const path = require('path');

class ItemStore {
  constructor(outputFile) {
    this.seenIds = new Set();
    this.allItems = [];
    this.outputFile = outputFile;
    this._loadFromFile();
  }

  /**
   * Carga los IDs previos desde el archivo de salida (si existe)
   */
  _loadFromFile() {
    try {
      if (this.outputFile && fs.existsSync(this.outputFile)) {
        const raw = fs.readFileSync(this.outputFile, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.allItems = data;
          data.forEach((item) => {
            if (item.id) this.seenIds.add(item.id);
          });
          console.log(`📦 Cargados ${this.seenIds.size} items previos desde ${this.outputFile}`);
        }
      }
    } catch (err) {
      // El archivo no existe o está corrupto, empezamos de cero
    }
  }

  /**
   * Guarda todos los items en el archivo JSON
   */
  _saveToFile() {
    try {
      if (!this.outputFile) return;
      const dir = path.dirname(this.outputFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.outputFile,
        JSON.stringify(this.allItems, null, 2),
        'utf8'
      );
    } catch (err) {
      console.error('⚠️  Error guardando archivo:', err.message);
    }
  }

  /**
   * Procesa un listado de items y devuelve solo los nuevos
   * @param {Array} items - Lista de items del scraper
   * @returns {Array} - Items nuevos (no vistos anteriormente)
   */
  getNewItems(items) {
    const newItems = [];

    for (const item of items) {
      const id = item.id;
      if (!id) continue;

      if (!this.seenIds.has(id)) {
        this.seenIds.add(id);
        const itemWithTimestamp = {
          ...item,
          detectedAt: new Date().toISOString(),
        };
        newItems.push(itemWithTimestamp);
        this.allItems.unshift(itemWithTimestamp); // Añadir al principio (más reciente primero)
      }
    }

    return newItems;
  }

  /**
   * Persiste nuevos items si está habilitado el guardado
   */
  save(saveToFile = true) {
    if (saveToFile) {
      this._saveToFile();
    }
  }

  /**
   * Devuelve estadísticas del store
   */
  getStats() {
    return {
      totalSeen: this.seenIds.size,
      totalSaved: this.allItems.length,
    };
  }

  /**
   * Limpia items más antiguos de N días para no crecer indefinidamente
   */
  cleanup(maxDays = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);

    const before = this.allItems.length;
    this.allItems = this.allItems.filter((item) => {
      if (!item.detectedAt) return true;
      return new Date(item.detectedAt) > cutoff;
    });

    // Rebuild seenIds
    this.seenIds.clear();
    this.allItems.forEach((item) => {
      if (item.id) this.seenIds.add(item.id);
    });

    const removed = before - this.allItems.length;
    if (removed > 0) {
      console.log(`🧹 Limpiados ${removed} items más antiguos de ${maxDays} días`);
    }
  }
}

module.exports = { ItemStore };
