/**
 * blameScopeBabelPlugin
 *
 * A Babel plugin that auto-injects `data-blamescope` attributes onto the root
 * JSX element of every React component it encounters.
 *
 * Pass the result to @vitejs/plugin-react's `babel.plugins` option:
 *
 *   react({ babel: { plugins: [blameScopeBabelPlugin()] } })
 *
 * Handles:
 *   - function Foo() { return <div /> }
 *   - const Foo = () => { return <div /> }
 *   - const Foo = () => <div />   (concise arrow body)
 *
 * Known limitations:
 *   - Fragments (<>...</>) cannot receive attributes; they are skipped.
 *   - Anonymous components (e.g. React.forwardRef inner functions) need the
 *     withBlame() HOC for manual annotation.
 */
export function blameScopeBabelPlugin(root?: string) {
  const projectRoot = (root ?? process.cwd()).replace(/\\/g, "/");

  return function blameScope({ types: t }: { types: any }) {
    function getRelativePath(filename: string): string {
      const normalized = filename.replace(/\\/g, "/");
      return normalized.startsWith(projectRoot + "/")
        ? normalized.slice(projectRoot.length + 1)
        : normalized;
    }

    function injectAttr(
      openingElement: any,
      file: string,
      component: string
    ) {
      if (!t.isJSXOpeningElement(openingElement)) return;
      // Skip if already annotated to avoid duplicates on HMR
      if (
        openingElement.attributes.some(
          (a: any) =>
            t.isJSXAttribute(a) &&
            t.isJSXIdentifier(a.name) &&
            a.name.name === "data-blamescope"
        )
      )
        return;

      openingElement.attributes.push(
        t.jsxAttribute(
          t.jsxIdentifier("data-blamescope"),
          t.stringLiteral(JSON.stringify({ file, component }))
        )
      );
    }

    return {
      visitor: {
        // Handles block-body functions/arrows:
        //   function Foo() { return <div /> }
        //   const Foo = () => { return <div /> }
        ReturnStatement(nodePath: any, state: any) {
          const arg = nodePath.node.argument;
          if (!arg || !t.isJSXElement(arg)) return;

          const funcPath = nodePath.findParent(
            (p: any) =>
              p.isFunctionDeclaration() ||
              p.isArrowFunctionExpression() ||
              p.isFunctionExpression()
          );
          if (!funcPath) return;

          const fn = funcPath.node;
          let name = "";
          if (t.isFunctionDeclaration(fn) && fn.id) {
            name = fn.id.name;
          } else {
            const parent = funcPath.parent;
            if (
              t.isVariableDeclarator(parent) &&
              t.isIdentifier(parent.id)
            ) {
              name = parent.id.name;
            }
          }
          // React components start with an uppercase letter
          if (!name || !/^[A-Z]/.test(name)) return;

          const file = getRelativePath(state.filename ?? "");
          injectAttr(arg.openingElement, file, name);
        },

        // Handles concise arrow body:
        //   const Foo = () => <div />
        ArrowFunctionExpression(nodePath: any, state: any) {
          const body = nodePath.node.body;
          if (!t.isJSXElement(body)) return;

          const parent = nodePath.parent;
          if (
            !t.isVariableDeclarator(parent) ||
            !t.isIdentifier(parent.id)
          )
            return;

          const name: string = parent.id.name;
          if (!/^[A-Z]/.test(name)) return;

          const file = getRelativePath(state.filename ?? "");
          injectAttr(body.openingElement, file, name);
        },
      },
    };
  };
}
