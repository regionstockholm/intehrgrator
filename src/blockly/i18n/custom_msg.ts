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
  CAT_MAPS: string;
  CAT_VARIABLES: string;
  CAT_PROCEDURES: string;
  SOURCE_QUERY: string;
  SOURCE_QUERY_TOOLTIP: string;
  SOURCE_NODE_TOOLTIP: string;
  TEXT_CODE: string;
  TEXT_CODE_TOOLTIP: string;
  TEXT_HANDLEBARS: string;
  TEXT_HANDLEBARS_WITH: string;
  TEXT_HANDLEBARS_TOOLTIP: string;
  FOR_EACH_SOURCE_PREFIX: string;
  FOR_EACH_SOURCE_IN: string;
  FOR_EACH_SOURCE_NODES: string;
  FOR_EACH_SOURCE_DO: string;
  FOR_EACH_SOURCE_TOOLTIP: string;
  LANGUAGE_LABEL: string;
  UI_LANGUAGE_LABEL: string;
  MODEL_LANGUAGE_LABEL: string;
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
    CAT_MAPS: "Maps",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Functions",
    SOURCE_QUERY: "source",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery against the loaded source (fontoxpath)",
    SOURCE_NODE_TOOLTIP:
      "XPath/XQuery subtree of the loaded JSON or XML source (fontoxpath). Use as Handlebars context.",
    TEXT_CODE: "text",
    TEXT_CODE_TOOLTIP:
      "Multiline text with syntax highlighting. Resizable editor; choose a language for highlighting.",
    TEXT_HANDLEBARS: "handlebars",
    TEXT_HANDLEBARS_WITH: "with",
    TEXT_HANDLEBARS_TOOLTIP:
      "Render a Handlebars script against a Map or a source subtree.",
    FOR_EACH_SOURCE_PREFIX: "for each",
    FOR_EACH_SOURCE_IN: "in",
    FOR_EACH_SOURCE_NODES: "source nodes",
    FOR_EACH_SOURCE_DO: "do",
    FOR_EACH_SOURCE_TOOLTIP:
      "Loop over every node matched by a source path. Current node is stored in the named variable.",
    LANGUAGE_LABEL: "Language",
    UI_LANGUAGE_LABEL: "UI",
    MODEL_LANGUAGE_LABEL: "Model",
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
    CAT_MAPS: "Mappar",
    CAT_VARIABLES: "Variabler",
    CAT_PROCEDURES: "Funktioner",
    SOURCE_QUERY: "källa",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery mot laddad källdata (fontoxpath)",
    SOURCE_NODE_TOOLTIP:
      "XPath/XQuery-subträd av laddad JSON- eller XML-källa (fontoxpath). Används som Handlebars-kontext.",
    TEXT_CODE: "text",
    TEXT_CODE_TOOLTIP:
      "Flerradig text med syntaxfärgning. Ändra storlek på editorn; välj språk för highlighting.",
    TEXT_HANDLEBARS: "handlebars",
    TEXT_HANDLEBARS_WITH: "med",
    TEXT_HANDLEBARS_TOOLTIP:
      "Rendera ett Handlebars-skript mot en Map eller ett källsubträd.",
    FOR_EACH_SOURCE_PREFIX: "för varje",
    FOR_EACH_SOURCE_IN: "i",
    FOR_EACH_SOURCE_NODES: "källnoder",
    FOR_EACH_SOURCE_DO: "gör",
    FOR_EACH_SOURCE_TOOLTIP:
      "Loopa över varje nod som matchas av en källsökväg. Aktuell nod lagras i den namngivna variabeln.",
    LANGUAGE_LABEL: "Språk",
    UI_LANGUAGE_LABEL: "UI",
    MODEL_LANGUAGE_LABEL: "Modell",
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
    CAT_MAPS: "Maps",
    CAT_VARIABLES: "Variablen",
    CAT_PROCEDURES: "Funktionen",
    SOURCE_QUERY: "Quelle",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery gegen die geladene Quelle (fontoxpath)",
    SOURCE_NODE_TOOLTIP:
      "XPath/XQuery-Teilbaum der geladenen JSON- oder XML-Quelle (fontoxpath). Als Handlebars-Kontext verwenden.",
    TEXT_CODE: "Text",
    TEXT_CODE_TOOLTIP:
      "Mehrzeiliger Text mit Syntaxhervorhebung. Editor ist skalierbar; Sprache für Highlighting wählen.",
    TEXT_HANDLEBARS: "Handlebars",
    TEXT_HANDLEBARS_WITH: "mit",
    TEXT_HANDLEBARS_TOOLTIP:
      "Handlebars-Skript gegen eine Map oder einen Quellen-Teilbaum ausführen.",
    FOR_EACH_SOURCE_PREFIX: "für jedes",
    FOR_EACH_SOURCE_IN: "in",
    FOR_EACH_SOURCE_NODES: "Quellenknoten",
    FOR_EACH_SOURCE_DO: "mache",
    FOR_EACH_SOURCE_TOOLTIP:
      "Schleife über jeden Knoten eines Quellpfads. Der aktuelle Knoten wird in der genannten Variable gespeichert.",
    LANGUAGE_LABEL: "Sprache",
    UI_LANGUAGE_LABEL: "UI",
    MODEL_LANGUAGE_LABEL: "Modell",
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
    CAT_MAPS: "Mapas",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Funciones",
    SOURCE_QUERY: "origen",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery sobre el origen cargado (fontoxpath)",
    SOURCE_NODE_TOOLTIP:
      "Subárbol XPath/XQuery del origen JSON o XML cargado (fontoxpath). Úselo como contexto Handlebars.",
    TEXT_CODE: "texto",
    TEXT_CODE_TOOLTIP:
      "Texto multilínea con resaltado de sintaxis. El editor es redimensionable; elija el lenguaje.",
    TEXT_HANDLEBARS: "handlebars",
    TEXT_HANDLEBARS_WITH: "con",
    TEXT_HANDLEBARS_TOOLTIP:
      "Renderiza un script Handlebars contra un Map o un subárbol de origen.",
    FOR_EACH_SOURCE_PREFIX: "para cada",
    FOR_EACH_SOURCE_IN: "en",
    FOR_EACH_SOURCE_NODES: "nodos de origen",
    FOR_EACH_SOURCE_DO: "hacer",
    FOR_EACH_SOURCE_TOOLTIP:
      "Recorre cada nodo coincidente con una ruta de origen. El nodo actual se guarda en la variable indicada.",
    LANGUAGE_LABEL: "Idioma",
    UI_LANGUAGE_LABEL: "IU",
    MODEL_LANGUAGE_LABEL: "Modelo",
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
    CAT_MAPS: "Mapes",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Funcions",
    SOURCE_QUERY: "origen",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery sobre l'origen carregat (fontoxpath)",
    SOURCE_NODE_TOOLTIP:
      "Subarbre XPath/XQuery de l'origen JSON o XML carregat (fontoxpath). Useu-lo com a context Handlebars.",
    TEXT_CODE: "text",
    TEXT_CODE_TOOLTIP:
      "Text multilínia amb ressaltat de sintaxi. L'editor és redimensionable; trieu el llenguatge.",
    TEXT_HANDLEBARS: "handlebars",
    TEXT_HANDLEBARS_WITH: "amb",
    TEXT_HANDLEBARS_TOOLTIP:
      "Renderitza un script Handlebars contra un Map o un subarbre d'origen.",
    FOR_EACH_SOURCE_PREFIX: "per a cada",
    FOR_EACH_SOURCE_IN: "a",
    FOR_EACH_SOURCE_NODES: "nodes d'origen",
    FOR_EACH_SOURCE_DO: "fes",
    FOR_EACH_SOURCE_TOOLTIP:
      "Recorre cada node que coincideix amb un camí d'origen. El node actual es desa a la variable indicada.",
    LANGUAGE_LABEL: "Idioma",
    UI_LANGUAGE_LABEL: "IU",
    MODEL_LANGUAGE_LABEL: "Model",
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
    CAT_MAPS: "Maps",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Fonctions",
    SOURCE_QUERY: "source",
    SOURCE_QUERY_TOOLTIP: "XPath/XQuery sur la source chargée (fontoxpath)",
    SOURCE_NODE_TOOLTIP:
      "Sous-arbre XPath/XQuery de la source JSON ou XML chargée (fontoxpath). À utiliser comme contexte Handlebars.",
    TEXT_CODE: "texte",
    TEXT_CODE_TOOLTIP:
      "Texte multiligne avec coloration syntaxique. L'éditeur est redimensionnable ; choisissez le langage.",
    TEXT_HANDLEBARS: "handlebars",
    TEXT_HANDLEBARS_WITH: "avec",
    TEXT_HANDLEBARS_TOOLTIP:
      "Rend un script Handlebars contre une Map ou un sous-arbre source.",
    FOR_EACH_SOURCE_PREFIX: "pour chaque",
    FOR_EACH_SOURCE_IN: "dans",
    FOR_EACH_SOURCE_NODES: "nœuds source",
    FOR_EACH_SOURCE_DO: "faire",
    FOR_EACH_SOURCE_TOOLTIP:
      "Boucle sur chaque nœud correspondant à un chemin source. Le nœud courant est stocké dans la variable nommée.",
    LANGUAGE_LABEL: "Langue",
    UI_LANGUAGE_LABEL: "IU",
    MODEL_LANGUAGE_LABEL: "Modèle",
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
