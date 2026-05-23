import type { Plugin } from "vite";
import * as babel from "@babel/core";
import MagicString from "magic-string";
import path from "path";

type Injection = { offset: number; component: string; selfClosing: boolean };

/**
 * Internal Babel visitor — collects positions where data-blamescope should
 * be inserted. Does NOT generate code (code: false). MagicString does the
 * actual insertion so the rest of the source is untouched.
 */
function makeCollectorPlugin(injections: Injection[]) {
  return function blameScopeCollect({ types: t }: { types: any }) {
    function nameFromFunc(funcPath: any): string {
      const fn = funcPath.node;
      if (t.isFunctionDeclaration(fn) && fn.id) return fn.id.name;
      const parent = funcPath.parent;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id))
        return parent.id.name;
      return "";
    }

    function collect(openingElement: any, component: string) {
      if (!t.isJSXOpeningElement(openingElement)) return;
      if (
        openingElement.attributes.some(
          (a: any) =>
            t.isJSXAttribute(a) &&
            t.isJSXIdentifier(a.name) &&
            a.name.name === "data-blamescope"
        )
      )
        return;
      injections.push({
        offset: openingElement.end,
        component,
        selfClosing: openingElement.selfClosing,
      });
    }

    return {
      visitor: {
        ReturnStatement(nodePath: any) {
          let arg = nodePath.node.argument;
          if (!arg) return;
          if (arg.type === "ParenthesizedExpression") arg = arg.expression;
          if (!t.isJSXElement(arg)) return;

          const funcPath = nodePath.findParent(
            (p: any) =>
              p.isFunctionDeclaration() ||
              p.isArrowFunctionExpression() ||
              p.isFunctionExpression()
          );
          if (!funcPath) return;

          const name = nameFromFunc(funcPath);
          if (!name || !/^[A-Z]/.test(name)) return;
          collect(arg.openingElement, name);
        },

        ArrowFunctionExpression(nodePath: any) {
          let body = nodePath.node.body;
          if (body.type === "ParenthesizedExpression") body = body.expression;
          if (!t.isJSXElement(body)) return;

          const parent = nodePath.parent;
          if (!t.isVariableDeclarator(parent) || !t.isIdentifier(parent.id))
            return;

          const name: string = parent.id.name;
          if (!/^[A-Z]/.test(name)) return;
          collect(body.openingElement, name);
        },
      },
    };
  };
}

/**
 * Standalone Vite plugin — auto-injects `data-blamescope` onto the root JSX
 * element of every React component found in JSX/TSX files.
 *
 * Strategy: Babel runs visitors only (code: false) to collect insertion
 * offsets, then MagicString inserts the attribute at those positions.
 * The rest of the source is unchanged → no regeneration issues with OXC.
 *
 * Usage in vite.config.ts (add BEFORE react()):
 *   plugins: [blameScopePlugin(), react()]
 */
export function blameScopePlugin(root?: string): Plugin {
  const projectRoot = path.resolve(root ?? process.cwd()).replace(/\\/g, "/");

  return {
    name: "vite-plugin-blamescope",
    enforce: "pre",

    configResolved(config) {
      console.log("[blamescope] configResolved — root:", config.root);
    },

    buildStart() {
      console.log("[blamescope] plugin active — watching JSX/TSX files");
    },

    transform(code, id) {
      console.log("[blamescope] transform called:", id);
      if (!/\.[jt]sx$/.test(id)) return null;
      if (id.includes("node_modules")) return null;

      const normalizedId = id.replace(/\\/g, "/");
      const filePath = normalizedId.startsWith(projectRoot + "/")
        ? normalizedId.slice(projectRoot.length + 1)
        : normalizedId;

      // Skip the plugin's own runtime files (relative path check, not full path)
      if (filePath.startsWith("src/blamescope/")) return null;

      const syntaxPlugin: any = id.endsWith(".tsx")
        ? ["@babel/plugin-syntax-typescript", { isTSX: true }]
        : "@babel/plugin-syntax-jsx";

      const injections: Injection[] = [];

      try {
        babel.transformSync(code, {
          filename: id,
          plugins: [syntaxPlugin, makeCollectorPlugin(injections)],
          code: false, // only run visitors — skip code generation entirely
          configFile: false,
          babelrc: false,
        });
      } catch (e) {
        console.error(
          "[blamescope] parse error in",
          filePath,
          e instanceof Error ? e.message : e
        );
        return null;
      }

      if (injections.length === 0) {
        console.log(`[blamescope] 0 injections in ${filePath}`);
        return null;
      }

      // Targeted insertion — original source is preserved, only attribute added
      const s = new MagicString(code);
      for (const { offset, component, selfClosing } of injections) {
        const meta = JSON.stringify({ file: filePath, component });
        const insertAt = offset - (selfClosing ? 2 : 1);
        s.prependLeft(insertAt, ` data-blamescope={'${meta}'}`);
      }

      console.log(
        `[blamescope] ✓ ${injections.map((i) => i.component).join(", ")}  (${filePath})`
      );

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
  };
}
