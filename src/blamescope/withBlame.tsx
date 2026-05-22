import { type ComponentType } from "react";

type BlameMeta = {
  file: string;
  component: string;
};

/**
 * Higher-order component that manually annotates a React component with
 * blame metadata.
 *
 * Use this for components the Babel plugin cannot auto-detect, such as
 * anonymous functions, React.forwardRef wrappers, etc.
 *
 * @example
 * const Button = withBlame(
 *   React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
 *     <button ref={ref} {...props} />
 *   )),
 *   { file: "src/components/Button.tsx", component: "Button" }
 * );
 */
export function withBlame<P extends object>(
  Component: ComponentType<P>,
  meta: BlameMeta
): ComponentType<P> {
  const metadata = JSON.stringify(meta);

  function BlameScopeWrapper(props: P) {
    return (
      <span data-blamescope={metadata} style={{ display: "contents" }}>
        <Component {...props} />
      </span>
    );
  }

  BlameScopeWrapper.displayName = `BlameScope(${meta.component})`;
  return BlameScopeWrapper as ComponentType<P>;
}
