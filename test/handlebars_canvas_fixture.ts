/**
 * Shared Conversion start → Text document → text_handlebars canvas used by
 * cross-mode codegen / Test Run tests (#115, #100).
 *
 * Renders `Hello {{name}}!` with context map name ← $.name so Mapping preview,
 * TypeScript, Go Template, XQuery, Java emit, and Handlebars Output mode share
 * one fixture. Source `{"name":"Ada"}` yields `Hello Ada!`.
 */
export const HANDLEBARS_GREETING_TEMPLATE = "Hello {{name}}!";
export const HANDLEBARS_GREETING_SOURCE = JSON.stringify({ name: "Ada" });
export const HANDLEBARS_GREETING_OUTPUT = "Hello Ada!";

export function handlebarsGreetingCanvas(): Record<string, unknown> {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "conversion_start",
          id: "start",
          next: {
            block: {
              type: "text_document",
              id: "doc",
              inputs: {
                VALUE: {
                  block: {
                    type: "text_handlebars",
                    id: "hbs",
                    inputs: {
                      SCRIPT: {
                        block: {
                          type: "text_code",
                          id: "script",
                          fields: {
                            LANG: "handlebars",
                            TEXT: HANDLEBARS_GREETING_TEMPLATE,
                          },
                        },
                      },
                      CONTEXT: {
                        block: {
                          type: "maps_create_with",
                          id: "ctx",
                          extraState: { itemCount: 1 },
                          fields: { KEY0: "name" },
                          inputs: {
                            VAL0: {
                              block: {
                                type: "source_query",
                                id: "q",
                                fields: {
                                  EXPRESSION: "$.name",
                                  RETURN_TYPE: "string",
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  };
}
