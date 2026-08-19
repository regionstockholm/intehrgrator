/**
 * intEHRgrator custom Blockly messages (categories + home-grown blocks).
 * Stock Blockly block strings come from `blockly/msg/*` via setLocale.
 */

export type IntehrLocale = "en" | "sv" | "de" | "es" | "ca" | "fr";

export const SUPPORTED_LOCALES: Array<{ code: IntehrLocale; name: string }> = [
  { code: "en", name: "English" },
  { code: "sv", name: "Svenska" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "ca", name: "Català" },
  { code: "fr", name: "Français" },
];

export interface IntehrMessages {
  CAT_SOURCE: string;
  CAT_OPENEHR_TYPES: string;
  CAT_JSON: string;
  CAT_XML: string;
  CAT_TARGET_SCHEMA: string;
  CAT_LOGIC: string;
  CAT_LOOPS: string;
  CAT_MATH: string;
  CAT_TEXT: string;
  CAT_LISTS: string;
  CAT_VARIABLES: string;
  CAT_PROCEDURES: string;
  SOURCE_QUERY: string;
  SOURCE_QUERY_TOOLTIP: string;
  FOR_EACH_SOURCE_PREFIX: string;
  FOR_EACH_SOURCE_IN: string;
  FOR_EACH_SOURCE_NODES: string;
  FOR_EACH_SOURCE_DO: string;
  FOR_EACH_SOURCE_TOOLTIP: string;
  LANGUAGE_LABEL: string;
}

const TABLE: Record<IntehrLocale, IntehrMessages> = {
  en: {
    CAT_SOURCE: "Source",
    CAT_OPENEHR_TYPES: "openEHR types",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Target schema",
    CAT_LOGIC: "Logic",
    CAT_LOOPS: "Loops",
    CAT_MATH: "Math",
    CAT_TEXT: "Text",
    CAT_LISTS: "Lists",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Functions",
    SOURCE_QUERY: "source",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery against the loaded source (fontoxpath)",
    FOR_EACH_SOURCE_PREFIX: "for each",
    FOR_EACH_SOURCE_IN: "in",
    FOR_EACH_SOURCE_NODES: "source nodes",
    FOR_EACH_SOURCE_DO: "do",
    FOR_EACH_SOURCE_TOOLTIP:
      "Loop over every node matched by a source path. Current node is stored in the named variable.",
    LANGUAGE_LABEL: "Language",
  },
  sv: {
    CAT_SOURCE: "Källa",
    CAT_OPENEHR_TYPES: "openEHR types",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Målschema",
    CAT_LOGIC: "Logik",
    CAT_LOOPS: "Loopar",
    CAT_MATH: "Matematik",
    CAT_TEXT: "Text",
    CAT_LISTS: "Listor",
    CAT_VARIABLES: "Variabler",
    CAT_PROCEDURES: "Funktioner",
    SOURCE_QUERY: "källa",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery mot laddad källdata (fontoxpath)",
    FOR_EACH_SOURCE_PREFIX: "för varje",
    FOR_EACH_SOURCE_IN: "i",
    FOR_EACH_SOURCE_NODES: "källnoder",
    FOR_EACH_SOURCE_DO: "gör",
    FOR_EACH_SOURCE_TOOLTIP:
      "Loopa över varje nod som matchas av en källsökväg. Aktuell nod lagras i den namngivna variabeln.",
    LANGUAGE_LABEL: "Språk",
  },
  de: {
    CAT_SOURCE: "Quelle",
    CAT_OPENEHR_TYPES: "openEHR types",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Zielschema",
    CAT_LOGIC: "Logik",
    CAT_LOOPS: "Schleifen",
    CAT_MATH: "Mathematik",
    CAT_TEXT: "Text",
    CAT_LISTS: "Listen",
    CAT_VARIABLES: "Variablen",
    CAT_PROCEDURES: "Funktionen",
    SOURCE_QUERY: "Quelle",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery gegen die geladene Quelle (fontoxpath)",
    FOR_EACH_SOURCE_PREFIX: "für jedes",
    FOR_EACH_SOURCE_IN: "in",
    FOR_EACH_SOURCE_NODES: "Quellenknoten",
    FOR_EACH_SOURCE_DO: "mache",
    FOR_EACH_SOURCE_TOOLTIP:
      "Schleife über jeden Knoten eines Quellpfads. Der aktuelle Knoten wird in der genannten Variable gespeichert.",
    LANGUAGE_LABEL: "Sprache",
  },
  es: {
    CAT_SOURCE: "Origen",
    CAT_OPENEHR_TYPES: "openEHR types",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Esquema destino",
    CAT_LOGIC: "Lógica",
    CAT_LOOPS: "Bucles",
    CAT_MATH: "Matemáticas",
    CAT_TEXT: "Texto",
    CAT_LISTS: "Listas",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Funciones",
    SOURCE_QUERY: "origen",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery sobre el origen cargado (fontoxpath)",
    FOR_EACH_SOURCE_PREFIX: "para cada",
    FOR_EACH_SOURCE_IN: "en",
    FOR_EACH_SOURCE_NODES: "nodos de origen",
    FOR_EACH_SOURCE_DO: "hacer",
    FOR_EACH_SOURCE_TOOLTIP:
      "Recorre cada nodo coincidente con una ruta de origen. El nodo actual se guarda en la variable indicada.",
    LANGUAGE_LABEL: "Idioma",
  },
  ca: {
    CAT_SOURCE: "Origen",
    CAT_OPENEHR_TYPES: "openEHR types",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Esquema de destinació",
    CAT_LOGIC: "Lògica",
    CAT_LOOPS: "Bucles",
    CAT_MATH: "Matemàtiques",
    CAT_TEXT: "Text",
    CAT_LISTS: "Llistes",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Funcions",
    SOURCE_QUERY: "origen",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery sobre l'origen carregat (fontoxpath)",
    FOR_EACH_SOURCE_PREFIX: "per a cada",
    FOR_EACH_SOURCE_IN: "a",
    FOR_EACH_SOURCE_NODES: "nodes d'origen",
    FOR_EACH_SOURCE_DO: "fes",
    FOR_EACH_SOURCE_TOOLTIP:
      "Recorre cada node que coincideix amb un camí d'origen. El node actual es desa a la variable indicada.",
    LANGUAGE_LABEL: "Idioma",
  },
  fr: {
    CAT_SOURCE: "Source",
    CAT_OPENEHR_TYPES: "openEHR types",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Schéma cible",
    CAT_LOGIC: "Logique",
    CAT_LOOPS: "Boucles",
    CAT_MATH: "Math",
    CAT_TEXT: "Texte",
    CAT_LISTS: "Listes",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Fonctions",
    SOURCE_QUERY: "source",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery sur la source chargée (fontoxpath)",
    FOR_EACH_SOURCE_PREFIX: "pour chaque",
    FOR_EACH_SOURCE_IN: "dans",
    FOR_EACH_SOURCE_NODES: "nœuds source",
    FOR_EACH_SOURCE_DO: "faire",
    FOR_EACH_SOURCE_TOOLTIP:
      "Boucle sur chaque nœud correspondant à un chemin source. Le nœud courant est stocké dans la variable nommée.",
    LANGUAGE_LABEL: "Langue",
  },
};

export function msg(locale: string): IntehrMessages {
  const code = (SUPPORTED_LOCALES.some((l) => l.code === locale)
    ? locale
    : "en") as IntehrLocale;
  return TABLE[code];
}

export function isIntehrLocale(code: string): code is IntehrLocale {
  return SUPPORTED_LOCALES.some((l) => l.code === code);
}
