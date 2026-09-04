import type { IntehrLocale } from "../blockly/i18n/custom_msg.ts";

export interface SheetsChrome {
  tab: string;
  add: string;
  rename: string;
  remove: string;
  importCsv: string;
  exportCsv: string;
  fullscreen: string;
  exitFullscreen: string;
  empty: string;
  namePrompt: string;
}

const CHROME: Record<IntehrLocale, SheetsChrome> = {
  en: {
    tab: "Sheets",
    add: "Add sheet",
    rename: "Rename",
    remove: "Delete",
    importCsv: "Import CSV",
    exportCsv: "Export CSV",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    empty: "No sheets yet. Add a sheet or import a CSV.",
    namePrompt: "Sheet name",
  },
  sv: {
    tab: "Kalkylblad",
    add: "Nytt blad",
    rename: "Byt namn",
    remove: "Ta bort",
    importCsv: "Importera CSV",
    exportCsv: "Exportera CSV",
    fullscreen: "Helskärm",
    exitFullscreen: "Lämna helskärm",
    empty: "Inga blad ännu. Lägg till ett blad eller importera CSV.",
    namePrompt: "Bladnamn",
  },
  de: {
    tab: "Tabellen",
    add: "Blatt hinzufügen",
    rename: "Umbenennen",
    remove: "Löschen",
    importCsv: "CSV importieren",
    exportCsv: "CSV exportieren",
    fullscreen: "Vollbild",
    exitFullscreen: "Vollbild beenden",
    empty: "Noch keine Blätter. Blatt hinzufügen oder CSV importieren.",
    namePrompt: "Blattname",
  },
  es: {
    tab: "Hojas",
    add: "Añadir hoja",
    rename: "Renombrar",
    remove: "Eliminar",
    importCsv: "Importar CSV",
    exportCsv: "Exportar CSV",
    fullscreen: "Pantalla completa",
    exitFullscreen: "Salir de pantalla completa",
    empty: "Aún no hay hojas. Añada una hoja o importe un CSV.",
    namePrompt: "Nombre de la hoja",
  },
  ca: {
    tab: "Fulls",
    add: "Afegeix full",
    rename: "Canvia el nom",
    remove: "Suprimeix",
    importCsv: "Importa CSV",
    exportCsv: "Exporta CSV",
    fullscreen: "Pantalla completa",
    exitFullscreen: "Surt de pantalla completa",
    empty: "Encara no hi ha fulls. Afegiu-ne un o importeu un CSV.",
    namePrompt: "Nom del full",
  },
  fr: {
    tab: "Feuilles",
    add: "Ajouter une feuille",
    rename: "Renommer",
    remove: "Supprimer",
    importCsv: "Importer CSV",
    exportCsv: "Exporter CSV",
    fullscreen: "Plein écran",
    exitFullscreen: "Quitter le plein écran",
    empty: "Pas encore de feuilles. Ajoutez-en une ou importez un CSV.",
    namePrompt: "Nom de la feuille",
  },
};

/** jspreadsheet.setDictionary keys are the original English UI strings. */
const JSS_DICTIONARY: Record<IntehrLocale, Record<string, string>> = {
  en: {},
  sv: {
    "Search": "Sök",
    "Cut": "Klipp ut",
    "Copy": "Kopiera",
    "Paste": "Klistra in",
    "Insert a new column before": "Infoga kolumn före",
    "Insert a new column after": "Infoga kolumn efter",
    "Delete selected columns": "Ta bort valda kolumner",
    "Rename this column": "Byt namn på kolumn",
    "Insert a new row before": "Infoga rad före",
    "Insert a new row after": "Infoga rad efter",
    "Delete selected rows": "Ta bort valda rader",
    "Save as": "Spara som",
    "About": "Om",
    "Are you sure?": "Är du säker?",
    "No records found": "Inga poster hittades",
    "Order ascending": "Sortera stigande",
    "Order descending": "Sortera fallande",
  },
  de: {
    "Search": "Suchen",
    "Cut": "Ausschneiden",
    "Copy": "Kopieren",
    "Paste": "Einfügen",
    "Insert a new column before": "Spalte davor einfügen",
    "Insert a new column after": "Spalte danach einfügen",
    "Delete selected columns": "Ausgewählte Spalten löschen",
    "Rename this column": "Spalte umbenennen",
    "Insert a new row before": "Zeile davor einfügen",
    "Insert a new row after": "Zeile danach einfügen",
    "Delete selected rows": "Ausgewählte Zeilen löschen",
    "Save as": "Speichern unter",
    "About": "Über",
    "Are you sure?": "Sind Sie sicher?",
    "No records found": "Keine Einträge gefunden",
    "Order ascending": "Aufsteigend sortieren",
    "Order descending": "Absteigend sortieren",
  },
  es: {
    "Search": "Buscar",
    "Cut": "Cortar",
    "Copy": "Copiar",
    "Paste": "Pegar",
    "Insert a new column before": "Insertar columna antes",
    "Insert a new column after": "Insertar columna después",
    "Delete selected columns": "Eliminar columnas seleccionadas",
    "Rename this column": "Renombrar columna",
    "Insert a new row before": "Insertar fila antes",
    "Insert a new row after": "Insertar fila después",
    "Delete selected rows": "Eliminar filas seleccionadas",
    "Save as": "Guardar como",
    "About": "Acerca de",
    "Are you sure?": "¿Está seguro?",
    "No records found": "No se encontraron registros",
    "Order ascending": "Ordenar ascendente",
    "Order descending": "Ordenar descendente",
  },
  ca: {
    "Search": "Cerca",
    "Cut": "Retalla",
    "Copy": "Copia",
    "Paste": "Enganxa",
    "Insert a new column before": "Insereix columna abans",
    "Insert a new column after": "Insereix columna després",
    "Delete selected columns": "Suprimeix les columnes seleccionades",
    "Rename this column": "Canvia el nom de la columna",
    "Insert a new row before": "Insereix fila abans",
    "Insert a new row after": "Insereix fila després",
    "Delete selected rows": "Suprimeix les files seleccionades",
    "Save as": "Anomena i desa",
    "About": "Quant a",
    "Are you sure?": "Segur?",
    "No records found": "No s'han trobat registres",
    "Order ascending": "Ordena ascendent",
    "Order descending": "Ordena descendent",
  },
  fr: {
    "Search": "Rechercher",
    "Cut": "Couper",
    "Copy": "Copier",
    "Paste": "Coller",
    "Insert a new column before": "Insérer une colonne avant",
    "Insert a new column after": "Insérer une colonne après",
    "Delete selected columns": "Supprimer les colonnes sélectionnées",
    "Rename this column": "Renommer la colonne",
    "Insert a new row before": "Insérer une ligne avant",
    "Insert a new row after": "Insérer une ligne après",
    "Delete selected rows": "Supprimer les lignes sélectionnées",
    "Save as": "Enregistrer sous",
    "About": "À propos",
    "Are you sure?": "Êtes-vous sûr ?",
    "No records found": "Aucun enregistrement",
    "Order ascending": "Tri croissant",
    "Order descending": "Tri décroissant",
  },
};

export function sheetsChrome(locale: string): SheetsChrome {
  return CHROME[(locale in CHROME ? locale : "en") as IntehrLocale];
}

export function jspreadsheetDictionary(locale: string): Record<string, string> {
  return JSS_DICTIONARY[(locale in JSS_DICTIONARY ? locale : "en") as IntehrLocale];
}
