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
		return marshalResult(false, "", "goTextTemplateExecute(template, dataJson) requires 2 arguments")
	}
	source := args[0].String()
	dataJSON := args[1].String()
	if diags := checkSource(source); len(diags) > 0 {
		return marshalResult(false, "", diags[0].Message)
	}
	output, err := render(source, dataJSON)
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

func marshalCheck(ok bool, diags []diagnostic) string {
	payload := map[string]any{"ok": ok, "diagnostics": diags}
	b, err := json.Marshal(payload)
	if err != nil {
		return `{"ok":false,"diagnostics":[{"message":"marshal failed"}]}`
	}
	return string(b)
}
