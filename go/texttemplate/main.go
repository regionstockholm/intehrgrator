// Go text/template executor compiled to WASM (GOOS=js GOARCH=wasm).
//
// JS API after wasm_exec.js + instantiate:
//   goTextTemplateExecute(templateSource: string, dataJson: string) → JSON string
//   { ok: boolean, output?: string, error?: string }
//   goTextTemplateCheck(templateSource: string) → JSON string
//   { ok: boolean, diagnostics?: [{ message: string }] }
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
	"text/template/parse"
)

func main() {
	js.Global().Set("goTextTemplateExecute", js.FuncOf(execute))
	js.Global().Set("goTextTemplateCheck", js.FuncOf(check))
	js.Global().Set("goTextTemplateReady", js.ValueOf(true))
	select {}
}

func execute(_ js.Value, args []js.Value) any {
	if len(args) < 2 {
		return marshalResult(false, "", "goTextTemplateExecute(template, dataJson[, sheetsJson]) requires 2 arguments")
	}
	source := args[0].String()
	dataJSON := args[1].String()
	sheetsJSON := "{}"
	if len(args) >= 3 && args[2].Type() == js.TypeString && args[2].String() != "" {
		sheetsJSON = args[2].String()
	}
	if diags := checkSource(source); len(diags) > 0 {
		return marshalResult(false, "", diags[0].Message)
	}
	output, err := render(source, dataJSON, sheetsJSON)
	if err != nil {
		return marshalResult(false, "", err.Error())
	}
	return marshalResult(true, output, "")
}

func check(_ js.Value, args []js.Value) any {
	if len(args) < 1 {
		return marshalCheck(false, []diagnostic{{Message: "goTextTemplateCheck(template) requires 1 argument"}})
	}
	diags := checkSource(args[0].String())
	return marshalCheck(len(diags) == 0, diags)
}

type diagnostic struct {
	Message string `json:"message"`
}

func checkSource(source string) []diagnostic {
	var diags []diagnostic
	if reBlockAction.MatchString(source) {
		diags = append(diags, diagnostic{
			Message: "VMS-Go forbids {{block}} (unverified / not in declarative export)",
		})
	}
	trees, err := parse.Parse("mapping", source, "{{", "}}", parseFuncMaps()...)
	if err != nil {
		return append(diags, diagnostic{Message: fmt.Sprintf("Go template parse error: %v", err)})
	}
	calls := map[string][]string{}
	for name, tree := range trees {
		if tree == nil || tree.Root == nil {
			continue
		}
		walkNode(tree.Root, &diags, calls, name)
	}
	if cycle := findTemplateCycle(calls); cycle != "" {
		diags = append(diags, diagnostic{Message: cycle})
	}
	return diags
}

var reBlockAction = regexp.MustCompile(`\{\{[\s\-]*block\b`)

/** Func maps so identifiers parse; walk rejects forbidden ones. */
func parseFuncMaps() []map[string]any {
	allowed := map[string]any{}
	for name, fn := range funcMap() {
		allowed[name] = fn
	}
	for _, name := range []string{
		"and", "or", "not", "eq", "ne", "lt", "le", "gt", "ge", "index", "len",
	} {
		allowed[name] = true
	}
	// Include hostile builtins so they parse into IdentifierNodes we can reject.
	forbidden := map[string]any{}
	for name := range vmsGoForbiddenIdents {
		forbidden[name] = true
	}
	return []map[string]any{allowed, forbidden}
}

var vmsGoAllowedIdents = map[string]bool{
	"and": true, "or": true, "not": true,
	"eq": true, "ne": true, "lt": true, "le": true, "gt": true, "ge": true,
	"index": true, "len": true,
	"replace": true, "regexReplaceAll": true, "trim": true, "quote": true,
	"lower": true, "upper": true, "substr": true, "int": true,
	"handlebars": true, "dict": true,
	"decisionTable": true, "sheetLookup": true,
}

var vmsGoForbiddenIdents = map[string]bool{
	"call": true, "html": true, "js": true, "urlquery": true,
	"print": true, "printf": true, "println": true, "slice": true,
	"include": true, "break": true, "continue": true,
}

func walkNode(node parse.Node, diags *[]diagnostic, calls map[string][]string, tmplName string) {
	if node == nil {
		return
	}
	switch n := node.(type) {
	case *parse.ListNode:
		for _, child := range n.Nodes {
			walkNode(child, diags, calls, tmplName)
		}
	case *parse.ActionNode:
		walkPipe(n.Pipe, diags, calls, tmplName)
	case *parse.IfNode:
		walkBranch(&n.BranchNode, diags, calls, tmplName)
	case *parse.RangeNode:
		walkBranch(&n.BranchNode, diags, calls, tmplName)
	case *parse.WithNode:
		*diags = append(*diags, diagnostic{
			Message: "VMS-Go forbids {{with}} (unverified / not in declarative export)",
		})
		walkBranch(&n.BranchNode, diags, calls, tmplName)
	case *parse.TemplateNode:
		if n.Name == "" {
			*diags = append(*diags, diagnostic{
				Message: "VMS-Go requires literal template names",
			})
		} else {
			calls[tmplName] = append(calls[tmplName], n.Name)
		}
		if n.Pipe != nil {
			walkPipe(n.Pipe, diags, calls, tmplName)
		}
	case *parse.BreakNode:
		*diags = append(*diags, diagnostic{
			Message: "VMS-Go forbids {{break}} (unverified / not in declarative export)",
		})
	case *parse.ContinueNode:
		*diags = append(*diags, diagnostic{
			Message: "VMS-Go forbids {{continue}} (unverified / not in declarative export)",
		})
	}
}

func walkBranch(n *parse.BranchNode, diags *[]diagnostic, calls map[string][]string, tmplName string) {
	if n.Pipe != nil {
		walkPipe(n.Pipe, diags, calls, tmplName)
	}
	if n.List != nil {
		walkNode(n.List, diags, calls, tmplName)
	}
	if n.ElseList != nil {
		walkNode(n.ElseList, diags, calls, tmplName)
	}
}

func walkPipe(pipe *parse.PipeNode, diags *[]diagnostic, calls map[string][]string, tmplName string) {
	if pipe == nil {
		return
	}
	for _, decl := range pipe.Decl {
		if decl != nil && pipe.IsAssign {
			*diags = append(*diags, diagnostic{
				Message: "VMS-Go forbids $name = reassignment (use := once inside define)",
			})
		}
	}
	for _, cmd := range pipe.Cmds {
		if cmd == nil || len(cmd.Args) == 0 {
			continue
		}
		if id, ok := cmd.Args[0].(*parse.IdentifierNode); ok {
			name := id.Ident
			if vmsGoForbiddenIdents[name] {
				*diags = append(*diags, diagnostic{
					Message: fmt.Sprintf("VMS-Go forbids %q (unverified / not in declarative export)", name),
				})
			} else if !vmsGoAllowedIdents[name] {
				*diags = append(*diags, diagnostic{
					Message: fmt.Sprintf("VMS-Go forbids unknown function %q (unverified / not in declarative export)", name),
				})
			}
		}
		for _, arg := range cmd.Args[1:] {
			walkArg(arg, diags, calls, tmplName)
		}
	}
}

func walkArg(arg parse.Node, diags *[]diagnostic, calls map[string][]string, tmplName string) {
	switch a := arg.(type) {
	case *parse.PipeNode:
		walkPipe(a, diags, calls, tmplName)
	case *parse.CommandNode:
		for _, child := range a.Args {
			walkArg(child, diags, calls, tmplName)
		}
	}
}

func findTemplateCycle(calls map[string][]string) string {
	const (
		white = 0
		gray  = 1
		black = 2
	)
	color := map[string]int{}
	var stack []string
	var dfs func(string) string
	dfs = func(n string) string {
		color[n] = gray
		stack = append(stack, n)
		for _, m := range calls[n] {
			switch color[m] {
			case white:
				if msg := dfs(m); msg != "" {
					return msg
				}
			case gray:
				return fmt.Sprintf("VMS-Go forbids cyclic define/template graph involving %q", m)
			}
		}
		stack = stack[:len(stack)-1]
		color[n] = black
		return ""
	}
	for n := range calls {
		if color[n] == white {
			if msg := dfs(n); msg != "" {
				return msg
			}
		}
	}
	// Also start from nodes that only appear as callees.
	for _, callees := range calls {
		for _, m := range callees {
			if color[m] == white {
				if msg := dfs(m); msg != "" {
					return msg
				}
			}
		}
	}
	return ""
}

func render(source, dataJSON, sheetsJSON string) (string, error) {
	var data any
	if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
		return "", fmt.Errorf("data JSON: %w", err)
	}
	sheets := map[string]any{}
	if strings.TrimSpace(sheetsJSON) != "" && sheetsJSON != "null" {
		if err := json.Unmarshal([]byte(sheetsJSON), &sheets); err != nil {
			return "", fmt.Errorf("sheets JSON: %w", err)
		}
		if sheets == nil {
			sheets = map[string]any{}
		}
	}
	tmpl, err := template.New("mapping").Option("missingkey=zero").Funcs(funcMapWithSheets(sheets)).Parse(source)
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
	return funcMapWithSheets(nil)
}

func funcMapWithSheets(sheets map[string]any) template.FuncMap {
	return template.FuncMap{
		"replace": func(old, new, src string) string {
			return strings.ReplaceAll(src, old, new)
		},
		// Sprig/Helm: regexReplaceAll REGEX SRC REPLACEMENT (not pipeline-last).
		// Chemo PROD `cleanAndQuoteFreeTextInput` calls it this way.
		"regexReplaceAll": func(pattern, src, repl string) string {
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
		"dict": func(values ...any) map[string]any {
			m := make(map[string]any, len(values)/2)
			for i := 0; i+1 < len(values); i += 2 {
				m[fmt.Sprint(values[i])] = values[i+1]
			}
			return m
		},
		"handlebars": func(template string, context any) (string, error) {
			fn := js.Global().Get("goTextTemplateHandlebars")
			if fn.Type() != js.TypeFunction {
				return "", fmt.Errorf("VMS-Hbs handlebars() requires goTextTemplateHandlebars host callback")
			}
			if context == nil {
				context = map[string]any{}
			}
			raw, err := json.Marshal(context)
			if err != nil {
				return "", err
			}
			result := fn.Invoke(template, string(raw))
			if result.Type() != js.TypeString {
				return "", fmt.Errorf("goTextTemplateHandlebars must return a string")
			}
			return result.String(), nil
		},
		"decisionTable": func(name any, inputs any, outputCol any) (any, error) {
			return hostSheetCall("goTextTemplateDecisionTable", sheets, name, inputs, outputCol)
		},
		"sheetLookup": func(name any, matchCol any, matchVal any, returnCol any) (any, error) {
			return hostSheetCall("goTextTemplateSheetLookup", sheets, name, matchCol, matchVal, returnCol)
		},
	}
}

func hostSheetCall(fnName string, sheets map[string]any, name any, args ...any) (any, error) {
	fn := js.Global().Get(fnName)
	if fn.Type() != js.TypeFunction {
		return "", fmt.Errorf("%s host callback is not registered", fnName)
	}
	key := fmt.Sprint(name)
	var sheet any
	if sheets != nil {
		sheet = sheets[key]
	}
	sheetJSON, err := json.Marshal(sheet)
	if err != nil {
		return "", err
	}
	payload := make([]any, 0, 1+len(args))
	payload = append(payload, string(sheetJSON))
	for _, arg := range args {
		raw, marshalErr := json.Marshal(arg)
		if marshalErr != nil {
			return "", marshalErr
		}
		payload = append(payload, string(raw))
	}
	jsArgs := make([]any, len(payload))
	copy(jsArgs, payload)
	result := fn.Invoke(jsArgs...)
	return parseHostValue(result)
}

func parseHostValue(result js.Value) (any, error) {
	if result.Type() != js.TypeString {
		return nil, fmt.Errorf("sheet host callback must return a JSON string")
	}
	var payload struct {
		Ok    bool   `json:"ok"`
		Value any    `json:"value"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(result.String()), &payload); err != nil {
		return nil, err
	}
	if !payload.Ok {
		if payload.Error == "" {
			return nil, fmt.Errorf("sheet host callback failed")
		}
		return nil, fmt.Errorf("%s", payload.Error)
	}
	if payload.Value == nil {
		return "", nil
	}
	return payload.Value, nil
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

func marshalCheck(ok bool, diags []diagnostic) string {
	payload := map[string]any{"ok": ok, "diagnostics": diags}
	b, err := json.Marshal(payload)
	if err != nil {
		return `{"ok":false,"diagnostics":[{"message":"marshal failed"}]}`
	}
	return string(b)
}
