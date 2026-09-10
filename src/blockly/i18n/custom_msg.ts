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
  CAT_SEARCH: string;
  CAT_SOURCE: string;
  CAT_OPENEHR_TYPES: string;
  CAT_OPENEHR_ENTRIES: string;
  CAT_OPENEHR_ITEMS: string;
  CAT_OPENEHR_PARTY: string;
  CAT_OPENEHR_DV: string;
  CAT_OPENEHR_TERMS: string;
  CAT_JSON: string;
  CAT_XML: string;
  CAT_TARGET_SCHEMA: string;
  CAT_LOGIC: string;
  CAT_LOOPS: string;
  CAT_MATH: string;
  CAT_TEXT: string;
  CAT_LISTS_AND_MAPS: string;
  CAT_SHEETS: string;
  CAT_VARIABLES: string;
  CAT_PROCEDURES: string;
  EXTRACT_TO_FUNCTION: string;
  SOURCE_QUERY: string;
  SOURCE_QUERY_TOOLTIP: string;
  SOURCE_NODE_TOOLTIP: string;
  TEXT_CODE: string;
  TEXT_CODE_TOOLTIP: string;
  TEXT_HANDLEBARS: string;
  TEXT_HANDLEBARS_WITH: string;
  TEXT_HANDLEBARS_TOOLTIP: string;
  CONVERSION_START: string;
  CONVERSION_START_TOOLTIP: string;
  TEXT_DOCUMENT: string;
  TEXT_DOCUMENT_TOOLTIP: string;
  FOR_EACH_SOURCE_PREFIX: string;
  FOR_EACH_SOURCE_IN: string;
  FOR_EACH_SOURCE_NODES: string;
  FOR_EACH_SOURCE_DO: string;
  FOR_EACH_SOURCE_TOOLTIP: string;
  FOR_EACH_LIST_TOOLTIP: string;
  LOGIC_ALL: string;
  LOGIC_ANY: string;
  LOGIC_NONE: string;
  LOGIC_AT_LEAST: string;
  LOGIC_AT_MOST: string;
  LOGIC_EXACTLY: string;
  LOGIC_OF: string;
  LOGIC_MATCH: string;
  LOGIC_REQUIRE_ITEMS: string;
  LOGIC_ITEM_NAME: string;
  LOGIC_NAME_ITEM: string;
  LOGIC_HIDE_ITEM_NAME: string;
  LOGIC_THIS_ITEM: string;
  LOGIC_RESTRICTION_TOOLTIP: string;
  LOGIC_CURRENT_ITEM_TOOLTIP: string;
  LOGIC_SET_BOTH: string;
  LOGIC_SET_EITHER: string;
  LOGIC_SET_NOT_IN: string;
  LOGIC_SET_CONN_AND: string;
  LOGIC_SET_CONN_OR: string;
  LOGIC_SET_CONN_NOT_IN: string;
  LOGIC_SET_TOOLTIP: string;
  LANGUAGE_LABEL: string;
  UI_LANGUAGE_LABEL: string;
  MODEL_LANGUAGE_LABEL: string;
}

const TABLE: Record<IntehrLocale, IntehrMessages> = {
  en: {
    CAT_SEARCH: "Search",
    CAT_SOURCE: "Source",
    CAT_OPENEHR_TYPES: "openEHR",
    CAT_OPENEHR_ENTRIES: "Compositions & entries",
    CAT_OPENEHR_ITEMS: "Items & events",
    CAT_OPENEHR_PARTY: "Party",
    CAT_OPENEHR_DV: "Data values",
    CAT_OPENEHR_TERMS: "Terminology",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Target schema",
    CAT_LOGIC: "Logic",
    CAT_LOOPS: "Loops",
    CAT_MATH: "Math",
    CAT_TEXT: "Text",
    CAT_LISTS_AND_MAPS: "Lists & maps",
    CAT_SHEETS: "Sheets",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Functions",
    EXTRACT_TO_FUNCTION: "Extract to function",
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
    CONVERSION_START: "Conversion start",
    CONVERSION_START_TOOLTIP:
      "Designates the conversion product. Snap onto one Instance root. Not a script trigger.",
    TEXT_DOCUMENT: "Text document",
    TEXT_DOCUMENT_TOOLTIP:
      "Schema-less text Instance root. The product is the String value (code, Handlebars, or a source query).",
    FOR_EACH_SOURCE_PREFIX: "for each",
    FOR_EACH_SOURCE_IN: "in",
    FOR_EACH_SOURCE_NODES: "source nodes",
    FOR_EACH_SOURCE_DO: "do",
    FOR_EACH_SOURCE_TOOLTIP:
      "Loop over every node matched by a source path. Current node is stored in the named variable.",
    FOR_EACH_LIST_TOOLTIP:
      "Loop over every item in a list (or map keys / sheet rows). Current item is stored in the named variable. No break or continue.",
    LOGIC_ALL: "all",
    LOGIC_ANY: "any",
    LOGIC_NONE: "none",
    LOGIC_AT_LEAST: "at least",
    LOGIC_AT_MOST: "at most",
    LOGIC_EXACTLY: "exactly",
    LOGIC_OF: "of",
    LOGIC_MATCH: "match",
    LOGIC_REQUIRE_ITEMS: "require at least one item",
    LOGIC_ITEM_NAME: "each item is called",
    LOGIC_NAME_ITEM: "Name the current item",
    LOGIC_HIDE_ITEM_NAME: "Hide the item name",
    LOGIC_THIS_ITEM: "this item",
    LOGIC_RESTRICTION_TOOLTIP:
      "True when the required number of list items match the condition. Source paths in the condition are relative to each item. An empty list makes all, none and at most true — tick require at least one item to rule that out. (OWL Manchester only/some/none and min/max/exactly.)",
    LOGIC_CURRENT_ITEM_TOOLTIP:
      "The list item the surrounding restriction is testing right now.",
    LOGIC_SET_BOTH: "items in both",
    LOGIC_SET_EITHER: "items in either",
    LOGIC_SET_NOT_IN: "items in",
    LOGIC_SET_CONN_AND: "and",
    LOGIC_SET_CONN_OR: "or",
    LOGIC_SET_CONN_NOT_IN: "but not in",
    LOGIC_SET_TOOLTIP:
      "Combine two lists: items in both (intersection), items in either (union), or items in the first but not the second (difference).",
    LANGUAGE_LABEL: "Language",
    UI_LANGUAGE_LABEL: "UI",
    MODEL_LANGUAGE_LABEL: "Model",
  },
  sv: {
    CAT_SEARCH: "Sök",
    CAT_SOURCE: "Källa",
    CAT_OPENEHR_TYPES: "openEHR",
    CAT_OPENEHR_ENTRIES: "Compositions & entries",
    CAT_OPENEHR_ITEMS: "Items & events",
    CAT_OPENEHR_PARTY: "Party",
    CAT_OPENEHR_DV: "Data values",
    CAT_OPENEHR_TERMS: "Terminology",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Målschema",
    CAT_LOGIC: "Logik",
    CAT_LOOPS: "Loopar",
    CAT_MATH: "Matematik",
    CAT_TEXT: "Text",
    CAT_LISTS_AND_MAPS: "Listor & mappar",
    CAT_SHEETS: "Kalkylblad",
    CAT_VARIABLES: "Variabler",
    CAT_PROCEDURES: "Funktioner",
    EXTRACT_TO_FUNCTION: "Bryt ut till funktion",
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
    CONVERSION_START: "Konverteringsstart",
    CONVERSION_START_TOOLTIP:
      "Markerar konverteringsprodukten. Kopplas på en Instansrot. Inte en skriptstart.",
    TEXT_DOCUMENT: "Textdokument",
    TEXT_DOCUMENT_TOOLTIP:
      "Schemalös text-Instansrot. Produkten är strängvärdet (kod, Handlebars eller en källfråga).",
    FOR_EACH_SOURCE_PREFIX: "för varje",
    FOR_EACH_SOURCE_IN: "i",
    FOR_EACH_SOURCE_NODES: "källnoder",
    FOR_EACH_SOURCE_DO: "gör",
    FOR_EACH_SOURCE_TOOLTIP:
      "Loopa över varje nod som matchas av en källsökväg. Aktuell nod lagras i den namngivna variabeln.",
    FOR_EACH_LIST_TOOLTIP:
      "Loopa över varje objekt i en lista (eller mapnycklar / kalkylbladsrader). Aktuellt objekt lagras i den namngivna variabeln. Ingen break eller continue.",
    LOGIC_ALL: "alla",
    LOGIC_ANY: "något",
    LOGIC_NONE: "inget",
    LOGIC_AT_LEAST: "minst",
    LOGIC_AT_MOST: "högst",
    LOGIC_EXACTLY: "exakt",
    LOGIC_OF: "av",
    LOGIC_MATCH: "matchar",
    LOGIC_REQUIRE_ITEMS: "kräv minst ett objekt",
    LOGIC_ITEM_NAME: "varje objekt kallas",
    LOGIC_NAME_ITEM: "Namnge aktuellt objekt",
    LOGIC_HIDE_ITEM_NAME: "Dölj objektnamnet",
    LOGIC_THIS_ITEM: "detta objekt",
    LOGIC_RESTRICTION_TOOLTIP:
      "Sant när det begärda antalet listobjekt matchar villkoret. Källsökvägar i villkoret är relativa till varje objekt. Tom lista gör alla, inget och högst sanna — kryssa kräv minst ett objekt för att utesluta det. (OWL Manchester only/some/none och min/max/exactly.)",
    LOGIC_CURRENT_ITEM_TOOLTIP:
      "Det listobjekt som den omgivande restriktionen just nu prövar.",
    LOGIC_SET_BOTH: "objekt i båda",
    LOGIC_SET_EITHER: "objekt i någon av",
    LOGIC_SET_NOT_IN: "objekt i",
    LOGIC_SET_CONN_AND: "och",
    LOGIC_SET_CONN_OR: "eller",
    LOGIC_SET_CONN_NOT_IN: "men inte i",
    LOGIC_SET_TOOLTIP:
      "Kombinera två listor: objekt i båda (snitt), objekt i någon av (union), eller objekt i den första men inte i den andra (differens).",
    LANGUAGE_LABEL: "Språk",
    UI_LANGUAGE_LABEL: "UI",
    MODEL_LANGUAGE_LABEL: "Modell",
  },
  de: {
    CAT_SEARCH: "Suche",
    CAT_SOURCE: "Quelle",
    CAT_OPENEHR_TYPES: "openEHR",
    CAT_OPENEHR_ENTRIES: "Compositions & entries",
    CAT_OPENEHR_ITEMS: "Items & events",
    CAT_OPENEHR_PARTY: "Party",
    CAT_OPENEHR_DV: "Data values",
    CAT_OPENEHR_TERMS: "Terminology",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Zielschema",
    CAT_LOGIC: "Logik",
    CAT_LOOPS: "Schleifen",
    CAT_MATH: "Mathematik",
    CAT_TEXT: "Text",
    CAT_LISTS_AND_MAPS: "Listen & Maps",
    CAT_SHEETS: "Tabellen",
    CAT_VARIABLES: "Variablen",
    CAT_PROCEDURES: "Funktionen",
    EXTRACT_TO_FUNCTION: "In Funktion auslagern",
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
    CONVERSION_START: "Conversion start",
    CONVERSION_START_TOOLTIP:
      "Designates the conversion product. Snap onto one Instance root. Not a script trigger.",
    TEXT_DOCUMENT: "Text document",
    TEXT_DOCUMENT_TOOLTIP:
      "Schema-less text Instance root. The product is the String value (code, Handlebars, or a source query).",
    FOR_EACH_SOURCE_PREFIX: "für jedes",
    FOR_EACH_SOURCE_IN: "in",
    FOR_EACH_SOURCE_NODES: "Quellenknoten",
    FOR_EACH_SOURCE_DO: "mache",
    FOR_EACH_SOURCE_TOOLTIP:
      "Schleife über jeden Knoten eines Quellpfads. Der aktuelle Knoten wird in der genannten Variable gespeichert.",
    FOR_EACH_LIST_TOOLTIP:
      "Schleife über jedes Element einer Liste (oder Map-Schlüssel / Tabellenzeilen). Das aktuelle Element wird in der genannten Variable gespeichert. Kein break oder continue.",
    LOGIC_ALL: "alle",
    LOGIC_ANY: "mindestens eines",
    LOGIC_NONE: "keines",
    LOGIC_AT_LEAST: "mindestens",
    LOGIC_AT_MOST: "höchstens",
    LOGIC_EXACTLY: "genau",
    LOGIC_OF: "von",
    LOGIC_MATCH: "erfüllen",
    LOGIC_REQUIRE_ITEMS: "mindestens ein Element verlangen",
    LOGIC_ITEM_NAME: "jedes Element heißt",
    LOGIC_NAME_ITEM: "Aktuelles Element benennen",
    LOGIC_HIDE_ITEM_NAME: "Elementnamen ausblenden",
    LOGIC_THIS_ITEM: "dieses Element",
    LOGIC_RESTRICTION_TOOLTIP:
      "Wahr, wenn die verlangte Anzahl der Listenelemente die Bedingung erfüllt. Quellpfade in der Bedingung sind relativ zu jedem Element. Leere Liste: alle, keines und höchstens sind wahr — mindestens ein Element verlangen schließt das aus. (OWL Manchester only/some/none und min/max/exactly.)",
    LOGIC_CURRENT_ITEM_TOOLTIP:
      "Das Listenelement, das die umgebende Restriktion gerade prüft.",
    LOGIC_SET_BOTH: "Elemente in beiden",
    LOGIC_SET_EITHER: "Elemente in einer von",
    LOGIC_SET_NOT_IN: "Elemente in",
    LOGIC_SET_CONN_AND: "und",
    LOGIC_SET_CONN_OR: "oder",
    LOGIC_SET_CONN_NOT_IN: "aber nicht in",
    LOGIC_SET_TOOLTIP:
      "Zwei Listen kombinieren: Elemente in beiden (Schnitt), in einer von beiden (Vereinigung) oder in der ersten, aber nicht in der zweiten (Differenz).",
    LANGUAGE_LABEL: "Sprache",
    UI_LANGUAGE_LABEL: "UI",
    MODEL_LANGUAGE_LABEL: "Modell",
  },
  es: {
    CAT_SEARCH: "Buscar",
    CAT_SOURCE: "Origen",
    CAT_OPENEHR_TYPES: "openEHR",
    CAT_OPENEHR_ENTRIES: "Compositions & entries",
    CAT_OPENEHR_ITEMS: "Items & events",
    CAT_OPENEHR_PARTY: "Party",
    CAT_OPENEHR_DV: "Data values",
    CAT_OPENEHR_TERMS: "Terminology",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Esquema destino",
    CAT_LOGIC: "Lógica",
    CAT_LOOPS: "Bucles",
    CAT_MATH: "Matemáticas",
    CAT_TEXT: "Texto",
    CAT_LISTS_AND_MAPS: "Listas y mapas",
    CAT_SHEETS: "Hojas",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Funciones",
    EXTRACT_TO_FUNCTION: "Extraer a función",
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
    CONVERSION_START: "Conversion start",
    CONVERSION_START_TOOLTIP:
      "Designates the conversion product. Snap onto one Instance root. Not a script trigger.",
    TEXT_DOCUMENT: "Text document",
    TEXT_DOCUMENT_TOOLTIP:
      "Schema-less text Instance root. The product is the String value (code, Handlebars, or a source query).",
    FOR_EACH_SOURCE_PREFIX: "para cada",
    FOR_EACH_SOURCE_IN: "en",
    FOR_EACH_SOURCE_NODES: "nodos de origen",
    FOR_EACH_SOURCE_DO: "hacer",
    FOR_EACH_SOURCE_TOOLTIP:
      "Recorre cada nodo coincidente con una ruta de origen. El nodo actual se guarda en la variable indicada.",
    FOR_EACH_LIST_TOOLTIP:
      "Recorre cada elemento de una lista (o claves de mapa / filas de hoja). El elemento actual se guarda en la variable indicada. Sin break ni continue.",
    LOGIC_ALL: "todos",
    LOGIC_ANY: "alguno",
    LOGIC_NONE: "ninguno",
    LOGIC_AT_LEAST: "al menos",
    LOGIC_AT_MOST: "como máximo",
    LOGIC_EXACTLY: "exactamente",
    LOGIC_OF: "de",
    LOGIC_MATCH: "cumplen",
    LOGIC_REQUIRE_ITEMS: "exigir al menos un elemento",
    LOGIC_ITEM_NAME: "cada elemento se llama",
    LOGIC_NAME_ITEM: "Nombrar el elemento actual",
    LOGIC_HIDE_ITEM_NAME: "Ocultar el nombre del elemento",
    LOGIC_THIS_ITEM: "este elemento",
    LOGIC_RESTRICTION_TOOLTIP:
      "Verdadero cuando el número requerido de elementos de la lista cumple la condición. Las rutas de origen de la condición son relativas a cada elemento. Lista vacía: todos, ninguno y como máximo son verdaderos — marque exigir al menos un elemento para descartarlo. (OWL Manchester only/some/none y min/max/exactly.)",
    LOGIC_CURRENT_ITEM_TOOLTIP:
      "El elemento de la lista que la restricción circundante está evaluando.",
    LOGIC_SET_BOTH: "elementos en ambas",
    LOGIC_SET_EITHER: "elementos en alguna de",
    LOGIC_SET_NOT_IN: "elementos en",
    LOGIC_SET_CONN_AND: "y",
    LOGIC_SET_CONN_OR: "o",
    LOGIC_SET_CONN_NOT_IN: "pero no en",
    LOGIC_SET_TOOLTIP:
      "Combina dos listas: elementos en ambas (intersección), en alguna de las dos (unión) o en la primera pero no en la segunda (diferencia).",
    LANGUAGE_LABEL: "Idioma",
    UI_LANGUAGE_LABEL: "IU",
    MODEL_LANGUAGE_LABEL: "Modelo",
  },
  ca: {
    CAT_SEARCH: "Cerca",
    CAT_SOURCE: "Origen",
    CAT_OPENEHR_TYPES: "openEHR",
    CAT_OPENEHR_ENTRIES: "Compositions & entries",
    CAT_OPENEHR_ITEMS: "Items & events",
    CAT_OPENEHR_PARTY: "Party",
    CAT_OPENEHR_DV: "Data values",
    CAT_OPENEHR_TERMS: "Terminology",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Esquema de destinació",
    CAT_LOGIC: "Lògica",
    CAT_LOOPS: "Bucles",
    CAT_MATH: "Matemàtiques",
    CAT_TEXT: "Text",
    CAT_LISTS_AND_MAPS: "Llistes i mapes",
    CAT_SHEETS: "Fulls",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Funcions",
    EXTRACT_TO_FUNCTION: "Extreure a funció",
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
    CONVERSION_START: "Conversion start",
    CONVERSION_START_TOOLTIP:
      "Designates the conversion product. Snap onto one Instance root. Not a script trigger.",
    TEXT_DOCUMENT: "Text document",
    TEXT_DOCUMENT_TOOLTIP:
      "Schema-less text Instance root. The product is the String value (code, Handlebars, or a source query).",
    FOR_EACH_SOURCE_PREFIX: "per a cada",
    FOR_EACH_SOURCE_IN: "a",
    FOR_EACH_SOURCE_NODES: "nodes d'origen",
    FOR_EACH_SOURCE_DO: "fes",
    FOR_EACH_SOURCE_TOOLTIP:
      "Recorre cada node que coincideix amb un camí d'origen. El node actual es desa a la variable indicada.",
    FOR_EACH_LIST_TOOLTIP:
      "Recorre cada element d'una llista (o claus de mapa / files de full). L'element actual es desa a la variable indicada. Sense break ni continue.",
    LOGIC_ALL: "tots",
    LOGIC_ANY: "algun",
    LOGIC_NONE: "cap",
    LOGIC_AT_LEAST: "com a mínim",
    LOGIC_AT_MOST: "com a màxim",
    LOGIC_EXACTLY: "exactament",
    LOGIC_OF: "de",
    LOGIC_MATCH: "compleixen",
    LOGIC_REQUIRE_ITEMS: "exigeix com a mínim un element",
    LOGIC_ITEM_NAME: "cada element s'anomena",
    LOGIC_NAME_ITEM: "Anomena l'element actual",
    LOGIC_HIDE_ITEM_NAME: "Amaga el nom de l'element",
    LOGIC_THIS_ITEM: "aquest element",
    LOGIC_RESTRICTION_TOOLTIP:
      "Cert quan el nombre requerit d'elements de la llista compleix la condició. Els camins d'origen de la condició són relatius a cada element. Llista buida: tots, cap i com a màxim són certs — marqueu exigeix com a mínim un element per descartar-ho. (OWL Manchester only/some/none i min/max/exactly.)",
    LOGIC_CURRENT_ITEM_TOOLTIP:
      "L'element de la llista que la restricció circumdant està avaluant.",
    LOGIC_SET_BOTH: "elements en totes dues",
    LOGIC_SET_EITHER: "elements en alguna de",
    LOGIC_SET_NOT_IN: "elements en",
    LOGIC_SET_CONN_AND: "i",
    LOGIC_SET_CONN_OR: "o",
    LOGIC_SET_CONN_NOT_IN: "però no en",
    LOGIC_SET_TOOLTIP:
      "Combina dues llistes: elements en totes dues (intersecció), en alguna de les dues (unió) o en la primera però no en la segona (diferència).",
    LANGUAGE_LABEL: "Idioma",
    UI_LANGUAGE_LABEL: "IU",
    MODEL_LANGUAGE_LABEL: "Model",
  },
  fr: {
    CAT_SEARCH: "Rechercher",
    CAT_SOURCE: "Source",
    CAT_OPENEHR_TYPES: "openEHR",
    CAT_OPENEHR_ENTRIES: "Compositions & entries",
    CAT_OPENEHR_ITEMS: "Items & events",
    CAT_OPENEHR_PARTY: "Party",
    CAT_OPENEHR_DV: "Data values",
    CAT_OPENEHR_TERMS: "Terminology",
    CAT_JSON: "JSON",
    CAT_XML: "XML",
    CAT_TARGET_SCHEMA: "Schéma cible",
    CAT_LOGIC: "Logique",
    CAT_LOOPS: "Boucles",
    CAT_MATH: "Math",
    CAT_TEXT: "Texte",
    CAT_LISTS_AND_MAPS: "Listes et maps",
    CAT_SHEETS: "Feuilles",
    CAT_VARIABLES: "Variables",
    CAT_PROCEDURES: "Fonctions",
    EXTRACT_TO_FUNCTION: "Extraire vers une fonction",
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
    CONVERSION_START: "Conversion start",
    CONVERSION_START_TOOLTIP:
      "Designates the conversion product. Snap onto one Instance root. Not a script trigger.",
    TEXT_DOCUMENT: "Text document",
    TEXT_DOCUMENT_TOOLTIP:
      "Schema-less text Instance root. The product is the String value (code, Handlebars, or a source query).",
    FOR_EACH_SOURCE_PREFIX: "pour chaque",
    FOR_EACH_SOURCE_IN: "dans",
    FOR_EACH_SOURCE_NODES: "nœuds source",
    FOR_EACH_SOURCE_DO: "faire",
    FOR_EACH_SOURCE_TOOLTIP:
      "Boucle sur chaque nœud correspondant à un chemin source. Le nœud courant est stocké dans la variable nommée.",
    FOR_EACH_LIST_TOOLTIP:
      "Boucle sur chaque élément d'une liste (ou clés de map / lignes de feuille). L'élément courant est stocké dans la variable nommée. Pas de break ni continue.",
    LOGIC_ALL: "tous",
    LOGIC_ANY: "au moins un",
    LOGIC_NONE: "aucun",
    LOGIC_AT_LEAST: "au moins",
    LOGIC_AT_MOST: "au plus",
    LOGIC_EXACTLY: "exactement",
    LOGIC_OF: "de",
    LOGIC_MATCH: "satisfont",
    LOGIC_REQUIRE_ITEMS: "exiger au moins un élément",
    LOGIC_ITEM_NAME: "chaque élément s'appelle",
    LOGIC_NAME_ITEM: "Nommer l'élément courant",
    LOGIC_HIDE_ITEM_NAME: "Masquer le nom de l'élément",
    LOGIC_THIS_ITEM: "cet élément",
    LOGIC_RESTRICTION_TOOLTIP:
      "Vrai lorsque le nombre requis d'éléments de la liste satisfait la condition. Les chemins source de la condition sont relatifs à chaque élément. Liste vide : tous, aucun et au plus sont vrais — cochez exiger au moins un élément pour l'exclure. (OWL Manchester only/some/none et min/max/exactly.)",
    LOGIC_CURRENT_ITEM_TOOLTIP:
      "L'élément de liste que la restriction environnante évalue actuellement.",
    LOGIC_SET_BOTH: "éléments dans les deux",
    LOGIC_SET_EITHER: "éléments dans l'une de",
    LOGIC_SET_NOT_IN: "éléments dans",
    LOGIC_SET_CONN_AND: "et",
    LOGIC_SET_CONN_OR: "ou",
    LOGIC_SET_CONN_NOT_IN: "mais pas dans",
    LOGIC_SET_TOOLTIP:
      "Combine deux listes : éléments dans les deux (intersection), dans l'une des deux (union) ou dans la première mais pas dans la seconde (différence).",
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
