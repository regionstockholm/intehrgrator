// Go text/template executor compiled to WASM (GOOS=js GOARCH=wasm).
//
// JS API after wasm_exec.js + instantiate:
//   goTextTemplateExecute(templateSource: string, dataJson: string) → JSON string
//   { ok: boolean, output?: string, error?: string }
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"syscall/js"
	"text/template"
)

func main() {
	js.Global().Set("goTextTemplateExecute", js.FuncOf(execute))
	js.Global().Set("goTextTemplateReady", js.ValueOf(true))
	select {}
}

func execute(_ js.Value, args []js.Value) any {
	if len(args) < 2 {
		return marshalResult(false, "", "goTextTemplateExecute(template, dataJson) requires 2 arguments")
	}
	source := args[0].String()
	dataJSON := args[1].String()
	output, err := render(source, dataJSON)
	if err != nil {
		return marshalResult(false, "", err.Error())
	}
	return marshalResult(true, output, "")
}

func render(source, dataJSON string) (string, error) {
	var data any
	if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
		return "", fmt.Errorf("data JSON: %w", err)
	}
	tmpl, err := template.New("mapping").Option("missingkey=zero").Funcs(funcMap()).Parse(source)
	if err != nil {
		return "", fmt.Errorf("parse: %w", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("execute: %w", err)
	}
	return buf.String(), nil
}

func funcMap() template.FuncMap {
	return template.FuncMap{
		"replace": func(old, new, src string) string {
			return strings.ReplaceAll(src, old, new)
		},
		"regexReplaceAll": func(pattern, repl, src string) string {
			re, err := regexp.Compile(pattern)
			if err != nil {
				return src
			}
			return re.ReplaceAllString(src, repl)
		},
		"trim": strings.TrimSpace,
		"quote": func(v any) string {
			return strconv.Quote(fmt.Sprint(v))
		},
		"lower": func(v any) string {
			return strings.ToLower(fmt.Sprint(v))
		},
		"upper": func(v any) string {
			return strings.ToUpper(fmt.Sprint(v))
		},
		"substr": func(start, end int, src string) string {
			if start < 0 {
				start = 0
			}
			if start > len(src) {
				return ""
			}
			if end > len(src) {
				end = len(src)
			}
			if end < start {
				return ""
			}
			return src[start:end]
		},
		"int": toInt,
	}
}

func toInt(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	case json.Number:
		i, _ := n.Int64()
		return int(i)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(n))
		return i
	default:
		i, _ := strconv.Atoi(fmt.Sprint(v))
		return i
	}
}

func marshalResult(ok bool, output, errMsg string) string {
	payload := map[string]any{"ok": ok, "output": output}
	if errMsg != "" {
		payload["error"] = errMsg
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return `{"ok":false,"error":"marshal failed"}`
	}
	return string(b)
}
