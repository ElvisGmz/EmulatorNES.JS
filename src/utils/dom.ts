export function requireElement<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  properties: Partial<HTMLElementTagNameMap[K]> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tagName), properties);
  element.append(...children);
  return element;
}
