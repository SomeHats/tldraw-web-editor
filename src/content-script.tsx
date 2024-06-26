import css from "tldraw/tldraw.css?raw";
import extraCss from "./extra.css?raw";
import { createRoot } from "react-dom/client";
import {
  Tldraw,
  TLBaseShape,
  BaseBoxShapeUtil,
  createShapeId,
  TLShapeId,
  Box,
  TLEventInfo,
} from "tldraw";
import { getAssetUrlsByImport } from "@tldraw/assets/imports.vite";
import { useState } from "react";

const assetUrls = getAssetUrlsByImport();
const tree = buildDomTree();

const container = document.createElement("div");
container.style.all = "initial";
container.style.position = "fixed";
container.style.inset = "0";
container.style.zIndex = "9999999";
document.body.appendChild(container);

document.body.style.overflow = "hidden";

const shadowRoot = container.attachShadow({ mode: "open" });

const root = createRoot(shadowRoot);
root.render(
  <>
    <style>{`${css}\n\n${extraCss}`}</style>
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9999999,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu, roboto, noto, arial, sans-serif",
      }}
    >
      <App tree={tree} />
    </div>
  </>
);

type Tree = {
  elementById: Map<TLShapeId, HTMLElement>;
  idByElement: Map<HTMLElement, TLShapeId>;
  initialPositions: Map<TLShapeId, Box>;
  allElements: {
    element: HTMLElement;
    parentId: TLShapeId | null;
  }[];
};

function buildDomTree() {
  const tree: Tree = {
    elementById: new Map(),
    idByElement: new Map(),
    initialPositions: new Map(),
    allElements: [],
  };

  function addToTree(element: HTMLElement, parent: HTMLElement | null) {
    const id = createShapeId();
    tree.elementById.set(id, element);
    tree.idByElement.set(element, id);

    const rect = element.getBoundingClientRect();
    const parentRect = parent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const position = new Box(
      rect.left - parentRect.left,
      rect.top - parentRect.top,
      rect.width,
      rect.height
    );

    tree.initialPositions.set(id, position);

    const parentId = parent ? assertExists(tree.idByElement.get(parent)) : null;
    tree.allElements.push({ element, parentId });
  }

  function visit(node: HTMLElement, parent: HTMLElement | null = null) {
    const hasText = !!node.textContent?.trim();

    const rect = node.getBoundingClientRect();
    const isGoodSize =
      rect.width > 10 &&
      rect.height > 10 &&
      rect.width < document.body.clientWidth &&
      rect.height < document.body.clientHeight;

    if (!hasText && isGoodSize) {
      addToTree(node, parent);
      return;
    }

    const children = Array.from(node.childNodes);
    const hasOwnText = children.some((child) => {
      if (child instanceof Text) {
        const text = child.textContent?.trim();
        return !!text;
      }
      return false;
    });

    const computedStyle = getComputedStyle(node);
    const hasVisibleStyle =
      computedStyle.backgroundColor !== "transparent" ||
      computedStyle.border !== "none" ||
      computedStyle.boxShadow !== "none" ||
      computedStyle.outline !== "none" ||
      computedStyle.backgroundImage !== "none";
    const isLeafy =
      node instanceof HTMLImageElement ||
      node instanceof HTMLCanvasElement ||
      node instanceof HTMLVideoElement ||
      node instanceof HTMLAudioElement ||
      node instanceof HTMLIFrameElement ||
      node instanceof HTMLObjectElement ||
      node instanceof HTMLEmbedElement ||
      node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLButtonElement ||
      node instanceof HTMLAnchorElement;

    const shouldMarkAsElement =
      isGoodSize && (hasOwnText || hasVisibleStyle || isLeafy);

    if (shouldMarkAsElement) {
      addToTree(node, parent);
    }

    if (isLeafy) return;

    for (const child of children) {
      if (child instanceof HTMLElement) {
        visit(child, shouldMarkAsElement ? node : parent);
      }
    }
  }

  visit(document.body);

  return tree;
}

type ElementShape = TLBaseShape<
  "element",
  {
    w: number;
    h: number;
  }
>;

class ElementShapeUtil extends BaseBoxShapeUtil<ElementShape> {
  static type = "element";

  getDefaultProps(): { w: number; h: number } {
    return { w: 100, h: 100 };
  }
  component(shape: ElementShape) {
    return null;
    return (
      <div
        style={{
          width: shape.props.w,
          height: shape.props.h,
          border: "1px solid cyan",
        }}
      >
        {shape.id}
      </div>
    );
  }
  indicator(shape: ElementShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />;
  }
}

function App({ tree }: { tree: Tree }) {
  const [isMounted, setIsMounted] = useState(true);

  if (!isMounted) {
    return null;
  }

  return (
    <Tldraw
      assetUrls={assetUrls}
      components={{
        PageMenu: null,
        DebugMenu: null,
        //   Toolbar: null,
        NavigationPanel: null,
        HelpMenu: null,
        Toolbar: null,
      }}
      autoFocus={true}
      forceMobile={true}
      shapeUtils={[ElementShapeUtil]}
      cameraOptions={{ isLocked: true }}
      // hideUi={true}
      onMount={(editor) => {
        console.log(tree);
        tree.allElements.forEach(({ element, parentId }) => {
          const id = assertExists(tree.idByElement.get(element));

          const box = assertExists(tree.initialPositions.get(id));

          editor.createShape<ElementShape>({
            type: "element",
            id: id,
            x: box.x,
            y: box.y,
            parentId: parentId ?? editor.getCurrentPageId(),
            props: {
              w: box.width,
              h: box.height,
            },
          });
        });

        const dispose = editor.sideEffects.registerAfterChangeHandler(
          "shape",
          (_, shape) => {
            if (!editor.isShapeOfType<ElementShape>(shape, "element")) return;

            const element = assertExists(tree.elementById.get(shape.id));
            const initialBox = assertExists(
              tree.initialPositions.get(shape.id)
            );

            const x = shape.x - initialBox.x;
            const y = shape.y - initialBox.y;
            element.style.transformOrigin = "top left";
            element.style.transform = `translate(${x}px, ${y}px) rotate(${shape.rotation}rad)`;
            element.style.width = `${shape.props.w}px`;
            element.style.height = `${shape.props.h}px`;
          }
        );

        const dispose2 = editor.sideEffects.registerAfterDeleteHandler(
          "shape",
          (shape) => {
            if (!editor.isShapeOfType<ElementShape>(shape, "element")) return;

            const element = assertExists(tree.elementById.get(shape.id));
            element.style.opacity = "0";
          }
        );

        // const onEvent = (event: TLEventInfo) => {
        //   if (
        //     event.type === "keyboard" &&
        //     event.name === "key_down" &&
        //     event.key === "Escape"
        //   ) {
        //     setIsMounted(false);
        //   }
        // };
        // editor.on("event", onEvent);

        window.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            // setIsMounted(false);
            container.remove();
          }
        });

        return () => {
          dispose();
          // editor.off("event", onEvent);
        };
      }}
    />
  );
}

function assertExists<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Value does not exist");
  }
  return value;
}
